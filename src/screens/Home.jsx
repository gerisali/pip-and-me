import { useEffect, useState } from 'react';
import { useApp } from '../App.jsx';
import Pip from '../character/Pip.jsx';
import Icon from '../components/Icon.jsx';
import { speak } from '../lib/audio.js';
import { todayPlan } from '../lib/content.js';
import { getLearner } from '../lib/learner.js';

export const MODULES = {
  talk: { icon: 'talk', title: 'Talk', tr: 'Konuş', color: 'm-talk' },
  mailbox: { icon: 'mail', title: 'Mailbox', tr: 'Mektuplar', color: 'm-mail' },
  story: { icon: 'story', title: 'Story Studio', tr: 'Hikâye kitabım', color: 'm-story' },
  explorer: { icon: 'explorer', title: 'Explorer', tr: 'Keşif', color: 'm-explorer' },
  wordlab: { icon: 'wordlab', title: 'Word Lab', tr: 'Kelime oyunları', color: 'm-wordlab' },
  phonics: { icon: 'phonics', title: 'Sounds', tr: 'Ses avı', color: 'm-phonics' },
};

export function ModuleBadge({ m, size = 30 }) {
  return (
    <span className={`badge ${MODULES[m].color}`}>
      <Icon name={MODULES[m].icon} size={size} stroke={2.2} />
    </span>
  );
}

export default function Home() {
  const { pack, settings, go, customImage } = useApp();
  const [plan, setPlan] = useState(null);
  const [stars, setStars] = useState(0);

  useEffect(() => {
    todayPlan(settings.daysPerWeek).then(setPlan);
    getLearner().then((l) => setStars(l.stars));
  }, [settings.daysPerWeek]);

  const name = settings.characterName || 'Pip';
  const greet = () => speak(`Hi ${settings.childName}! This week is "${pack?.title}". What shall we do today?`);
  const open = (m) => (m === 'phonics' ? go('wordlab', { mode: 'phonics' }) : go(m));

  return (
    <div className="home">
      <header className="home-top">
        <div className="stars-pill" title="Yıldızlar">
          <Icon name="star" size={20} className="star-icon" /> <b>{stars}</b>
        </div>
        <button className="btn ghost small" onClick={() => go('parent')} aria-label="Veli paneli">
          <Icon name="parent" size={18} /> Veli
        </button>
      </header>

      <section className="hero" onClick={greet}>
        <div className="spotlight" />
        <Pip state="happy" size={210} customImage={customImage} />
        <div className="bubble">
          <div className="bubble-hi">Hi {settings.childName}!</div>
          <div className="bubble-week">
            <span className="week-chip">Week {pack?.week}</span> {pack?.title}
          </div>
          <div className="tiny muted">
            <Icon name="speaker" size={14} /> Tap {name} · Bana dokun
          </div>
        </div>
      </section>

      {plan && (
        <section className="card today">
          <div className="section-head">
            <h2>Today's plan</h2>
            {plan.completed && <span className="done-pill"><Icon name="check" size={16} /> Done!</span>}
          </div>
          <div className="plan-row">
            {plan.plan.items.map((m, i) => (
              <button key={m} className={`plan-tile ${plan.done.includes(m) ? 'done' : ''}`} onClick={() => open(m)}>
                <span className="step-no">{plan.done.includes(m) ? <Icon name="check" size={16} stroke={3} /> : i + 1}</span>
                <ModuleBadge m={m} size={34} />
                <span className="plan-title">{MODULES[m].title}</span>
                <span className="tiny muted">{MODULES[m].tr}</span>
              </button>
            ))}
          </div>
          {plan.completed && <p className="muted center-text">Great job today! Bugünlük plan tamam — istersen başka bir şey de seçebilirsin.</p>}
        </section>
      )}

      <h3 className="grid-title">All activities</h3>
      <section className="grid">
        {Object.keys(MODULES).map((k) => (
          <button key={k} className="tile" onClick={() => open(k)}>
            <ModuleBadge m={k} />
            <span className="tile-title">{MODULES[k].title}</span>
            <span className="tiny muted">{MODULES[k].tr}</span>
          </button>
        ))}
      </section>
    </div>
  );
}

export function TopBar({ title, onBack, right, module }) {
  return (
    <header className="topbar">
      <button className="btn ghost back" onClick={onBack} aria-label="Back">
        <Icon name="back" size={22} stroke={2.6} />
      </button>
      <h1>
        {module && <ModuleBadge m={module} size={20} />} <span>{title}</span>
      </h1>
      <div className="topbar-right">{right}</div>
    </header>
  );
}
