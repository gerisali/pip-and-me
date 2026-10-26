// Cloud sync between the child's device and parent devices (Upstash Redis via /api/sync).
// - Child device: pushes learning events + its state; pulls settings/packs/character the parent changed.
// - Parent device: pulls everything (events included) and pushes settings/packs/character changes.
// Values are synced per key with last-write-wins on the "last changed" timestamp kept in db.js.
import { kv, events, SYNC_KEYS, CHILD_OWNED, getRole } from './db.js';
import { call } from './api.js';
import { invalidateLearner } from './learner.js';
import { invalidatePacks } from './content.js';

let enabled = false;
let running = null;
const listeners = new Set();

export const setCloud = (on) => (enabled = !!on);
export const cloudOn = () => enabled;
export function onSynced(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function lastSync() {
  return kv.get('lastSync', 0);
}

// Wipe local data for a reset that happened (here or on another device).
export async function applyReset(scope) {
  await events.clear();
  for (const k of ['learner', 'letters', 'missionsDone', 'planState', 'planIndex', 'currentWeek', 'books', 'lastEventPushed']) await kv.del(k);
  if (scope === 'all') for (const k of ['settings', 'characterImages', 'characterImage', 'importedPacks']) await kv.del(k);
  invalidateLearner();
  invalidatePacks();
}

// Reset everywhere (cloud + this device). Without cloud it only resets this device.
export async function resetEverywhere(scope) {
  if (enabled) {
    const r = await call('sync', { reset: scope });
    await applyReset(scope);
    if (r.resetDone) await kv.set('resetSeen', r.resetDone.t);
  } else {
    await applyReset(scope);
  }
}

export function syncNow() {
  if (!enabled) return Promise.resolve({ changed: false, skipped: true });
  if (running) return running;
  running = doSync()
    .catch((e) => ({ changed: false, error: String(e.message || e) }))
    .finally(() => (running = null));
  return running;
}

async function doSync() {
  const role = getRole();
  let changed = false;

  // 1) meta + reset marker first, so a reset elsewhere wipes stale local data before we push it back.
  let res = await call('sync', {});
  const seen = await kv.get('resetSeen', 0);
  if (res.reset && res.reset.t > seen) {
    await applyReset(res.reset.scope);
    await kv.set('resetSeen', res.reset.t);
    changed = true;
  }

  // 2) child pushes new events
  if (role === 'child') {
    const last = await kv.get('lastEventPushed', 0);
    const evs = await events.after(last);
    for (let i = 0; i < evs.length; i += 40) {
      const chunk = evs.slice(i, i + 40);
      await call('sync', { events: chunk });
      await kv.set('lastEventPushed', chunk.at(-1).id);
    }
  }

  // 3) per-key last-write-wins
  const localT = await kv.get('syncT', {});
  const serverT = res.meta || {};
  for (const k of SYNC_KEYS) {
    const lt = localT[k] || 0;
    const st = serverT[k] || 0;
    const mayPush = role === 'child' || !CHILD_OWNED.has(k);
    if (lt > st && mayPush) {
      const v = await kv.get(k);
      if (v !== undefined) await call('sync', { put: { key: k, v, t: lt } });
    } else if (st > lt) {
      const r = await call('sync', { get: k });
      if (k === 'settings') {
        // field-wise merge: never lose a field one device has and the other left empty (e.g. child name vs parent PIN)
        const local = (await kv.get('settings')) || {};
        const merged = { ...local, ...Object.fromEntries(Object.entries(r.value || {}).filter(([, v]) => v !== '' && v != null)) };
        const differs = JSON.stringify(merged) !== JSON.stringify(r.value);
        if (differs) await kv.set('settings', merged);
        else await kv.setRaw('settings', merged, r.t || st);
      } else {
        await kv.setRaw(k, r.value, r.t || st);
      }
      changed = true;
    }
  }

  // 4) parent mirrors all events
  if (role === 'parent') {
    const r = await call('sync', { pullEvents: true });
    await events.replaceAll(r.events || []);
    changed = true;
  }

  await kv.set('lastSync', Date.now());
  if (changed) {
    invalidateLearner();
    invalidatePacks();
  }
  listeners.forEach((f) => f({ changed }));
  return { changed };
}

// Child device: sync in the background.
let timer = null;
export function startAutoSync() {
  if (!enabled || timer) return;
  timer = setInterval(() => syncNow(), 120000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') syncNow();
  });
}

let soon = null;
export function syncSoon(ms = 1500) {
  if (!enabled) return;
  clearTimeout(soon);
  soon = setTimeout(() => syncNow(), ms);
}
