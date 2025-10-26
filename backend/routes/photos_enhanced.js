const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const supabase = require('../config/supabase');
const axios = require('axios');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const router = express.Router();

// Muscle group constants
const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'abs', 'obliques', 'quads', 'hamstrings', 'calves', 'glutes',
  'full_body', 'arms', 'legs'
];

/**
 * Get all photos for authenticated user, optionally filtered by muscle group
 * GET /api/photos/enhanced?muscle_group=chest
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { muscle_group } = req.query;
    
    let query = supabase
      .from('photos')
      .select('*')
      .eq('user_id', req.user.id);
    
    if (muscle_group && MUSCLE_GROUPS.includes(muscle_group)) {
      query = query.eq('muscle_group', muscle_group);
    }
    
    const { data: photos, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching photos:', error);
      return res.status(500).json({ error: 'Failed to fetch photos' });
    }

    // Group photos by muscle group for timeline view
    const photosByMuscle = photos.reduce((acc, photo) => {
      const muscle = photo.muscle_group || 'uncategorized';
      if (!acc[muscle]) {
        acc[muscle] = [];
      }
      acc[muscle].push(photo);
      return acc;
    }, {});

    res.json({ 
      photos,
      photosByMuscle,
      totalPhotos: photos.length,
      muscleGroups: Object.keys(photosByMuscle)
    });
  } catch (error) {
    console.error('Photos fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Upload a new progress photo with muscle group
 * POST /api/photos/enhanced/upload
 */
router.post('/upload', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { muscle_group, notes, weight_lbs, body_fat_percentage, measurements } = req.body;
    const file = req.file;

    // Validate input
    if (!file) {
      return res.status(400).json({ error: 'Photo file is required' });
    }

    if (!muscle_group || !MUSCLE_GROUPS.includes(muscle_group)) {
      return res.status(400).json({ 
        error: `Invalid muscle group. Must be one of: ${MUSCLE_GROUPS.join(', ')}` 
      });
    }

    // Generate unique filename
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${req.user.id}/${muscle_group}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('progress-photos')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ 
        error: 'Failed to upload photo to storage', 
        details: uploadError.message || uploadError 
      });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('progress-photos')
      .getPublicUrl(fileName);

    // Parse measurements if provided
    let parsedMeasurements = {};
    if (measurements) {
      try {
        parsedMeasurements = typeof measurements === 'string' ? 
          JSON.parse(measurements) : measurements;
      } catch (e) {
        console.error('Error parsing measurements:', e);
      }
    }

    // Save photo record to database
    const { data: photo, error: dbError } = await supabase
      .from('photos')
      .insert([
        {
          user_id: req.user.id,
          url: publicUrl,
          muscle_group,
          notes,
          weight_lbs: weight_lbs ? parseFloat(weight_lbs) : null,
          body_fat_percentage: body_fat_percentage ? parseFloat(body_fat_percentage) : null,
          measurements: parsedMeasurements,
          analysis_data: null,
          created_at: new Date().toISOString()
        }
      ])
      .select('*')
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ 
        error: 'Failed to save photo record', 
        details: dbError.message || dbError 
      });
    }

    // Auto-trigger analysis
    try {
      await analyzePhotoAndCompare(photo.id, req.user.id, muscle_group);
    } catch (analysisError) {
      console.error('Auto-analysis failed:', analysisError);
      // Don't fail the upload if analysis fails
    }

    res.status(201).json({ 
      photo,
      message: 'Photo uploaded successfully. AI analysis in progress.'
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Analyze a photo and compare with previous photos
 * POST /api/photos/enhanced/:id/analyze
 */
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get photo from database
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const analysis = await analyzePhotoAndCompare(id, req.user.id, photo.muscle_group);

    res.json({ 
      photo: analysis.photo,
      analysis: analysis.analysis,
      comparison: analysis.comparison,
      insights: analysis.insights
    });
  } catch (error) {
    console.error('Photo analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get progress insights for a muscle group
 * GET /api/photos/enhanced/insights/:muscle_group
 */
router.get('/insights/:muscle_group', authenticateToken, async (req, res) => {
  try {
    const { muscle_group } = req.params;

    if (!MUSCLE_GROUPS.includes(muscle_group)) {
      return res.status(400).json({ error: 'Invalid muscle group' });
    }

    const { data: insights, error } = await supabase
      .from('muscle_progress_insights')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('muscle_group', muscle_group)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching insights:', error);
      return res.status(500).json({ error: 'Failed to fetch insights' });
    }

    res.json({ insights });
  } catch (error) {
    console.error('Insights fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get timeline for a specific muscle group
 * GET /api/photos/enhanced/timeline/:muscle_group
 */
router.get('/timeline/:muscle_group', authenticateToken, async (req, res) => {
  try {
    const { muscle_group } = req.params;

    if (!MUSCLE_GROUPS.includes(muscle_group)) {
      return res.status(400).json({ error: 'Invalid muscle group' });
    }

    // Get all photos for this muscle group
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('muscle_group', muscle_group)
      .order('created_at', { ascending: true });

    if (photosError) {
      console.error('Error fetching timeline photos:', photosError);
      return res.status(500).json({ error: 'Failed to fetch timeline' });
    }

    // Get comparisons for this muscle group
    const { data: comparisons, error: comparisonsError } = await supabase
      .from('photo_comparisons')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('muscle_group', muscle_group)
      .order('created_at', { ascending: true });

    if (comparisonsError) {
      console.error('Error fetching comparisons:', comparisonsError);
    }

    // Calculate trend
    const trend = calculateTrend(photos, comparisons || []);

    res.json({ 
      muscle_group,
      photos,
      comparisons: comparisons || [],
      trend,
      totalPhotos: photos.length,
      firstPhoto: photos[0],
      latestPhoto: photos[photos.length - 1]
    });
  } catch (error) {
    console.error('Timeline fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Compare two specific photos
 * POST /api/photos/enhanced/compare
 */
router.post('/compare', authenticateToken, async (req, res) => {
  try {
    const { photo_id_old, photo_id_new } = req.body;

    if (!photo_id_old || !photo_id_new) {
      return res.status(400).json({ error: 'Both photo IDs are required' });
    }

    // Fetch both photos
    const { data: photos, error } = await supabase
      .from('photos')
      .select('*')
      .in('id', [photo_id_old, photo_id_new])
      .eq('user_id', req.user.id);

    if (error || photos.length !== 2) {
      return res.status(404).json({ error: 'Photos not found' });
    }

    const oldPhoto = photos.find(p => p.id == photo_id_old);
    const newPhoto = photos.find(p => p.id == photo_id_new);

    if (oldPhoto.muscle_group !== newPhoto.muscle_group) {
      return res.status(400).json({ error: 'Photos must be of the same muscle group' });
    }

    const comparison = await comparePhotos(oldPhoto, newPhoto, req.user.id);

    res.json({ 
      comparison,
      oldPhoto,
      newPhoto
    });
  } catch (error) {
    console.error('Photo comparison error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a photo
 * DELETE /api/photos/enhanced/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('photos')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Error deleting photo:', error);
      return res.status(500).json({ error: 'Failed to delete photo' });
    }

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Photo deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Analyze photo and compare with previous photos
 */
async function analyzePhotoAndCompare(photoId, userId, muscleGroup) {
  // Get the current photo
  const { data: currentPhoto, error: photoError } = await supabase
    .from('photos')
    .select('*')
    .eq('id', photoId)
    .single();

  if (photoError || !currentPhoto) {
    throw new Error('Photo not found');
  }

  // Get previous photo of the same muscle group
  const { data: previousPhotos, error: prevError } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .eq('muscle_group', muscleGroup)
    .lt('created_at', currentPhoto.created_at)
    .order('created_at', { ascending: false })
    .limit(1);

  const previousPhoto = previousPhotos && previousPhotos.length > 0 ? previousPhotos[0] : null;

  // Analyze current photo
  const analysis = await analyzeSinglePhoto(currentPhoto);

  // If there's a previous photo, do comparison
  let comparison = null;
  let insights = [];

  if (previousPhoto) {
    comparison = await comparePhotos(previousPhoto, currentPhoto, userId);
    insights = await generateInsights(userId, muscleGroup, currentPhoto, previousPhoto, comparison);
  } else {
    // First photo for this muscle group
    insights = [{
      insight_type: 'first_photo',
      insight_text: `Great start! This is your first ${muscleGroup} photo. Keep tracking to see your progress over time.`,
      confidence_score: 1.0
    }];
  }

  // Update photo with analysis
  const { data: updatedPhoto, error: updateError } = await supabase
    .from('photos')
    .update({
      analysis_data: analysis,
      comparison_data: comparison,
      progress_score: comparison ? comparison.progress_score : 50,
      updated_at: new Date().toISOString()
    })
    .eq('id', photoId)
    .select('*')
    .single();

  // Save insights
  if (insights.length > 0 && comparison) {
    await supabase
      .from('muscle_progress_insights')
      .insert(
        insights.map(insight => ({
          user_id: userId,
          muscle_group: muscleGroup,
          ...insight,
          photo_ids: [photoId, previousPhoto?.id].filter(Boolean),
          created_at: new Date().toISOString()
        }))
      );
  }

  return {
    photo: updatedPhoto,
    analysis,
    comparison,
    insights
  };
}

/**
 * Analyze a single photo using OpenAI Vision
 */
async function analyzeSinglePhoto(photo) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = axios.create({
    baseURL: 'https://api.openai.com/v1',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const analysisPrompt = `Analyze this ${photo.muscle_group} progress photo for fitness tracking. Provide:

1. **Muscle Development**: Describe the visible development state of ${photo.muscle_group}
2. **Definition Level**: Rate muscle definition and separation (scale 1-10)
3. **Symmetry**: Note any asymmetry or balance observations
4. **Key Observations**: 3-4 specific observations about this muscle group
5. **Training Focus**: Suggest specific exercises to improve this area

Be specific, encouraging, and actionable.`;

  try {
    const visionResponse = await openai.post('/chat/completions', {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert bodybuilding coach analyzing progress photos. Focus on muscle development, definition, and symmetry.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: analysisPrompt },
            { 
              type: 'image_url', 
              image_url: { url: photo.url, detail: 'high' } 
            }
          ]
        }
      ],
      max_tokens: 600
    });

    const analysisText = visionResponse.data.choices[0].message.content;
    
    return {
      timestamp: new Date().toISOString(),
      muscle_group: photo.muscle_group,
      analysis: analysisText,
      summary: extractAnalysisSummary(analysisText)
    };
  } catch (error) {
    console.error('OpenAI Vision API error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Compare two photos using OpenAI Vision
 */
async function comparePhotos(oldPhoto, newPhoto, userId) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = axios.create({
    baseURL: 'https://api.openai.com/v1',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const daysBetween = Math.floor(
    (new Date(newPhoto.created_at) - new Date(oldPhoto.created_at)) / (1000 * 60 * 60 * 24)
  );

  const comparisonPrompt = `Compare these two ${oldPhoto.muscle_group} progress photos taken ${daysBetween} days apart. The FIRST image is from ${new Date(oldPhoto.created_at).toLocaleDateString()}, and the SECOND image is from ${new Date(newPhoto.created_at).toLocaleDateString()}.

Provide a detailed comparison:

1. **Overall Change**: Describe visible changes (growth, definition, size)
2. **Estimated Growth**: Approximate % change in muscle size/definition
3. **Definition Improvement**: Has muscle separation improved?
4. **Symmetry Changes**: Any changes in balance or proportion?
5. **Recommendations**: Based on progress, what should they focus on next?

Be specific with percentages and measurements when possible. Keep the tone motivating.`;

  try {
    const visionResponse = await openai.post('/chat/completions', {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert bodybuilding coach comparing before/after progress photos. Be specific about changes, estimate growth percentages, and provide actionable feedback.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: comparisonPrompt },
            { 
              type: 'image_url', 
              image_url: { url: oldPhoto.url, detail: 'high' } 
            },
            { 
              type: 'image_url', 
              image_url: { url: newPhoto.url, detail: 'high' } 
            }
          ]
        }
      ],
      max_tokens: 800
    });

    const comparisonText = visionResponse.data.choices[0].message.content;
    const summary = extractComparisonSummary(comparisonText);

    // Save comparison to database
    const { data: comparison, error } = await supabase
      .from('photo_comparisons')
      .insert([
        {
          user_id: userId,
          muscle_group: oldPhoto.muscle_group,
          photo_id_old: oldPhoto.id,
          photo_id_new: newPhoto.id,
          comparison_analysis: {
            text: comparisonText,
            summary: summary,
            days_between: daysBetween
          },
          growth_percentage: summary.growth_percentage || 0,
          symmetry_score: summary.symmetry_score || 5,
          definition_score: summary.definition_score || 5,
          created_at: new Date().toISOString()
        }
      ])
      .select('*')
      .single();

    if (error) {
      console.error('Error saving comparison:', error);
    }

    return {
      text: comparisonText,
      summary,
      days_between: daysBetween,
      old_photo_date: oldPhoto.created_at,
      new_photo_date: newPhoto.created_at,
      progress_score: calculateProgressScore(summary)
    };
  } catch (error) {
    console.error('OpenAI comparison error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Generate actionable insights from comparison
 */
async function generateInsights(userId, muscleGroup, newPhoto, oldPhoto, comparison) {
  const insights = [];
  const summary = comparison.summary;

  // Growth insight
  if (summary.growth_percentage > 2) {
    insights.push({
      insight_type: 'growth',
      insight_text: `Your ${muscleGroup} has grown by approximately ${summary.growth_percentage}% over the past ${comparison.days_between} days. Great progress!`,
      confidence_score: summary.growth_percentage > 5 ? 0.9 : 0.7,
      comparison_period: comparison.days_between < 14 ? 'week' : comparison.days_between < 60 ? 'month' : 'quarter'
    });
  } else if (summary.growth_percentage < -2) {
    insights.push({
      insight_type: 'loss',
      insight_text: `Your ${muscleGroup} appears to have decreased by approximately ${Math.abs(summary.growth_percentage)}%. Consider increasing volume or checking your nutrition.`,
      confidence_score: 0.7,
      comparison_period: comparison.days_between < 14 ? 'week' : 'month'
    });
  }

  // Definition insight
  if (summary.definition_improvement) {
    insights.push({
      insight_type: 'definition',
      insight_text: `Muscle definition in your ${muscleGroup} has improved noticeably. Your cutting phase is working!`,
      confidence_score: 0.8
    });
  }

  // Symmetry insight
  if (summary.symmetry_notes) {
    insights.push({
      insight_type: 'symmetry',
      insight_text: summary.symmetry_notes,
      confidence_score: 0.7
    });
  }

  // Recommendation insight
  if (summary.recommendations) {
    insights.push({
      insight_type: 'recommendation',
      insight_text: summary.recommendations,
      confidence_score: 0.9
    });
  }

  return insights;
}

/**
 * Extract structured summary from analysis text
 */
function extractAnalysisSummary(text) {
  const summary = {
    development_level: '',
    definition_score: 5,
    key_observations: [],
    recommendations: []
  };

  const lines = text.split('\n').filter(l => l.trim());

  lines.forEach(line => {
    const trimmed = line.trim();
    
    if (trimmed.match(/definition|separation/i)) {
      const scoreMatch = trimmed.match(/(\d+)\/10|(\d+) out of 10/i);
      if (scoreMatch) {
        summary.definition_score = parseInt(scoreMatch[1] || scoreMatch[2]);
      }
    }

    if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.match(/^\d+\./)) {
      const content = trimmed.replace(/^[-•\d.\s]+/, '').trim();
      if (content.length > 10) {
        if (trimmed.match(/recommend|suggest|focus|try/i)) {
          summary.recommendations.push(content);
        } else {
          summary.key_observations.push(content);
        }
      }
    }
  });

  return summary;
}

/**
 * Extract structured summary from comparison text
 */
function extractComparisonSummary(text) {
  const summary = {
    growth_percentage: 0,
    definition_improvement: false,
    symmetry_score: 5,
    symmetry_notes: '',
    recommendations: '',
    overall_assessment: ''
  };

  // Extract percentage
  const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    const pct = parseFloat(percentMatch[1]);
    // Check context to determine if it's growth or loss
    const context = text.substring(Math.max(0, text.indexOf(percentMatch[0]) - 50), text.indexOf(percentMatch[0]) + 50);
    if (context.match(/decreas|loss|small|reduc/i)) {
      summary.growth_percentage = -pct;
    } else {
      summary.growth_percentage = pct;
    }
  }

  // Check for definition improvement
  if (text.match(/definition.*(improv|better|increas|enh)/i)) {
    summary.definition_improvement = true;
  }

  // Extract recommendations
  const recMatch = text.match(/recommendations?:(.+?)(?=\n\n|\n#|$)/is);
  if (recMatch) {
    summary.recommendations = recMatch[1].trim();
  }

  // Extract overall assessment
  const lines = text.split('\n').filter(l => l.trim() && l.length > 50);
  if (lines.length > 0) {
    summary.overall_assessment = lines[0].replace(/^#+\s*/, '').trim();
  }

  return summary;
}

/**
 * Calculate progress score (0-100)
 */
function calculateProgressScore(summary) {
  let score = 50; // Base score

  // Growth contributes heavily
  if (summary.growth_percentage > 0) {
    score += Math.min(summary.growth_percentage * 5, 30);
  } else if (summary.growth_percentage < 0) {
    score += Math.max(summary.growth_percentage * 5, -30);
  }

  // Definition improvement
  if (summary.definition_improvement) {
    score += 10;
  }

  // Symmetry
  if (summary.symmetry_score > 7) {
    score += 10;
  } else if (summary.symmetry_score < 5) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate trend from photos and comparisons
 */
function calculateTrend(photos, comparisons) {
  if (photos.length < 2) {
    return { trend: 'insufficient_data', message: 'Need at least 2 photos to determine trend' };
  }

  const progressScores = photos.map(p => p.progress_score || 50);
  const avgScore = progressScores.reduce((a, b) => a + b, 0) / progressScores.length;

  const recentScores = progressScores.slice(-3);
  const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

  let trend = 'stable';
  if (avgRecent > avgScore + 5) {
    trend = 'improving';
  } else if (avgRecent < avgScore - 5) {
    trend = 'declining';
  }

  const totalGrowth = comparisons.reduce((sum, c) => sum + (c.growth_percentage || 0), 0);

  return {
    trend,
    avgScore: Math.round(avgScore),
    recentAvgScore: Math.round(avgRecent),
    totalGrowth: Math.round(totalGrowth * 10) / 10,
    photoCount: photos.length,
    comparisonCount: comparisons.length
  };
}

module.exports = router;

