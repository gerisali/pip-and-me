import { promptSummary } from './learner.js';

// The slice of the week pack + learner model the server needs to build Pip's prompt.
export async function buildCtx(pack, settings, extra = {}) {
  return {
    level: pack?.level || 'starters',
    childName: settings.childName,
    characterName: settings.characterName || 'Pip',
    characterDescription: settings.characterDescription,
    pack: {
      title: pack?.title,
      theme: pack?.theme,
      chunks: (pack?.chunks || []).map((c) => ({ text: c.text })),
      vocab: (pack?.vocab || []).map((v) => ({ word: v.word })),
    },
    learner: await promptSummary(),
    ...extra,
  };
}
