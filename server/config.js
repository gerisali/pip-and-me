// All provider/model choices live here and can be changed with environment variables
// (Vercel → Project → Settings → Environment Variables, or a local .env file).

const env = (k, d) => (process.env[k] && process.env[k].trim()) || d;

export const config = {
  anthropicKey: env('ANTHROPIC_API_KEY', ''),
  openaiKey: env('OPENAI_API_KEY', ''),
  passcode: env('APP_PASSCODE', ''),

  // Pip's brain. Fast + cheap model for live conversation.
  chatModel: env('CHAT_MODEL', 'claude-haiku-5-5'),
  chatEffort: env('CHAT_EFFORT', 'low'),

  // Speech-to-text. gpt-transcribe hears English AND Turkish, so switches to Turkish get logged.
  sttModel: env('STT_MODEL', 'gpt-transcribe'),

  // Text-to-speech. 'openai' | 'browser'. gpt-4o-mini-tts shuts down 2027-01-06 — switch before then.
  ttsProvider: env('TTS_PROVIDER', 'openai'),
  ttsModel: env('TTS_MODEL', 'gpt-4o-mini-tts'),
  ttsVoice: env('TTS_VOICE', 'marin'),
  ttsInstructions: env(
    'TTS_INSTRUCTIONS',
    'You are Pip, a friendly, curious young fox talking to a 9-year-old English learner. Speak warmly and clearly, a little slower than normal, with gentle enthusiasm. Pronounce every word clearly.'
  ),

  moderation: env('MODERATION', 'on') !== 'off',
};

export const isMock = () => !config.anthropicKey;
