const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// GET /api/daily-input/today
// Returns today's daily input if it exists
router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_inputs')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (error) throw error;

    res.json({ data: data || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/daily-input
// Upsert today's "what was built" entry
// Body: { what_was_built: string }
router.post('/', async (req, res) => {
  try {
    const { what_was_built } = req.body;
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_inputs')
      .upsert(
        { date: today, what_was_built },
        { onConflict: 'date' }
      )
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
