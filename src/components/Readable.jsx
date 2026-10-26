import { useState } from 'react';
import { speak } from '../lib/audio.js';
import Icon from './Icon.jsx';

// Text where every word can be tapped to hear it. Lines are preserved.
export default function Readable({ text, className = '' }) {
  return (
    <div className={`readable ${className}`}>
      {(text || '').split('\n').map((line, i) => (
        <p key={i}>
          {line.split(/(\s+)/).map((tok, j) =>
            /\S/.test(tok) ? (
              <span key={j} className="word" onClick={() => speak(tok.replace(/[^A-Za-z'’-]/g, ''), { rate: 0.8 })}>
                {tok}
              </span>
            ) : (
              tok
            )
          )}
        </p>
      ))}
    </div>
  );
}

export function Quiz({ questions = [], onAnswer }) {
  return (
    <div className="quiz">
      {questions.map((q, i) => (
        <QuizItem key={i} q={q} onAnswer={(c) => onAnswer?.(q, c)} />
      ))}
    </div>
  );
}

function QuizItem({ q, onAnswer }) {
  const [picked, setPicked] = useState(null);
  return (
    <div className="quiz-item">
      <div className="quiz-q" onClick={() => speak(q.q)}><Icon name="speaker" size={18} /> {q.q}</div>
      <div className="quiz-opts">
        {q.options.map((o, i) => (
          <button
            key={i}
            className={`btn opt ${picked === null ? '' : i === q.answer ? 'right' : picked === i ? 'wrong' : ''}`}
            disabled={picked !== null}
            onClick={() => {
              setPicked(i);
              onAnswer(i === q.answer);
              speak(i === q.answer ? 'Yes!' : `It's ${q.options[q.answer]}.`);
            }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
