const supabase = require('../db/supabase');
const { generateRedditPost } = require('./openai');
const { sendPost, editPost } = require('./telegram');

/**
 * Core generation logic — shared by daily cron and regenerate flow.
 * Returns the generated content AND the chosen subreddit.
 *
 * @param {Object} config      - app_config row
 * @param {string|null} whatBuilt
 * @returns {{ content: string, subreddit: string }}
 */
async function _generate(config, whatBuilt) {
  // Fetch last 5 posted entries to avoid repeating angles
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('content')
    .eq('status', 'POSTED')
    .order('posted_at', { ascending: false })
    .limit(5);

  // Pick subreddit — simple rotation based on total post count
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true });

  const subreddit = config.subreddits[(count || 0) % config.subreddits.length];

  console.log(`[Generator] Generating post for r/${subreddit}...`);

  const content = await generateRedditPost(
    config,
    whatBuilt,
    recentPosts || [],
    subreddit
  );

  return { content, subreddit };
}

/**
 * Daily generation flow.
 * 1. Guard — skip if a PENDING post already exists today
 * 2. Fetch config + today's daily input
 * 3. Generate content via OpenAI
 * 4. Save as PENDING
 * 5. Send to Telegram with inline buttons
 *
 * @returns {Object|null} saved post row, or null if skipped
 */
async function runDailyGeneration() {
  // 1. Skip if already generated today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existingToday } = await supabase
    .from('posts')
    .select('id')
    .eq('status', 'PENDING')
    .gte('created_at', todayStart.toISOString())
    .maybeSingle();

  if (existingToday) {
    console.log('[Generator] Post already pending for today — skipping');
    return null;
  }

  // 2. Fetch app config
  const { data: config, error: configError } = await supabase
    .from('app_config')
    .select('*')
    .limit(1)
    .single();

  if (configError || !config) {
    throw new Error('No app config found. Set up your config first.');
  }

  if (!config.subreddits?.length) {
    throw new Error('No subreddits configured in app_config.');
  }

  // 3. Fetch today's daily input (optional)
  const today = new Date().toISOString().split('T')[0];
  const { data: dailyInput } = await supabase
    .from('daily_inputs')
    .select('*')
    .eq('date', today)
    .maybeSingle();

  // 4. Generate
  const { content, subreddit } = await _generate(
    config,
    dailyInput?.what_was_built || null
  );

  // 5. Save as PENDING — include subreddit for display purposes
  const { data: post, error: insertError } = await supabase
    .from('posts')
    .insert({
      daily_input_id: dailyInput?.id || null,
      subreddit,
      content,
      status: 'PENDING',
    })
    .select()
    .single();

  if (insertError) throw new Error(`Failed to save post: ${insertError.message}`);

  console.log(`[Generator] Post saved: ${post.id}`);

  // 6. Send to Telegram, store the message_id for future edits
  const telegramMessageId = await sendPost(post);

  if (telegramMessageId) {
    await supabase
      .from('posts')
      .update({ telegram_message_id: telegramMessageId })
      .eq('id', post.id);
  }

  return { ...post, telegram_message_id: telegramMessageId };
}

/**
 * Regeneration flow (triggered by Telegram button or API).
 * Overwrites the existing post record with fresh content.
 * Edits the existing Telegram message in place.
 *
 * @param {string} postId
 * @returns {Object} updated post row
 */
async function regeneratePost(postId) {
  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (fetchError || !existing) throw new Error('Post not found');
  if (existing.status !== 'PENDING') throw new Error('Only PENDING posts can be regenerated');

  const { data: config, error: configError } = await supabase
    .from('app_config')
    .select('*')
    .limit(1)
    .single();

  if (configError || !config) throw new Error('No app config found');

  let whatBuilt = null;
  if (existing.daily_input_id) {
    const { data: di } = await supabase
      .from('daily_inputs')
      .select('what_was_built')
      .eq('id', existing.daily_input_id)
      .maybeSingle();
    whatBuilt = di?.what_was_built || null;
  }

  // Generate fresh content — reuse the same subreddit as the original post
  const { content } = await _generate(config, whatBuilt);

  const { data: updated, error: updateError } = await supabase
    .from('posts')
    .update({ content })
    .eq('id', postId)
    .select()
    .single();

  if (updateError) throw new Error(`Failed to update post: ${updateError.message}`);

  console.log(`[Generator] Post ${postId} regenerated`);

  // Edit the existing Telegram message with new content
  if (existing.telegram_message_id) {
    await editPost(existing.telegram_message_id, content, postId, existing.subreddit);
  }

  return updated;
}

module.exports = { runDailyGeneration, regeneratePost };
