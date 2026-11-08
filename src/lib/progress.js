// Daily lesson + automatic week progression.
//
// Every lesson day (3 a week, ~25-30 min) covers all skills:
//   1. Word Lab  (listening, spelling, saying words)       ~5 min
//   2. Talk      (speaking: next mission of the week)      ~10 min
//   3. Read & write, rotating: Mailbox → Explorer → Story  ~10 min
//   4. Sounds    (phonics)                                  ~3 min
// An unfinished lesson carries over to the next day.
//
// The week moves on by itself when she is ready (see READY), or after MAX_LESSONS lessons at the latest.
import { kv, events, getRole } from './db.js';
import { getLearner } from './learner.js';
import { loadPacks, sortedPacks, currentPack, setCurrentWeek } from './content.js';

export const ROTATION = ['mailbox', 'explorer', 'story'];
export const STEP_MINUTES = { wordlab: 5, talk: 10, mailbox: 10, explorer: 10, story: 10, phonics: 3 };
export const READY = { minLessons: 3, vocabShare: 0.6, missions: 2, patterns: 3 };
export const MAX_LESSONS = 5;

const todayStr = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD, local time

function lessonFor(index) {
  return { index, items: ['wordlab', 'talk', ROTATION[index % ROTATION.length], 'phonics'] };
}

// Current lesson: continue an unfinished one (even from an earlier day); a new one starts the day after a finished one.
export async function todayLesson() {
  const st = await kv.get('lessonState', null);
  const index = await kv.get('lessonIndex', 0);
  if (st && (!st.completed || st.date === todayStr())) {
    return { ...lessonFor(st.index), done: st.done || [], completed: !!st.completed };
  }
  return { ...lessonFor(index), done: [], completed: false };
}

// Called by every activity when she finishes it. Returns true when this finished today's lesson.
export async function markStep(item) {
  const lesson = await todayLesson();
  if (!lesson.items.includes(item) || lesson.completed) return lesson.completed;
  const done = Array.from(new Set([...lesson.done, item]));
  const completed = lesson.items.every((x) => done.includes(x));
  await kv.set('lessonState', { index: lesson.index, date: todayStr(), done, completed });
  if (completed) {
    await kv.set('lessonIndex', lesson.index + 1);
    const pack = await currentPack();
    await events.add({ type: 'lesson_complete', week: pack?.id, lesson: lesson.index });
    await maybeAdvance();
  }
  return completed;
}

// The Talk mission for today's lesson: first one not done yet, otherwise rotate.
export async function nextMission(pack, lessonIndex = 0) {
  const ms = pack?.talkMissions || [];
  if (!ms.length) return null;
  const done = await kv.get('missionsDone', []);
  return ms.find((m) => !done.includes(m.id)) || ms[lessonIndex % ms.length];
}

// How ready she is to move on from this week's pack.
export async function weekStatus(pack) {
  if (!pack) return null;
  const L = await getLearner();
  const all = await events.all();
  const lessons = all.filter((e) => e.type === 'lesson_complete' && e.week === pack.id).length;
  const vocab = (pack.vocab || []).map((v) => v.word.toLowerCase());
  const known = vocab.filter((w) => (L.words[w]?.right || 0) > 0 && (L.words[w]?.box || 1) >= 2);
  const done = await kv.get('missionsDone', []);
  const missions = (pack.talkMissions || []).filter((m) => done.includes(m.id)).length;
  const patterns = (pack.chunks || []).filter((c) => (L.chunks[c.text] || 0) > 0).length;
  const list = sortedPacks(await loadPacks());
  const next = list[list.findIndex((p) => p.id === pack.id) + 1] || null;
  const checks = {
    lessons: { value: lessons, target: READY.minLessons, ok: lessons >= READY.minLessons },
    vocab: { value: known.length, total: vocab.length, target: Math.ceil(vocab.length * READY.vocabShare), ok: known.length >= Math.ceil(vocab.length * READY.vocabShare) },
    missions: { value: missions, target: Math.min(READY.missions, (pack.talkMissions || []).length), ok: missions >= Math.min(READY.missions, (pack.talkMissions || []).length) },
    patterns: { value: patterns, target: Math.min(READY.patterns, (pack.chunks || []).length), ok: patterns >= Math.min(READY.patterns, (pack.chunks || []).length) },
  };
  const ready = Object.values(checks).every((c) => c.ok);
  const timeUp = lessons >= MAX_LESSONS;
  return { pack, next, lessons, checks, ready, timeUp, shouldAdvance: !!next && (ready || timeUp) };
}

export async function maybeAdvance() {
  if (getRole() === 'parent') return null; // parent preview never moves the week
  const settings = await kv.get('settings', {});
  if (settings.autoAdvance === false) return null;
  const pack = await currentPack();
  const st = await weekStatus(pack);
  if (!st?.shouldAdvance) return null;
  await setCurrentWeek(st.next.id);
  const info = { from: pack.id, to: st.next.id, week: st.next.week, title: st.next.title, early: st.ready, ts: Date.now() };
  await kv.set('weekUnlocked', info);
  await events.add({ type: 'week_advance', from: pack.id, to: st.next.id, reason: st.ready ? 'ready' : 'max_lessons', checks: st.checks });
  window.dispatchEvent(new CustomEvent('pip:week-changed'));
  return info;
}
