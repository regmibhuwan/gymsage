const supabase = require('../config/supabase');
const { getOpenAIClient } = require('./openaiClient');

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo';

async function fetchLatestTwoPhotos(userId, muscleGroup) {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .eq('muscle_group', muscleGroup)
    .order('created_at', { ascending: false })
    .limit(2);

  if (error) {
    throw new Error(`Failed to fetch photos: ${error.message || error}`);
  }

  return data || [];
}

function buildAnalysisPrompt({ muscleGroup, latest, previous, userMetrics }) {
  const latestDate = latest?.created_at || null;
  const previousDate = previous?.created_at || null;

  const system = `You are a meticulous fitness progress analyst. Compare body progress photos for the specified muscle group using provided metadata and image URLs. Focus on definition, symmetry, volume, and posture. Be concrete and avoid generic advice. If uncertainty is high, say so and explain why.`;

  const user = {
    muscle_group: muscleGroup,
    latest_photo: latest ? { url: latest.url, created_at: latestDate, notes: latest.notes || null, weight_lbs: latest.weight_lbs || null, body_fat_percentage: latest.body_fat_percentage || null, measurements: latest.measurements || null } : null,
    previous_photo: previous ? { url: previous.url, created_at: previousDate, notes: previous.notes || null, weight_lbs: previous.weight_lbs || null, body_fat_percentage: previous.body_fat_percentage || null, measurements: previous.measurements || null } : null,
    user_metrics: userMetrics || null
  };

  return { system, userContent: JSON.stringify(user) };
}

const analysisSchema = {
  name: 'muscle_progress_analysis',
  schema: {
    type: 'object',
    properties: {
      muscle_group: { type: 'string' },
      change_percentage: { type: 'number' },
      trend: { type: 'string' },
      summary: { type: 'string' },
      recommendations: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number' },
    },
    required: ['muscle_group', 'change_percentage', 'trend', 'summary', 'recommendations']
  }
};

async function analyzeMuscleGroup({ userId, muscleGroup, userMetrics }) {
  const photos = await fetchLatestTwoPhotos(userId, muscleGroup);
  const latest = photos[0] || null;
  const previous = photos[1] || null;

  if (!latest) {
    return {
      muscle_group: muscleGroup,
      change_percentage: 0,
      trend: 'insufficient data',
      summary: 'No photos available to analyze for this muscle group.',
      recommendations: ['Upload at least one photo to begin analysis'],
      confidence: 0
    };
  }

  const { system, userContent } = buildAnalysisPrompt({ muscleGroup, latest, previous, userMetrics });

  const client = getOpenAIClient();

  try {
    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_schema', json_schema: analysisSchema },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent }
      ],
      temperature: 0.2
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(raw);
    // Ensure muscle_group filled
    if (!parsed.muscle_group) parsed.muscle_group = muscleGroup;
    return parsed;
  } catch (err) {
    // Fallback minimal response
    return {
      muscle_group: muscleGroup,
      change_percentage: 0,
      trend: 'unknown',
      summary: 'AI analysis unavailable at the moment. Try again later.',
      recommendations: ['Re-run analysis later', 'Ensure photos are clear with consistent lighting'],
      confidence: 0
    };
  }
}

module.exports = {
  analyzeMuscleGroup
};



