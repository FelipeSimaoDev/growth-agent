const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// GET /api/config
// Returns the single app config row (creates empty one if none exists)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    res.json({ data: data || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/config
// Upsert the app config. If no row exists, create one. Otherwise update.
router.put('/', async (req, res) => {
  try {
    const {
      app_name,
      description,
      target_audience,
      tone_of_voice,
      subreddits,
      context_blocks,
    } = req.body;

    // Check if a config already exists
    const { data: existing } = await supabase
      .from('app_config')
      .select('id')
      .limit(1)
      .maybeSingle();

    let result;

    if (existing) {
      const { data, error } = await supabase
        .from('app_config')
        .update({
          app_name,
          description,
          target_audience,
          tone_of_voice,
          subreddits: subreddits || [],
          context_blocks: context_blocks || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('app_config')
        .insert({
          app_name,
          description,
          target_audience,
          tone_of_voice,
          subreddits: subreddits || [],
          context_blocks: context_blocks || [],
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
