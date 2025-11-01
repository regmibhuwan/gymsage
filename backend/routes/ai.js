const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { analyzeMuscleGroup } = require('../services/aiAnalysis');
const supabase = require('../config/supabase');
const { getOpenAIClient } = require('../services/openaiClient');

const router = express.Router();

// Analyze latest vs previous photo for a muscle group
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const { muscle_group, user_metrics } = req.body;
    if (!muscle_group) {
      return res.status(400).json({ error: 'muscle_group is required' });
    }

    const result = await analyzeMuscleGroup({
      userId: req.user.id,
      muscleGroup: muscle_group,
      userMetrics: user_metrics || null
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to analyze', details: err.message || err });
  }
});

// Minimal chat endpoint with contextual grounding from recent uploads
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message is required' });

    // Pull recent uploads to ground the response
    const { data: recentPhotos, error } = await supabase
      .from('photos')
      .select('id, url, muscle_group, created_at, notes, weight_lbs, body_fat_percentage, measurements')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message || error);

    const client = getOpenAIClient();

    // Build context-aware system prompt
    const system = `You are an expert fitness coach AI. You have access to the user's progress photo history. When analyzing progress, be specific about what you observe in their photos, reference muscle groups they've tracked, and provide actionable, personalized recommendations. Avoid generic advice - base your responses on their actual photo data and metrics.`;

    // Build messages array with history
    const messages = [
      { role: 'system', content: system }
    ];

    // Add chat history if provided (last 10 messages to keep context manageable)
    const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
    recentHistory.forEach(msg => {
      if (msg.role && msg.content) {
        messages.push({ role: msg.role, content: msg.content });
      }
    });

    // Add current context and message
    const contextSummary = recentPhotos && recentPhotos.length > 0 
      ? `User's recent progress photos (${recentPhotos.length} total):\n` +
        recentPhotos.map(p => 
          `- ${p.muscle_group} (${new Date(p.created_at).toLocaleDateString()})` +
          (p.weight_lbs ? ` - Weight: ${p.weight_lbs}lbs` : '') +
          (p.body_fat_percentage ? ` - Body Fat: ${p.body_fat_percentage}%` : '') +
          (p.notes ? ` - Notes: ${p.notes}` : '')
        ).join('\n')
      : 'User has no progress photos uploaded yet.';

    messages.push({
      role: 'user',
      content: `Context:\n${contextSummary}\n\nUser's question: ${message}`
    });

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4-turbo',
      messages: messages,
      temperature: 0.5
    });

    const content = completion.choices?.[0]?.message?.content || 'I apologize, but I couldn\'t generate a response. Please try again.';
    return res.json({ content });
  } catch (err) {
    console.error('AI chat error:', err);
    return res.status(500).json({ error: 'Chat failed', details: err.message || err });
  }
});

module.exports = router;



