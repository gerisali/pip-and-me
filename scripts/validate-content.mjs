// Checks every week pack in public/content/weeks (or files given as arguments).
import { readFileSync, readdirSync } from 'node:fs';

const REQUIRED = ['id', 'week', 'level', 'title', 'vocab', 'chunks', 'talkMissions', 'letters', 'story', 'explorer', 'phonics'];
const dir = new URL('../public/content/weeks/', import.meta.url);
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => new URL(f, dir).pathname);

let bad = 0;
for (const f of files) {
  const problems = [];
  let p;
  try {
    p = JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    console.log(`✗ ${f}: invalid JSON (${e.message})`);
    bad++;
    continue;
  }
  for (const k of REQUIRED) if (p[k] === undefined) problems.push(`missing ${k}`);
  if (!['starters', 'movers', 'flyers'].includes(p.level)) problems.push('bad level');
  const qs = [...(p.letters || []).flatMap((l) => l.questions || []), ...(p.explorer || []).flatMap((c) => c.questions || [])];
  for (const q of qs) if (!(q.answer >= 0 && q.answer < q.options.length)) problems.push(`bad answer: ${q.q}`);
  for (const v of p.vocab || []) if (!v.word || !v.emoji) problems.push(`vocab item incomplete: ${JSON.stringify(v)}`);
  for (const m of p.talkMissions || []) if (!m.opener || !m.goal) problems.push(`mission incomplete: ${m.id}`);
  if (problems.length) {
    bad++;
    console.log(`✗ ${p.id || f}: ${problems.join('; ')}`);
  } else console.log(`✓ ${p.id}: week ${p.week}, ${p.level}, ${p.vocab.length} words, ${p.talkMissions.length} missions`);
}
process.exit(bad ? 1 : 0);
