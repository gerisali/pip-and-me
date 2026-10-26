// Weekly report: raw events + learner snapshot, aggregated. Parent downloads it and gives it to Claude,
// who writes the next week's content pack from it.
import { events, kv } from './db.js';
import { getLearner } from './learner.js';

const DAY = 86400000;
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export async function aggregate(sinceTs) {
  const ev = await events.since(sinceTs);
  const by = (t) => ev.filter((e) => e.type === t);

  const talk = by('talk_turn');
  const childTurns = talk.filter((t) => t.childText);
  const wc = childTurns.map((t) => t.analysis?.word_count ?? t.childText.split(/\s+/).filter(Boolean).length);
  const turkishTurns = childTurns.filter((t) => t.analysis?.used_turkish).length;

  const errorCounts = {};
  const errorExamples = {};
  const allAnalyses = [...talk, ...by('letter_reply'), ...by('story_page')].map((e) => ({ a: e.analysis, mode: e.type }));
  for (const { a, mode } of allAnalyses) {
    for (const er of a?.errors || []) {
      errorCounts[er.type] = (errorCounts[er.type] || 0) + 1;
      (errorExamples[er.type] = errorExamples[er.type] || []).length < 4 &&
        errorExamples[er.type].push({ said: er.said, better: er.better, mode });
    }
  }
  const chunkUse = {};
  const wordsProduced = {};
  const turkishGaps = [];
  for (const { a } of allAnalyses) {
    for (const c of a?.target_chunks_used || []) chunkUse[c] = (chunkUse[c] || 0) + 1;
    for (const w of a?.target_words_used || []) wordsProduced[w] = (wordsProduced[w] || 0) + 1;
    for (const t of a?.turkish_words || []) turkishGaps.push(t);
  }

  const wr = by('word_result');
  const wordStats = {};
  for (const r of wr) {
    const s = (wordStats[r.word] = wordStats[r.word] || { right: 0, wrong: 0 });
    r.correct ? s.right++ : s.wrong++;
  }
  const hardWords = Object.entries(wordStats)
    .filter(([, s]) => s.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 12)
    .map(([w, s]) => ({ word: w, ...s }));

  const reading = by('read_aloud');
  const misreads = {};
  for (const r of reading) for (const m of r.missed || []) misreads[m] = (misreads[m] || 0) + 1;

  const quiz = [...by('letter_question'), ...by('explorer_answer')];
  const ends = by('session_end');
  const minutesByModule = {};
  for (const e of ends) minutesByModule[e.module] = round((minutesByModule[e.module] || 0) + (e.seconds || 0) / 60, 1);
  const sessionDays = new Set(ev.filter((e) => e.type === 'session_start').map((e) => new Date(e.ts).toLocaleDateString('sv')));

  const letters = by('letter_reply');
  const hints = by('talk_hint').length;

  return {
    events: ev,
    metrics: {
      activeDays: sessionDays.size,
      minutesByModule,
      talk: {
        childTurns: childTurns.length,
        meanWordsPerTurn: wc.length ? round(wc.reduce((a, b) => a + b, 0) / wc.length) : 0,
        longestTurnWords: wc.length ? Math.max(...wc) : 0,
        oneWordTurns: wc.filter((x) => x <= 1).length,
        turkishTurnRatio: childTurns.length ? round(turkishTurns / childTurns.length) : 0,
        hintsUsed: hints,
      },
      writing: {
        replies: letters.length,
        meanWords: letters.length ? round(letters.reduce((a, l) => a + (l.text || '').split(/\s+/).filter(Boolean).length, 0) / letters.length, 1) : 0,
        storyPages: by('story_page').length,
      },
      reading: {
        readAloudAttempts: reading.length,
        meanAccuracy: reading.length ? round(reading.reduce((a, r) => a + (r.accuracy || 0), 0) / reading.length) : null,
        misreadWords: Object.entries(misreads).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w, n]) => ({ word: w, n })),
        quizAccuracy: quiz.length ? round(quiz.filter((q) => q.correct).length / quiz.length) : null,
        quizCount: quiz.length,
      },
      vocabulary: {
        wordLabAnswers: wr.length,
        wordLabAccuracy: wr.length ? round(wr.filter((r) => r.correct).length / wr.length) : null,
        hardWords,
        wordsProducedInSpeechOrWriting: wordsProduced,
      },
      errors: Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count, examples: errorExamples[type] })),
      targetChunksProduced: chunkUse,
      turkishGaps: turkishGaps.slice(0, 30),
      flags: by('flag').map((f) => ({ ts: new Date(f.ts).toISOString(), ...f.flag, text: f.text })),
    },
  };
}

export async function buildWeeklyReport(days = 7) {
  const since = Date.now() - days * DAY;
  const { events: ev, metrics } = await aggregate(since);
  const learner = await getLearner();
  const settings = await kv.get('settings', {});
  const week = await kv.get('currentWeek', null);

  // Short transcript samples: last 3 talk sessions, compact.
  const talk = ev.filter((e) => e.type === 'talk_turn');
  const sessions = [...new Set(talk.map((t) => t.session))].slice(-3);
  const transcripts = sessions.map((s) => ({
    session: s,
    mission: talk.find((t) => t.session === s)?.missionId,
    turns: talk.filter((t) => t.session === s).flatMap((t) => [
      ...(t.childText ? [{ who: 'child', text: t.childText }] : []),
      { who: 'pip', text: t.pipText },
    ]),
  }));
  const letters = ev.filter((e) => e.type === 'letter_reply').map((l) => ({ letterId: l.letterId, childText: l.text }));
  const pages = ev.filter((e) => e.type === 'story_page').map((p) => ({ page: p.pageIndex, childText: p.text, corrected: p.corrected }));

  const boxes = [1, 2, 3, 4, 5].map((b) => Object.values(learner.words).filter((w) => w.box === b).length);

  return {
    schema: 'pip-weekly-report/1',
    generatedAt: new Date().toISOString(),
    periodDays: days,
    currentWeek: week,
    child: { age: 9, firstLanguage: 'Turkish', name: settings.childName || undefined },
    metrics,
    learnerSnapshot: {
      wordBoxes: { box1: boxes[0], box2: boxes[1], box3: boxes[2], box4: boxes[3], box5: boxes[4] },
      errorTotals: Object.fromEntries(Object.entries(learner.errors).map(([k, v]) => [k, v.count])),
      chunkTotals: learner.chunks,
      stars: learner.stars,
      totalSessions: learner.sessions,
    },
    samples: { transcripts, letters, pages },
    noteForClaude:
      'Use this report to write the next week pack (docs/CONTENT_SCHEMA.md). Recycle hard/misread words and Turkish gaps, target the top 2 error types with chunks and missions, keep what she enjoyed (minutes by module), adjust level if mean words per turn and accuracy allow.',
  };
}

export function download(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

// Compare a target text with what speech recognition heard → words she skipped or misread.
export function compareReading(target, heard) {
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
  const t = norm(target);
  const h = norm(heard);
  const hs = new Map();
  h.forEach((w) => hs.set(w, (hs.get(w) || 0) + 1));
  const missed = [];
  for (const w of t) {
    if (hs.get(w)) hs.set(w, hs.get(w) - 1);
    else missed.push(w);
  }
  return { missed: Array.from(new Set(missed)), accuracy: t.length ? round(1 - missed.length / t.length) : 0 };
}
