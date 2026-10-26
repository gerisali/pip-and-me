// The on-screen character.
// - Built-in: "Pip", an original fox from planet Zoot (placeholder until the child's own character is ready).
// - Custom: images uploaded in the parent panel, one per mood (idle is enough; talking makes the mouth flap).
// States: idle | talking | listening | thinking | happy | surprised
import { useEffect, useState } from 'react';
import { onSpeakingChange, isSpeaking } from '../lib/audio.js';

const VISEMES = ['rest', 'a', 'o', 'e', 'a', 'rest', 'o', 'e'];

function useTalking() {
  const [talking, setTalking] = useState(isSpeaking());
  useEffect(() => onSpeakingChange(setTalking), []);
  return talking;
}

function useViseme(active) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return setI(0);
    const t = setInterval(() => setI((x) => (x + 1) % VISEMES.length), 115);
    return () => clearInterval(t);
  }, [active]);
  return active ? VISEMES[i] : 'rest';
}

export default function Pip({ state = 'idle', size = 220, customImage = null }) {
  const talking = useTalking();
  const s = talking ? 'talking' : state;
  const viseme = useViseme(talking);
  const images = customImage && typeof customImage === 'object' ? customImage : customImage ? { idle: customImage } : null;

  if (images?.idle) {
    let src = images[s] || images.idle;
    if (s === 'talking') src = viseme === 'rest' ? images.idle : images.talking || images.idle;
    return (
      <div className={`char char-${s}`} style={{ width: size, height: size }}>
        <div className="char-glow" />
        <img src={src} alt="" className="char-img" draggable={false} />
        {s === 'thinking' && <Dots />}
      </div>
    );
  }

  return (
    <div className={`char char-${s}`} style={{ width: size, height: size }} role="img" aria-label="Pip">
      <div className="char-glow" />
      <PipArt state={s} viseme={viseme} />
      {s === 'thinking' && <Dots />}
    </div>
  );
}

function Dots() {
  return (
    <div className="char-dots">
      <span />
      <span />
      <span />
    </div>
  );
}

function Mouth({ state, viseme }) {
  if (state === 'surprised') return <ellipse cx="100" cy="124" rx="6" ry="7.5" fill="#5b1f2a" />;
  if (state === 'talking') {
    const shape = {
      rest: <path d="M91 121 Q100 127 109 121" stroke="#3a1d14" strokeWidth="3" fill="none" strokeLinecap="round" />,
      a: <path d="M90 119 Q100 118 110 119 Q108 133 100 134 Q92 133 90 119Z" fill="#5b1f2a" />,
      o: <ellipse cx="100" cy="125" rx="6.5" ry="8" fill="#5b1f2a" />,
      e: <path d="M89 120 Q100 121 111 120 Q107 128 100 128 Q93 128 89 120Z" fill="#5b1f2a" />,
    }[viseme];
    return (
      <g>
        {shape}
        {viseme === 'a' && <path d="M94 129 Q100 126 106 129 Q100 133 94 129Z" fill="#ff8d9a" />}
      </g>
    );
  }
  if (state === 'happy')
    return (
      <g>
        <path d="M89 119 Q100 134 111 119 Z" fill="#5b1f2a" />
        <path d="M94 126 Q100 123 106 126 Q100 131 94 126Z" fill="#ff8d9a" />
      </g>
    );
  return <path d="M91 121 Q100 129 109 121" stroke="#3a1d14" strokeWidth="3" fill="none" strokeLinecap="round" />;
}

function Eyes({ state }) {
  if (state === 'happy')
    return (
      <g stroke="#2a160e" strokeWidth="4" fill="none" strokeLinecap="round">
        <path d="M70 90 Q78 80 86 90" />
        <path d="M114 90 Q122 80 130 90" />
      </g>
    );
  const big = state === 'surprised';
  const dy = state === 'thinking' ? -4 : 0;
  const dx = state === 'listening' ? 2 : 0;
  return (
    <g className="char-eyes">
      {[78, 122].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy={88} rx={big ? 11 : 10} ry={big ? 13 : 12} fill="#fff" />
          <ellipse cx={cx + dx} cy={89 + dy} rx={big ? 6.5 : 7.5} ry={big ? 7.5 : 9} fill="#2a160e" />
          <circle cx={cx + dx + 3} cy={85 + dy} r="3" fill="#fff" />
          <circle cx={cx + dx - 2.5} cy={93 + dy} r="1.3" fill="#fff" opacity=".8" />
        </g>
      ))}
    </g>
  );
}

function Brows({ state }) {
  const up = state === 'surprised' || state === 'thinking' ? -5 : state === 'listening' ? -2 : 0;
  const tilt = state === 'thinking' ? 4 : 0;
  return (
    <g stroke="#7a3d12" strokeWidth="3.5" strokeLinecap="round" fill="none">
      <path d={`M69 ${72 + up} Q78 ${67 + up - tilt} 87 ${71 + up}`} />
      <path d={`M113 ${71 + up} Q122 ${67 + up} 131 ${72 + up}`} />
    </g>
  );
}

function PipArt({ state, viseme }) {
  return (
    <svg viewBox="0 0 200 210" width="100%" height="100%" className="char-svg">
      <defs>
        <linearGradient id="fur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffa54a" />
          <stop offset="1" stopColor="#f07a1f" />
        </linearGradient>
        <linearGradient id="furDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0862b" />
          <stop offset="1" stopColor="#d9631a" />
        </linearGradient>
        <linearGradient id="cream" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf2" />
          <stop offset="1" stopColor="#ffe9d1" />
        </linearGradient>
        <radialGradient id="bulb" cx="40%" cy="35%" r="65%">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset=".6" stopColor="#ffd84a" />
          <stop offset="1" stopColor="#ffb21e" />
        </radialGradient>
        <linearGradient id="scarf" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c6cff" />
          <stop offset="1" stopColor="#b06cff" />
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="203" rx="48" ry="6" fill="#000" opacity=".08" />

      {/* tail */}
      <g className="char-tail">
        <path d="M140 172 C186 170 198 128 178 104 C176 136 160 150 132 156 Z" fill="url(#furDark)" />
        <path d="M178 104 C192 118 192 136 186 148 C178 134 174 120 178 104 Z" fill="url(#cream)" />
      </g>

      {/* body */}
      <path d="M58 176 C58 146 76 132 100 132 C124 132 142 146 142 176 C142 192 124 200 100 200 C76 200 58 192 58 176Z" fill="url(#fur)" />
      <path d="M80 178 C80 158 88 146 100 146 C112 146 120 158 120 178 C120 190 112 196 100 196 C88 196 80 190 80 178Z" fill="url(#cream)" />
      <ellipse cx="80" cy="198" rx="13" ry="6.5" fill="#3b2418" />
      <ellipse cx="120" cy="198" rx="13" ry="6.5" fill="#3b2418" />

      {/* scarf */}
      <path d="M70 138 Q100 152 130 138 L132 146 Q100 162 68 146Z" fill="url(#scarf)" />
      <path d="M116 146 L124 170 L112 166 L108 150Z" fill="#9b6cff" />

      <g className="char-head">
        {/* antenna */}
        <g className="char-antenna">
          <path d="M100 46 C96 34 106 26 101 14" stroke="#7a3d12" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <circle cx="101" cy="12" r="8" fill="url(#bulb)" className="char-bulb" />
          <circle cx="98" cy="9" r="2.2" fill="#fff" opacity=".9" />
        </g>
        {/* ears */}
        <g className="char-ears">
          <path d="M50 82 L40 24 Q44 20 49 24 L92 58 Z" fill="url(#fur)" />
          <path d="M56 74 L50 38 L80 60 Z" fill="#4a2a1a" />
          <path d="M150 82 L160 24 Q156 20 151 24 L108 58 Z" fill="url(#fur)" />
          <path d="M144 74 L150 38 L120 60 Z" fill="#4a2a1a" />
        </g>
        {/* head */}
        <path d="M34 92 C34 58 66 46 100 46 C134 46 166 58 166 92 C166 124 136 144 100 146 C64 144 34 124 34 92Z" fill="url(#fur)" />
        <path d="M42 104 C58 112 80 118 100 146 C120 118 142 112 158 104 C156 130 128 146 100 146 C72 146 44 130 42 104Z" fill="url(#cream)" />
        <path d="M60 56 C72 50 86 48 100 48" stroke="#ffd3a0" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".6" />
        {/* cheeks */}
        <ellipse cx="62" cy="110" rx="10" ry="6" fill="#ff8d9a" opacity=".45" />
        <ellipse cx="138" cy="110" rx="10" ry="6" fill="#ff8d9a" opacity=".45" />
        <Brows state={state} />
        <Eyes state={state} />
        {/* nose */}
        <path d="M93 108 Q100 104 107 108 Q104 114 100 115 Q96 114 93 108Z" fill="#2a160e" />
        <circle cx="97.5" cy="108" r="1.6" fill="#fff" opacity=".7" />
        <Mouth state={state} viseme={viseme} />
      </g>
    </svg>
  );
}
