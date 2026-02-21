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
async function generateRedditPost(config, whatBuilt, concreteDetails, recentPosts, subreddit) {
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

  const writingSamplesText = (config.writing_samples || '').trim();

  const userPrompt = `
You are ghostwriting a Reddit post FOR ME for the subreddit r/${subreddit}. You must write in MY voice — not yours.

${writingSamplesText ? `=== HOW I ACTUALLY WRITE (real samples of my writing) ===
Study these carefully. This is my actual voice: my rhythm, vocabulary, sentence length, how I start sentences, how I end thoughts, my level of formality, my quirks. Mirror all of it.

${writingSamplesText}

CRITICAL: The post must sound EXACTLY like I wrote it. Someone who knows me should read it and think "yeah, that's him." Don't make it more polished, more structured, or more "correct" than my samples above. Keep my imperfections if they define my style.

` : ''}=== ABOUT MY APP ===
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

=== CONCRETE DETAILS (numbers, dates, names, specific events) ===
${concreteDetails ? concreteDetails : 'None provided — write only what can be inferred from the context above. Do not invent specifics.'}

RULE: Every factual claim in the post must be grounded in at least one detail from the section above. If a sentence has no specific fact behind it, cut it or make it more general. Do not invent numbers, metrics, or events.

=== RECENT POSTS (DO NOT repeat these angles or topics) ===
${recentPostsSummary}

=== INSTRUCTIONS ===
- Write ONE post: a title and a body
- It must sound like ME — use my voice from the samples above as the primary guide
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

  const systemPrompt = writingSamplesText
    ? 'You are a ghostwriter. Your only job is to write in the exact voice of the person whose writing samples you have been given. Study their samples deeply — their rhythm, word choice, sentence structure, level of polish, how casual or formal they are. Reproduce their voice perfectly. Never make their writing sound more professional or structured than it is. Respond only with the requested JSON.'
    : 'You are a developer writing authentic, value-driven posts for Reddit. You write like a real founder building in public — honest, direct, occasionally vulnerable, always useful. Never write marketing copy. Respond only with the requested JSON.';

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
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

  // Anti-AI pass: strip expressions that sound like an LLM trying to be casual
  const cleanedBody = await antiAiPass(parsed.body.trim());

  // Format as a single content string — title bold, body below
  // Telegram renders **bold** with Markdown parse mode
  return `*${parsed.title.trim()}*\n\n${cleanedBody}`;
}

/**
 * Second-pass cleanup: removes AI-flavoured casual language without adding content.
 * Returns the cleaned body text.
 */
async function antiAiPass(text) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an editor. Your only job is to remove or replace words and phrases that sound like an AI trying to sound casual or emphatic. Do not add new sentences. Do not change the meaning. Do not restructure paragraphs. Only remove or simplify the flagged expressions. Return the cleaned text as plain text — no JSON, no markdown formatting.',
      },
      {
        role: 'user',
        content: `Read this post body. Find and remove or replace every expression that sounds like an AI trying to sound casual or emphatic: "bam", "totally", "wild", "crazy", "game-changer", "game-changing", "on a new wave", "it's just crazy", "honestly", "genuinely", "truly", "simply", "basically", "actually", "incredibly", "literally", "amazing", "awesome", "exciting", "fascinating", "revolutionary", "transformative", "seamlessly", "effortlessly", "leverage", "unlock", "supercharge", "dive into", "level up", "at the end of the day", "the thing is", "here's the thing", "let me be honest", "I have to say", and similar AI-flavoured filler. Replace with plain language or nothing. Do NOT add new content. Only edit what is already there.\n\nPost body:\n${text}`,
      },
    ],
    temperature: 0.2,
  });

  const cleaned = response.choices[0].message.content?.trim();
  return cleaned || text; // fallback to original if something goes wrong
}

module.exports = { generateRedditPost };
