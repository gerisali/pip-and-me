# Weekly update procedure (for Claude)

Input: a `pip-weekly-report/1` JSON exported from the parent panel.
Output: the next week pack `week-NN.json` following `docs/CONTENT_SCHEMA.md`, validated with `npm run validate-content -- <file>`,
plus a short Turkish note to the parent (3-5 bullets: what went well, what to watch, what changes next week).

## Decision rules

1. **Level.** Keep the level unless: `talk.meanWordsPerTurn` ≥ 5 for two weeks AND quiz accuracy ≥ 0.8 → move up
   (starters → movers → flyers). If mean words/turn < 2.5 or Turkish ratio > 0.4 → simplify (shorter openers, more choice questions, more hints).
2. **Grammar focus.** Top 1-2 `metrics.errors` types become next week's grammar goal: build 2 chunks and 1 talk mission that
   naturally elicit them (e.g. past_tense → "Yesterday I…", "Last weekend we…", a mission about what she did).
3. **Vocabulary.** Next week's vocab = ~70% new theme words + ~30% recycled: `vocabulary.hardWords`, `reading.misreadWords`,
   and the English side of `turkishGaps` (these are words she needed but didn't have).
4. **Phonics.** If `reading.misreadWords` share a pattern (th→t, short vowel confusion, silent e…), make it a phonics set.
5. **Engagement.** Look at `minutesByModule`: a module she avoids gets a more playful version (shorter text, a game, a topic from her interests);
   the one she enjoys most carries the main theme.
6. **Wins.** `targetChunksProduced` with ≥ 3 uses = learned; keep one in the story starters but don't re-teach.
7. **Flags.** Any `metrics.flags` → mention to the parent first, plainly.
8. Themes rotate through: me & my world, animals, routines, art, nature & weather, food & market, town & directions, feelings & friends,
   science & space, travel (Italy unit in April-May 2027). Prefer her interests: drawing, stories, animals, nature, science.
