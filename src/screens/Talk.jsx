import { useEffect, useRef, useState } from 'react';
import { useApp } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import { TopBar } from './Home.jsx';
import Pip from '../character/Pip.jsx';
import Mic from '../components/Mic.jsx';
import { speak, prefetch } from '../lib/audio.js';
import { chat } from '../lib/api.js';
import { events, kv } from '../lib/db.js';
import { applyAnalysis, addStars } from '../lib/learner.js';
import { markPlanItem } from '../lib/content.js';
import { buildCtx } from '../lib/ctx.js';
import { useSession } from '../lib/session.js';

const MAX_TURNS = 14;

export default function Talk() {
  const { pack, go, settings } = useApp();
  const [mission, setMission] = useState(null);
  const [done, setDone] = useState([]);

  useEffect(() => {
    kv.get('missionsDone', []).then(setDone);
  }, []);

  if (!mission) {
    const missions = pack?.talkMissions || [];
    return (
      <div className="screen">
        <TopBar title={`Talk with ${settings.characterName}`} onBack={() => go('home')} module="talk" />
        <p className="muted center-text">Choose a mission · Bir görev seç</p>
        <div className="list">
          {missions.map((m) => (
            <button key={m.id} className="card mission" onClick={() => setMission(m)}>
              <span className={`mission-icon ${done.includes(m.id) ? 'ok' : ''}`}><Icon name={done.includes(m.id) ? 'check' : 'target'} size={26} /></span>
              <span>
                <b>{m.title}</b>
                <div className="tiny muted">{m.titleTr}</div>
              </span>
            </button>
          ))}
          <button
            className="card mission"
            onClick={() => setMission({ id: 'free', title: 'Free chat', titleTr: 'Serbest sohbet', goal: 'Free friendly chat about anything she likes.', opener: "Hi! I'm so happy to see you! What did you do today?", targets: [], hints: (pack?.chunks || []).map((c) => c.text) })}
          >
            <span className="mission-icon free"><Icon name="sparkle" size={26} /></span>
            <span><b>Free chat</b><div className="tiny muted">Serbest sohbet</div></span>
          </button>
        </div>
      </div>
    );
  }
  return <Conversation mission={mission} />;
}

function Conversation({ mission }) {
  const { pack, settings, go, health, customImage } = useApp();
  const session = useSession('talk', { missionId: mission.id });
  const [msgs, setMsgs] = useState([{ role: 'pip', text: mission.opener }]);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(!health.stt);
  const [draft, setDraft] = useState('');
  const [showHints, setShowHints] = useState(false);
  useEffect(() => { prefetch(mission.hints || []); }, [mission.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showText, setShowText] = useState(true);
  const [ended, setEnded] = useState(null);
  const [pipState, setPipState] = useState('happy');
  const started = useRef(Date.now());
  const scroller = useRef(null);

  useEffect(() => {
    speak(mission.opener);
  }, [mission.opener]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 1e6, behavior: 'smooth' });
  }, [msgs, busy]);

  const childTurns = msgs.filter((m) => m.role === 'child').length;

  async function send(text, meta = {}) {
    if (!text) {
      const again = "Sorry, I didn't hear you. Can you say it again?";
      setMsgs((m) => [...m, { role: 'pip', text: again }]);
      return speak(again);
    }
    const next = [...msgs, { role: 'child', text }];
    setMsgs(next);
    setBusy(true);
    setPipState('thinking');
    try {
      const minutes = (Date.now() - started.current) / 60000;
      const ctx = await buildCtx(pack, settings, {
        mission,
        turn: childTurns + 1,
        maxTurns: minutes > settings.sessionMinutes - 3 ? childTurns + 1 : MAX_TURNS,
      });
      const r = await chat('talk', ctx, next);
      setMsgs((m) => [...m, { role: 'pip', text: r.reply }]);
      setPipState(r.emotion === 'surprised' ? 'surprised' : 'happy');
      await events.add({
        type: 'talk_turn', session, missionId: mission.id, childText: text, pipText: r.reply,
        analysis: r.analysis, audioSeconds: meta.seconds, sttLanguages: meta.languages, week: pack?.id,
      });
      await applyAnalysis(r.analysis, { mode: 'talk', text, session });
      setBusy(false);
      await speak(r.reply);
      if (childTurns + 1 >= MAX_TURNS || /goodbye|bye for now|see you/i.test(r.reply)) finish(childTurns + 1);
    } catch (e) {
      setBusy(false);
      setPipState('idle');
      setMsgs((m) => [...m, { role: 'system', text: 'Bağlantı sorunu, tekrar dener misin?' }]);
    }
  }

  async function finish(count) {
    const said = typeof count === 'number' ? count : msgs.filter((m) => m.role === 'child').length;
    const stars = await addStars(said >= 6 ? 3 : said >= 3 ? 2 : 1);
    if (mission.id !== 'free') {
      const d = await kv.get('missionsDone', []);
      await kv.set('missionsDone', Array.from(new Set([...d, mission.id])));
    }
    await markPlanItem('talk', settings.daysPerWeek);
    setEnded({ said, stars });
  }

  if (ended) {
    return (
      <div className="screen center-col">
        <Pip state="happy" size={200} customImage={customImage} />
        <h2>Great talk! <Icon name="star" size={26} className="star-icon" /></h2>
        <p>You said <b>{ended.said}</b> things to {settings.characterName} today.</p>
        <p className="muted">Bugün {settings.characterName}'e {ended.said} şey anlattın!</p>
        <button className="btn primary big" onClick={() => go('home')}>Back home</button>
      </div>
    );
  }

  const lastPip = [...msgs].reverse().find((m) => m.role === 'pip')?.text;

  return (
    <div className="screen talk">
      <TopBar
        title={mission.title}
        onBack={() => go('home')}
        module="talk"
        right={<button className="btn ghost small" onClick={() => finish()}><Icon name="wave" size={18} /> Bye</button>}
      />
      <div className="talk-stage">
        <Pip state={busy ? 'thinking' : pipState} size={150} customImage={customImage} />
        <div className="talk-tools">
          <button className="btn small" onClick={() => speak(lastPip)}><Icon name="replay" size={18} /> Again</button>
          <button className="btn small" onClick={() => speak(lastPip, { rate: 0.75 })}><Icon name="slow" size={18} /> Slow</button>
          <button className="btn small" onClick={() => setShowText((s) => !s)}><Icon name={showText ? 'eyeOff' : 'eye'} size={18} /> {showText ? 'Hide words' : 'Show words'}</button>
        </div>
      </div>

      <div className="chat" ref={scroller}>
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === 'pip' && !showText ? <span className="hidden-words"><Icon name="speaker" size={18} /> …</span> : m.text}
          </div>
        ))}
        {busy && <div className="msg pip typing">…</div>}
      </div>

      {showHints && (
        <div className="card hints">
          <div className="hints-head">
            <b>Help · Yardım</b>
            <button className="btn ghost small" onClick={() => setShowHints(false)} aria-label="Close"><Icon name="close" size={18} /></button>
          </div>
          {(mission.hints || []).map((h, i) => (
            <button key={i} className="hint" onClick={() => speak(h)}><Icon name="speaker" size={18} /> {h}</button>
          ))}
          <div className="tiny muted">İpucuna dokunursan {settings.characterName} söyler. Sonra sen kendi cümleni söyle!</div>
        </div>
      )}

      <div className="talk-controls">
        <button
          className="btn round"
          onClick={() => {
            setShowHints(true);
            events.add({ type: 'talk_hint', session, missionId: mission.id });
          }}
          aria-label="Help"
        ><Icon name="bulb" size={24} /></button>
        {typing ? (
          <form
            className="type-row"
            onSubmit={(e) => {
              e.preventDefault();
              const t = draft.trim();
              if (!t) return;
              setDraft('');
              send(t, { typed: true });
            }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type in English…" autoCapitalize="sentences" />
            <button className="btn primary" disabled={busy} aria-label="Send"><Icon name="send" size={20} /></button>
          </form>
        ) : (
          <Mic
            disabled={busy}
            onText={(t, meta) => send(t, meta)}
            onUnavailable={() => setTyping(true)}
            prompt={`A 9-year-old Turkish girl practising English with ${settings.characterName} (${settings.characterDescription}). Topic: ${mission.title}. ${(mission.targets || []).join(' ')}`}
          />
        )}
        <button className="btn round" onClick={() => setTyping((t) => !t)} aria-label="Keyboard"><Icon name={typing ? 'mic' : 'keyboard'} size={24} /></button>
      </div>
    </div>
  );
}
