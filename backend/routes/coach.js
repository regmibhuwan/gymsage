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
    const { message, history } = req.body || {};

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
User is asking to compare photos from: ${specificPhotos.requestedDates.date1} to ${specificPhotos.requestedDates.date2}
Muscle group requested: ${specificPhotos.muscleGroup || 'not specified'}

ALL AVAILABLE PHOTOS (check these dates carefully):
${specificPhotos.allPhotos.map(p => {
  const date = new Date(p.created_at);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `- ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}: ${p.muscle_group} (Score: ${p.progress_score || 'N/A'})`;
}).join('\n')}

CRITICAL RULES - MATCH DATES BY MONTH AND DAY:
1. User wants to compare photos from ${specificPhotos.requestedDates.date1} to ${specificPhotos.requestedDates.date2}
2. Look for photos in the list above that have the SAME MONTH AND DAY (ignore the year)
3. For example, if user asks "may 14", look for photos showing "May 14" in the list above
4. Filter by muscle group: ${specificPhotos.muscleGroup}
5. If you find matching photos: Compare them and give the actual growth percentage/improvement
6. If you DON'T find matching photos: Say "I don't have ${specificPhotos.muscleGroup} photos from those dates. I have photos from: [list actual dates found]"
7. DO NOT compare photos from wrong dates`;
    }

    const systemPrompt = `You are an expert AI fitness coach named GymSage. You provide personalized, well-written fitness, nutrition, and training advice based on the user's workout data, progress photos, and goals.

User Context:
- Name: ${context.user.name}
- Recent Workouts: ${JSON.stringify(context.user.recentWorkouts)}
- Muscle Group Stats: ${JSON.stringify(muscleStats)}
- Recent Progress Insights: ${JSON.stringify(context.user.progressInsights)}
- Recent Comparisons: ${JSON.stringify(context.user.muscleComparisons)}
${additionalContext}

YOUR ROLE:
- You remember previous conversations and can reference what was discussed earlier
- You provide well-written, detailed, and helpful responses for fitness, nutrition, and training
- You format responses clearly with line breaks, bullet points, and numbered lists when appropriate
- You are knowledgeable about nutrition, macro tracking, meal timing, supplements, training splits, progressive overload, recovery, and more

RESPONSE QUALITY GUIDELINES:
1. BE HONEST and accurate - If photos don't exist for dates requested, say so clearly
2. REMEMBER previous conversation topics - Reference what was discussed earlier if relevant
3. Provide DETAILED, WELL-WRITTEN responses (not just 2-3 sentences - be thorough and helpful)
4. Use proper formatting:
   - Line breaks between paragraphs
   - Bullet points (• or -) for lists
   - Numbered lists (1. 2. 3.) for step-by-step advice
   - NO markdown formatting (**bold** or *italic*) - just plain text
5. For fitness questions: Provide exercise recommendations, sets/reps, form tips, training frequency
6. For nutrition questions: Provide macro breakdowns, meal examples, timing advice, food suggestions
7. For progress questions: Reference actual data (growth percentages, progress scores) from their photos
8. Be encouraging and motivational but also realistic
9. Reference previous conversation topics naturally when relevant

RESPONSE FORMAT:
Return JSON with this structure:
{
  "response": "Your detailed, well-written response here. Use line breaks (\\n\\n) between paragraphs. Use bullet points for lists. Be thorough and helpful.",
  "suggestions": ["Exercise suggestion 1", "Exercise suggestion 2"],
  "program_mods": ["Training modification 1", "Training modification 2"],
  "nutrition_tips": ["Nutrition tip 1", "Nutrition tip 2"]
}

CRITICAL: 
- Keep response DETAILED and helpful (5-10 sentences for complex questions, 3-5 for simple ones)
- Use line breaks (\\n\\n) to separate paragraphs for readability
- Reference previous conversation topics when relevant
- Write naturally - no JSON symbols or technical jargon
- Example good response: "Based on your chest photos, you've shown solid progress. The upper chest has improved by about 8% over the past two months.\\n\\nTo continue this growth, focus on:\\n- Incline bench press (4 sets x 6-8 reps)\\n- Incline dumbbell flyes (3 sets x 10-12 reps)\\n- Cable crossovers (3 sets x 12-15 reps)\\n\\nMake sure you're progressively overloading each week."`;

    // Build messages array with conversation history
    const messages = [
      { role: "system", content: systemPrompt }
    ];

    // Add conversation history (last 15 messages to maintain context without overwhelming)
    const conversationHistory = Array.isArray(history) ? history.slice(-15) : [];
    conversationHistory.forEach(msg => {
      if (msg.role && msg.content) {
        messages.push({ role: msg.role, content: msg.content });
      }
    });

    // Add current message
    messages.push({ role: "user", content: message });

    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4-turbo",  // Using GPT-4 Turbo for better quality responses
        messages: messages,
        temperature: 0.7,  // Higher temperature for more natural, varied responses
        max_tokens: 1000  // More tokens for detailed responses
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      )
    ]);

    let aiResponse = completion.choices[0].message.content;

    // Clean up markdown formatting
    aiResponse = aiResponse.replace(/\*\*([^*]+)\*\*/g, '$1');
    aiResponse = aiResponse.replace(/__([^_]+)__/g, '$1');
    aiResponse = aiResponse.replace(/\*([^*]+)\*/g, '$1');
    aiResponse = aiResponse.replace(/_([^_]+)_/g, '$1');
    aiResponse = aiResponse.replace(/^#{1,6}\s+/gm, '');

    // Try to parse JSON response, fallback to plain text
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
      // Clean markdown from response field too
      if (parsedResponse.response) {
        parsedResponse.response = parsedResponse.response
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/__([^_]+)__/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/_([^_]+)_/g, '$1');
      }
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
      message: parsedResponse.response || parsedResponse.message || aiResponse,
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
