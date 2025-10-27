const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const supabase = require('../config/supabase');
const OpenAI = require('openai');

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Chat with AI fitness coach
 * POST /api/coach/chat
 */
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check if user is asking for specific date comparisons
    let specificPhotos = null;
    const dateComparisonMatch = message.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}).*?(to|and|vs|-).*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i);
    
    if (dateComparisonMatch) {
      console.log('📅 Date comparison detected:', dateComparisonMatch);
      
      // Extract muscle group from question
      const muscleMatch = message.match(/(chest|back|shoulders?|biceps?|triceps?|forearms?|abs|obliques?|quads?|hamstrings?|calves?|glutes?|legs?|arms?)/i);
      const muscleGroup = muscleMatch ? muscleMatch[1].toLowerCase() : null;
      
      console.log('💪 Muscle group:', muscleGroup);
      
      // Get ALL photos for this user
      const { data: allPhotos } = await supabase
        .from('photos')
        .select('id, muscle_group, created_at, analysis_data, comparison_data, progress_score, url')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: true });
      
      console.log(`📸 Found ${allPhotos?.length || 0} total photos for user`);
      if (allPhotos) {
        console.log('Photos by date:', allPhotos.map(p => `${new Date(p.created_at).toLocaleDateString()} - ${p.muscle_group}`));
      }
      
      specificPhotos = {
        allPhotos: allPhotos || [],
        muscleGroup: muscleGroup,
        requestedDates: {
          date1: `${dateComparisonMatch[1]} ${dateComparisonMatch[2]}`,
          date2: `${dateComparisonMatch[4]} ${dateComparisonMatch[5]}`
        }
      };
    }

    // Get user's recent workouts and photo analyses for context
    const { data: workouts } = await supabase
      .from('workouts')
      .select('date, exercises, notes')
      .eq('user_id', req.user.id)
      .order('date', { ascending: false })
      .limit(10);

    const { data: photos } = await supabase
      .from('photos')
      .select('muscle_group, analysis_data, comparison_data, progress_score, created_at')
      .eq('user_id', req.user.id)
      .not('analysis_data', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: insights } = await supabase
      .from('muscle_progress_insights')
      .select('muscle_group, insight_type, insight_text, confidence_score, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(15);

    const { data: comparisons } = await supabase
      .from('photo_comparisons')
      .select('muscle_group, growth_percentage, symmetry_score, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Build context for AI
    const context = {
      user: {
        name: req.user.name,
        recentWorkouts: workouts || [],
        recentPhotoAnalyses: photos || [],
        progressInsights: insights || [],
        muscleComparisons: comparisons || []
      }
    };

    // Extract muscle-specific stats for better context
    const muscleStats = {};
    if (photos) {
      photos.forEach(photo => {
        if (!muscleStats[photo.muscle_group]) {
          muscleStats[photo.muscle_group] = {
            photo_count: 0,
            avg_progress_score: 0,
            latest_analysis: null
          };
        }
        muscleStats[photo.muscle_group].photo_count++;
        muscleStats[photo.muscle_group].avg_progress_score += (photo.progress_score || 0);
        if (!muscleStats[photo.muscle_group].latest_analysis) {
          muscleStats[photo.muscle_group].latest_analysis = photo.analysis_data?.summary;
        }
      });
      
      // Calculate averages
      Object.keys(muscleStats).forEach(muscle => {
        muscleStats[muscle].avg_progress_score = 
          Math.round(muscleStats[muscle].avg_progress_score / muscleStats[muscle].photo_count);
      });
    }

    let additionalContext = '';
    if (specificPhotos) {
      additionalContext = `

IMPORTANT - Date-Specific Comparison Request:
User is asking to compare photos from specific dates: ${specificPhotos.requestedDates.date1} and ${specificPhotos.requestedDates.date2}
Muscle group requested: ${specificPhotos.muscleGroup || 'not specified'}

Available photos with dates:
${specificPhotos.allPhotos.map(p => `- ${new Date(p.created_at).toLocaleDateString()}: ${p.muscle_group} (Progress Score: ${p.progress_score || 'N/A'})`).join('\n')}

CRITICAL RULES FOR DATE COMPARISONS:
1. Check if photos exist for BOTH requested dates (within 2-3 days tolerance)
2. Check if the muscle group matches what the user asked about
3. If photos DON'T exist for either date, be HONEST and say: "I don't see any ${specificPhotos.muscleGroup} photos from [missing date(s)]. Please upload photos for those dates first."
4. If photos exist, compare ONLY those specific photos
5. Do NOT make up data or use photos from different dates`;
    }

    const systemPrompt = `You are an AI fitness coach named GymSage. You help users with their fitness journey by providing personalized advice based on their workout data, progress photos, and muscle-specific analysis.

User Context:
- Name: ${context.user.name}
- Recent Workouts: ${JSON.stringify(context.user.recentWorkouts)}
- Muscle Group Stats: ${JSON.stringify(muscleStats)}
- Recent Progress Insights: ${JSON.stringify(context.user.progressInsights)}
- Recent Comparisons: ${JSON.stringify(context.user.muscleComparisons)}
${additionalContext}

Guidelines:
1. BE HONEST - If photos don't exist for the dates requested, say so clearly
2. Check dates carefully when user asks for specific date comparisons
3. When asked "Is my [muscle] growing?", reference actual growth_percentage from data
4. When asked "Which muscle improved most?", compare the actual progress scores
5. When asked about cutting/bulking, analyze overall trends and body composition
6. Suggest specific exercises based on muscle group weaknesses
7. Provide actionable, specific advice
8. Be encouraging and motivational
9. Keep responses SHORT, conversational, and friendly
10. Write like you're texting a gym buddy - no formal structure
11. If giving suggestions, just mention them naturally in your response
12. Always respond in JSON format ONLY for the structure, keep the response text natural:
{
  "response": "Your SHORT conversational response (max 2-3 sentences). If suggesting exercises, list them naturally like: Try incline press, dumbbell flyes, and push-ups.",
  "suggestions": [],
  "program_mods": [],
  "nutrition_tips": []
}

CRITICAL: Keep the "response" field SHORT and conversational. No bullet points, no numbered lists, no formal structure. Just natural friendly text.

If the user asks about something not related to fitness, politely redirect them back to fitness topics.`;

    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      )
    ]);

    const aiResponse = completion.choices[0].message.content;

    // Try to parse JSON response, fallback to plain text
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (error) {
      // Fallback if AI doesn't return proper JSON
      parsedResponse = {
        response: aiResponse,
        suggestions: [],
        program_mods: [],
        nutrition_tips: []
      };
    }

    res.json({
      message: parsedResponse.response,
      suggestions: parsedResponse.suggestions || [],
      program_mods: parsedResponse.program_mods || [],
      nutrition_tips: parsedResponse.nutrition_tips || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Coach error:', error);
    
    // Always return a JSON response, never throw
    return res.status(200).json({
      message: "I'm having trouble connecting to my AI brain right now. Please try again in a moment! In the meantime, make sure you're staying hydrated and getting enough protein.",
      suggestions: ["Try again in a few minutes", "Check your internet connection"],
      program_mods: [],
      nutrition_tips: ["Stay hydrated", "Aim for 1g protein per lb bodyweight"],
      timestamp: new Date().toISOString(),
      error: "AI service temporarily unavailable"
    });
  }
});

/**
 * Get personalized workout recommendations
 * GET /api/coach/recommendations
 */
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    // Get user's workout history
    const { data: workouts } = await supabase
      .from('workouts')
      .select('date, exercises')
      .eq('user_id', req.user.id)
      .order('date', { ascending: false })
      .limit(20);

    if (!workouts || workouts.length === 0) {
      return res.json({
        recommendations: [
          "Start with basic compound movements like squats, deadlifts, and bench press",
          "Focus on proper form before increasing weight",
          "Aim for 3-4 workouts per week"
        ],
        program_mods: [],
        nutrition_tips: [
          "Eat a balanced diet with adequate protein",
          "Stay hydrated throughout the day"
        ]
      });
    }

    // Analyze workout patterns
    const exerciseFrequency = {};
    const recentExercises = [];

    workouts.forEach(workout => {
      workout.exercises.forEach(exercise => {
        const exerciseName = exercise.exercise.toLowerCase();
        exerciseFrequency[exerciseName] = (exerciseFrequency[exerciseName] || 0) + 1;
        recentExercises.push(exerciseName);
      });
    });

    // Generate recommendations based on patterns
    const recommendations = [];
    const programMods = [];
    const nutritionTips = [
      "Consume protein within 30 minutes post-workout",
      "Stay hydrated - aim for 8-10 glasses of water daily"
    ];

    // Check for common patterns and suggest improvements
    if (Object.keys(exerciseFrequency).length < 5) {
      recommendations.push("Consider adding more exercise variety to your routine");
      programMods.push("Add 2-3 new exercises to your current program");
    }

    if (workouts.length < 3) {
      recommendations.push("Try to maintain consistency with at least 3 workouts per week");
      programMods.push("Schedule specific workout days and stick to them");
    }

    // Check for progression
    const hasProgression = workouts.some(workout => 
      workout.exercises.some(exercise => 
        exercise.sets.some(set => set.weight_kg > 0)
      )
    );

    if (!hasProgression) {
      recommendations.push("Consider adding weight progression to your exercises");
      programMods.push("Increase weight by 2.5-5lbs when you can complete all sets");
    }

    res.json({
      recommendations: recommendations.length > 0 ? recommendations : [
        "Great job maintaining consistency!",
        "Consider tracking your nutrition for better results",
        "Make sure you're getting adequate rest between workouts"
      ],
      program_mods: programMods,
      nutrition_tips: nutritionTips
    });

  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

/**
 * Get progress insights from photo analysis data
 * GET /api/coach/progress-insights
 */
router.get('/progress-insights', authenticateToken, async (req, res) => {
  try {
    // Get user's photos with analysis data
    const { data: photos } = await supabase
      .from('photos')
      .select('view, analysis_data, created_at')
      .eq('user_id', req.user.id)
      .not('analysis_data', 'is', null)
      .order('created_at', { ascending: true });

    if (!photos || photos.length < 2) {
      return res.json({
        insights: [
          "Upload more progress photos to track your muscle growth over time",
          "Take photos from front, side, and back views for comprehensive tracking"
        ],
        muscle_progress: {},
        recommendations: [
          "Take consistent photos in similar lighting",
          "Maintain the same pose for accurate comparisons"
        ]
      });
    }

    // Group photos by view for comparison
    const photosByView = {
      front: photos.filter(p => p.view === 'front'),
      side: photos.filter(p => p.view === 'side'),
      back: photos.filter(p => p.view === 'back')
    };

    const insights = [];
    const muscleProgress = {};
    const recommendations = [];

    // Analyze progress for each view
    Object.entries(photosByView).forEach(([view, viewPhotos]) => {
      if (viewPhotos.length >= 2) {
        const oldest = viewPhotos[0];
        const newest = viewPhotos[viewPhotos.length - 1];

        const oldestMeasurements = oldest.analysis_data?.measurements || {};
        const newestMeasurements = newest.analysis_data?.measurements || {};

        // Calculate changes
        const shoulderChange = newestMeasurements.shoulder_width - oldestMeasurements.shoulder_width;
        const armChange = (
          (newestMeasurements.left_arm_length || 0) + (newestMeasurements.right_arm_length || 0)
        ) - (
          (oldestMeasurements.left_arm_length || 0) + (oldestMeasurements.right_arm_length || 0)
        );

        // Generate insights based on changes
        if (view === 'front') {
          if (shoulderChange > 5) {
            insights.push("✅ Great shoulder development! Your shoulders are showing significant growth.");
            muscleProgress.shoulders = "growing";
          } else if (shoulderChange < -2) {
            insights.push("⚠️ Your shoulder width has decreased. Consider adding more shoulder exercises.");
            muscleProgress.shoulders = "declining";
            recommendations.push("Add lateral raises and overhead press to your routine");
          } else {
            insights.push("📊 Shoulder development is stable. Consider progressive overload.");
            muscleProgress.shoulders = "stable";
          }

          if (armChange > 10) {
            insights.push("✅ Excellent arm growth! Your biceps and triceps are developing well.");
            muscleProgress.arms = "growing";
          } else if (armChange < -5) {
            insights.push("⚠️ Arm measurements have decreased. Focus more on arm exercises.");
            muscleProgress.arms = "declining";
            recommendations.push("Increase volume for bicep curls and tricep exercises");
          } else {
            insights.push("📊 Arm development is steady. Keep up the consistency.");
            muscleProgress.arms = "stable";
          }
        }

        if (view === 'back') {
          insights.push("📸 Back photos are great for tracking lat and rear delt development");
          if (shoulderChange > 5) {
            insights.push("✅ Your back width is improving!");
            muscleProgress.back = "growing";
          } else {
            muscleProgress.back = "stable";
            recommendations.push("Add more rows and pull-ups for back development");
          }
        }

        if (view === 'side') {
          insights.push("📸 Side view helps track chest and posture development");
          muscleProgress.chest = "stable";
        }
      }
    });

    // Overall nutrition recommendation based on progress
    if (insights.some(i => i.includes('declining'))) {
      recommendations.push("🍗 Increase calorie intake by 200-300 calories");
      recommendations.push("🥩 Aim for 1g protein per lb of bodyweight");
    } else if (insights.some(i => i.includes('Great') || i.includes('Excellent'))) {
      recommendations.push("🎯 Keep up your current nutrition plan - it's working!");
      recommendations.push("💪 Continue progressive overload in your training");
    }

    res.json({
      insights: insights.length > 0 ? insights : [
        "Keep taking consistent progress photos to track your development"
      ],
      muscle_progress: muscleProgress,
      recommendations: recommendations.length > 0 ? recommendations : [
        "Stay consistent with your training",
        "Ensure you're eating enough protein"
      ],
      total_photos: photos.length,
      date_range: {
        first: photos[0].created_at,
        latest: photos[photos.length - 1].created_at
      }
    });

  } catch (error) {
    console.error('Progress insights error:', error);
    res.status(500).json({ error: 'Failed to generate progress insights' });
  }
});

module.exports = router;
