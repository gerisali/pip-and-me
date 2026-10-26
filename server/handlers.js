// Web-standard (Request → Response) handlers, shared by Vercel functions (api/*.js)
// and the local Vite dev server (vite.config.js).
import { config, isMock } from './config.js';
import { buildRequest } from './prompts.js';
import { mockChat } from './mock.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

function authorized(req) {
  if (!config.passcode) return true;
  return req.headers.get('x-app-code') === config.passcode;
}

// ---------- moderation ----------
async function moderate(text) {
  if (!config.moderation || !config.openaiKey || !text) return { flagged: false };
  try {
    const r = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { authorization: `Bearer ${config.openaiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
    });
    if (!r.ok) return { flagged: false };
    const d = await r.json();
    const res = d.results?.[0];
    if (!res?.flagged) return { flagged: false };
    const cats = Object.entries(res.categories || {}).filter(([, v]) => v).map(([k]) => k);
    return { flagged: true, categories: cats };
  } catch {
    return { flagged: false };
  }
}

const SAFE_REDIRECT = {
  reply: "Hmm, let's talk about something else. Can you tell me about your favourite animal?",
  emotion: 'calm',
};

// ---------- /api/health ----------
export async function health(req) {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  return json({
    ok: true,
    mock: isMock(),
    stt: !!config.openaiKey,
    tts: config.ttsProvider === 'openai' && !!config.openaiKey ? 'openai' : 'browser',
    chatModel: config.chatModel,
  });
}

// ---------- /api/chat ----------
// body: { mode, ctx: {...}, messages: [{role:'pip'|'child', text}] }
export async function chat(req) {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const { mode = 'talk', ctx = {}, messages = [] } = body;
  const lastChild = [...messages].reverse().find((m) => m.role === 'child')?.text || '';

  const mod = await moderate(lastChild);
  if (mod.flagged) {
    return json({
      ...SAFE_REDIRECT,
      page_text: undefined,
      analysis: {
        errors: [], used_turkish: false, turkish_words: [], target_chunks_used: [], target_words_used: [],
        word_count: lastChild.split(/\s+/).filter(Boolean).length, mission_progress: 0,
        flag: { type: 'inappropriate', note: `Moderation: ${mod.categories.join(', ')}` },
      },
      moderated: true,
    });
  }

  if (isMock()) return json(mockChat(mode, ctx, messages));

  let system, tool;
  try {
    ({ system, tool } = buildRequest(mode, ctx));
  } catch (e) {
    return json({ error: e.message }, 400);
  }

  // Map conversation to Claude messages. Pip = assistant, child = user. Must start with user.
  const conv = [];
  for (const m of messages.slice(-24)) {
    const role = m.role === 'pip' ? 'assistant' : 'user';
    const text = (m.text || '').trim() || '(silence)';
    if (conv.length && conv.at(-1).role === role) conv.at(-1).content += `\n${text}`;
    else conv.push({ role, content: text });
  }
  if (!conv.length || conv[0].role !== 'user') conv.unshift({ role: 'user', content: '(The child opens the app.)' });
  if (conv.at(-1).role !== 'user') conv.push({ role: 'user', content: '(The child is quiet. Encourage her gently with an easy question.)' });

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.chatModel,
      max_tokens: 1200,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: conv,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      thinking: { type: 'disabled' },
      output_config: { effort: config.chatEffort },
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    return json({ error: 'model_error', status: r.status, detail: t.slice(0, 500) }, 502);
  }
  const d = await r.json();
  const out = d.content?.find((c) => c.type === 'tool_use')?.input;
  if (!out?.reply) return json({ error: 'no_output' }, 502);

  // Moderate Pip's own output as well (belt and braces).
  const outMod = await moderate(out.reply);
  if (outMod.flagged) return json({ ...SAFE_REDIRECT, analysis: out.analysis, moderated: true });

  return json({ ...out, usage: d.usage });
}

// ---------- /api/transcribe ----------
// multipart: file=<audio>, prompt=<optional context>
export async function transcribe(req) {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  if (!config.openaiKey) return json({ error: 'stt_unavailable' }, 501);
  const form = await req.formData();
  const file = form.get('file');
  if (!file) return json({ error: 'no file' }, 400);
  const fd = new FormData();
  const name = file.name || (file.type?.includes('mp4') ? 'speech.mp4' : 'speech.webm');
  fd.append('file', file, name);
  fd.append('model', config.sttModel);
  const prompt = form.get('prompt');
  if (config.sttModel === 'gpt-transcribe') {
    fd.append('languages[]', 'en');
    fd.append('languages[]', 'tr');
  } else {
    fd.append('language', 'en');
  }
  if (prompt) fd.append('prompt', String(prompt).slice(0, 800));
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.openaiKey}` },
    body: fd,
  });
  if (!r.ok) return json({ error: 'stt_error', status: r.status, detail: (await r.text()).slice(0, 500) }, 502);
  const d = await r.json();
  return json({ text: d.text || '', languages: d.languages || null });
}

// ---------- /api/tts ----------
// body: { text } → audio/mpeg
export async function tts(req) {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  if (config.ttsProvider !== 'openai' || !config.openaiKey) return json({ error: 'use_browser_tts' }, 501);
  const { text, voice, persona } = await req.json();
  if (!text) return json({ error: 'no text' }, 400);
  const VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
  const useVoice = VOICES.includes(voice) ? voice : config.ttsVoice;
  const instructions = persona
    ? `You are ${String(persona).slice(0, 200)}, talking to a 9-year-old English learner. Speak warmly and clearly, a little slower than normal, with gentle enthusiasm. Pronounce every word clearly.`
    : config.ttsInstructions;
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.openaiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.ttsModel,
      voice: useVoice,
      input: String(text).slice(0, 1500),
      instructions,
      response_format: 'mp3',
    }),
  });
  if (!r.ok) return json({ error: 'tts_error', status: r.status, detail: (await r.text()).slice(0, 300) }, 502);
  return new Response(r.body, { status: 200, headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=86400' } });
}

export const routes = { health, chat, transcribe, tts };
