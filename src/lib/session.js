import { useEffect, useRef } from 'react';
import { events } from './db.js';
import { countSession } from './learner.js';
import { syncSoon } from './sync.js';

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Logs session_start / session_end for a module and returns the session id.
export function useSession(module, extra = {}) {
  const ref = useRef(null);
  if (!ref.current) ref.current = { id: newId(), started: Date.now() };
  useEffect(() => {
    const { id, started } = ref.current;
    events.add({ type: 'session_start', module, session: id, ...extra });
    countSession();
    const end = () =>
      events.add({ type: 'session_end', module, session: id, seconds: Math.round((Date.now() - started) / 1000) }).then(() => syncSoon());
    window.addEventListener('pagehide', end);
    return () => {
      window.removeEventListener('pagehide', end);
      end();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref.current.id;
}
