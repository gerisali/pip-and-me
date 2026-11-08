// Keeps the hidden analysis honest. Used on the server (new turns) and in the app (older saved turns).
// - Errors must come from the child's newest message (the model sometimes repeats slips from earlier turns).
// - Full forms are correct English: "I am" vs "I'm" is never an error.
// - In speech, spelling belongs to the transcriber ("color", "favorite"), not to the child.
// - Turkish words must actually appear in the newest message.

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-zçğıöşü' ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CONTRACTIONS = [
  [/\bi'm\b/g, 'i am'], [/\bit's\b/g, 'it is'], [/\byou're\b/g, 'you are'], [/\bhe's\b/g, 'he is'], [/\bshe's\b/g, 'she is'],
  [/\bthat's\b/g, 'that is'], [/\bwhat's\b/g, 'what is'], [/\bthere's\b/g, 'there is'], [/\bwe're\b/g, 'we are'],
  [/\bthey're\b/g, 'they are'], [/\bdon't\b/g, 'do not'], [/\bdoesn't\b/g, 'does not'], [/\bcan't\b/g, 'cannot'],
  [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'], [/\bi've\b/g, 'i have'], [/\bi'll\b/g, 'i will'], [/\blet's\b/g, 'let us'],
];
const expand = (s) => CONTRACTIONS.reduce((t, [re, v]) => t.replace(re, v), norm(s)).replace(/\bcolour\b/g, 'color').replace(/\bfavourite\b/g, 'favorite');

const tokens = (s) => norm(s).split(' ').filter(Boolean);

// Does `frag` come from `text`? (most of its words are in it)
function partOf(frag, text) {
  const f = tokens(frag);
  if (!f.length) return false;
  const t = new Set(tokens(text));
  const hit = f.filter((w) => t.has(w)).length;
  return hit / f.length >= 0.7;
}

export function cleanAnalysis(a, childText, mode = 'talk') {
  if (!a || typeof a !== 'object' || !childText) return a;
  const speech = mode === 'talk' || mode === 'talk_turn';
  const errors = (a.errors || []).filter((e) => {
    if (!e || !e.said) return false;
    if (speech && e.type === 'spelling') return false;
    if (!partOf(e.said, childText)) return false; // repeated from an earlier turn
    if (expand(e.said).replace(/[ .!?]/g, '') === expand(String(e.better || '').replace(/\(.*?\)/g, '')).replace(/[ .!?]/g, '')) return false; // only contraction/spelling differs
    return true;
  });
  const turkish_words = (a.turkish_words || []).filter((w) => w && w.tr && partOf(w.tr, childText));
  const inText = (s) => partOf(s, childText);
  // a pattern like "I like ... / I don't like ..." counts if one of its alternatives is in the text
  const chunkIn = (c) =>
    String(c || '')
      .split('/')
      .some((alt) => {
        const words = tokens(expand(alt.replace(/\.\.\.|…/g, ' ')));
        const t = new Set(tokens(expand(childText)));
        return words.length > 0 && words.filter((w) => t.has(w)).length / words.length >= 0.7;
      });
  return {
    ...a,
    errors,
    turkish_words,
    used_turkish: turkish_words.length > 0,
    target_chunks_used: (a.target_chunks_used || []).filter(chunkIn),
    target_words_used: (a.target_words_used || []).filter(inText),
    other_good_language: (a.other_good_language || []).filter(inText),
  };
}

// Saved events: clean their analysis against the text the child produced in that event.
export function cleanEvent(e) {
  if (!e || !e.analysis) return e;
  const text = e.type === 'talk_turn' ? e.childText : e.text;
  return { ...e, analysis: cleanAnalysis(e.analysis, text, e.type) };
}
