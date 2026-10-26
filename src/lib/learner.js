// Learner model: what she knows, what she is still learning, what slips she makes.
// Everything is also written to the event log so weekly reports can be rebuilt from raw data.
import { kv, events } from './db.js';

const DAY = 86400000;
// Leitner boxes: 1 = new/forgotten … 5 = solid. Interval until the word is due again.
const INTERVAL = { 1: 0, 2: 1 * DAY, 3: 3 * DAY, 4: 7 * DAY, 5: 21 * DAY };

const empty = () => ({ words: {}, errors: {}, chunks: {}, turkish: [], stars: 0, sessions: 0, created: Date.now() });

let cache = null;
export async function getLearner() {
  if (!cache) cache = { ...empty(), ...(await kv.get('learner', empty())) };
  return cache;
}
async function save() {
  await kv.set('learner', cache);
}

export async function ensureWords(pack) {
  const L = await getLearner();
  let changed = false;
  for (const v of pack?.vocab || []) {
    const w = v.word.toLowerCase();
    if (!L.words[w]) {
      L.words[w] = { box: 1, due: 0, seen: 0, right: 0, wrong: 0, produced: 0, week: pack.week, emoji: v.emoji, tr: v.tr };
      changed = true;
    }
  }
  if (changed) await save();
}

export async function wordResult(word, correct, game, session) {
  const L = await getLearner();
  const w = word.toLowerCase();
  const rec = L.words[w] || (L.words[w] = { box: 1, due: 0, seen: 0, right: 0, wrong: 0, produced: 0 });
  rec.seen++;
  if (correct) {
    rec.right++;
    rec.box = Math.min(5, rec.box + 1);
  } else {
    rec.wrong++;
    rec.box = 1;
  }
  rec.due = Date.now() + INTERVAL[rec.box];
  rec.last = Date.now();
  await save();
  await events.add({ type: 'word_result', word: w, correct, game, box: rec.box, session });
}

// Words for today's Word Lab: due words (any week) first, lowest box first, then this week's new words.
export async function dueWords(pack, n = 8) {
  const L = await getLearner();
  const now = Date.now();
  const all = Object.entries(L.words).map(([word, r]) => ({ word, ...r }));
  const due = all.filter((r) => r.due <= now).sort((a, b) => a.box - b.box || a.due - b.due);
  const thisWeek = (pack?.vocab || []).map((v) => v.word.toLowerCase());
  const ordered = [...due.filter((r) => thisWeek.includes(r.word)), ...due.filter((r) => !thisWeek.includes(r.word))];
  return ordered.slice(0, n).map((r) => r.word);
}

export async function applyAnalysis(a, meta = {}) {
  if (!a) return;
  const L = await getLearner();
  const now = Date.now();
  for (const e of a.errors || []) {
    const rec = L.errors[e.type] || (L.errors[e.type] = { count: 0, examples: [] });
    rec.count++;
    rec.examples.unshift({ said: e.said, better: e.better, ts: now, mode: meta.mode });
    rec.examples = rec.examples.slice(0, 6);
  }
  for (const c of a.target_chunks_used || []) L.chunks[c] = (L.chunks[c] || 0) + 1;
  for (const w of a.target_words_used || []) {
    const rec = L.words[w.toLowerCase()];
    if (rec) rec.produced++;
  }
  for (const t of a.turkish_words || []) L.turkish.unshift({ ...t, ts: now });
  L.turkish = L.turkish.slice(0, 60);
  await save();
  if (a.flag) await events.add({ type: 'flag', flag: a.flag, mode: meta.mode, text: meta.text, session: meta.session });
}

export async function addStars(n = 1) {
  const L = await getLearner();
  L.stars += n;
  await save();
  return L.stars;
}

export async function countSession() {
  const L = await getLearner();
  L.sessions++;
  await save();
}

// Short summary sent with each model request so Pip recycles weak words and recasts frequent slips.
export async function promptSummary() {
  const L = await getLearner();
  const weakWords = Object.entries(L.words)
    .filter(([, r]) => r.seen > 0 && r.box <= 2)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 6)
    .map(([w]) => w);
  const since = Date.now() - 14 * DAY;
  const topErrors = Object.entries(L.errors)
    .map(([type, r]) => ({ type, recent: r.examples.filter((e) => e.ts > since).length, example: r.examples[0]?.said }))
    .filter((e) => e.recent > 0)
    .sort((a, b) => b.recent - a.recent)
    .slice(0, 3);
  return { weakWords, topErrors };
}

export async function resetLearner() {
  cache = empty();
  await save();
}
