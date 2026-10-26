// Tiny IndexedDB wrapper: a key-value store + an append-only event log.
// Keys listed in SYNC_KEYS carry a "last changed" timestamp (kv 'syncT') so devices can sync them
// with last-write-wins. CHILD_OWNED keys only ever travel child → cloud → parent.
const DB_NAME = 'pip-and-me';
const VERSION = 1;
let dbp;

export const SYNC_KEYS = ['settings', 'learner', 'letters', 'missionsDone', 'planState', 'planIndex', 'currentWeek', 'importedPacks', 'characterImages'];
export const CHILD_OWNED = new Set(['learner', 'letters', 'missionsDone', 'planState', 'planIndex']);

let role = 'child'; // 'child' | 'parent' (set from kv 'deviceRole' at start-up)
export const setRole = (r) => (role = r === 'parent' ? 'parent' : 'child');
export const getRole = () => role;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('events')) {
        const s = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
        s.createIndex('ts', 'ts');
        s.createIndex('session', 'session');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const out = fn(s);
        t.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out);
        t.onerror = () => reject(t.error);
      })
  );
}

// put value + update its sync timestamp in one transaction
function putWithT(k, v, t) {
  return tx('kv', 'readwrite', (s) => {
    s.put(v, k);
    if (t === null) return;
    const g = s.get('syncT');
    g.onsuccess = () => {
      const m = g.result || {};
      if (t === undefined) delete m[k];
      else m[k] = t;
      s.put(m, 'syncT');
    };
  });
}

const tracked = (k) => SYNC_KEYS.includes(k) && (role === 'child' || !CHILD_OWNED.has(k));

export const kv = {
  get: (k, d = undefined) => tx('kv', 'readonly', (s) => s.get(k)).then((v) => (v === undefined ? d : v)),
  set: (k, v) => putWithT(k, v, tracked(k) ? Date.now() : null),
  // value coming from the cloud: keep the cloud's timestamp
  setRaw: (k, v, t) => putWithT(k, v, t),
  del: (k) =>
    tx('kv', 'readwrite', (s) => {
      s.delete(k);
      if (!SYNC_KEYS.includes(k)) return;
      const g = s.get('syncT');
      g.onsuccess = () => {
        const m = g.result || {};
        delete m[k];
        s.put(m, 'syncT');
      };
    }),
};

export const events = {
  // Parent devices only read; they never create learning events.
  add: (e) => (role === 'parent' ? Promise.resolve() : tx('events', 'readwrite', (s) => s.add({ ts: Date.now(), ...e }))),
  since: (ts) => tx('events', 'readonly', (s) => s.index('ts').getAll(IDBKeyRange.lowerBound(ts))),
  after: (id) => tx('events', 'readonly', (s) => s.getAll(IDBKeyRange.lowerBound(id, true))),
  all: () => tx('events', 'readonly', (s) => s.getAll()),
  clear: () => tx('events', 'readwrite', (s) => s.clear()),
  replaceAll: (list) =>
    tx('events', 'readwrite', (s) => {
      s.clear();
      for (const e of list) if (e && typeof e.id === 'number') s.put(e);
    }),
};

// Ask the browser to keep our data (helps on iPad).
export async function persist() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {}
}
