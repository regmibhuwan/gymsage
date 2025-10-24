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

module.exports = router;
