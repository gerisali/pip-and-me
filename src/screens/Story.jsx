import { useEffect, useState } from 'react';
import { useApp } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import { TopBar } from './Home.jsx';
import Pip from '../character/Pip.jsx';
import Mic from '../components/Mic.jsx';
import Readable from '../components/Readable.jsx';
import { speak } from '../lib/audio.js';
import { chat } from '../lib/api.js';
import { events, kv } from '../lib/db.js';
import { applyAnalysis, addStars } from '../lib/learner.js';
import { markPlanItem } from '../lib/content.js';
import { buildCtx } from '../lib/ctx.js';
import { useSession } from '../lib/session.js';
import { fileToDataUrl } from '../lib/image.js';
import { compareReading } from '../lib/report.js';

export default function Story() {
  const { pack, settings, go, health, customImage } = useApp();
  const story = pack?.story || { title: 'My story', pages: [] };
  const session = useSession('story');
  const [book, setBook] = useState(null);
  const [i, setI] = useState(0);
  const [view, setView] = useState('edit'); // edit | book
  const [busy, setBusy] = useState(false);
  const [pipSays, setPipSays] = useState('');
  const [reading, setReading] = useState(null);

  useEffect(() => {
    kv.get('books', {}).then((b) => setBook(b[pack.id] || { pages: story.pages.map(() => ({ image: null, text: '', corrected: '' })) }));
  }, [pack.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!book) return null;
  const page = book.pages[i] || {};
  const pp = story.pages[i] || {};

  async function save(next) {
    setBook(next);
    const all = await kv.get('books', {});
    all[pack.id] = next;
    await kv.set('books', all);
  }
  const setPage = (patch) => save({ ...book, pages: book.pages.map((p, k) => (k === i ? { ...p, ...patch } : p)) });

  async function askPip() {
    if (!page.text.trim()) return;
    setBusy(true);
    try {
      const ctx = await buildCtx(pack, settings, { storyTitle: story.title, storyPage: { prompt: pp.prompt } });
      const r = await chat('story', ctx, [{ role: 'child', text: page.text }]);
      setPipSays(r.reply);
      await setPage({ corrected: r.page_text || page.text });
      await events.add({ type: 'story_page', pageIndex: i, text: page.text, corrected: r.page_text, analysis: r.analysis, session, week: pack.id });
      await applyAnalysis(r.analysis, { mode: 'story', text: page.text, session });
      await addStars(1);
      speak(r.reply);
    } catch {
      setPipSays('Bağlantı sorunu, tekrar dene.');
    }
    setBusy(false);
  }

  async function onRead(heard) {
    const target = page.corrected || page.text;
    const res = compareReading(target, heard);
    setReading({ ...res, heard });
    await events.add({ type: 'read_aloud', source: 'story', target, heard, missed: res.missed, accuracy: res.accuracy, session });
    speak(res.accuracy >= 0.9 ? 'Wow, great reading!' : 'Good try! Listen and read again.');
    if (book.pages.every((p) => p.text)) markPlanItem('story', settings.daysPerWeek);
  }

  if (view === 'book') {
    return (
      <div className="screen">
        <TopBar title={story.title} onBack={() => setView('edit')} module="story" right={<button className="btn small" onClick={() => speak(book.pages.map((p) => p.corrected || p.text).join(' '))}><Icon name="speaker" size={18} /> Read</button>} />
        <div className="book">
          <div className="book-cover card"><h2>{story.title}</h2><p>by {settings.childName}</p></div>
          {book.pages.map((p, k) => (
            <div key={k} className="book-page card">
              {p.image && <img src={p.image} alt="" />}
              <Readable text={p.corrected || p.text} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar title={story.title} onBack={() => go('home')} module="story" right={<button className="btn small" onClick={() => setView('book')}><Icon name="book" size={18} /> My book</button>} />
      <div className="tabs">
        {story.pages.map((_, k) => (
          <button key={k} className={`tab ${k === i ? 'active' : ''} ${book.pages[k]?.text ? 'filled' : ''}`} onClick={() => { setI(k); setPipSays(''); setReading(null); }}>
            Page {k + 1}
          </button>
        ))}
      </div>

      <div className="card">
        <p className="prompt" onClick={() => speak(pp.prompt)}><Icon name="speaker" size={18} /> {pp.prompt}</p>
        <p className="tiny muted">{pp.promptTr}</p>
        <label className="image-drop">
          {page.image ? <img src={page.image} alt="" /> : <span className="drop-hint"><Icon name="image" size={34} /><br />Draw on paper, then add a photo<br /><span className="tiny">Kâğıda çiz, fotoğrafını ekle</span></span>}
          <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files[0] && setPage({ image: await fileToDataUrl(e.target.files[0]) })} />
        </label>

        <div className="chips">
          {(pp.starters || []).map((s) => (
            <button key={s} className="chip" onClick={() => setPage({ text: (page.text ? page.text + ' ' : '') + s + ' ', corrected: '' })}>{s}</button>
          ))}
        </div>
        <textarea rows={4} value={page.text} onChange={(e) => setPage({ text: e.target.value, corrected: '' })} placeholder="Write your page here…" autoCapitalize="sentences" spellCheck={false} />
        {health.stt && (
          <Mic label="Or say it · Ya da söyle" onText={(t) => t && setPage({ text: (page.text ? page.text + ' ' : '') + t, corrected: '' })} prompt={`A child dictating a page of her story: ${pp.prompt}`} />
        )}
        <button className="btn primary big" onClick={askPip} disabled={busy || !page.text.trim()}>{busy ? 'Reading…' : <>Show {settings.characterName} <Icon name="sparkle" size={20} /></>}</button>
      </div>

      {(pipSays || page.corrected) && (
        <div className="card pip-help">
          <div className="row">
            <Pip state={busy ? 'thinking' : 'happy'} size={80} customImage={customImage} />
            <p>{pipSays}</p>
          </div>
          {page.corrected && page.corrected.trim() !== page.text.trim() && (
            <>
              <div className="tiny muted">Book version · Kitap için düzenlenmiş hali:</div>
              <div className="corrected">{page.corrected}</div>
              <button className="btn small" onClick={() => setPage({ text: page.corrected })}><Icon name="check" size={18} /> Use it · Bunu kullan</button>
            </>
          )}
          {health.stt && (
            <div className="read-aloud">
              <b><Icon name="speaker" size={18} /> Now read your page aloud! · Şimdi sesli oku</b>
              <Mic label="Read aloud" onText={onRead} prompt={page.corrected || page.text} maxSeconds={45} />
              {reading && (
                <div className="tiny">
                  {reading.missed.length ? <>Practice: {reading.missed.map((w) => <button key={w} className="chip" onClick={() => speak(w, { rate: 0.8 })}><Icon name="speaker" size={18} /> {w}</button>)}</> : <span className="perfect"><Icon name="star" size={18} className="star-icon" /> Perfect!</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
