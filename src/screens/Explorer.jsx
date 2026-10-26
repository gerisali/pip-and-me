import { useEffect, useState } from 'react';
import { useApp } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import { TopBar } from './Home.jsx';
import Readable, { Quiz } from '../components/Readable.jsx';
import Mic from '../components/Mic.jsx';
import { speak, prefetch } from '../lib/audio.js';
import { events } from '../lib/db.js';
import { addStars } from '../lib/learner.js';
import { markPlanItem } from '../lib/content.js';
import { useSession } from '../lib/session.js';
import { compareReading } from '../lib/report.js';

export default function Explorer() {
  const { pack, go } = useApp();
  const [card, setCard] = useState(null);
  if (card) return <Card card={card} onBack={() => setCard(null)} />;
  return (
    <div className="screen">
      <TopBar title="Explorer" onBack={() => go('home')} module="explorer" />
      <p className="muted center-text">Let's discover! · Hadi keşfedelim!</p>
      <div className="grid">
        {(pack?.explorer || []).map((c) => (
          <button key={c.id} className="tile big" onClick={() => setCard(c)}>
            <span className="tile-icon huge">{c.emoji}</span>
            <span>{c.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({ card, onBack }) {
  const { settings, health } = useApp();
  const session = useSession('explorer', { cardId: card.id });
  const [answered, setAnswered] = useState(0);
  const [readRes, setReadRes] = useState(null);
  const fact = card.facts?.[0];
  useEffect(() => { prefetch([card.text, ...(card.facts || [])]); }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="screen">
      <TopBar title={card.title} onBack={onBack} module="explorer" />
      <div className="card explorer-card">
        <div className="huge center-text">{card.emoji}</div>
        <button className="btn small" onClick={() => speak(card.text)}><Icon name="speaker" size={18} /> Listen · Dinle</button>
        <Readable text={card.text} />
      </div>
      {card.facts?.length > 0 && (
        <div className="card">
          <h3><Icon name="bulb" size={20} /> Fun facts</h3>
          {card.facts.map((f) => (
            <button key={f} className="hint" onClick={() => speak(f)}><Icon name="speaker" size={18} /> {f}</button>
          ))}
          {health.stt && fact && (
            <div className="read-aloud">
              <b>Read this fact aloud: · Bunu sesli oku:</b>
              <p>“{fact}”</p>
              <Mic
                label="Read aloud"
                prompt={fact}
                onText={async (heard) => {
                  const r = compareReading(fact, heard);
                  setReadRes(r);
                  await events.add({ type: 'read_aloud', source: 'explorer', target: fact, heard, missed: r.missed, accuracy: r.accuracy, session });
                  speak(r.accuracy >= 0.9 ? 'Super reading!' : 'Good try!');
                }}
              />
              {readRes && (readRes.missed.length ? <div className="tiny">Practice: {readRes.missed.map((w) => <button key={w} className="chip" onClick={() => speak(w, { rate: 0.8 })}><Icon name="speaker" size={18} /> {w}</button>)}</div> : <div className="perfect"><Icon name="star" size={18} className="star-icon" /> Perfect!</div>)}
            </div>
          )}
        </div>
      )}
      <div className="card">
        <h3><Icon name="target" size={20} /> Quiz</h3>
        <Quiz
          questions={card.questions || []}
          onAnswer={async (q, correct) => {
            await events.add({ type: 'explorer_answer', cardId: card.id, q: q.q, correct, session });
            const n = answered + 1;
            setAnswered(n);
            if (correct) await addStars(1);
            if (n >= (card.questions || []).length) markPlanItem('explorer', settings.daysPerWeek);
          }}
        />
      </div>
    </div>
  );
}
