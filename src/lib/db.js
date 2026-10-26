// Tiny IndexedDB wrapper: a key-value store + an append-only event log.
const DB_NAME = 'pip-and-me';
const VERSION = 1;
let dbp;

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

export const kv = {
  get: (k, d = undefined) => tx('kv', 'readonly', (s) => s.get(k)).then((v) => (v === undefined ? d : v)),
  set: (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k)),
  del: (k) => tx('kv', 'readwrite', (s) => s.delete(k)),
};

export const events = {
  add: (e) => tx('events', 'readwrite', (s) => s.add({ ts: Date.now(), ...e })),
  since: (ts) =>
    tx('events', 'readonly', (s) => s.index('ts').getAll(IDBKeyRange.lowerBound(ts))),
  all: () => tx('events', 'readonly', (s) => s.getAll()),
  clear: () => tx('events', 'readwrite', (s) => s.clear()),
};

// Ask the browser to keep our data (helps on iPad).
export async function persist() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {}
}
