import { kv } from './db.js';

let code = null;
export async function getCode() {
  if (code === null) code = (await kv.get('appCode', '')) || '';
  return code;
}
export async function setCode(c) {
  code = c;
  await kv.set('appCode', c);
}

async function post(path, body, isForm = false) {
  const headers = { 'x-app-code': await getCode() };
  if (!isForm) headers['content-type'] = 'application/json';
  const r = await fetch(`/api/${path}`, { method: 'POST', headers, body: isForm ? body : JSON.stringify(body) });
  return r;
}

export async function health() {
  try {
    const r = await post('health', {});
    if (r.status === 401) return { unauthorized: true };
    if (!r.ok) return { offline: true };
    return await r.json();
  } catch {
    return { offline: true };
  }
}

export async function chat(mode, ctx, messages) {
  const r = await post('chat', { mode, ctx, messages });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `chat ${r.status}`);
  return d;
}

export async function transcribe(blob, prompt) {
  const fd = new FormData();
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  fd.append('file', blob, `speech.${ext}`);
  if (prompt) fd.append('prompt', prompt);
  const r = await post('transcribe', fd, true);
  if (r.status === 501) return { unavailable: true };
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `stt ${r.status}`);
  return d;
}

export async function ttsBlob(text, opts = {}) {
  const r = await post('tts', { text, ...opts });
  if (!r.ok) return null;
  return await r.blob();
}
