import { useEffect, useRef, useState } from 'react';
import { Recorder, stopSpeaking, unlockAudio } from '../lib/audio.js';
import { transcribe } from '../lib/api.js';
import Icon from './Icon.jsx';

// Tap to talk, tap again to stop. Calls onText(text, {seconds, languages}) or onUnavailable().
export default function Mic({ onText, onUnavailable, disabled, prompt, maxSeconds = 30, label = 'Tap and talk' }) {
  const [state, setState] = useState('idle'); // idle | rec | busy | error
  const [secs, setSecs] = useState(0);
  const rec = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => {
    clearInterval(timer.current);
    rec.current?.cancel();
  }, []);

  async function start() {
    unlockAudio();
    stopSpeaking();
    if (!Recorder.supported()) return onUnavailable?.();
    try {
      rec.current = new Recorder();
      await rec.current.start();
      setState('rec');
      setSecs(0);
      const t0 = Date.now();
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000);
        setSecs(s);
        if (s >= maxSeconds) stop();
      }, 250);
    } catch {
      setState('error');
      onUnavailable?.('mic');
    }
  }

  async function stop() {
    clearInterval(timer.current);
    if (!rec.current) return;
    setState('busy');
    const out = await rec.current.stop();
    rec.current = null;
    if (!out || out.seconds < 0.6) {
      setState('idle');
      return onText('', { seconds: out?.seconds || 0 });
    }
    try {
      const r = await transcribe(out.blob, prompt);
      setState('idle');
      if (r.unavailable) return onUnavailable?.('stt');
      onText((r.text || '').trim(), { seconds: out.seconds, languages: r.languages });
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 1500);
    }
  }

  const click = () => (state === 'rec' ? stop() : state === 'idle' || state === 'error' ? start() : null);

  return (
    <div className="mic-wrap">
      <button
        className={`mic mic-${state}`}
        onClick={click}
        disabled={disabled || state === 'busy'}
        aria-label={state === 'rec' ? 'Stop' : 'Talk'}
      >
        {state === 'rec' ? <Icon name="stop" size={40} /> : state === 'busy' ? <span className="mic-spin" /> : <Icon name="mic" size={42} stroke={2.2} />}
      </button>
      <div className="mic-label">
        {state === 'rec' ? `Listening… ${secs}s · Bitince dokun` : state === 'busy' ? 'One moment…' : state === 'error' ? 'Try again' : label}
      </div>
    </div>
  );
}
