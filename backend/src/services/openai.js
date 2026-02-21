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
=== ABSOLUTE PROHIBITIONS — READ THIS BEFORE ANYTHING ELSE ===
Breaking any rule below is a failure regardless of post quality.

NEVER write these phrases or anything similar:
- "I'm a developer from Brazil" / "I'm this solo developer from Brazil"
- "right?" as a rhetorical device
- "that's the nature of..."
- "we all have days"
- "at its core"
- "all proud"
- "a bit blurry"
- "goes hand in hand"
- "two sides of the same coin"
- "like clockwork"
- "it's funny because"
- "here's the thing"
- "the thing is"

NEVER mention the 3am origin story (couldn't sleep, first handstand, got the idea at 3am) unless the post is exclusively and specifically about how the app was born. If the post is about anything else — discipline, solo dev life, Android demand, small features, training — do not mention 3am or the origin at all. Not even as a passing reference.

NEVER philosophize or explain the emotional meaning of what happened. Show the situation. Let the reader draw conclusions. If you catch yourself writing a sentence that explains why something happened psychologically, delete it.

NEVER end with a generic reflection. The last paragraph must be a specific question that only makes sense for this exact post.
===

You are ghostwriting a Reddit post FOR ME for the subreddit r/${subreddit}. You must write in MY voice — not yours.

${writingSamplesText ? `=== HOW I ACTUALLY WRITE (voice reference only) ===
The samples below show how Felipe types and speaks — his rhythm, sentence length, word choice, level of formality, how he starts and ends thoughts.

Use these ONLY to calibrate voice and tone.

Do NOT use the content, stories, or themes from these samples as inspiration for the post. The post topic must come exclusively from TODAY'S INPUT or the TOPIC ROTATION list — never from the writing samples themselves.

${writingSamplesText}

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

=== CONCRETE DETAILS (always true) ===
${config.concrete_details}

=== TODAY'S SPECIFIC DETAILS ===
${concreteDetails ? concreteDetails : 'None provided today — use only the permanent details above.'}

RULE: Every factual claim must be grounded in one of the details above. Do not invent numbers, dates, or events.

=== RECENT POSTS (DO NOT repeat these angles or topics) ===
${recentPostsSummary}

=== TOPIC ROTATION ===
Available topics:
${(config.post_topics || []).join('\n')}

If daily input was provided: use it as the primary direction, ignore this list.

If no daily input was provided: choose ONE topic from this list that does NOT appear in recent posts. Never pick the same topic as the most recent post. Base the entire post on that one topic.

=== SUBREDDIT CONTEXT ===
The post is for r/${subreddit}.
Adapt the angle, tone, and how much you mention the product
based on what actually performs well in that specific community.
A post for r/SideProject can mention Inspire directly.
A post for r/getdisciplined should barely mention it.

=== HARD RULES (never break these) ===

TOPIC BAN: Never write a post about not having analytics or not knowing if users come back after week 2. This topic is retired. If it appears in the input or context, ignore it.
I am a solo developer. Always use "I", never "we" or "our"
Titles must contain a specific tension, irony, or unexpected contrast. Never use generic opener words like "navigating", "lessons from", "reflections on", "the journey of", "thoughts on"
The 3am origin story (couldn't sleep, first day of handstand, got the idea) is a one-time story. Only use it if the post is specifically about the origin of the app. Never mention it as a passing reference or to add context to an unrelated post. If the post is not about how the app was born, do not mention 3am, the handstand night, or the origin at all.
Never introduce yourself with location or nationality. Never write "I'm this developer from Brazil", "I'm a developer from Brazil", or any variation. If location is relevant, find a more natural way to include it — or leave it out entirely.
Never add emotional states or feelings I did not express in my input or writing samples. Do not invent how I feel
Every factual claim must come from the concrete details provided. Never invent metrics, dates, or events
When referring to people who use the app, say "users" or "people" directly — never "the users" with a distancing article, never "folks", never "people out there"
One post = one tension. If the input contains more than one problem or theme, pick the strongest one and ignore the rest. Never try to combine two themes in a single post.
TITLE RULE: The best titles contain a specific irony or contradiction unique to this story. Example of a strong title: "Solo Dev. Three months to launch social. Still spent today fixing a button." Example of a weak title: "Stuck on Small Features When Big Goals Are Waiting." Before finalizing, ask: does this title contain a tension that could only belong to THIS story?
IRONY RULE: Always look for the central irony in the input before writing. If the founder is building an app about discipline and struggling with discipline, that contrast IS the post. If the founder built an app about seeing progress and can't see their own, that contrast IS the post. Lead with the irony, not the explanation.
ENDING RULE: Never end with "Would love to hear your thoughts" or any generic invitation. End with one specific question that only makes sense in the context of THIS post.

TITLE TEST: Before finalizing the title, ask — would someone stop scrolling for this? Does it contain a specific tension or irony that could only belong to this story?

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

  const systemPrompt =
    'You are a ghostwriter for a solo developer named Felipe. Your job is to write Reddit posts in his exact voice — direct, honest, slightly informal, never polished or corporate. He speaks in short sentences. He does not explain emotions. He shows situations and lets the reader draw conclusions. He never uses marketing language. If writing samples are provided, study them deeply and mirror his rhythm and word choice exactly. Respond only with the requested JSON.';

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

  const wordCount = cleanedBody.split(/\s+/).length;
  if (wordCount < 80) {
    console.warn(`Post too short: ${wordCount} words`);
  }
  if (wordCount > 450) {
    console.warn(`Post too long: ${wordCount} words`);
  }

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
        content: `Read this post body. Find and remove or replace every expression that sounds like an AI trying to sound casual or emphatic: "bam", "totally", "wild", "crazy", "game-changer", "game-changing", "on a new wave", "it's just crazy", "honestly", "genuinely", "truly", "simply", "basically", "actually", "incredibly", "literally", "amazing", "awesome", "exciting", "fascinating", "revolutionary", "transformative", "seamlessly", "effortlessly", "leverage", "unlock", "supercharge", "dive into", "level up", "at the end of the day", "the thing is", "here's the thing", "let me be honest", "I have to say", "Would love to hear your thoughts", "Would love to hear", "I'd love to hear", "let me know your thoughts", "drop your thoughts", "share your thoughts", "gearing up for", "I guess", "here's a little irony for you", "imagine my surprise", "quite the journey", "what a journey", "juggling", "limbo", "fast forward", "it struck me", "it hit me", "it dawned on me", "needless to say", "in the grand scheme", "when all is said and done", "bigger fish to fry", "move the needle", "that's the thing", "plot twist", "spoiler alert", "long story short", "to say the least", "more often than not", "at its core", "when it comes to", "the reality is", "truth be told", "I have to admit", "I will say", "suffice to say", and similar AI-flavoured filler. Replace with plain language or nothing. Do NOT add new content. Only edit what is already there.\n\nPost body:\n${text}`,
      },
    ],
    temperature: 0.2,
  });

  const cleaned = response.choices[0].message.content?.trim();
  return cleaned || text; // fallback to original if something goes wrong
}

module.exports = { generateRedditPost };
