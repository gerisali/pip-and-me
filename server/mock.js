// Demo mode (no ANTHROPIC_API_KEY): simple rule-based Pip so the app can be tried and tested.

const pick = (arr, n) => arr[n % arr.length];

const TALK = [
  'Wow! Tell me more, please!',
  'That is so interesting! What colour is it?',
  'I love that! Is it big or small?',
  'Really? What is your favourite animal?',
  'On Zoot we have purple trees! What do you like to draw?',
];

function analyse(text, ctx) {
  const words = (text || '').toLowerCase().match(/[a-zçğıöşü']+/gi) || [];
  const trChars = /[çğıöşü]/i.test(text || '');
  const chunks = (ctx.pack?.chunks || [])
    .map((c) => c.text)
    .filter((c) => (text || '').toLowerCase().includes(c.replace(/\.\.\..*$/, '').trim().toLowerCase()));
  const vocab = (ctx.pack?.vocab || []).map((v) => v.word.toLowerCase()).filter((w) => words.includes(w));
  const errors = [];
  if (/\bi (go|eat|see|play)\b.*\byesterday\b|\byesterday\b.*\bi (go|eat|see|play)\b/i.test(text || ''))
    errors.push({ type: 'past_tense', said: text, better: text.replace(/\bgo\b/, 'went').replace(/\beat\b/, 'ate') });
  if (/\b(he|she|it) (like|have|go|play)\b/i.test(text || ''))
    errors.push({ type: 'third_person_s', said: text, better: text.replace(/\b(he|she|it) (like|go|play)\b/i, (m, a, b) => `${a} ${b}s`).replace(/\b(he|she|it) have\b/i, '$1 has') });
  return {
    errors,
    used_turkish: trChars,
    turkish_words: trChars ? [{ tr: (text.match(/\S*[çğıöşü]\S*/i) || [''])[0], en: '?' }] : [],
    target_chunks_used: chunks,
    target_words_used: vocab,
    other_good_language: [],
    word_count: words.length,
    mission_progress: 0.2,
    flag: null,
  };
}

export function mockChat(mode, ctx, messages) {
  const childTurns = messages.filter((m) => m.role === 'child');
  const last = childTurns.at(-1)?.text || '';
  const n = childTurns.length;
  const analysis = analyse(last, ctx);
  const name = ctx.characterName || 'Pip';

  if (mode === 'mailbox') {
    return {
      reply: `Dear ${ctx.childName || 'friend'},\n\nThank you for your letter! I read it three times. I love it.\nOn Zoot it is raining purple rain today.\nWhat do you like to do on rainy days?\n\nLove, ${name}`,
      emotion: 'happy',
      analysis,
      mock: true,
    };
  }
  if (mode === 'story') {
    return {
      reply: 'What a great page! What colour is it?',
      emotion: 'surprised',
      page_text: last.charAt(0).toUpperCase() + last.slice(1) + (/[.!?]$/.test(last) ? '' : '.'),
      analysis,
      mock: true,
    };
  }
  let reply = pick(TALK, n);
  if (analysis.used_turkish) reply = 'Hmm, is that a Zoot song? Can you say it in English?';
  else if (analysis.word_count === 1) reply = `${last.trim()}? Wow! Can you tell me in a sentence?`;
  if (n >= (ctx.maxTurns || 16)) reply = 'Thank you! You taught me so much today. Goodbye for now!';
  return { reply, emotion: pick(['happy', 'curious', 'surprised'], n), analysis, mock: true };
}
