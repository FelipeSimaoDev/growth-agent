const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Builds the prompt and calls OpenAI to generate a Reddit-style post.
 *
 * @param {Object} config        - app_config row
 * @param {string|null} whatBuilt - today's daily input text
 * @param {Array} recentPosts    - last 5 posts [{content}]
 * @param {string} subreddit     - target subreddit for this post
 * @returns {string} formatted content: "**Title**\n\nBody..."
 */
async function generateRedditPost(config, whatBuilt, recentPosts, subreddit) {
  const contextBlocksText = (config.context_blocks || [])
    .map((b) => `### ${b.title}\n${b.content}`)
    .join('\n\n');

  const recentPostsSummary = recentPosts.length
    ? recentPosts.map((p, i) => `${i + 1}. ${p.content.split('\n')[0]}`).join('\n')
    : 'No recent posts yet.';

  const whatBuiltText = whatBuilt
    ? whatBuilt
    : 'Nothing specific today — write a general building-in-public or insight post.';

  const focusType = config.growth_focus_type || 'BUILD_IN_PUBLIC';
  const focusDescription =
    config.growth_focus_description ||
    'Share honest insights about building the app and the personal journey behind it.';

  const userPrompt = `
You are helping me write ONE Reddit post for the subreddit: r/${subreddit}

=== ABOUT MY APP ===
Name: ${config.app_name}
Description: ${config.description}
Target audience: ${config.target_audience}
Tone: ${config.tone_of_voice}

=== CONTEXT (things I've written about my product) ===
${contextBlocksText}

=== CURRENT GROWTH FOCUS ===
Type: ${focusType}
Objective: ${focusDescription}

The post must naturally align with this growth focus. Let it shape:
- The angle you choose (what story to tell)
- How much you explain vs. show
- The intensity of the call to action (subtle → strong)
- Whether to position as builder, user, or observer
Do NOT reference the focus type label directly. Let it guide the post invisibly.

=== WHAT I BUILT OR LEARNED TODAY ===
${whatBuiltText}

=== RECENT POSTS (DO NOT repeat these angles or topics) ===
${recentPostsSummary}

=== INSTRUCTIONS ===
- Write ONE post: a title and a body
- The post should feel personal and real, not polished or corporate
- Provide genuine value or a real story — not a product pitch
- If you mention the product, make it incidental — the post must stand alone without it
- End with a soft open question to encourage comments
- Keep the body between 150–400 words
- Do NOT mention AI, ChatGPT, or that this was generated
- Do NOT use bullet-point lists as the entire body — write in paragraphs
- Do NOT start the title with "I " — make it compelling and specific
- Respect Reddit's culture: no hype, no buzzwords, no "game-changing"

Respond ONLY in this JSON format, nothing else:
{
  "title": "...",
  "body": "..."
}
`.trim();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a developer writing authentic, value-driven posts for Reddit. You write like a real founder building in public — honest, direct, occasionally vulnerable, always useful. Never write marketing copy. Respond only with the requested JSON.',
      },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.85,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0].message.content;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`OpenAI returned invalid JSON: ${raw}`);
  }

  if (!parsed.title || !parsed.body) {
    throw new Error(`OpenAI response missing title or body: ${raw}`);
  }

  // Format as a single content string — title bold, body below
  // Telegram renders **bold** with Markdown parse mode
  return `*${parsed.title.trim()}*\n\n${parsed.body.trim()}`;
}

module.exports = { generateRedditPost };
