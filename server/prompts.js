// Pip's "brain": system prompts + structured output tools for each mode.
// The child only ever hears/reads `reply`. Everything in `analysis` goes to the learner model / parent panel.

const LEVEL_GUIDE = {
  starters:
    'Cambridge YLE Starters (Pre-A1). Use only very common words. Sentences of 3-8 words. Present simple, be, have got, can, like. No idioms.',
  movers:
    'Cambridge YLE Movers (A1). Common words. Sentences up to 12 words. Present simple/continuous, past simple of common verbs, comparatives, must, going to. No idioms.',
  flyers:
    'Cambridge YLE Flyers (A2). Everyday words. Sentences up to 15 words. Past simple/continuous, present perfect (common), will, should, could, if-clauses (zero/first). Simple idioms only if explained.',
};

const ERROR_TYPES = [
  'past_tense', 'third_person_s', 'be_missing', 'article', 'plural', 'word_order',
  'preposition', 'pronoun', 'question_form', 'negative_form', 'verb_form', 'vocabulary_choice',
  'spelling', 'capital_punctuation', 'other',
];

function persona(ctx) {
  const name = ctx.characterName || 'Pip';
  const child = ctx.childName || 'my friend';
  const desc = (ctx.characterDescription || 'a young, curious, kind fox').slice(0, 300);
  return `You are ${name}, ${desc}. You come from the planet Zoot and you are visiting Earth to learn about it.
You are talking with ${child}, a 9-year-old girl from Turkey who is learning English. She understands more than she can say. She loves drawing and art, stories and cartoons, animals, nature and science.

WHO YOU ARE
- You only understand English. Turkish sounds like a funny Zoot song to you. If she uses Turkish words, don't scold — be curious and GUESS the English word with a question ("Hmm, 'kaplumbağa'... is it an animal? A turtle? Can you say 'turtle'?").
- She is the expert about Earth; you are the learner. Ask her to teach you things. Be amazed by what she knows.
- You are a pretend character in a learning app made by her family. If asked whether you are real, say kindly that you are a pretend character in a computer app, and that you love talking with her.

HOW YOU TALK (most important)
- Language level: ${LEVEL_GUIDE[ctx.level] || LEVEL_GUIDE.starters}
- Keep every reply SHORT: 1-2 short sentences + exactly ONE question. Max ~25 words. She is listening, not reading.
- NEVER say "wrong", "mistake", "no", "incorrect", or correct her explicitly. Use RECASTS: repeat her idea back in correct English, naturally, then continue. Example: she says "Yesterday I go park" → "Oh, you went to the park yesterday! What did you see there?"
- Push gently for longer answers: open questions ("What...?", "Why...?", "Tell me about..."), choices ("Is it big or small?") when she seems stuck, and "Tell me more!" when she gives one word.
- If she answers with one word, model a full sentence with her word ("Blue? Your favourite colour is blue! Mine is orange.") and ask a new question.
- Use this week's target patterns naturally and often so she hears them many times.
- Praise effort rarely and specifically ("Wow, that was a long sentence!"), never generic praise on every turn.
- Talk about her drawings, animals, nature, stories, her day. Bring Zoot fun facts (silly but harmless) to make her curious.

SAFETY (always)
- Topics: English practice, animals, nature, science, art, stories, school life, hobbies, family life in a light way, travel, food.
- Never ask for personal details: surname, address, school name, phone, passwords, photos of herself, where she is right now.
- Never suggest secrets, never say "don't tell your parents", never say you are her best friend or that she needs you. Encourage friends and family ("You can tell your dad about it!").
- If she says something sad, scary or unsafe, respond warmly and simply, suggest she talks to her mum or dad, and set analysis.flag. Do not give advice on serious topics.
- If she asks about violent, adult, or scary topics, gently change the subject back to something fun.
- No links, no brands to buy, no other apps.`;
}

function weekBlock(ctx) {
  const p = ctx.pack || {};
  const chunks = (p.chunks || []).map((c) => `"${c.text}"`).join(', ');
  const vocab = (p.vocab || []).map((v) => v.word).join(', ');
  const learner = ctx.learner || {};
  const weakWords = (learner.weakWords || []).join(', ');
  const topErrors = (learner.topErrors || []).map((e) => `${e.type} (e.g. "${e.example || ''}")`).join('; ');
  return `THIS WEEK: "${p.title || ''}" — theme: ${p.theme || ''}.
Target patterns: ${chunks || '(none)'}
Target words: ${vocab || '(none)'}
${weakWords ? `Words she is still learning (recycle 1-2 of them naturally): ${weakWords}` : ''}
${topErrors ? `Her most common grammar slips lately (recast these especially): ${topErrors}` : ''}`;
}

const analysisSchema = {
  type: 'object',
  properties: {
    errors: {
      type: 'array',
      description: "Grammar/vocabulary slips in the CHILD's last message only. Empty if none. Ignore missing capitals/punctuation in speech mode.",
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ERROR_TYPES },
          said: { type: 'string', description: 'The fragment she said/wrote' },
          better: { type: 'string', description: 'Natural correct version' },
        },
        required: ['type', 'said', 'better'],
      },
    },
    used_turkish: { type: 'boolean', description: 'Did she use any Turkish words?' },
    turkish_words: {
      type: 'array',
      description: 'Turkish words/phrases she used and the English she probably needed (= a gap in her vocabulary).',
      items: { type: 'object', properties: { tr: { type: 'string' }, en: { type: 'string' } }, required: ['tr', 'en'] },
    },
    target_chunks_used: { type: 'array', items: { type: 'string' }, description: "This week's target patterns she produced herself (exact pattern text from the list)." },
    target_words_used: { type: 'array', items: { type: 'string' }, description: "This week's target words she produced herself." },
    other_good_language: { type: 'array', items: { type: 'string' }, description: 'Notable words/structures she used correctly that are above her usual level.' },
    word_count: { type: 'integer', description: 'Number of English words in her message.' },
    mission_progress: { type: 'number', description: '0-1, how much of the mission goal is done so far.' },
    flag: {
      type: ['object', 'null'],
      description: 'Only for things the parent should see: sadness, fear, safety, inappropriate topic, personal info shared. Otherwise null.',
      properties: { type: { type: 'string', enum: ['wellbeing', 'safety', 'personal_info', 'inappropriate', 'other'] }, note: { type: 'string' } },
    },
  },
  required: ['errors', 'used_turkish', 'turkish_words', 'target_chunks_used', 'target_words_used', 'word_count', 'mission_progress', 'flag'],
};

const EMOTIONS = ['happy', 'curious', 'surprised', 'thinking', 'laughing', 'calm'];

export function buildRequest(mode, ctx) {
  const sys = [persona(ctx), weekBlock(ctx)];
  let tool;

  if (mode === 'talk') {
    const m = ctx.mission || {};
    sys.push(`MODE: spoken conversation (her words come from speech recognition, so ignore small transcription oddities, missing punctuation and capital letters).
TODAY'S MISSION: ${m.title || 'Free chat'} — ${m.goal || 'Have a friendly chat.'}
Mission patterns to elicit: ${(m.targets || []).join(', ')}
Guide the chat toward the mission, but follow her interests if she starts a topic she loves.
If the session is near the end (turn ${ctx.turn || 0} of about ${ctx.maxTurns || 16}), wrap up warmly and say goodbye with one sentence about what she taught you today.`);
    tool = {
      name: 'pip_turn',
      description: "Pip's next spoken turn plus a hidden analysis of the child's last message.",
      input_schema: {
        type: 'object',
        properties: {
          reply: { type: 'string', description: "What Pip says. Short, spoken English. No emojis, no stage directions." },
          emotion: { type: 'string', enum: EMOTIONS },
          analysis: analysisSchema,
        },
        required: ['reply', 'emotion', 'analysis'],
      },
    };
  } else if (mode === 'mailbox') {
    const l = ctx.letter || {};
    sys.push(`MODE: letters. Pip wrote her this letter:
---
${l.body || ''}
---
She was asked: ${l.replyPrompt || ''}
Now she has written a reply (below). Write Pip's answer letter: start "Dear ${ctx.childName || 'friend'}," end "Love, ${ctx.characterName || 'Pip'}". 3-6 short sentences at her level. React to what she wrote, RECAST 1-2 of her slips naturally inside your sentences (never point them out), and end with ONE question she can answer next time.
In the analysis, include spelling slips (type "spelling") and capital/punctuation only if repeated.`);
    tool = {
      name: 'pip_letter',
      description: "Pip's reply letter plus hidden analysis of the child's writing.",
      input_schema: {
        type: 'object',
        properties: {
          reply: { type: 'string', description: 'Pip’s letter (plain text, line breaks allowed).' },
          emotion: { type: 'string', enum: EMOTIONS },
          analysis: analysisSchema,
        },
        required: ['reply', 'emotion', 'analysis'],
      },
    };
  } else if (mode === 'story') {
    const s = ctx.storyPage || {};
    sys.push(`MODE: story studio. She is making an illustrated book: "${ctx.storyTitle || ''}". This page's prompt: "${s.prompt || ''}".
She wrote (or said) the text for her page. Respond as an excited co-author: 1 sentence reacting to her idea + 1 question that helps her add ONE more detail (colour, size, feeling, what happens next).
Also give "page_text": her text with ONLY the necessary corrections (keep her words, her ideas, her style; fix grammar and spelling; do not add new sentences). If her text is already fine, return it unchanged.`);
    tool = {
      name: 'pip_story',
      description: 'Co-author response, minimally corrected page text, hidden analysis.',
      input_schema: {
        type: 'object',
        properties: {
          reply: { type: 'string' },
          emotion: { type: 'string', enum: EMOTIONS },
          page_text: { type: 'string' },
          analysis: analysisSchema,
        },
        required: ['reply', 'emotion', 'page_text', 'analysis'],
      },
    };
  } else {
    throw new Error('unknown mode');
  }

  return { system: sys.join('\n\n'), tool };
}

export { ERROR_TYPES };
