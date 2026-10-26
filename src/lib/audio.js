import { ttsBlob } from './api.js';

// ---------- speaking (TTS) ----------
// - Only the newest speak() call may play: older calls still waiting for audio are dropped (no "late" voices).
// - Calling speak() again with the same text while it is loading/playing does nothing (no restart on repeated taps).
// - prefetch() warms the cache so words play instantly.
let audioEl = null;
let unlocked = false;
let ttsMode = 'openai'; // set from /api/health: 'openai' | 'browser'
let voiceOpts = {}; // { voice, persona } from settings
const cache = new Map(); // text -> object URL
const inflight = new Map(); // text -> Promise<url|null>
const MAX_CACHE = 250;

export function setVoice(v) {
  const next = v || {};
  if (JSON.stringify(next) === JSON.stringify(voiceOpts)) return;
  voiceOpts = next;
  cache.forEach((u) => URL.revokeObjectURL(u));
  cache.clear();
}
export function setTtsMode(m) {
  ttsMode = m;
}

// state: 'idle' | 'loading' | 'playing'
let state = 'idle';
const listeners = new Set();
const stateListeners = new Set();
function setState(s) {
  if (s === state) return;
  const wasPlaying = state === 'playing';
  state = s;
  stateListeners.forEach((f) => f(s));
  if (wasPlaying !== (s === 'playing')) listeners.forEach((f) => f(s === 'playing'));
}
// "talking" (mouth animation) = actually playing
export function onSpeakingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function onTtsState(fn) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}
export const isSpeaking = () => state === 'playing';

// iPad Safari only plays audio started from a tap. Call this inside the first tap handler.
export function unlockAudio() {
  if (unlocked) return;
  audioEl = audioEl || new Audio();
  audioEl.playsInline = true;
  audioEl.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqq';
  audioEl.play().catch(() => {});
  try {
    if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  } catch {}
  unlocked = true;
}

function browserSpeak(text, rate = 0.9) {
  return new Promise((resolve) => {
    const s = window.speechSynthesis;
    if (!s) return resolve();
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = rate;
    u.pitch = 1.15;
    const voices = s.getVoices().filter((v) => v.lang?.startsWith('en'));
    const pref = voices.find((v) => /Samantha|Karen|Moira|Serena|Kate|Google UK English Female/i.test(v.name)) || voices[0];
    if (pref) u.voice = pref;
    u.onend = u.onerror = () => resolve();
    s.speak(u);
  });
}

function remember(text, url) {
  cache.set(text, url);
  if (cache.size > MAX_CACHE) {
    const [k, u] = cache.entries().next().value;
    cache.delete(k);
    URL.revokeObjectURL(u);
  }
}

function getUrl(text) {
  if (cache.has(text)) return Promise.resolve(cache.get(text));
  if (inflight.has(text)) return inflight.get(text);
  const p = ttsBlob(text, voiceOpts)
    .then((blob) => {
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      remember(text, url);
      return url;
    })
    .catch(() => null)
    .finally(() => inflight.delete(text));
  inflight.set(text, p);
  return p;
}

// Warm the cache in the background (2 at a time).
export function prefetch(texts) {
  if (ttsMode !== 'openai') return;
  const list = [...new Set((texts || []).filter(Boolean))].filter((t) => !cache.has(t) && !inflight.has(t)).slice(0, 60);
  let i = 0;
  const worker = async () => {
    while (i < list.length) await getUrl(list[i++]);
  };
  worker();
  worker();
}

let gen = 0;
let current = null; // { text, rate, promise }
let endCurrent = null; // resolves the playing promise when stopped

export function speak(text, { rate } = {}) {
  if (!text) return Promise.resolve();
  if (current && current.text === text && current.rate === rate) return current.promise;
  stopSpeaking();
  const my = ++gen;
  const promise = (async () => {
    try {
      if (ttsMode === 'openai') {
        setState('loading');
        const url = await getUrl(text);
        if (my !== gen) return; // a newer speak/stop happened while we waited
        if (url) {
          audioEl = audioEl || new Audio();
          audioEl.src = url;
          audioEl.defaultPlaybackRate = audioEl.playbackRate = rate && rate < 1 ? 0.85 : 1;
          setState('playing');
          // no 'pause' listener: a late pause event from the previous clip would end this one early
          await new Promise((resolve) => {
            endCurrent = resolve;
            audioEl.onended = audioEl.onerror = () => resolve();
            audioEl.play().catch(() => resolve());
          });
          return;
        }
      }
      if (my !== gen) return;
      setState('playing');
      await browserSpeak(text, rate || 0.9);
    } finally {
      if (my === gen) {
        current = null;
        setState('idle');
      }
    }
  })();
  current = { text, rate, promise };
  return promise;
}

export function stopSpeaking() {
  gen++;
  current = null;
  if (endCurrent) {
    endCurrent();
    endCurrent = null;
  }
  try {
    if (audioEl && !audioEl.paused) audioEl.pause();
  } catch {}
  try {
    window.speechSynthesis?.cancel();
  } catch {}
  setState('idle');
}

// Resolves when nothing is loading or playing (or after maxMs).
export function waitIdle(maxMs = 6000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => (state === 'idle' || Date.now() - t0 > maxMs ? resolve() : setTimeout(tick, 100));
    tick();
  });
}

// ---------- listening (recording) ----------
export class Recorder {
  constructor() {
    this.stream = null;
    this.rec = null;
    this.chunks = [];
    this.startedAt = 0;
  }
  static supported() {
    return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  }
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported?.(t));
    this.rec = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start();
    this.startedAt = Date.now();
  }
  stop() {
    return new Promise((resolve) => {
      if (!this.rec) return resolve(null);
      this.rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.rec.mimeType || 'audio/mp4' });
        this.stream.getTracks().forEach((t) => t.stop());
        const seconds = (Date.now() - this.startedAt) / 1000;
        this.rec = null;
        resolve({ blob, seconds });
      };
      this.rec.stop();
    });
  }
  cancel() {
    try {
      this.rec?.stop();
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    this.rec = null;
  }
}
