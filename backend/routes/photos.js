const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const supabase = require('../config/supabase');

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

/**
 * Get all photos for authenticated user
 * GET /api/photos
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: photos, error } = await supabase
      .from('photos')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching photos:', error);
      return res.status(500).json({ error: 'Failed to fetch photos' });
    }

    res.json({ photos });
  } catch (error) {
    console.error('Photos fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Upload a new progress photo
 * POST /api/photos/upload
 */
router.post('/upload', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { view } = req.body;
    const file = req.file;

    // Validate input
    if (!file) {
      return res.status(400).json({ error: 'Photo file is required' });
    }

    if (!view || !['front', 'side', 'back'].includes(view)) {
      return res.status(400).json({ error: 'View must be front, side, or back' });
    }

    // Generate unique filename
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${req.user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('progress-photos')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload photo to storage' });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('progress-photos')
      .getPublicUrl(fileName);

    // Save photo record to database
    const { data: photo, error: dbError } = await supabase
      .from('photos')
      .insert([
        {
          user_id: req.user.id,
          url: publicUrl,
          view,
          analysis_data: null,
          created_at: new Date().toISOString()
        }
      ])
      .select('*')
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: 'Failed to save photo record' });
    }

    res.status(201).json({ 
      photo,
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Upload a new progress photo (legacy endpoint)
 * POST /api/photos
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { url, view, analysis_data } = req.body;

    // Validate input
    if (!url || !view) {
      return res.status(400).json({ error: 'URL and view are required' });
    }

    if (!['front', 'side', 'back'].includes(view)) {
      return res.status(400).json({ error: 'View must be front, side, or back' });
    }

    const { data: photo, error } = await supabase
      .from('photos')
      .insert([
        {
          user_id: req.user.id,
          url,
          view,
          analysis_data: analysis_data || null,
          created_at: new Date().toISOString()
        }
      ])
      .select('*')
      .single();

    if (error) {
      console.error('Error creating photo:', error);
      return res.status(500).json({ error: 'Failed to upload photo' });
    }

    res.status(201).json({ photo });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Trigger photo analysis using OpenAI Vision API
 * POST /api/photos/:id/analyze
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

    // Use OpenAI Vision API for analysis
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured' 
      });
    }

    try {
      const axios = require('axios');
      const openai = axios.create({
        baseURL: 'https://api.openai.com/v1',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      // Analyze the photo using OpenAI Vision
      const analysisPrompt = `You are a fitness coach analyzing a ${photo.view} view progress photo for workout tracking purposes. Focus on observable fitness and form elements without identifying the individual.

Please provide:

1. **Muscle Development Observations**: Describe visible muscle groups and their development state (e.g., "well-defined back muscles", "developing shoulder definition")

2. **Body Composition Notes**: Comment on overall muscle mass and definition visible in this ${photo.view} view

3. **Posture & Form Analysis**: Note any posture observations relevant to workout effectiveness

4. **Training Recommendations**: Based on what's visible, suggest 3-4 specific exercises or training focuses to continue progress in the visible muscle groups

5. **Progress Tracking Tips**: What specific areas should be monitored in future ${photo.view} view photos to track improvement

Keep the tone motivating and educational. Focus on actionable fitness insights.`;

      const visionResponse = await openai.post('/chat/completions', {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert fitness coach who provides detailed, actionable analysis of workout progress photos. You focus on observable physical development, form, and provide specific training recommendations without identifying individuals.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: analysisPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: photo.url,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 800
      });

      const analysisText = visionResponse.data.choices[0].message.content;
      
      // Parse the analysis into structured format
      const analysis = {
        timestamp: new Date().toISOString(),
        view: photo.view,
        analysis: analysisText,
        summary: extractSummary(analysisText)
      };

      // Update photo with analysis data
      const { data: updatedPhoto, error: updateError } = await supabase
        .from('photos')
        .update({
          analysis_data: analysis,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', req.user.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error updating photo with analysis:', updateError);
        return res.status(500).json({ error: 'Failed to save analysis results' });
      }

      res.json({ 
        photo: updatedPhoto,
        analysis: analysis
      });
    } catch (openaiError) {
      console.error('OpenAI Vision API error:', openaiError.response?.data || openaiError.message);
      return res.status(500).json({ 
        error: 'Failed to analyze photo with AI. Please try again.' 
      });
    }
  } catch (error) {
    console.error('Photo analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to extract a short summary from the analysis
function extractSummary(analysisText) {
  // Extract key points from the analysis
  const lines = analysisText.split('\n').filter(line => line.trim());
  
  const summary = {
    keyPoints: [],
    overallAssessment: '',
    recommendations: [],
    muscleDevelopment: '',
    postureNotes: ''
  };

  let currentSection = '';
  
  lines.forEach(line => {
    const trimmedLine = line.trim();
    
    // Detect section headers
    if (trimmedLine.match(/^\*?\*?Muscle Development/i)) {
      currentSection = 'muscle';
    } else if (trimmedLine.match(/^\*?\*?Body Composition/i)) {
      currentSection = 'composition';
    } else if (trimmedLine.match(/^\*?\*?Posture|Form Analysis/i)) {
      currentSection = 'posture';
    } else if (trimmedLine.match(/^\*?\*?Training Recommendation/i)) {
      currentSection = 'recommendations';
    } else if (trimmedLine.match(/^\*?\*?Progress Tracking/i)) {
      currentSection = 'tracking';
    }
    
    // Extract content based on section
    if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.match(/^\d+\./)) {
      const content = trimmedLine.replace(/^[-•\d.\s*]+/, '').trim();
      if (content && content.length > 5) {
        if (currentSection === 'recommendations') {
          summary.recommendations.push(content);
        } else {
          summary.keyPoints.push(content);
        }
      }
    } else if (trimmedLine.length > 20 && !trimmedLine.match(/^\*?\*?[A-Z]/)) {
      // Regular paragraph text
      if (currentSection === 'muscle' && !summary.muscleDevelopment) {
        summary.muscleDevelopment = trimmedLine;
      } else if (currentSection === 'composition' && !summary.overallAssessment) {
        summary.overallAssessment = trimmedLine;
      } else if (currentSection === 'posture' && !summary.postureNotes) {
        summary.postureNotes = trimmedLine;
      }
    }
  });

  // If we didn't get an overall assessment, use the first substantial line
  if (!summary.overallAssessment && lines.length > 0) {
    const firstContent = lines.find(l => l.trim().length > 30 && !l.match(/^\*?\*?[A-Z]/));
    if (firstContent) {
      summary.overallAssessment = firstContent.trim();
    }
  }

  return summary;
}

/**
 * Update photo analysis data
 * PUT /api/photos/:id/analysis
 */
router.put('/:id/analysis', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { analysis_data } = req.body;

    if (!analysis_data) {
      return res.status(400).json({ error: 'Analysis data is required' });
    }

    const { data: photo, error } = await supabase
      .from('photos')
      .update({
        analysis_data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating photo analysis:', error);
      return res.status(500).json({ error: 'Failed to update photo analysis' });
    }

    res.json({ photo });
  } catch (error) {
    console.error('Photo analysis update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get photo analysis trends
 * GET /api/photos/trends
 */
router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const { data: photos, error } = await supabase
      .from('photos')
      .select('view, analysis_data, created_at')
      .eq('user_id', req.user.id)
      .not('analysis_data', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching photo trends:', error);
      return res.status(500).json({ error: 'Failed to fetch photo trends' });
    }

    // Process trends data by view type
    const trends = {
      front: [],
      side: [],
      back: []
    };

    photos.forEach(photo => {
      if (photo.analysis_data && trends[photo.view]) {
        trends[photo.view].push({
          date: photo.created_at,
          measurements: photo.analysis_data.measurements || {},
          keypoints: photo.analysis_data.keypoints || []
        });
      }
    });

    res.json({ trends });
  } catch (error) {
    console.error('Photo trends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a photo
 * DELETE /api/photos/:id
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

module.exports = router;
