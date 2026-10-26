# Pip & Me

Speaking-first English companion for a 9-year-old Turkish learner. Pip is a curious fox from planet Zoot who only
understands English, so she has a real reason to speak. Pip never says "wrong": every slip is recast and logged for the parent.

- **Kurulum (Turkish setup guide):** [KURULUM.md](KURULUM.md)
- **Week pack format:** [docs/CONTENT_SCHEMA.md](docs/CONTENT_SCHEMA.md)
- **Weekly data → next week procedure:** [docs/HAFTALIK_GUNCELLEME.md](docs/HAFTALIK_GUNCELLEME.md)

## Structure

```
api/[route].js        Vercel function → server/handlers.js (health, chat, transcribe, tts)
server/config.js      models/providers via env vars
server/prompts.js     Pip's persona, pedagogy rules, structured-output tools (reply + hidden analysis)
server/mock.js        demo mode when no ANTHROPIC_API_KEY
src/screens/          Home, Talk, Mailbox, Story, Explorer, WordLab (vocab + phonics), Parent
src/lib/learner.js    learner model: Leitner boxes, error counts, chunk use, Turkish gaps
src/lib/report.js     weekly report aggregation + read-aloud comparison
src/lib/db.js         IndexedDB (kv + event log) — all data stays on the device
public/content/weeks/ week packs (JSON); new ones can also be imported from the parent panel
```

## Commands

```bash
npm install
npm run dev               # app + API on http://localhost:5173 (reads .env)
npm run build             # production build (Vercel runs this)
npm run validate-content  # check week packs
```
