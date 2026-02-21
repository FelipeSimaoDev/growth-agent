const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../db/supabase');

let bot = null;

// Lazily-registered handlers — set from index.js to avoid circular deps
let onRegenerate = null;
let onMarkPosted = null;
let onDiscard = null;
let onGenerate = null;
let onScheduleChange = null;

// ============================================================
// Growth focus options
// Add new entries here to extend available focus types.
// ============================================================
const FOCUS_OPTIONS = [
  {
    type: 'ACQUIRE_USERS',
    label: '🎯 Acquire Users',
    description: 'Drive new user signups by showing the value and ease of getting started with the app.',
  },
  {
    type: 'MEDIA_DRIVEN_USERS',
    label: '🎥 Attract Media-Driven Users',
    description: 'Target users who discover apps through viral content, influencers, and visual storytelling.',
  },
  {
    type: 'EDUCATE_ABOUT_APP',
    label: '📣 Educate About the App',
    description: "Explain what the app does, who it's for, and why it matters to new audiences.",
  },
  {
    type: 'BUILD_IN_PUBLIC',
    label: '🔥 Build in Public',
    description: 'Share honest insights about building the app and the personal journey behind it.',
  },
  {
    type: 'SCALE_AWARENESS',
    label: '🚀 Scale Awareness',
    description: 'Maximize reach and brand recognition across communities and platforms.',
  },
];

// ============================================================
// Schedule presets shown in the /schedule keyboard
// ============================================================
const SCHEDULE_PRESETS = [
  { label: '7:00 AM', cron: '0 7 * * *' },
  { label: '8:00 AM', cron: '0 8 * * *' },
  { label: '9:00 AM', cron: '0 9 * * *' },
  { label: '10:00 AM', cron: '0 10 * * *' },
  { label: '12:00 PM', cron: '0 12 * * *' },
  { label: '6:00 PM', cron: '0 18 * * *' },
];

// ============================================================
// Helpers
// ============================================================

/**
 * Convert a cron expression to a human-readable string.
 * Handles standard "M H * * *" daily patterns.
 */
function cronToHuman(expr) {
  const match = expr?.match(/^(\d+)\s+(\d+)\s+\*\s+\*\s+\*$/);
  if (match) {
    const minutes = parseInt(match[1]);
    const hours = parseInt(match[2]);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const displayMin = minutes.toString().padStart(2, '0');
    return `${displayHour}:${displayMin} ${period} UTC`;
  }
  return expr || '—';
}

/**
 * Convert HH:MM (24h) to a cron expression "M H * * *".
 * Returns null if the input is invalid.
 */
function timeToCron(hhmm) {
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (h > 23 || m > 59) return null;
  return `${m} ${h} * * *`;
}

// ============================================================
// Bot setup
// ============================================================
function getBot() {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

    // Log all incoming messages — helps find your chat ID on first run
    bot.on('message', (msg) => {
      console.log(`[Telegram] Message from chat ${msg.chat.id}: ${msg.text}`);
    });

    // /generate — trigger post generation immediately
    bot.onText(/\/generate/, async (msg) => {
      if (onGenerate) await onGenerate(msg.chat.id);
    });

    // /focus — show predefined keyboard, or save custom focus if text is provided
    // Usage:
    //   /focus              → show predefined options
    //   /focus <your text>  → save as CUSTOM focus
    bot.onText(/\/focus/, async (msg) => {
      const chatId = msg.chat.id;
      const customText = (msg.text || '').replace(/^\/focus(@\S+)?/, '').trim();

      if (customText.length > 0) {
        await handleSetCustomFocus(customText, chatId);
        return;
      }

      const { data: config } = await supabase
        .from('app_config')
        .select('growth_focus_type')
        .limit(1)
        .maybeSingle();

      const currentType = config?.growth_focus_type || 'BUILD_IN_PUBLIC';

      // Each option on its own row; mark the active predefined one with ✓
      // CUSTOM focus won't match any predefined type, so no ✓ is shown
      const keyboard = FOCUS_OPTIONS.map((opt) => [
        {
          text: opt.type === currentType ? `${opt.label} ✓` : opt.label,
          callback_data: `set_focus:${opt.type}`,
        },
      ]);

      await bot.sendMessage(
        chatId,
        '🎯 *Select Growth Focus*\n\nChoose a predefined focus below, or send:\n`/focus your custom focus text`',
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } }
      );
    });

    // /schedule — show current schedule + preset keyboard, or set custom time
    // Usage:
    //   /schedule            → show current schedule + preset options
    //   /schedule HH:MM      → set custom daily time (24h, UTC)
    bot.onText(/\/schedule/, async (msg) => {
      const chatId = msg.chat.id;
      const arg = (msg.text || '').replace(/^\/schedule(@\S+)?/, '').trim();

      if (arg.length > 0) {
        await handleSetCustomSchedule(arg, chatId);
        return;
      }

      const { data: config } = await supabase
        .from('app_config')
        .select('generate_cron')
        .limit(1)
        .maybeSingle();

      const currentCron = config?.generate_cron || '0 9 * * *';
      const currentLabel = cronToHuman(currentCron);

      // Build 2-per-row keyboard; mark the active preset with ✓
      const rows = [];
      for (let i = 0; i < SCHEDULE_PRESETS.length; i += 2) {
        const row = SCHEDULE_PRESETS.slice(i, i + 2).map((p) => ({
          text: p.cron === currentCron ? `${p.label} ✓` : p.label,
          callback_data: `set_schedule:${p.cron}`,
        }));
        rows.push(row);
      }

      await bot.sendMessage(
        chatId,
        `🕐 *Post Generation Schedule*\n\nCurrent: *${currentLabel}*\n\nChoose a preset below, or send:\n\`/schedule HH:MM\` _(24h UTC, e.g. /schedule 14:30)_`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }
      );
    });

    bot.on('callback_query', async (query) => {
      const { data, message } = query;
      await bot.answerCallbackQuery(query.id).catch(() => {});

      if (data?.startsWith('set_focus:')) {
        const focusType = data.split(':')[1];
        await handleSetFocus(focusType, message.message_id);
      } else if (data?.startsWith('set_schedule:')) {
        // cron expression is everything after "set_schedule:"
        const newCron = data.slice('set_schedule:'.length);
        await handleSetSchedule(newCron, message.message_id);
      } else if (data?.startsWith('regenerate:') && onRegenerate) {
        const postId = data.split(':')[1];
        await onRegenerate(postId, message.message_id);
      } else if (data?.startsWith('mark_posted:') && onMarkPosted) {
        const postId = data.split(':')[1];
        await onMarkPosted(postId, message.message_id);
      } else if (data?.startsWith('discard:') && onDiscard) {
        const postId = data.split(':')[1];
        await onDiscard(postId, message.message_id);
      }
    });

    bot.on('polling_error', (err) => {
      console.error('[Telegram] Polling error:', err.message);
    });

    console.log('[Telegram] Bot started (polling)');
  }
  return bot;
}

// ============================================================
// Command handlers
// ============================================================

/**
 * Handle a focus selection from the /focus keyboard.
 */
async function handleSetFocus(focusType, messageId) {
  const option = FOCUS_OPTIONS.find((o) => o.type === focusType);
  if (!option) return;

  const b = getBot();
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!b || !chatId) return;

  try {
    const { data: existing } = await supabase
      .from('app_config')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!existing) {
      await b.sendMessage(chatId, '❌ No app config found. Set up your config first.');
      return;
    }

    await supabase
      .from('app_config')
      .update({
        growth_focus_type: option.type,
        growth_focus_description: option.description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    const updatedKeyboard = FOCUS_OPTIONS.map((opt) => [
      {
        text: opt.type === focusType ? `${opt.label} ✓` : opt.label,
        callback_data: `set_focus:${opt.type}`,
      },
    ]);

    await b.editMessageReplyMarkup(
      { inline_keyboard: updatedKeyboard },
      { chat_id: chatId, message_id: messageId }
    );

    await b.sendMessage(
      chatId,
      `✅ Growth focus updated to: *${option.label}*\n\n_${option.description}_`,
      { parse_mode: 'Markdown' }
    );

    console.log(`[Telegram] Growth focus set to: ${option.type}`);
  } catch (err) {
    console.error('[Telegram] Failed to update focus:', err.message);
    await b.sendMessage(chatId, `❌ Failed to update focus: ${err.message}`).catch(() => {});
  }
}

/**
 * Handle /focus <text> — save as CUSTOM focus.
 */
async function handleSetCustomFocus(customText, chatId) {
  const b = getBot();
  if (!b || !chatId) return;

  try {
    const { data: existing } = await supabase
      .from('app_config')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!existing) {
      await b.sendMessage(chatId, '❌ No app config found. Set up your config first.');
      return;
    }

    await supabase
      .from('app_config')
      .update({
        growth_focus_type: 'CUSTOM',
        growth_focus_description: customText,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    await b.sendMessage(
      chatId,
      `✅ *Custom growth focus updated.*\n\nCurrent focus:\n_"${customText}"_\n\nAll future content will align with this focus.`,
      { parse_mode: 'Markdown' }
    );

    console.log(`[Telegram] Custom growth focus set: "${customText}"`);
  } catch (err) {
    console.error('[Telegram] Failed to set custom focus:', err.message);
    await b.sendMessage(chatId, `❌ Failed to update focus: ${err.message}`).catch(() => {});
  }
}

/**
 * Handle a schedule selection from the /schedule keyboard.
 * Updates DB, restarts the live cron, updates the keyboard ✓.
 */
async function handleSetSchedule(newCron, messageId) {
  const b = getBot();
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!b || !chatId) return;

  try {
    const { data: existing } = await supabase
      .from('app_config')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!existing) {
      await b.sendMessage(chatId, '❌ No app config found. Set up your config first.');
      return;
    }

    await supabase
      .from('app_config')
      .update({ generate_cron: newCron, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (onScheduleChange) onScheduleChange(newCron);

    // Update keyboard to show the new active preset
    const rows = [];
    for (let i = 0; i < SCHEDULE_PRESETS.length; i += 2) {
      const row = SCHEDULE_PRESETS.slice(i, i + 2).map((p) => ({
        text: p.cron === newCron ? `${p.label} ✓` : p.label,
        callback_data: `set_schedule:${p.cron}`,
      }));
      rows.push(row);
    }

    await b.editMessageReplyMarkup(
      { inline_keyboard: rows },
      { chat_id: chatId, message_id: messageId }
    );

    await b.sendMessage(
      chatId,
      `✅ Schedule updated to *${cronToHuman(newCron)}*`,
      { parse_mode: 'Markdown' }
    );

    console.log(`[Telegram] Schedule set to: ${newCron}`);
  } catch (err) {
    console.error('[Telegram] Failed to update schedule:', err.message);
    await b.sendMessage(chatId, `❌ Failed to update schedule: ${err.message}`).catch(() => {});
  }
}

/**
 * Handle /schedule HH:MM — parse, validate, and save as custom schedule.
 */
async function handleSetCustomSchedule(arg, chatId) {
  const b = getBot();
  if (!b || !chatId) return;

  const newCron = timeToCron(arg);

  if (!newCron) {
    await b.sendMessage(
      chatId,
      `❌ Invalid time format: \`${arg}\`\n\nUse 24h format, e.g. \`/schedule 14:30\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  try {
    const { data: existing } = await supabase
      .from('app_config')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!existing) {
      await b.sendMessage(chatId, '❌ No app config found. Set up your config first.');
      return;
    }

    await supabase
      .from('app_config')
      .update({ generate_cron: newCron, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (onScheduleChange) onScheduleChange(newCron);

    await b.sendMessage(
      chatId,
      `✅ Schedule updated to *${cronToHuman(newCron)}*`,
      { parse_mode: 'Markdown' }
    );

    console.log(`[Telegram] Custom schedule set: ${newCron}`);
  } catch (err) {
    console.error('[Telegram] Failed to set custom schedule:', err.message);
    await b.sendMessage(chatId, `❌ Failed to update schedule: ${err.message}`).catch(() => {});
  }
}

// ============================================================
// Exported utilities
// ============================================================

/**
 * Register handlers for commands that require cross-service calls.
 * Called from index.js after all services are loaded.
 */
function registerCallbackHandlers({ regenerate, markPosted, discard, generate, scheduleChange }) {
  onRegenerate = regenerate;
  onMarkPosted = markPosted;
  onDiscard = discard;
  onGenerate = generate;
  onScheduleChange = scheduleChange;
}

function buildKeyboard(postId) {
  return {
    inline_keyboard: [
      [
        { text: '🔁 Regenerate', callback_data: `regenerate:${postId}` },
        { text: '🗑️ Discard', callback_data: `discard:${postId}` },
      ],
      [
        { text: '✅ Mark as Posted', callback_data: `mark_posted:${postId}` },
      ],
    ],
  };
}

function buildMessageText(subreddit, content) {
  return `📍 *r/${subreddit}*\n\n${content}`;
}

async function sendPost(post) {
  const b = getBot();
  if (!b) {
    console.warn('[Telegram] Bot not configured — skipping notification');
    return null;
  }

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn('[Telegram] TELEGRAM_CHAT_ID not set — skipping notification');
    return null;
  }

  const text = buildMessageText(post.subreddit, post.content);

  const msg = await b.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: buildKeyboard(post.id),
  });

  return msg.message_id;
}

async function editPost(messageId, newContent, postId, subreddit) {
  const b = getBot();
  if (!b) return;

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  const text = subreddit ? buildMessageText(subreddit, newContent) : newContent;

  await b.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: buildKeyboard(postId),
  });
}

async function markMessageAsPosted(messageId, subreddit, originalContent) {
  const b = getBot();
  if (!b) return;

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  const base = subreddit ? buildMessageText(subreddit, originalContent) : originalContent;

  await b.editMessageText(`${base}\n\n✅ _Marked as posted._`, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [] },
  });
}

async function markMessageAsDiscarded(messageId, subreddit, originalContent) {
  const b = getBot();
  if (!b) return;

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  const base = subreddit ? buildMessageText(subreddit, originalContent) : originalContent;

  await b.editMessageText(`${base}\n\n🗑️ _Discarded._`, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [] },
  });
}

async function notify(text) {
  const b = getBot();
  if (!b) return;

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  await b.sendMessage(chatId, text);
}

// Initialize bot on module load
getBot();

module.exports = {
  sendPost,
  editPost,
  markMessageAsPosted,
  markMessageAsDiscarded,
  notify,
  registerCallbackHandlers,
  FOCUS_OPTIONS,
};
