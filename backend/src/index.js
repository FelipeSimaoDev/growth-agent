require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { requireApiKey } = require('./middleware/auth');

// Routes
const configRoutes = require('./routes/config');
const dailyInputRoutes = require('./routes/dailyInput');
const postsRoutes = require('./routes/posts');

// Services
const { registerCallbackHandlers, markMessageAsPosted, notify } = require('./services/telegram');
const { regeneratePost } = require('./services/generator');
const supabase = require('./db/supabase');

// Cron
const { startGenerateCron } = require('./cron/generatePost');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

// Health check — no auth needed
app.get('/health', (req, res) => res.json({ ok: true }));

// All API routes require API key
app.use('/api', requireApiKey);
app.use('/api/config', configRoutes);
app.use('/api/daily-input', dailyInputRoutes);
app.use('/api/posts', postsRoutes);

// Wire up Telegram inline button callbacks.
// Done here (not in telegram.js) to avoid circular dependencies.
registerCallbackHandlers({
  regenerate: async (postId) => {
    try {
      await regeneratePost(postId);
    } catch (err) {
      console.error('[Telegram callback] Regenerate failed:', err.message);
      await notify(`❌ Regenerate failed: ${err.message}`).catch(() => {});
    }
  },

  markPosted: async (postId, messageId) => {
    try {
      const { data: post } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (!post || post.status !== 'PENDING') return;

      await supabase
        .from('posts')
        .update({ status: 'POSTED', posted_at: new Date().toISOString() })
        .eq('id', postId);

      await markMessageAsPosted(messageId, post.content);
    } catch (err) {
      console.error('[Telegram callback] Mark as posted failed:', err.message);
      await notify(`❌ Mark as posted failed: ${err.message}`).catch(() => {});
    }
  },
});

// Start daily cron
startGenerateCron();

app.listen(PORT, () => {
  console.log(`Growth Agent backend running on port ${PORT}`);
});
