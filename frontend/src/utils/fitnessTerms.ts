/**
 * Fitness Term Recognition & Correction Utility
 * Handles accent variations, common misspellings, and fuzzy matching
 */

// Common exercise names database
export const EXERCISE_DATABASE = [
  // Chest
  'bench press', 'incline bench press', 'decline bench press', 'dumbbell press',
  'chest press', 'push ups', 'pushups', 'chest fly', 'chest flyes', 'pec deck',
  'cable crossover', 'dips',
  
  // Back
  'pull ups', 'pullups', 'chin ups', 'chinups', 'lat pulldown', 'lat pull down',
  'barbell row', 'bent over row', 'dumbbell row', 'cable row', 'seated row',
  'deadlift', 'deadlifts', 't bar row', 'face pull', 'back extension',
  
  // Legs
  'squat', 'squats', 'front squat', 'back squat', 'leg press', 'leg extension',
  'leg curl', 'hamstring curl', 'calf raise', 'calf raises', 'lunges', 'lunge',
  'bulgarian split squat', 'hack squat', 'romanian deadlift', 'rdl',
  
  // Shoulders
  'shoulder press', 'overhead press', 'military press', 'arnold press',
  'lateral raise', 'lateral raises', 'side raise', 'front raise', 'rear delt fly',
  'upright row', 'shrugs', 'face pulls',
  
  // Arms
  'bicep curl', 'biceps curl', 'hammer curl', 'preacher curl', 'concentration curl',
  'tricep extension', 'triceps extension', 'skull crusher', 'tricep dip',
  'close grip bench press', 'cable curl',
  
  // Core
  'plank', 'crunches', 'sit ups', 'situps', 'leg raise', 'leg raises',
  'russian twist', 'ab wheel', 'cable crunch', 'hanging leg raise'
];

// Common misheard variations (what speech API hears -> correct term)
export const CORRECTION_MAP: { [key: string]: string } = {
  // Bench Press variations
  'bench': 'bench press',
  'bentch press': 'bench press',
  'bench price': 'bench press',
  'bench breast': 'bench press',
  'french press': 'bench press',
  
  // Squat variations
  'squat': 'squats',
  'squads': 'squats',
  'scott': 'squats',
  'squad': 'squats',
  'squats exercise': 'squats',
  
  // Deadlift variations
  'dead lift': 'deadlift',
  'debt lift': 'deadlift',
  'dad lift': 'deadlift',
  'deadlifts': 'deadlift',
  
  // Pull ups
  'pool ups': 'pull ups',
  'pull up': 'pull ups',
  'pullup': 'pull ups',
  'chin up': 'chin ups',
  'chinup': 'chin ups',
  
  // Lat pulldown
  'lat pull down': 'lat pulldown',
  'lad pulldown': 'lat pulldown',
  'lat pull': 'lat pulldown',
  
  // Shoulder press
  'shoulder': 'shoulder press',
  'soldier press': 'shoulder press',
  'overhead': 'overhead press',
  
  // Bicep curl
  'bicep': 'bicep curl',
  'biceps': 'bicep curl',
  'by step curl': 'bicep curl',
  'bicep curls': 'bicep curl',
  
  // Leg press
  'leg': 'leg press',
  'leg price': 'leg press',
  
  // Common number corrections
  'tree': '3',
  'for': '4',
  'too': '2',
  'to': '2',
  'won': '1',
  'one': '1',
  'two': '2',
  'three': '3',
  'four': '4',
  'five': '5',
  'six': '6',
  'seven': '7',
  'eight': '8',
  'nine': '9',
  'ten': '10',
  
  // Weight units
  'kilograms': 'kg',
  'kilogram': 'kg',
  'kgs': 'kg',
  'pounds': 'lbs',
  'pound': 'lbs',
  'lb': 'lbs',
  
  // Reps
  'reps': 'reps',
  'rep': 'reps',
  'repetitions': 'reps',
  'repetition': 'reps',
  'raps': 'reps',
  
  // Sets
  'set': 'sets',
  'sets': 'sets',
  'said': 'sets',
  'sat': 'sets'
};

/**
 * Calculate similarity between two strings (Levenshtein distance)
 */
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  
  return costs[s2.length];
}

/**
 * Find the best matching exercise from the database
 */
export function findBestExerciseMatch(input: string, threshold: number = 0.6): string | null {
  const inputLower = input.toLowerCase().trim();
  
  // Direct match
  if (EXERCISE_DATABASE.includes(inputLower)) {
    return inputLower;
  }
  
  // Check correction map first
  if (CORRECTION_MAP[inputLower]) {
    return CORRECTION_MAP[inputLower];
  }
  
  // Fuzzy match
  let bestMatch: string | null = null;
  let bestScore = threshold;
  
  for (const exercise of EXERCISE_DATABASE) {
    const score = similarity(inputLower, exercise);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = exercise;
    }
    
    // Also check if input is contained in exercise name
    if (exercise.includes(inputLower) && inputLower.length > 3) {
      if (score > bestScore - 0.1) { // Slight preference for partial matches
        bestScore = score;
        bestMatch = exercise;
      }
    }
  }
  
  return bestMatch;
}

/**
 * Correct common speech recognition errors in transcript
 */
export function correctTranscript(transcript: string): string {
  let corrected = transcript.toLowerCase().trim();
  
  // Apply correction map
  const words = corrected.split(' ');
  const correctedWords = words.map(word => {
    // Remove punctuation
    const cleaned = word.replace(/[.,!?;:]/g, '');
    return CORRECTION_MAP[cleaned] || word;
  });
  
  corrected = correctedWords.join(' ');
  
  // Try to find and correct exercise name
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i + 1]}`;
    const match = findBestExerciseMatch(twoWord);
    if (match) {
      corrected = corrected.replace(twoWord, match);
    }
  }
  
  // Single word exercise name correction
  for (const word of words) {
    if (word.length > 4) { // Only check longer words to avoid false positives
      const match = findBestExerciseMatch(word);
      if (match) {
        corrected = corrected.replace(new RegExp(`\\b${word}\\b`, 'g'), match);
      }
    }
  }
  
  return corrected;
}

/**
 * Extract exercise name from corrected transcript
 */
export function extractExerciseName(transcript: string): string | null {
  const corrected = correctTranscript(transcript);
  const words = corrected.split(' ');
  
  // Try two-word combinations first
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i + 1]}`;
    const match = findBestExerciseMatch(twoWord, 0.7);
    if (match) return match;
  }
  
  // Try single words
  for (const word of words) {
    const match = findBestExerciseMatch(word, 0.8);
    if (match) return match;
  }
  
  // If no match, return first few words as exercise name
  return words.slice(0, Math.min(3, words.length)).join(' ');
}

/**
 * Get helpful suggestions for voice input
 */
export function getVoiceInputTips(): string[] {
  return [
    '💡 Speak clearly: "Bench press 3 sets of 10 reps at 60 kg"',
    '💡 Alternative: "I did 3 sets of squats, 8 reps, 80 kilograms"',
    '💡 Simple format: "Deadlift 5 sets 5 reps 100 kg"',
    '💡 Use full names: "bicep curl" instead of just "bicep"'
  ];
}

