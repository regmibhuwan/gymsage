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

// Enhanced chat endpoint with contextual grounding from recent uploads and date-specific queries
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message is required' });

    // Check for date-specific queries (e.g., "from March to August")
    const datePattern = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,4})/gi;
    const dateMatches = [...message.matchAll(datePattern)];
    const hasDateQuery = dateMatches.length > 0;

    // Pull ALL photos if date query detected, otherwise recent ones
    let query = supabase
      .from('photos')
      .select('id, url, muscle_group, created_at, notes, weight_lbs, body_fat_percentage, measurements, analysis_data, comparison_data')
      .eq('user_id', req.user.id);

    if (hasDateQuery) {
      // Get all photos for date range analysis
      query = query.order('created_at', { ascending: true });
    } else {
      // Get recent photos only
      query = query.order('created_at', { ascending: false }).limit(15);
    }

    const { data: photos, error } = await query;
    if (error) throw new Error(error.message || error);

    const client = getOpenAIClient();

    // Build context-aware system prompt
    const system = `You are an expert fitness coach AI with access to the user's progress photo history. 

CRITICAL ACCURACY REQUIREMENTS:
- You MUST identify REGRESSION when the latest photo shows WORSE development than earlier photos
- Do NOT assume progress - accurately assess if there's improvement, regression, or no change
- Compare photos in chronological order (oldest to newest) to identify the trend
- If the most recent photo shows less muscle mass, definition, or development than earlier photos, clearly state this is REGRESSION, not progress
- Be honest and accurate - if progress has declined, state it clearly and explain what you observe
- Use objective comparisons: muscle size, definition, volume, symmetry between photos in chronological sequence

ANALYSIS GUIDELINES:
- When analyzing progress between specific dates, reference the exact dates and photos from those time periods
- Be specific about what you observe in their photos, reference muscle groups they've tracked
- Compare the chronological sequence: Photo 1 (oldest) → Photo 2 → Photo 3 → Photo 4 (newest)
- If Photo 4 (newest) shows less development than Photo 3, 2, or 1, state clearly: "There has been REGRESSION" or "The latest photo shows a decline"
- Provide actionable, personalized recommendations based on their actual photo data and metrics
- If asked about specific date ranges, use the photo dates provided in the context to give accurate comparisons
- Avoid generic advice - base your responses on their actual photo data and metrics

IMPORTANT FORMATTING RULES:
- Use bullet points (• or -) for lists and recommendations instead of paragraphs
- Use line breaks (\\n\\n) between different topics or sections
- Use numbered lists for step-by-step instructions
- DO NOT use markdown formatting like **bold** or *italic* - just use plain text with line breaks and bullets
- Keep paragraphs short and break them with line breaks for better readability`;

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

    // Build detailed context summary with dates and photo information - ALWAYS IN CHRONOLOGICAL ORDER
    let contextSummary = '';
    let sortedPhotos = [];
    let photoCount = 0;
    
    if (photos && photos.length > 0) {
      // Sort photos chronologically (oldest first) for accurate trend analysis
      sortedPhotos = [...photos].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      photoCount = sortedPhotos.length;
      
      contextSummary = `User's progress photos in CHRONOLOGICAL ORDER (oldest to newest, ${photoCount} total):\n\n`;
      sortedPhotos.forEach((p, index) => {
        const date = new Date(p.created_at);
        const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const photoNumber = index + 1;
        contextSummary += `Photo ${photoNumber} (${p.muscle_group}) - ${dateStr}`;
        if (p.weight_lbs) contextSummary += ` - Weight: ${p.weight_lbs}lbs`;
        if (p.body_fat_percentage) contextSummary += ` - Body Fat: ${p.body_fat_percentage}%`;
        if (p.notes) contextSummary += ` - Notes: ${p.notes}`;
        if (p.analysis_data) contextSummary += ` - Has analysis data`;
        contextSummary += '\n';
      });
      
      // Add explicit chronological comparison instructions
      if (sortedPhotos.length > 1) {
        const earliest = new Date(sortedPhotos[0].created_at);
        const latest = new Date(sortedPhotos[sortedPhotos.length - 1].created_at);
        contextSummary += `\nIMPORTANT: Compare photos in order - Photo 1 (${earliest.toLocaleDateString()}) is the OLDEST, Photo ${photoCount} (${latest.toLocaleDateString()}) is the NEWEST.\n`;
        contextSummary += `If Photo ${photoCount} (newest) shows LESS development than earlier photos, this indicates REGRESSION, not progress.\n`;
      }
      
      // Add date range context if relevant
      if (hasDateQuery && sortedPhotos.length > 1) {
        const earliest = new Date(sortedPhotos[0].created_at);
        const latest = new Date(sortedPhotos[sortedPhotos.length - 1].created_at);
        contextSummary += `\nDate range: ${earliest.toLocaleDateString()} to ${latest.toLocaleDateString()}\n`;
      }
    } else {
      contextSummary = 'User has no progress photos uploaded yet.';
    }

    messages.push({
      role: 'user',
      content: `Context:\n${contextSummary}\n\nUser's question: ${message}\n\nCRITICAL: When analyzing the photos above, compare them in chronological order (Photo 1 = oldest, Photo ${photoCount || 'N'} = newest). If the newest photo shows LESS muscle development, definition, or size than earlier photos, you MUST state this is REGRESSION or a DECLINE, not progress. Be honest and accurate about what you observe.\n\nPlease provide a detailed, specific response based on the photos and dates available. Format your response with:\n- Line breaks between paragraphs\n- Bullet points (• or -) for lists\n- Numbered lists (1. 2. 3.) for step-by-step instructions\n- NO markdown formatting (no **bold** or *italic*)\n- NO asterisks for emphasis\n- Keep paragraphs short and well-spaced`
    });

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4-turbo',
      messages: messages,
      temperature: 0.5
    });

    let content = completion.choices?.[0]?.message?.content || 'I apologize, but I couldn\'t generate a response. Please try again.';
    
    // Clean up markdown formatting
    // Remove markdown bold (**text** or __text__)
    content = content.replace(/\*\*([^*]+)\*\*/g, '$1');
    content = content.replace(/__([^_]+)__/g, '$1');
    // Remove markdown italic (*text* or _text_)
    content = content.replace(/\*([^*]+)\*/g, '$1');
    content = content.replace(/_([^_]+)_/g, '$1');
    // Remove markdown headers (# Header)
    content = content.replace(/^#{1,6}\s+/gm, '');
    // Ensure proper line breaks (double newlines for paragraphs)
    content = content.replace(/\n\n+/g, '\n\n');
    
    return res.json({ content });
  } catch (err) {
    console.error('AI chat error:', err);
    return res.status(500).json({ error: 'Chat failed', details: err.message || err });
  }
});

module.exports = router;



