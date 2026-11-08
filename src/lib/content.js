import { kv } from './db.js';

let packsCache = null;

export async function loadPacks() {
  if (packsCache) return packsCache;
  const packs = {};
  try {
    const idx = await (await fetch('/content/index.json')).json();
    await Promise.all(
      (idx.packs || []).map(async (id) => {
        try {
          packs[id] = await (await fetch(`/content/weeks/${id}.json`)).json();
        } catch {}
      })
    );
  } catch {}
  const imported = await kv.get('importedPacks', {});
  Object.assign(packs, imported);
  packsCache = packs;
  return packs;
}

export function invalidatePacks() {
  packsCache = null;
}

export function sortedPacks(packs) {
  return Object.values(packs).sort((a, b) => (a.week || 0) - (b.week || 0));
}

export async function currentPack() {
  const packs = await loadPacks();
  const list = sortedPacks(packs);
  const id = await kv.get('currentWeek', list[0]?.id);
  return packs[id] || list[0];
}

export async function setCurrentWeek(id) {
  await kv.set('currentWeek', id);
}

const REQUIRED = ['id', 'week', 'level', 'title', 'vocab', 'chunks', 'talkMissions', 'letters', 'story', 'explorer', 'phonics'];

export function validatePack(p) {
  const problems = [];
  if (!p || typeof p !== 'object') return ['Not a JSON object'];
  for (const k of REQUIRED) if (p[k] === undefined) problems.push(`missing "${k}"`);
  if (p.level && !['starters', 'movers', 'flyers'].includes(p.level)) problems.push('level must be starters|movers|flyers');
  for (const l of p.letters || []) for (const q of l.questions || []) if (!(q.answer >= 0 && q.answer < (q.options || []).length)) problems.push(`bad answer index in ${l.id}`);
  for (const c of p.explorer || []) for (const q of c.questions || []) if (!(q.answer >= 0 && q.answer < (q.options || []).length)) problems.push(`bad answer index in ${c.id}`);
  return problems;
}

export async function importPack(p) {
  const problems = validatePack(p);
  if (problems.length) return problems;
  const imported = await kv.get('importedPacks', {});
  imported[p.id] = p;
  await kv.set('importedPacks', imported);
  packsCache = null;
  return [];
}

export async function removeImported(id) {
  const imported = await kv.get('importedPacks', {});
  delete imported[id];
  await kv.set('importedPacks', imported);
  packsCache = null;
}

export const defaultSettings = {
  childName: '',
  characterName: 'Pip',
  characterDescription: 'a young, curious, kind fox',
  voice: 'marin',
  parentPin: '',
  sessionMinutes: 25,
  daysPerWeek: 3,
  autoAdvance: true,
};

// Content packs are written with "Pip"; show the chosen character's name instead.
export function withCharacterName(pack, name) {
  if (!pack || !name || name === 'Pip') return pack;
  return JSON.parse(JSON.stringify(pack).replace(/\bPip\b/g, name.replace(/["\\]/g, '')));
}

export async function getCharacterImages() {
  const imgs = await kv.get('characterImages', null);
  if (imgs) return imgs;
  const legacy = await kv.get('characterImage', null);
  return legacy ? { idle: legacy } : null;
}
export async function getSettings() {
  return { ...defaultSettings, ...(await kv.get('settings', {})) };
}
export async function saveSettings(s) {
  await kv.set('settings', s);
}

// Daily lessons and week progression live in progress.js (it imports this file, so load it lazily).
export async function markPlanItem(item) {
  const { markStep } = await import('./progress.js');
  return markStep(item);
}
