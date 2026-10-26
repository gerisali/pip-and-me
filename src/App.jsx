import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { loadPacks, currentPack, getSettings, saveSettings, withCharacterName, getCharacterImages } from './lib/content.js';
import { ensureWords } from './lib/learner.js';
import { health, setCode } from './lib/api.js';
import { setTtsMode, setVoice, unlockAudio, stopSpeaking } from './lib/audio.js';
import { persist } from './lib/db.js';
import Home from './screens/Home.jsx';
import Talk from './screens/Talk.jsx';
import Mailbox from './screens/Mailbox.jsx';
import Story from './screens/Story.jsx';
import Explorer from './screens/Explorer.jsx';
import WordLab from './screens/WordLab.jsx';
import Parent from './screens/Parent.jsx';
import Pip from './character/Pip.jsx';
import Icon from './components/Icon.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export default function App() {
  const [state, setState] = useState({ loading: true });
  const [screen, setScreen] = useState({ name: 'home', key: 0 });

  const refresh = useCallback(async () => {
    const [packs, rawPack, settings, h, images] = await Promise.all([
      loadPacks(), currentPack(), getSettings(), health(), getCharacterImages(),
    ]);
    const pack = withCharacterName(rawPack, settings.characterName);
    if (pack) await ensureWords(pack);
    if (h.tts) setTtsMode(h.tts);
    setVoice({ voice: settings.voice, persona: `${settings.characterName}, ${settings.characterDescription}` });
    setState({ loading: false, packs, pack, settings, health: h, customImage: images });
  }, []);

  useEffect(() => {
    persist();
    refresh();
  }, [refresh]);

  const go = useCallback((name, params = {}) => {
    stopSpeaking();
    setScreen({ name, key: Date.now(), ...params });
    window.scrollTo(0, 0);
  }, []);

  if (state.loading)
    return (
      <div className="center stage-bg">
        <Pip state="thinking" size={170} />
      </div>
    );

  const needsSetup = state.health.unauthorized || !state.settings.childName;
  if (needsSetup) return <Setup state={state} onDone={refresh} />;

  const value = { ...state, go, refresh };
  const { key: screenKey, ...screenProps } = screen;
  const S = { home: Home, talk: Talk, mailbox: Mailbox, story: Story, explorer: Explorer, wordlab: WordLab, parent: Parent }[screen.name] || Home;

  return (
    <Ctx.Provider value={value}>
      <div className="stage-bg" />
      <div className="app" onPointerDown={unlockAudio}>
        {state.health.offline && <div className="banner">Sunucuya ulaşılamıyor — internet bağlantısını kontrol edin.</div>}
        {state.health.mock && <div className="banner demo">Demo modu: API anahtarı yok, karakter basit cevaplar veriyor.</div>}
        <div className="screen-anim" key={screenKey}>
          <S {...screenProps} />
        </div>
      </div>
    </Ctx.Provider>
  );
}

function Setup({ state, onDone }) {
  const [code, setC] = useState('');
  const [child, setChild] = useState(state.settings.childName || '');
  const [err, setErr] = useState('');
  const needCode = state.health.unauthorized;

  async function submit(e) {
    e.preventDefault();
    unlockAudio();
    if (needCode) {
      await setCode(code.trim());
      const h = await health();
      if (h.unauthorized) return setErr('Erişim kodu yanlış.');
    }
    if (!child.trim()) return setErr('Lütfen çocuğun adını yazın.');
    await saveSettings({ ...state.settings, childName: child.trim() });
    onDone();
  }

  return (
    <>
      <div className="stage-bg" />
      <div className="setup">
        <Pip state="happy" size={190} />
        <h1 className="brand">Pip &amp; Me</h1>
        <p className="muted">Kurulum · veli için</p>
        <form onSubmit={submit} className="card form">
          {needCode && (
            <label>
              Erişim kodu
              <input value={code} onChange={(e) => setC(e.target.value)} autoComplete="off" />
            </label>
          )}
          <label>
            Çocuğun adı (karakter ona böyle hitap edecek)
            <input value={child} onChange={(e) => setChild(e.target.value)} />
          </label>
          {err && <p className="error">{err}</p>}
          <button className="btn primary big">
            Başla <Icon name="sparkle" size={20} />
          </button>
          <p className="tiny muted">Karakter bir yapay zekâ karakteridir. Konuşmalar veli panelinden görülebilir.</p>
        </form>
      </div>
    </>
  );
}
