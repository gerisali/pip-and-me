import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { loadPacks, currentPack, getSettings, saveSettings, withCharacterName, getCharacterImages } from './lib/content.js';
import { ensureWords } from './lib/learner.js';
import { health, setCode } from './lib/api.js';
import { setTtsMode, setVoice, unlockAudio, stopSpeaking, onTtsState } from './lib/audio.js';
import { persist, kv, setRole } from './lib/db.js';
import { setCloud, syncNow, startAutoSync, onSynced } from './lib/sync.js';
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

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r({ timeout: true }), ms))]);

export default function App() {
  const [state, setState] = useState({ loading: true });
  const [screen, setScreen] = useState(null);

  // Load everything from the local database (no network sync).
  const reload = useCallback(async (h) => {
    const health_ = h || (await health());
    const [packs, rawPack, settings, images, role] = await Promise.all([
      loadPacks(), currentPack(), getSettings(), getCharacterImages(), kv.get('deviceRole', null),
    ]);
    const pack = withCharacterName(rawPack, settings.characterName);
    if (pack) await ensureWords(pack);
    if (health_.tts) setTtsMode(health_.tts);
    setVoice({ voice: settings.voice, persona: `${settings.characterName}, ${settings.characterDescription}` });
    setState({ loading: false, packs, pack, settings, health: health_, customImage: images, role: role || 'child', roleChosen: !!role });
    setScreen((s) => (!s || s.key === 0 ? { name: role === 'parent' ? 'parent' : 'home', key: 0 } : s));
  }, []);

  // Sync with the cloud (if available), then reload.
  const refresh = useCallback(async () => {
    const h = await health();
    if (h.cloud) {
      setCloud(true);
      const role = await kv.get('deviceRole', null);
      setRole(role || 'child');
      if (role) await withTimeout(syncNow(), 8000);
      if (role !== 'parent') startAutoSync();
    }
    await reload(h);
  }, [reload]);

  useEffect(() => {
    persist();
    refresh();
    return onSynced(({ changed }) => changed && reload());
  }, [refresh, reload]);

  const go = useCallback((name, params = {}) => {
    stopSpeaking();
    setScreen({ name, key: Date.now(), ...params });
    window.scrollTo(0, 0);
  }, []);

  if (state.loading || !screen)
    return (
      <div className="center stage-bg">
        <Pip state="thinking" size={170} />
      </div>
    );

  const h = state.health;
  const needsSetup = h.unauthorized || (h.cloud && !state.roleChosen) || (state.role !== 'parent' && !state.settings.childName);
  if (needsSetup) return <Setup state={state} onDone={refresh} />;

  const value = { ...state, go, refresh, reload };
  const { key: screenKey, ...screenProps } = screen;
  const S = { home: Home, talk: Talk, mailbox: Mailbox, story: Story, explorer: Explorer, wordlab: WordLab, parent: Parent }[screen.name] || Home;

  return (
    <Ctx.Provider value={value}>
      <div className="stage-bg" />
      <div className="app" onPointerDown={unlockAudio}>
        {h.offline && <div className="banner">Sunucuya ulaşılamıyor — internet bağlantısını kontrol edin.</div>}
        {h.mock && <div className="banner demo">Demo modu: API anahtarı yok, karakter basit cevaplar veriyor.</div>}
        {state.role === 'parent' && screen.name !== 'parent' && (
          <div className="banner demo">Önizleme (veli cihazı): burada yapılanlar kızınızın ilerlemesine yazılmaz.</div>
        )}
        <div className="screen-anim" key={screenKey}>
          <S {...screenProps} />
        </div>
        <TtsPill />
      </div>
    </Ctx.Provider>
  );
}

// Small "getting the voice ready" hint while speech is being fetched (shows only if it takes > 250 ms).
function TtsPill() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let t = null;
    const off = onTtsState((st) => {
      clearTimeout(t);
      if (st === 'loading') t = setTimeout(() => setShow(true), 250);
      else setShow(false);
    });
    return () => { clearTimeout(t); off(); };
  }, []);
  if (!show) return null;
  return (
    <div className="tts-pill" role="status" aria-live="polite">
      <span className="dots"><i /><i /><i /></span>
    </div>
  );
}

function Setup({ state, onDone }) {
  const h = state.health;
  const [code, setC] = useState('');
  const [child, setChild] = useState(state.settings.childName || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const step = h.unauthorized ? 'code' : h.cloud && !state.roleChosen ? 'role' : 'child';

  async function submitCode(e) {
    e.preventDefault();
    unlockAudio();
    await setCode(code.trim());
    const r = await health();
    if (r.unauthorized) return setErr('Erişim kodu yanlış.');
    setErr('');
    onDone();
  }

  async function chooseRole(role) {
    setBusy(true);
    await kv.set('deviceRole', role);
    setRole(role);
    onDone();
  }

  async function submitChild(e) {
    e.preventDefault();
    unlockAudio();
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

        {step === 'code' && (
          <form onSubmit={submitCode} className="card form">
            <label>
              Erişim kodu
              <input value={code} onChange={(e) => setC(e.target.value)} autoComplete="off" />
            </label>
            {err && <p className="error">{err}</p>}
            <button className="btn primary big">Devam</button>
          </form>
        )}

        {step === 'role' && (
          <div className="card form">
            <h3>Bu cihaz kimin?</h3>
            <button className="role-btn" disabled={busy} onClick={() => chooseRole('child')}>
              <span className="badge m-talk"><Icon name="sparkle" size={28} /></span>
              <span>
                <b>Çocuk cihazı</b>
                <span className="tiny muted">Kızınızın iPad'i. Dersler burada yapılır, ilerleme buluta kaydedilir.</span>
              </span>
            </button>
            <button className="role-btn" disabled={busy} onClick={() => chooseRole('parent')}>
              <span className="badge m-explorer"><Icon name="parent" size={28} /></span>
              <span>
                <b>Veli cihazı</b>
                <span className="tiny muted">Sizin bilgisayarınız ya da telefonunuz. İlerlemeyi izler, ayarları ve haftalık paketleri yönetirsiniz.</span>
              </span>
            </button>
          </div>
        )}

        {step === 'child' && (
          <form onSubmit={submitChild} className="card form">
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
        )}
      </div>
    </>
  );
}
