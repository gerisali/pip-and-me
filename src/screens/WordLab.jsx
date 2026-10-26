import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import { TopBar } from './Home.jsx';
import Pip from '../character/Pip.jsx';
import Mic from '../components/Mic.jsx';
import { speak, waitIdle, prefetch } from '../lib/audio.js';
import { getLearner, dueWords, wordResult, addStars } from '../lib/learner.js';
import { markPlanItem } from '../lib/content.js';
import { useSession } from '../lib/session.js';

const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const ROUND = 8;

export default function WordLab({ mode = 'vocab' }) {
  const { pack, settings, go, health, customImage } = useApp();
  const session = useSession(mode === 'phonics' ? 'phonics' : 'wordlab');
  const [items, setItems] = useState(null);
  const [k, setK] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    (async () => {
      if (mode === 'phonics') {
        const ph = buildPhonics(pack);
        prefetch(ph.flatMap((it) => [`Find the word with ${it.pattern.pattern}.`, it.word, `Yes! ${it.word}!`, ...it.options]));
        return setItems(ph);
      }
      const L = await getLearner();
      const vocab = (pack?.vocab || []).map((v) => ({ word: v.word.toLowerCase(), emoji: v.emoji, tr: v.tr }));
      const lookup = (w) => vocab.find((v) => v.word === w) || { word: w, emoji: L.words[w]?.emoji || '❓', tr: L.words[w]?.tr };
      let words = await dueWords(pack, ROUND);
      if (words.length < ROUND) words = [...words, ...shuffle(vocab.map((v) => v.word).filter((w) => !words.includes(w)))].slice(0, ROUND);
      words = shuffle(words);
      const pool = vocab.filter((v) => v.emoji);
      const built =
        words.map((w, i) => {
          const item = lookup(w);
          const game = i % 3 === 1 && /^[a-z]{3,7}$/.test(w) ? 'spell' : i % 3 === 2 && health.stt ? 'say' : 'listen';
          const options = shuffle([item, ...shuffle(pool.filter((p) => p.word !== w && p.emoji !== item.emoji)).slice(0, 3)]);
          return { ...item, game, options };
        });
      // warm the voice cache so taps play right away
      prefetch(built.flatMap((it) => [it.word, `Yes! ${it.word}!`]));
      setItems(built);
    })();
  }, [mode, pack, health.stt]);

  async function answer(item, correct) {
    await wordResult(item.word, correct, item.game, session);
    if (correct) setScore((s) => s + 1);
    // move on only after the feedback voice has finished (and the child has seen the result)
    const t0 = Date.now();
    await new Promise((r) => setTimeout(r, 150));
    await waitIdle(correct ? 5000 : 8000);
    const minWait = correct ? 700 : 1500;
    const left = minWait - (Date.now() - t0);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    if (k + 1 >= items.length) {
      await addStars(Math.max(1, Math.round((score + (correct ? 1 : 0)) / 3)));
      await markPlanItem(mode === 'phonics' ? 'phonics' : 'wordlab', settings.daysPerWeek);
      setFinished(true);
    } else setK(k + 1);
  }

  const title = mode === 'phonics' ? 'Sound hunt' : 'Word Lab';
  if (!items) return null;
  if (finished || !items.length) {
    return (
      <div className="screen center-col">
        <Pip state="happy" size={180} customImage={customImage} />
        <h2 className="score">{score} / {items.length} <Icon name="star" size={30} className="star-icon" /></h2>
        <button className="btn primary big" onClick={() => go('home')}>Back home</button>
      </div>
    );
  }
  const item = items[k];
  return (
    <div className="screen">
      <TopBar title={title} onBack={() => go('home')} module={mode === 'phonics' ? 'phonics' : 'wordlab'} right={<span className="counter">{k + 1}/{items.length}</span>} />
      <div className="progress"><div style={{ width: `${(k / items.length) * 100}%` }} /></div>
      {item.game === 'listen' && <Listen key={k} item={item} onDone={answer} />}
      {item.game === 'spell' && <Spell key={k} item={item} onDone={answer} />}
      {item.game === 'say' && <Say key={k} item={item} onDone={answer} />}
      {item.game === 'hunt' && <Hunt key={k} item={item} onDone={answer} />}
      {item.game === 'pickWritten' && <PickWritten key={k} item={item} onDone={answer} />}
    </div>
  );
}

function Feedback({ state }) {
  if (state === null) return null;
  return <div className={`feedback ${state ? 'ok' : 'no'}`}>{state ? 'Yes!' : 'Almost!'}</div>;
}

function Listen({ item, onDone }) {
  const [res, setRes] = useState(null);
  useEffect(() => { speak(item.word, { rate: 0.85 }); }, [item.word]);
  return (
    <div className="game">
      <p className="center-text">Listen and tap · Dinle ve dokun</p>
      <button className="btn big" onClick={() => speak(item.word, { rate: 0.85 })}><Icon name="speaker" size={22} /> Listen again</button>
      <div className="opt-grid">
        {item.options.map((o) => (
          <button key={o.word} className={`emoji-opt ${res !== null && o.word === item.word ? 'right' : ''}`} disabled={res !== null}
            onClick={() => { const c = o.word === item.word; setRes(c); speak(c ? item.word : `This is ${o.word}.`); onDone(item, c); }}>
            {o.emoji}
          </button>
        ))}
      </div>
      <Feedback state={res} />
    </div>
  );
}

function Spell({ item, onDone }) {
  const letters = useMemo(() => shuffle([...item.word.split(''), ...shuffle('abcdefghilmnoprstu'.split('').filter((c) => !item.word.includes(c))).slice(0, 2)]).map((c, i) => ({ c, i })), [item.word]);
  const [picked, setPicked] = useState([]);
  const [res, setRes] = useState(null);
  useEffect(() => { speak(item.word, { rate: 0.85 }); }, [item.word]);
  const typed = picked.map((p) => p.c).join('');
  useEffect(() => {
    if (res === null && typed.length === item.word.length) {
      const c = typed === item.word;
      setRes(c);
      speak(c ? `Yes! ${item.word}!` : `It's ${item.word.split('').join(', ')}. ${item.word}.`, { rate: 0.85 });
      onDone(item, c);
    }
  }, [typed]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="game">
      <div className="huge center-text" onClick={() => speak(item.word)}>{item.emoji}</div>
      <p className="center-text">Spell it! · Harflerle yaz</p>
      <div className="slots">
        {item.word.split('').map((_, i) => <span key={i} className="slot">{picked[i]?.c || ''}</span>)}
      </div>
      {res === false && <p className="center-text"><b>{item.word}</b></p>}
      <div className="letters">
        {letters.map((l) => (
          <button key={l.i} className="letter-tile" disabled={res !== null || picked.includes(l)} onClick={() => setPicked([...picked, l])}>{l.c}</button>
        ))}
        <button className="letter-tile back" disabled={res !== null || !picked.length} onClick={() => setPicked(picked.slice(0, -1))} aria-label="Delete"><Icon name="back" size={24} stroke={3} /></button>
      </div>
      <Feedback state={res} />
    </div>
  );
}

function Say({ item, onDone }) {
  const [res, setRes] = useState(null);
  const [heard, setHeard] = useState('');
  return (
    <div className="game">
      <div className="huge center-text">{item.emoji}</div>
      <p className="center-text">What is it? Say it! · Bu ne? Söyle!</p>
      {res === null && (
        <>
          <Mic label="Say the word" prompt={item.word} onText={(t) => {
            setHeard(t);
            const c = new RegExp(`\\b${item.word}s?\\b`, 'i').test(t);
            setRes(c);
            speak(c ? `Yes! ${item.word}!` : `It's ${item.word}. Say: ${item.word}.`, { rate: 0.85 });
            onDone(item, c);
          }} />
          <button className="btn ghost small" onClick={() => speak(item.word, { rate: 0.8 })}><Icon name="bulb" size={18} /> Help</button>
        </>
      )}
      {heard && <p className="tiny muted center-text">I heard: “{heard}”</p>}
      <Feedback state={res} />
    </div>
  );
}

// ---------- phonics ----------
function buildPhonics(pack) {
  const out = [];
  const sets = pack?.phonics || [];
  for (const s of sets) {
    const words = shuffle(s.words || []);
    const dis = s.distractors || [];
    out.push({ game: 'hunt', word: words[0], pattern: s, options: shuffle([words[0], ...shuffle(dis).slice(0, 3)]) });
    out.push({ game: 'pickWritten', word: words[1] || words[0], pattern: s, options: shuffle([words[1] || words[0], ...shuffle(dis).slice(0, 2)]) });
    if (words[2]) out.push({ game: 'hunt', word: words[2], pattern: s, options: shuffle([words[2], ...shuffle(dis).slice(0, 3)]) });
  }
  return shuffle(out).slice(0, ROUND);
}

function Hunt({ item, onDone }) {
  const [res, setRes] = useState(null);
  const g = item.pattern.grapheme;
  useEffect(() => { speak(`Find the word with ${item.pattern.pattern}.`); }, [item.pattern.pattern]);
  return (
    <div className="game">
      <p className="center-text">Find the word with <span className="grapheme">{g}</span></p>
      <p className="tiny muted center-text">İçinde “{g}” olan kelimeyi bul. Hoparlöre dokunup dinleyebilirsin.</p>
      <div className="word-opts">
        {item.options.map((w) => (
          <div key={w} className="word-opt-row">
            <button className="btn ghost small" onClick={() => speak(w, { rate: 0.85 })} aria-label="Listen"><Icon name="speaker" size={18} /></button>
            <button className={`btn opt word ${res !== null && w === item.word ? 'right' : ''}`} disabled={res !== null}
              onClick={() => { const c = w === item.word; setRes(c); speak(c ? `Yes! ${w}!` : `${w}. Try to find ${g}.`); onDone(item, c); }}>
              {highlight(w, res !== null && w === item.word ? g : null)}
            </button>
          </div>
        ))}
      </div>
      <Feedback state={res} />
    </div>
  );
}

function PickWritten({ item, onDone }) {
  const [res, setRes] = useState(null);
  useEffect(() => { speak(item.word, { rate: 0.85 }); }, [item.word]);
  return (
    <div className="game">
      <p className="center-text">Listen. Which word is it? · Dinle, hangisi?</p>
      <button className="btn big" onClick={() => speak(item.word, { rate: 0.8 })}><Icon name="speaker" size={22} /> Listen again</button>
      <div className="word-opts">
        {item.options.map((w) => (
          <button key={w} className={`btn opt word ${res !== null && w === item.word ? 'right' : ''}`} disabled={res !== null}
            onClick={() => { const c = w === item.word; setRes(c); speak(c ? `Yes! ${w}!` : `This is ${w}. Listen: ${item.word}.`); onDone(item, c); }}>
            {highlight(w, res !== null && w === item.word ? item.pattern.grapheme : null)}
          </button>
        ))}
      </div>
      <Feedback state={res} />
    </div>
  );
}

function highlight(word, g) {
  if (!g) return word;
  const parts = g.split('_');
  if (parts.length === 2) return word; // split digraphs like a_e: no inline highlight
  const i = word.indexOf(g);
  if (i < 0) return word;
  return (<>{word.slice(0, i)}<mark>{g}</mark>{word.slice(i + g.length)}</>);
}
