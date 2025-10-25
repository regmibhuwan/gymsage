const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'workout-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (Whisper max)
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/') || file.originalname.match(/\.(webm|mp3|mp4|mpeg|mpga|m4a|wav)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

/**
 * Transcribe audio with Whisper AI and parse workout data
 * POST /api/voice/transcribe
 */
router.post('/transcribe', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    console.log('Received audio file:', req.file.filename);

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      // Cleanup uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ 
        error: 'Whisper API not configured. Please add OPENAI_API_KEY to .env file.' 
      });
    }

    // Transcribe audio with Whisper
    console.log('Transcribing with Whisper...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    });

    console.log('Whisper transcript:', transcription);

    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);

    const transcript = transcription.toString().trim();

    if (!transcript) {
      return res.status(400).json({ error: 'No speech detected in audio' });
    }

    // Now parse the transcript into workout data
    // Try OpenAI parsing first
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a fitness data parser. Parse workout voice transcripts into structured JSON format.

Output: JSON with exercise name, sets array with set number, reps, and weight in kg

Examples:
- "Bench press 3 sets of 10 reps at 60 kilograms" → {"exercise": "bench press", "sets": [{"set": 1, "reps": 10, "weight_kg": 60.0}, {"set": 2, "reps": 10, "weight_kg": 60.0}, {"set": 3, "reps": 10, "weight_kg": 60.0}]}
- "Squats 4 sets 8 reps 80 kg" → {"exercise": "squats", "sets": [{"set": 1, "reps": 8, "weight_kg": 80.0}, {"set": 2, "reps": 8, "weight_kg": 80.0}, {"set": 3, "reps": 8, "weight_kg": 80.0}, {"set": 4, "reps": 8, "weight_kg": 80.0}]}
- "135 pounds bench press 3 sets of 10" → {"exercise": "bench press", "sets": [{"set": 1, "reps": 10, "weight_kg": 61.5}, {"set": 2, "reps": 10, "weight_kg": 61.5}, {"set": 3, "reps": 10, "weight_kg": 61.5}]}

Rules:
1. Always return valid JSON
2. Exercise names should be lowercase
3. Weight MUST be in kg (convert from lbs if needed: 1 lb = 0.453592 kg)
4. Weight MUST be rounded to nearest .0 or .5 (e.g., 60.0, 60.5, 61.0, 61.5) with 1 decimal place
5. If no weight mentioned, use 0.0
6. If no reps mentioned, use 10
7. If no sets mentioned, use 3
8. Accept both "kg/kilograms" and "lbs/pounds" - ALWAYS convert to kg and round to .0 or .5`
          },
          {
            role: "user",
            content: transcript
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      });

      const aiResponse = completion.choices[0].message.content;
      const parsedData = JSON.parse(aiResponse);
      
      // Post-process: Ensure all weights are smartly rounded to .0 or .5
      if (parsedData.sets && Array.isArray(parsedData.sets)) {
        parsedData.sets = parsedData.sets.map(set => ({
          ...set,
          weight_kg: smartRoundWeight(set.weight_kg || 0)
        }));
      }
      
      return res.json({ 
        success: true, 
        data: parsedData,
        transcript: transcript,
        method: 'whisper+openai'
      });
    } catch (parseError) {
      console.error('OpenAI parsing error, using regex fallback:', parseError);
      // Fall back to regex parser
      const regexResult = parseWithRegex(transcript);
      return res.json({ 
        success: true, 
        data: regexResult,
        transcript: transcript,
        method: 'whisper+regex'
      });
    }

  } catch (error) {
    console.error('Whisper transcription error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Failed to transcribe audio: ' + error.message 
    });
  }
});

/**
 * Enhanced incremental voice parsing with session context
 * POST /api/voice/parse-incremental
 */
router.post('/parse-incremental', authenticateToken, async (req, res) => {
  try {
    const { transcript, sessionContext } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    // Parse with enhanced logic that considers session context
    const parsedData = await parseIncrementalWorkout(transcript, sessionContext || {});
    
    return res.json({ 
      success: true, 
      data: parsedData,
      transcript: transcript,
      method: 'incremental-parser'
    });

  } catch (error) {
    console.error('Incremental parsing error:', error);
    res.status(500).json({ error: 'Failed to parse voice transcript' });
  }
});

/**
 * Parse voice transcript into structured workout data
 * POST /api/voice/parse
 */
router.post('/parse', authenticateToken, async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    // Try OpenAI API first if key is available
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are a fitness data parser. Parse workout voice transcripts into structured JSON format.

Input: Voice transcript describing a workout
Output: JSON with exercise name, sets array with set number, reps, and weight in kg

Examples:
- "Bench press 3 sets of 10 reps at 60 kilograms" → {"exercise": "bench press", "sets": [{"set": 1, "reps": 10, "weight_kg": 60}, {"set": 2, "reps": 10, "weight_kg": 60}, {"set": 3, "reps": 10, "weight_kg": 60}]}
- "Squats 4 sets 8 reps 80 kg" → {"exercise": "squats", "sets": [{"set": 1, "reps": 8, "weight_kg": 80}, {"set": 2, "reps": 8, "weight_kg": 80}, {"set": 3, "reps": 8, "weight_kg": 80}, {"set": 4, "reps": 8, "weight_kg": 80}]}
- "Deadlift 5 sets of 5 reps at 100 kg" → {"exercise": "deadlift", "sets": [{"set": 1, "reps": 5, "weight_kg": 100}, {"set": 2, "reps": 5, "weight_kg": 100}, {"set": 3, "reps": 5, "weight_kg": 100}, {"set": 4, "reps": 5, "weight_kg": 100}, {"set": 5, "reps": 5, "weight_kg": 100}]}

Rules:
1. Always return valid JSON
2. Exercise names should be lowercase
3. Weight should be in kg (convert from lbs if needed: 1 lb = 0.453592 kg)
4. If no weight mentioned, use 0
5. If no reps mentioned, use 1
6. If no sets mentioned, use 1
7. Only parse the first exercise mentioned in the transcript`
            },
            {
              role: "user",
              content: transcript
            }
          ],
          temperature: 0.1,
          max_tokens: 300
        });

        const aiResponse = completion.choices[0].message.content;
        
        try {
          const parsedData = JSON.parse(aiResponse);
          return res.json({ 
            success: true, 
            data: parsedData,
            method: 'openai'
          });
        } catch (parseError) {
          console.error('Failed to parse OpenAI response:', parseError);
          // Fall through to regex parser
        }
      } catch (openaiError) {
        console.error('OpenAI API error:', openaiError);
        // Fall through to regex parser
      }
    }

    // Fallback to regex parser
    const regexResult = parseWithRegex(transcript);
    return res.json({ 
      success: true, 
      data: regexResult,
      method: 'regex'
    });

  } catch (error) {
    console.error('Voice parsing error:', error);
    res.status(500).json({ error: 'Failed to parse voice transcript' });
  }
});

/**
 * Smart weight rounding - rounds to nearest .0 or .5
 * @param {number} weight - Raw weight value
 * @returns {number} Rounded weight (e.g., 60.5, 61.0, 61.5)
 */
function smartRoundWeight(weight) {
  // Round to nearest 0.5
  const rounded = Math.round(weight * 2) / 2;
  // Return with 1 decimal place precision
  return Math.round(rounded * 10) / 10;
}

/**
 * Fallback regex parser for offline mode
 * Enhanced to handle corrected transcripts and various formats
 * @param {string} transcript - Voice transcript text
 * @returns {Object} Parsed workout data
 */
function parseWithRegex(transcript) {
  const text = transcript.toLowerCase().trim();
  
  // Enhanced exercise patterns - more comprehensive list
  const exercisePatterns = [
    // Chest
    /(?:bench press|bench|incline bench|decline bench|chest press|dumbbell press)/,
    /(?:push\s*ups?|pushups?)/,
    /(?:chest (?:fly|flyes?))/,
    /(?:cable crossover)/,
    
    // Back
    /(?:pull\s*ups?|pullups?|chin\s*ups?|chinups?)/,
    /(?:lat pulldown|lat pull down)/,
    /(?:deadlifts?|dead lift)/,
    /(?:barbell row|bent over row|dumbbell row|cable row|seated row)/,
    /(?:t bar row)/,
    
    // Legs
    /(?:squats?|front squat|back squat|bulgarian split squat)/,
    /(?:leg press|leg extension|leg curl)/,
    /(?:lunges?)/,
    /(?:calf raises?)/,
    /(?:romanian deadlift|rdl)/,
    
    // Shoulders
    /(?:shoulder press|overhead press|military press|arnold press)/,
    /(?:lateral raises?|side raises?|front raises?)/,
    /(?:rear delt fly)/,
    /(?:upright row)/,
    /(?:shrugs?)/,
    
    // Arms
    /(?:bicep curls?|biceps curls?|hammer curls?|preacher curls?)/,
    /(?:tricep (?:extension|dip)s?|triceps (?:extension|dip)s?)/,
    /(?:skull crushers?)/,
    
    // Generic patterns (fallback)
    /(?:dumbbell|db)\s+(\w+(?:\s+\w+)?)/,
    /(?:barbell|bb)\s+(\w+(?:\s+\w+)?)/,
    /(\w+(?:\s+\w+)?)\s+(?:press|lift|row|curl|extension|raise)/
  ];

  // Extract exercise name
  let exercise = 'unknown exercise';
  for (const pattern of exercisePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1]) {
        exercise = match[1].trim();
      } else {
        exercise = match[0].trim();
      }
      break;
    }
  }

  // If still no match, try to extract first 2-3 words as exercise name
  if (exercise === 'unknown exercise') {
    const words = text.split(/\s+/);
    exercise = words.slice(0, Math.min(3, words.length)).join(' ');
  }

  // Enhanced patterns for sets, reps, and weight
  // More flexible patterns to catch various formats
  const setsPattern = /(\d+)\s*(?:sets?|x|times)/i;
  const repsPattern = /(\d+)\s*(?:reps?|repetitions?|times?)\b/i;
  const weightPattern = /(\d+(?:\.\d+)?)\s*(?:kg|kilograms?|kilos?|lbs?|pounds?|lb)\b/i;

  const setsMatch = text.match(setsPattern);
  const repsMatch = text.match(repsPattern);
  const weightMatch = text.match(weightPattern);

  const numSets = setsMatch ? parseInt(setsMatch[1]) : 3; // Default to 3 sets
  const numReps = repsMatch ? parseInt(repsMatch[1]) : 10; // Default to 10 reps
  let weight = weightMatch ? parseFloat(weightMatch[1]) : 0;

  // Convert lbs to kg if needed (and round smartly)
  if (weightMatch && (text.includes('lb') || text.includes('pound'))) {
    weight = weight * 0.453592; // Convert to kg
  }

  // Smart rounding to nearest .0 or .5
  weight = smartRoundWeight(weight);

  // Generate sets array
  const sets = [];
  for (let i = 1; i <= numSets; i++) {
    sets.push({
      set: i,
      reps: numReps,
      weight_kg: weight
    });
  }

  return {
    exercise: exercise.trim(),
    sets: sets
  };
}

/**
 * Parse individual sets with separate reps/weights
 * Handles phrases like "3 sets of bench press, first set 10 reps 100 pounds, second set 8 reps 90 pounds"
 * Also handles comma-separated reps like "pushups 4 sets and 2, 3, 4, 5 reps"
 */
function parseIndividualSets(text) {
  // Pattern 1: Explicit set descriptions like "first set 10 reps 100 pounds"
  const explicitSetsPattern = /(?:first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|set\s+\d+)\s+(?:set\s+)?(\d+)\s+reps?\s+(\d+(?:\.\d+)?)\s*(kg|kilograms?|kilos?|lbs?|pounds?|lb)/gi;
  
  // Pattern 2: Comma-separated reps like "2, 3, 4, 5 reps"
  const commaRepsPattern = /(\d+(?:\s*,\s*\d+)*)\s+reps?/i;
  
  const sets = [];
  
  // Try explicit sets first
  let match;
  while ((match = explicitSetsPattern.exec(text)) !== null) {
    const reps = parseInt(match[1]);
    const weight = parseFloat(match[2]);
    const unit = match[3].toLowerCase();
    
    let weightKg, weightLbs, weightUnit;
    
    if (unit.includes('lb') || unit.includes('pound')) {
      weightLbs = weight;
      weightKg = weight * 0.453592;
      weightUnit = 'lbs';
    } else {
      weightKg = weight;
      weightLbs = weight * 2.20462;
      weightUnit = 'kg';
    }
    
    sets.push({
      reps: reps,
      weight_kg: smartRoundWeight(weightKg),
      weight_lbs: Math.round(weightLbs * 2) / 2,
      weight_unit: weightUnit
    });
  }
  
  // If no explicit sets found, try comma-separated reps
  if (sets.length === 0) {
    const commaMatch = text.match(commaRepsPattern);
    if (commaMatch) {
      const repsString = commaMatch[1];
      const repsArray = repsString.split(',').map(r => parseInt(r.trim()));
      
      // Extract weight if mentioned
      const weightPattern = /(\d+(?:\.\d+)?)\s*(kg|kilograms?|kilos?|lbs?|pounds?|lb)/i;
      const weightMatch = text.match(weightPattern);
      
      let weightKg = 0, weightLbs = 0, weightUnit = 'kg';
      
      if (weightMatch) {
        const weight = parseFloat(weightMatch[1]);
        const unit = weightMatch[2].toLowerCase();
        
        if (unit.includes('lb') || unit.includes('pound')) {
          weightLbs = weight;
          weightKg = weight * 0.453592;
          weightUnit = 'lbs';
        } else {
          weightKg = weight;
          weightLbs = weight * 2.20462;
          weightUnit = 'kg';
        }
      }
      
      // Create sets for each rep count
      repsArray.forEach((reps, index) => {
        sets.push({
          reps: reps,
          weight_kg: smartRoundWeight(weightKg),
          weight_lbs: Math.round(weightLbs * 2) / 2,
          weight_unit: weightUnit
        });
      });
    }
  }
  
  return sets;
}

/**
 * Enhanced incremental workout parser with session context
 * Handles incremental logging, set continuation, and smart defaults
 * @param {string} transcript - Voice transcript text
 * @param {Object} sessionContext - Current session context with last exercise info
 * @returns {Object} Parsed workout data with continuation logic
 */
async function parseIncrementalWorkout(transcript, sessionContext) {
  const text = transcript.toLowerCase().trim();
  
  // Check for continuation keywords
  const continuationKeywords = [
    'next set', 'another set', 'second set', 'third set', 'fourth set', 'fifth set',
    'again', 'same', 'continue', 'more', 'add set', 'one more'
  ];
  
  const isContinuation = continuationKeywords.some(keyword => text.includes(keyword)) || 
                        sessionContext.isVoiceContinuation; // Special flag for voice-added sets
  
  // Extract exercise name if mentioned
  let exerciseName = null;
  const exercisePatterns = [
    // Chest
    /(?:bench press|bench|incline bench|decline bench|chest press|dumbbell press)/,
    /(?:push\s*ups?|pushups?)/,
    /(?:chest (?:fly|flyes?))/,
    /(?:cable crossover)/,
    
    // Back
    /(?:pull\s*ups?|pullups?|chin\s*ups?|chinups?)/,
    /(?:lat pulldown|lat pull down)/,
    /(?:deadlifts?|dead lift)/,
    /(?:barbell row|bent over row|dumbbell row|cable row|seated row)/,
    /(?:t bar row)/,
    
    // Legs
    /(?:squats?|front squat|back squat|bulgarian split squat)/,
    /(?:leg press|leg extension|leg curl)/,
    /(?:lunges?)/,
    /(?:calf raises?)/,
    /(?:romanian deadlift|rdl)/,
    
    // Shoulders
    /(?:shoulder press|overhead press|military press|arnold press)/,
    /(?:lateral raises?|side raises?|front raises?)/,
    /(?:rear delt fly)/,
    /(?:upright row)/,
    /(?:shrugs?)/,
    
    // Arms
    /(?:bicep curls?|biceps curls?|hammer curls?|preacher curls?)/,
    /(?:tricep (?:extension|dip)s?|triceps (?:extension|dip)s?)/,
    /(?:skull crushers?)/,
    
    // Generic patterns
    /(?:dumbbell|db)\s+(\w+(?:\s+\w+)?)/,
    /(?:barbell|bb)\s+(\w+(?:\s+\w+)?)/,
    /(\w+(?:\s+\w+)?)\s+(?:press|lift|row|curl|extension|raise)/
  ];

  for (const pattern of exercisePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1]) {
        exerciseName = match[1].trim();
      } else {
        exerciseName = match[0].trim();
      }
      break;
    }
  }

  // Determine exercise name based on context
  let finalExerciseName;
  if (exerciseName) {
    finalExerciseName = exerciseName;
  } else if (isContinuation && sessionContext.lastExercise) {
    finalExerciseName = sessionContext.lastExercise;
  } else if (sessionContext.lastExercise) {
    // If no exercise mentioned but we have context, use last exercise
    finalExerciseName = sessionContext.lastExercise;
  } else {
    // Fallback: try to extract first 2-3 words as exercise name
    const words = text.split(/\s+/);
    finalExerciseName = words.slice(0, Math.min(3, words.length)).join(' ');
  }

  // Extract reps and weight
  const repsPattern = /(\d+)\s*(?:reps?|repetitions?|times?)\b/i;
  const weightPattern = /(\d+(?:\.\d+)?)\s*(?:kg|kilograms?|kilos?|lbs?|pounds?|lb)\b/i;
  const setsPattern = /(\d+)\s*(?:sets?|x|times)/i;

  const repsMatch = text.match(repsPattern);
  const weightMatch = text.match(weightPattern);
  const setsMatch = text.match(setsPattern);

  const reps = repsMatch ? parseInt(repsMatch[1]) : 1; // Default to 1 rep if not mentioned
  let weight = weightMatch ? parseFloat(weightMatch[1]) : 0;
  const numSets = setsMatch ? parseInt(setsMatch[1]) : 1; // Default to 1 set if not mentioned

  // Determine weight unit and preserve both values
  let weightKg = weight;
  let weightLbs = weight;
  let weightUnit = 'kg'; // Default unit

  if (weightMatch) {
    if (text.includes('lb') || text.includes('pound')) {
      weightLbs = weight;
      weightKg = weight * 0.453592; // Convert to kg for storage
      weightUnit = 'lbs';
    } else {
      weightKg = weight;
      weightLbs = weight * 2.20462; // Convert to lbs for display
      weightUnit = 'kg';
    }
  }

  // Smart rounding to nearest .0 or .5
  weightKg = smartRoundWeight(weightKg);
  weightLbs = Math.round(weightLbs * 2) / 2; // Round to nearest .5 for lbs

  // Determine if this is a continuation or new exercise
  let isNewExercise = true;
  let setNumber = 1;

  if (isContinuation && sessionContext.lastExercise === finalExerciseName) {
    isNewExercise = false;
    setNumber = (sessionContext.lastSetNumber || 0) + 1;
  } else if (isContinuation && sessionContext.lastExercise) {
    // Voice continuation - use the last exercise even if name doesn't match exactly
    finalExerciseName = sessionContext.lastExercise;
    isNewExercise = false;
    setNumber = (sessionContext.lastSetNumber || 0) + 1;
  } else if (exerciseName && sessionContext.lastExercise === finalExerciseName) {
    // Same exercise name mentioned again - treat as new exercise
    isNewExercise = true;
    setNumber = 1;
  }

  // Check for individual sets parsing first
  const individualSets = parseIndividualSets(text);
  let sets = [];
  
  if (individualSets.length > 0) {
    // Individual sets found - use them
    sets = individualSets.map((setData, index) => ({
      set: setNumber + index,
      reps: setData.reps,
      weight_kg: setData.weight_kg,
      weight_lbs: setData.weight_lbs,
      weight_unit: setData.weight_unit
    }));
  } else {
    // No individual sets - create uniform sets
    for (let i = 0; i < numSets; i++) {
      sets.push({
        set: setNumber + i,
        reps: reps,
        weight_kg: weightKg,
        weight_lbs: weightLbs,
        weight_unit: weightUnit
      });
    }
  }

  // Return data structure
  const result = {
    exercise: finalExerciseName.trim(),
    sets: sets,
    isNewExercise: isNewExercise,
    isContinuation: isContinuation,
    setNumber: setNumber + numSets - 1 // Last set number
  };

  return result;
}

/**
 * Generate daily workout summary
 * @param {Array} exercises - Array of exercise objects
 * @param {string} date - Workout date
 * @returns {Object} Structured daily summary with both text and table data
 */
function generateDailySummary(exercises, date) {
  const workoutDate = new Date(date);
  const formattedDate = workoutDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Generate text summary
  let textSummary = `🏋️ Workout Log — ${formattedDate}\n`;
  textSummary += '--------------------------------\n';

  let totalSets = 0;
  const tableData = [];

  exercises.forEach(exercise => {
    textSummary += `${exercise.exercise}:\n`;
    
    const exerciseData = {
      exercise: exercise.exercise,
      sets: []
    };
    
    exercise.sets.forEach(set => {
      const weightLbs = Math.round(set.weight_kg * 2.20462); // Convert back to lbs for display
      textSummary += `  • Set ${set.set} — ${set.reps} reps × ${weightLbs} lb\n`;
      
      exerciseData.sets.push({
        set: set.set,
        reps: set.reps,
        weight_kg: set.weight_kg,
        weight_lbs: weightLbs
      });
      
      totalSets++;
    });
    
    tableData.push(exerciseData);
    textSummary += '\n';
  });

  textSummary += '--------------------------------\n';
  textSummary += `Total Exercises: ${exercises.length}\n`;
  textSummary += `Total Sets: ${totalSets}`;

  return {
    text: textSummary,
    tableData: tableData,
    stats: {
      totalExercises: exercises.length,
      totalSets: totalSets,
      date: formattedDate
    }
  };
}

/**
 * Generate weekly workout summary
 * @param {Array} workouts - Array of workout objects for the week
 * @param {string} weekStart - Start date of the week
 * @param {string} weekEnd - End date of the week
 * @returns {Object} Structured weekly summary with both text and table data
 */
function generateWeeklySummary(workouts, weekStart, weekEnd) {
  const startDate = new Date(weekStart);
  const endDate = new Date(weekEnd);
  
  const formattedStart = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formattedEnd = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Generate text summary
  let textSummary = `📅 Weekly Summary (${formattedStart}–${formattedEnd})\n`;
  textSummary += '--------------------------------\n';

  // Aggregate exercise data
  const exerciseStats = {};
  let totalWorkouts = workouts.length;
  let totalSets = 0;
  const tableData = [];

  workouts.forEach(workout => {
    workout.exercises.forEach(exercise => {
      const exerciseName = exercise.exercise;
      
      if (!exerciseStats[exerciseName]) {
        exerciseStats[exerciseName] = {
          totalSets: 0,
          maxWeight: 0,
          totalReps: 0,
          workouts: new Set()
        };
      }

      exercise.sets.forEach(set => {
        exerciseStats[exerciseName].totalSets++;
        exerciseStats[exerciseName].maxWeight = Math.max(
          exerciseStats[exerciseName].maxWeight, 
          set.weight_kg
        );
        exerciseStats[exerciseName].totalReps += set.reps;
        exerciseStats[exerciseName].workouts.add(workout.date);
        totalSets++;
      });
    });
  });

  // Generate summary for each exercise
  Object.entries(exerciseStats).forEach(([exerciseName, stats]) => {
    const maxWeightLbs = Math.round(stats.maxWeight * 2.20462);
    textSummary += `${exerciseName} — ${stats.totalSets} sets total, Max weight: ${maxWeightLbs} lb\n`;
    
    tableData.push({
      exercise: exerciseName,
      totalSets: stats.totalSets,
      totalReps: stats.totalReps,
      maxWeightKg: stats.maxWeight,
      maxWeightLbs: maxWeightLbs,
      workoutsCount: stats.workouts.size,
      avgSetsPerWorkout: Math.round((stats.totalSets / stats.workouts.size) * 10) / 10
    });
  });

  textSummary += '--------------------------------\n';
  textSummary += `Total Workouts: ${totalWorkouts}\n`;
  textSummary += `Total Sets: ${totalSets}`;

  return {
    text: textSummary,
    tableData: tableData,
    stats: {
      totalWorkouts: totalWorkouts,
      totalSets: totalSets,
      weekRange: `${formattedStart}–${formattedEnd}`,
      uniqueExercises: Object.keys(exerciseStats).length
    }
  };
}

/**
 * Generate daily workout summary
 * POST /api/voice/summary/daily
 */
router.post('/summary/daily', authenticateToken, async (req, res) => {
  try {
    const { exercises, date } = req.body;

    if (!exercises || !Array.isArray(exercises) || !date) {
      return res.status(400).json({ error: 'Exercises array and date are required' });
    }

    const summary = generateDailySummary(exercises, date);
    
    return res.json({ 
      success: true, 
      summary: summary.text,
      tableData: summary.tableData,
      stats: summary.stats,
      type: 'daily'
    });

  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({ error: 'Failed to generate daily summary' });
  }
});

/**
 * Generate weekly workout summary
 * POST /api/voice/summary/weekly
 */
router.post('/summary/weekly', authenticateToken, async (req, res) => {
  try {
    const { workouts, weekStart, weekEnd } = req.body;

    if (!workouts || !Array.isArray(workouts) || !weekStart || !weekEnd) {
      return res.status(400).json({ error: 'Workouts array, weekStart, and weekEnd are required' });
    }

    const summary = generateWeeklySummary(workouts, weekStart, weekEnd);
    
    return res.json({ 
      success: true, 
      summary: summary.text,
      tableData: summary.tableData,
      stats: summary.stats,
      type: 'weekly'
    });

  } catch (error) {
    console.error('Weekly summary error:', error);
    res.status(500).json({ error: 'Failed to generate weekly summary' });
  }
});

module.exports = router;
