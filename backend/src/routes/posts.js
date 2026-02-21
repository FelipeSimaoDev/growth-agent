const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { runDailyGeneration, regeneratePost } = require('../services/generator');
const { markMessageAsPosted, markMessageAsDiscarded } = require('../services/telegram');

// GET /api/posts
// List recent posts (latest 30)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/posts/pending
// Get the current PENDING post (at most one)
router.get('/pending', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    res.json({ data: data || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts/generate
// Manually trigger post generation (same as the daily cron)
router.post('/generate', async (req, res) => {
  try {
    const post = await runDailyGeneration();

    if (!post) {
      return res.status(409).json({
        error: 'A pending post already exists for today. Regenerate or mark it as posted first.',
      });
    }

    res.json({ data: post });
  } catch (err) {
    console.error('[POST /generate]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts/:id/regenerate
// Re-generate content for an existing PENDING post (overwrites in place)
router.post('/:id/regenerate', async (req, res) => {
  try {
    const post = await regeneratePost(req.params.id);
    res.json({ data: post });
  } catch (err) {
    console.error('[POST /:id/regenerate]', err);
    const status = err.message === 'Post not found' ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/posts/:id/mark-posted
// Mark a post as manually posted — sets status=POSTED + posted_at
router.post('/:id/mark-posted', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.status !== 'PENDING') {
      return res.status(400).json({ error: `Post is already ${post.status}` });
    }

    const { data: updated, error: updateError } = await supabase
      .from('posts')
      .update({ status: 'POSTED', posted_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Edit the Telegram message to reflect the posted state
    if (post.telegram_message_id) {
      await markMessageAsPosted(post.telegram_message_id, post.subreddit, post.content);
    }

    res.json({ data: updated });
  } catch (err) {
    console.error('[POST /:id/mark-posted]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts/:id/discard
// Mark a post as discarded
router.post('/:id/discard', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.status !== 'PENDING') {
      return res.status(400).json({ error: `Post is already ${post.status}` });
    }

    const { data: updated, error: updateError } = await supabase
      .from('posts')
      .update({ status: 'DISCARDED' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    if (post.telegram_message_id) {
      await markMessageAsDiscarded(post.telegram_message_id, post.subreddit, post.content);
    }

    res.json({ data: updated });
  } catch (err) {
    console.error('[POST /:id/discard]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
