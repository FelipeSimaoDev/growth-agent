const TelegramBot = require('node-telegram-bot-api');

let bot = null;

// Lazily-registered callback handlers — set from index.js to avoid circular deps
let onRegenerate = null;
let onMarkPosted = null;

function getBot() {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

    // Log incoming messages — useful for finding your chat ID on first run
    bot.on('message', (msg) => {
      console.log(`[Telegram] Message from chat ${msg.chat.id}: ${msg.text}`);
    });

    bot.on('callback_query', async (query) => {
      const { data, message } = query;
      await bot.answerCallbackQuery(query.id).catch(() => {}); // dismiss loading spinner

      if (data?.startsWith('regenerate:') && onRegenerate) {
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
 * Register the handlers for Telegram inline button callbacks.
 * Called from index.js after all services are loaded.
 *
 * @param {{ regenerate: Function, markPosted: Function }} handlers
 */
function registerCallbackHandlers({ regenerate, markPosted }) {
  onRegenerate = regenerate;
  onMarkPosted = markPosted;
}

/**
 * Build the inline keyboard shown under every post message.
 */
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
 *
 * @param {Object} post  - post row with id + content
 * @returns {number|null} telegram message_id
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
 * Edit an existing Telegram message with new content (e.g. after regeneration).
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
    reply_markup: { inline_keyboard: [] }, // remove action buttons
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

module.exports = { sendPost, editPost, markMessageAsPosted, notify, registerCallbackHandlers };
