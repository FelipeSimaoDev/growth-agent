const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../db/supabase');

let bot = null;

// Lazily-registered callback handlers — set from index.js to avoid circular deps
let onRegenerate = null;
let onMarkPosted = null;

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
// Bot setup
// ============================================================
function getBot() {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

    // Log all incoming messages — helps find your chat ID on first run
    bot.on('message', (msg) => {
      console.log(`[Telegram] Message from chat ${msg.chat.id}: ${msg.text}`);
    });

    // /focus — show predefined keyboard, or save custom focus if text is provided
    // Usage:
    //   /focus              → show predefined options
    //   /focus <your text>  → save as CUSTOM focus
    bot.onText(/\/focus/, async (msg) => {
      const chatId = msg.chat.id;

      // Strip the command itself; handle /focus@botname syntax
      const customText = (msg.text || '').replace(/^\/focus(@\S+)?/, '').trim();

      if (customText.length > 0) {
        await handleSetCustomFocus(customText, chatId);
        return;
      }

      // No args — show predefined keyboard
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

    bot.on('callback_query', async (query) => {
      const { data, message } = query;
      await bot.answerCallbackQuery(query.id).catch(() => {}); // dismiss loading spinner

      if (data?.startsWith('set_focus:')) {
        const focusType = data.split(':')[1];
        await handleSetFocus(focusType, message.message_id);
      } else if (data?.startsWith('regenerate:') && onRegenerate) {
        const postId = data.split(':')[1];
        await onRegenerate(postId, message.message_id);
      } else if (data?.startsWith('mark_posted:') && onMarkPosted) {
        const postId = data.split(':')[1];
        await onMarkPosted(postId, message.message_id);
      }
    });

    bot.on('polling_error', (err) => {
      console.error('[Telegram] Polling error:', err.message);
    });

    console.log('[Telegram] Bot started (polling)');
  }
  return bot;
}

/**
 * Handle a focus selection from the /focus keyboard.
 * Updates app_config, edits the keyboard to reflect the new selection,
 * and sends a confirmation message.
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

    // Update keyboard to show the new active option
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
 * Save a free-text custom focus sent as /focus <text>.
 * Sets growth_focus_type = 'CUSTOM' and stores the full text as description.
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

// ============================================================
// Exported utilities
// ============================================================

/**
 * Register the handlers for post-level inline button callbacks.
 * Called from index.js after all services are loaded.
 */
function registerCallbackHandlers({ regenerate, markPosted }) {
  onRegenerate = regenerate;
  onMarkPosted = markPosted;
}

function buildKeyboard(postId) {
  return {
    inline_keyboard: [
      [
        { text: '🔁 Regenerate', callback_data: `regenerate:${postId}` },
        { text: '✅ Mark as Posted', callback_data: `mark_posted:${postId}` },
      ],
    ],
  };
}

/**
 * Send a new post to Telegram with inline action buttons.
 * Returns the Telegram message_id so we can edit it later.
 */
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

  const msg = await b.sendMessage(chatId, post.content, {
    parse_mode: 'Markdown',
    reply_markup: buildKeyboard(post.id),
  });

  return msg.message_id;
}

/**
 * Edit an existing Telegram message with new content (after regeneration).
 * Preserves the inline keyboard.
 */
async function editPost(messageId, newContent, postId) {
  const b = getBot();
  if (!b) return;

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  await b.editMessageText(newContent, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: buildKeyboard(postId),
  });
}

/**
 * Edit an existing Telegram message to append a "marked as posted" notice.
 * Removes the inline keyboard buttons.
 */
async function markMessageAsPosted(messageId, originalContent) {
  const b = getBot();
  if (!b) return;

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  await b.editMessageText(`${originalContent}\n\n✅ _Marked as posted._`, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [] },
  });
}

/**
 * Send a plain text notification (errors, system messages).
 */
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
  notify,
  registerCallbackHandlers,
  FOCUS_OPTIONS,
};
