import { ttsBlob } from './api.js';

// ---------- speaking (TTS) ----------
let audioEl = null;
let unlocked = false;
let ttsMode = 'openai'; // set from /api/health: 'openai' | 'browser'
let voiceOpts = {}; // { voice, persona } from settings
export function setVoice(v) {
  voiceOpts = v || {};
  cache.clear();
}
const cache = new Map(); // text -> object URL
const listeners = new Set();
let speaking = false;

export function setTtsMode(m) {
  ttsMode = m;
}
export function onSpeakingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setSpeaking(v) {
  speaking = v;
  listeners.forEach((f) => f(v));
}
export const isSpeaking = () => speaking;

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

export async function speak(text, { rate } = {}) {
  if (!text) return;
  stopSpeaking();
  setSpeaking(true);
  try {
    if (ttsMode === 'openai') {
      let url = cache.get(text);
      if (!url) {
        const blob = await ttsBlob(text, voiceOpts);
        if (blob) {
          url = URL.createObjectURL(blob);
          cache.set(text, url);
        }
      }
      if (url) {
        audioEl = audioEl || new Audio();
        audioEl.src = url;
        audioEl.playbackRate = rate && rate < 1 ? 0.85 : 1;
        await new Promise((resolve) => {
          audioEl.onended = audioEl.onerror = audioEl.onpause = () => resolve();
          audioEl.play().catch(() => resolve());
        });
        return;
      }
    }
    await browserSpeak(text, rate || 0.9);
  } finally {
    setSpeaking(false);
  }
}

export function stopSpeaking() {
  try {
    if (audioEl && !audioEl.paused) audioEl.pause();
  } catch {}
  try {
    window.speechSynthesis?.cancel();
  } catch {}
  setSpeaking(false);
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
