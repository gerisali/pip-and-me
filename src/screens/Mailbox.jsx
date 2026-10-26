import { useEffect, useRef, useState } from 'react';
import { useApp } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import { TopBar } from './Home.jsx';
import Readable, { Quiz } from '../components/Readable.jsx';
import { speak, prefetch } from '../lib/audio.js';
import { chat } from '../lib/api.js';
import { events, kv } from '../lib/db.js';
import { applyAnalysis, addStars } from '../lib/learner.js';
import { markPlanItem } from '../lib/content.js';
import { buildCtx } from '../lib/ctx.js';
import { useSession } from '../lib/session.js';

export default function Mailbox() {
  const { pack, go, settings } = useApp();
  const [open, setOpen] = useState(null);
  const [store, setStore] = useState({});
  useEffect(() => {
    kv.get('letters', {}).then(setStore);
  }, [open]);

  if (open) return <Letter letter={open} saved={store[open.id]} onBack={() => setOpen(null)} />;

  return (
    <div className="screen">
      <TopBar title="Mailbox" onBack={() => go('home')} module="mailbox" />
      <p className="muted center-text">{settings.characterName} wrote to you! · Sana mektup var!</p>
      <div className="list">
        {(pack?.letters || []).map((l) => (
          <button key={l.id} className="card mission" onClick={() => setOpen(l)}>
            <span className={`mission-icon ${store[l.id]?.pipReply ? 'ok' : 'new'}`}><Icon name={store[l.id]?.pipReply ? 'check' : 'mail'} size={26} /></span>
            <span>
              <b>{l.subject}</b>
              <div className="tiny muted">{store[l.id]?.pipReply ? 'Answered · Cevaplandı' : 'New letter · Yeni mektup'}</div>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Letter({ letter, saved, onBack }) {
  const { pack, settings } = useApp();
  const session = useSession('mailbox', { letterId: letter.id });
  const [text, setText] = useState(saved?.reply || '');
  const [pipReply, setPipReply] = useState(saved?.pipReply || null);
  useEffect(() => { prefetch([letter.body, letter.replyPrompt, saved?.pipReply]); }, [letter.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const t0 = useRef(Date.now());
  const ta = useRef(null);

  const insert = (s) => {
    const sep = text && !/\s$/.test(text) ? (/[,.!?]$/.test(s) || s.endsWith(',') ? '\n' : ' ') : '';
    setText(text + sep + s + ' ');
    ta.current?.focus();
  };

  async function send() {
    if (text.trim().split(/\s+/).length < 2) return setErr('Write a little more! · Biraz daha yaz!');
    setErr('');
    setBusy(true);
    await events.add({ type: 'letter_read', letterId: letter.id, seconds: Math.round((Date.now() - t0.current) / 1000), session });
    try {
      const ctx = await buildCtx(pack, settings, { letter: { body: letter.body, replyPrompt: letter.replyPrompt } });
      const r = await chat('mailbox', ctx, [{ role: 'child', text }]);
      setPipReply(r.reply);
      const store = await kv.get('letters', {});
      store[letter.id] = { reply: text, pipReply: r.reply, ts: Date.now() };
      await kv.set('letters', store);
      await events.add({ type: 'letter_reply', letterId: letter.id, text, pipReply: r.reply, analysis: r.analysis, session, week: pack?.id });
      await applyAnalysis(r.analysis, { mode: 'mailbox', text, session });
      await addStars(2);
      await markPlanItem('mailbox', settings.daysPerWeek);
      speak(r.reply);
    } catch {
      setErr('Bağlantı sorunu, tekrar dene.');
    }
    setBusy(false);
  }

  return (
    <div className="screen">
      <TopBar title={letter.subject} onBack={onBack} module="mailbox" />
      <div className="card letter">
        <button className="btn small" onClick={() => speak(letter.body)}><Icon name="speaker" size={18} /> Listen · Dinle</button>
        <Readable text={letter.body} />
        <div className="tiny muted">Bilmediğin kelimeye dokun, Pip söylesin.</div>
      </div>

      {letter.questions?.length > 0 && (
        <div className="card">
          <h3><Icon name="check" size={20} /> Quick check</h3>
          <Quiz questions={letter.questions} onAnswer={(q, correct) => events.add({ type: 'letter_question', letterId: letter.id, q: q.q, correct, session })} />
        </div>
      )}

      <div className="card">
        <h3><Icon name="pencil" size={20} /> Your reply</h3>
        <p className="prompt" onClick={() => speak(letter.replyPrompt)}><Icon name="speaker" size={18} /> {letter.replyPrompt}</p>
        <p className="tiny muted">{letter.replyPromptTr}</p>
        {!pipReply && (
          <>
            <div className="chips">
              {(letter.starters || []).map((s) => (
                <button key={s} className="chip" onClick={() => insert(s)}>{s}</button>
              ))}
            </div>
            <textarea ref={ta} rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Dear Pip, …" autoCapitalize="sentences" spellCheck={false} />
            {err && <p className="error">{err}</p>}
            <button className="btn primary big" onClick={send} disabled={busy}>{busy ? 'Sending…' : <>Send to {settings.characterName} <Icon name="send" size={20} /></>}</button>
          </>
        )}
        {pipReply && <div className="sent">{text}</div>}
      </div>

      {pipReply && (
        <div className="card letter pip-letter">
          <h3><Icon name="mail" size={20} /> {settings.characterName} answered!</h3>
          <button className="btn small" onClick={() => speak(pipReply)}><Icon name="speaker" size={18} /> Listen</button>
          <Readable text={pipReply} />
        </div>
      )}
    </div>
  );
}
