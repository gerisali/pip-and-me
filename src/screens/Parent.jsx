import { useEffect, useState } from 'react';
import { useApp } from '../App.jsx';
import { TopBar } from './Home.jsx';
import { aggregate, buildWeeklyReport, download } from '../lib/report.js';
import { events, kv } from '../lib/db.js';
import { getLearner } from '../lib/learner.js';
import { sortedPacks, setCurrentWeek, importPack, removeImported, saveSettings } from '../lib/content.js';
import { fileToDataUrl } from '../lib/image.js';
import { cloudOn, syncNow, syncSoon, resetEverywhere, lastSync } from '../lib/sync.js';
import { setRole } from '../lib/db.js';
import Icon from '../components/Icon.jsx';

const DAY = 86400000;
const ERR_TR = {
  past_tense: 'Geçmiş zaman', third_person_s: '3. tekil -s', be_missing: 'am/is/are eksik', article: 'a/an/the', plural: 'Çoğul',
  word_order: 'Kelime sırası', preposition: 'Edat (in/on/at…)', pronoun: 'Zamir', question_form: 'Soru yapısı', negative_form: 'Olumsuz yapı',
  verb_form: 'Fiil biçimi', vocabulary_choice: 'Kelime seçimi', spelling: 'Yazım', capital_punctuation: 'Büyük harf/noktalama', other: 'Diğer',
};
const MOD_TR = { talk: 'Talk', mailbox: 'Mailbox', story: 'Story', explorer: 'Explorer', wordlab: 'Word Lab', phonics: 'Sounds' };
const pct = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`);

export default function Parent() {
  const { settings, go } = useApp();
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('summary');

  if (!ok) {
    const creating = !settings.parentPin;
    return (
      <div className="screen">
        <TopBar title="Veli paneli" onBack={() => go('home')} />
        <form className="card form narrow" onSubmit={async (e) => {
          e.preventDefault();
          if (creating) {
            if (!/^\d{4,8}$/.test(pin)) return setErr('4–8 haneli bir PIN belirleyin.');
            await saveSettings({ ...settings, parentPin: pin });
            syncSoon(300);
            setOk(true);
          } else if (pin === settings.parentPin) setOk(true);
          else setErr('PIN yanlış.');
        }}>
          <label>{creating ? 'Yeni veli PIN’i belirleyin' : 'Veli PIN’i'}
            <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
          </label>
          {err && <p className="error">{err}</p>}
          <button className="btn primary">{creating ? 'Kaydet ve gir' : 'Gir'}</button>
        </form>
      </div>
    );
  }

  return <Panel tab={tab} setTab={setTab} />;
}

function Panel({ tab, setTab }) {
  const { go, role, reload } = useApp();
  const [ver, setVer] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [last, setLast] = useState(0);
  const [syncErr, setSyncErr] = useState('');

  async function doSync() {
    setSyncing(true);
    const r = await syncNow();
    setSyncErr(r.error || '');
    setLast(await lastSync());
    setSyncing(false);
    if (!r.skipped) {
      await reload();
      setVer((v) => v + 1);
    }
  }
  useEffect(() => {
    doSync();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="screen parent">
      <TopBar title="Veli paneli" onBack={() => go('home')} right={<button className="btn ghost small" onClick={() => go('home')}>Önizle</button>} />
      <div className="sync-bar">
        {cloudOn() ? (
          <>
            <span className={`dot ${syncErr ? 'bad' : 'ok'}`} />
            <span>
              {role === 'parent' ? 'Veli cihazı' : 'Çocuk cihazı'} · Bulut senkronu {syncErr ? `hata: ${syncErr}` : last ? `· son: ${new Date(last).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
            <button className="btn small" onClick={doSync} disabled={syncing}><Icon name="replay" size={16} /> {syncing ? 'Senkronize ediliyor…' : 'Yenile'}</button>
          </>
        ) : (
          <span className="tiny muted">Bulut senkronu kapalı — veriler sadece bu cihazda.</span>
        )}
      </div>
      <div className="tabs">
        {[['summary', 'Özet'], ['logs', 'Konuşmalar'], ['week', 'Hafta & rapor'], ['settings', 'Ayarlar']].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'summary' && <Summary key={ver} />}
      {tab === 'logs' && <Logs key={ver} />}
      {tab === 'week' && <WeekTab key={ver} />}
      {tab === 'settings' && <SettingsTab key={ver} />}
    </div>
  );
}

function Summary() {
  const [days, setDays] = useState(7);
  const [m, setM] = useState(null);
  const [L, setL] = useState(null);
  useEffect(() => {
    aggregate(Date.now() - days * DAY).then((r) => setM(r.metrics));
    getLearner().then(setL);
  }, [days]);
  if (!m || !L) return null;
  const boxes = [1, 2, 3, 4, 5].map((b) => Object.values(L.words).filter((w) => w.box === b).length);
  return (
    <div>
      <div className="seg">
        {[7, 14, 30].map((d) => <button key={d} className={`tab ${d === days ? 'active' : ''}`} onClick={() => setDays(d)}>Son {d} gün</button>)}
      </div>
      {m.flags.length > 0 && (
        <div className="card flag">
          <h3>⚠️ Dikkat edilmesi gerekenler</h3>
          {m.flags.map((f, i) => <p key={i}><b>{f.type}</b> — {f.note} {f.text && <span className="muted">(“{f.text}”)</span>}</p>)}
        </div>
      )}
      <div className="stats">
        <Stat label="Aktif gün" value={m.activeDays} />
        <Stat label="Ort. kelime / konuşma turu" value={m.talk.meanWordsPerTurn} hint="Konuşmanın ana göstergesi" />
        <Stat label="En uzun cevap (kelime)" value={m.talk.longestTurnWords} />
        <Stat label="Türkçeye geçiş" value={pct(m.talk.turkishTurnRatio)} />
        <Stat label="Tek kelimelik cevap" value={m.talk.oneWordTurns} />
        <Stat label="İpucu kullanımı" value={m.talk.hintsUsed} />
        <Stat label="Word Lab doğruluk" value={pct(m.vocabulary.wordLabAccuracy)} />
        <Stat label="Okuma soruları" value={pct(m.reading.quizAccuracy)} />
        <Stat label="Sesli okuma doğruluğu" value={pct(m.reading.meanAccuracy)} />
        <Stat label="Mektup cevabı (ort. kelime)" value={m.writing.meanWords} />
      </div>
      <div className="card">
        <h3>Süre (dakika)</h3>
        <div className="bars">
          {Object.entries(m.minutesByModule).map(([k, v]) => (
            <div key={k} className="bar-row"><span>{MOD_TR[k] || k}</span><div className="bar"><div style={{ width: `${Math.min(100, v * 4)}%` }} /></div><span>{v}</span></div>
          ))}
          {!Object.keys(m.minutesByModule).length && <p className="muted">Henüz oturum yok.</p>}
        </div>
      </div>
      <div className="card">
        <h3>En sık hatalar</h3>
        {m.errors.length ? m.errors.slice(0, 6).map((e) => (
          <div key={e.type} className="err-row">
            <b>{ERR_TR[e.type] || e.type}</b> <span className="muted">× {e.count}</span>
            {e.examples.slice(0, 2).map((x, i) => <div key={i} className="tiny">“{x.said}” → <i>{x.better}</i></div>)}
          </div>
        )) : <p className="muted">Henüz veri yok.</p>}
      </div>
      <div className="card two-col">
        <div>
          <h3>Zorlandığı kelimeler</h3>
          {m.vocabulary.hardWords.map((w) => <span key={w.word} className="chip static">{w.word} ({w.wrong}✗)</span>)}
          {m.reading.misreadWords.length > 0 && <><h4>Sesli okumada takıldıkları</h4>{m.reading.misreadWords.map((w) => <span key={w.word} className="chip static">{w.word}</span>)}</>}
        </div>
        <div>
          <h3>Türkçe söyledikleri</h3>
          {m.turkishGaps.map((t, i) => <span key={i} className="chip static">{t.tr} → {t.en}</span>)}
          <h4>Kendiliğinden kullandığı kalıplar</h4>
          {Object.entries(m.targetChunksProduced).map(([c, n]) => <span key={c} className="chip static">{c} ×{n}</span>)}
        </div>
      </div>
      <div className="card">
        <h3>Kelime kutuları (aralıklı tekrar)</h3>
        <p className="tiny muted">Kutu 1: yeni/unutulmuş … Kutu 5: kalıcı</p>
        <div className="boxes">{boxes.map((n, i) => <div key={i} className="box"><b>{n}</b><span>Kutu {i + 1}</span></div>)}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return <div className="stat card"><div className="stat-v">{value}</div><div className="stat-l">{label}</div>{hint && <div className="tiny muted">{hint}</div>}</div>;
}

function Logs() {
  const [ev, setEv] = useState(null);
  useEffect(() => { events.since(Date.now() - 30 * DAY).then((e) => setEv(e.reverse())); }, []);
  if (!ev) return null;
  const talk = ev.filter((e) => e.type === 'talk_turn');
  const sessions = [...new Set(talk.map((t) => t.session))];
  const writing = ev.filter((e) => e.type === 'letter_reply' || e.type === 'story_page');
  return (
    <div>
      <h3>Konuşmalar (son 30 gün)</h3>
      {!sessions.length && <p className="muted">Henüz konuşma yok.</p>}
      {sessions.map((s) => {
        const turns = talk.filter((t) => t.session === s).reverse();
        return (
          <details key={s} className="card">
            <summary>{new Date(turns[0].ts).toLocaleString('tr-TR')} · {turns[0].missionId} · {turns.length} tur</summary>
            {turns.map((t) => (
              <div key={t.id} className="log-turn">
                <div className="msg child">{t.childText}</div>
                {(t.analysis?.errors || []).map((e, i) => <div key={i} className="tiny err">✎ {ERR_TR[e.type] || e.type}: “{e.said}” → {e.better}</div>)}
                {t.analysis?.used_turkish && <div className="tiny err">🇹🇷 {(t.analysis.turkish_words || []).map((w) => `${w.tr}→${w.en}`).join(', ')}</div>}
                <div className="msg pip">{t.pipText}</div>
              </div>
            ))}
          </details>
        );
      })}
      <h3>Yazdıkları</h3>
      {writing.map((w) => (
        <div key={w.id} className="card">
          <div className="tiny muted">{new Date(w.ts).toLocaleString('tr-TR')} · {w.type === 'letter_reply' ? `Mektup ${w.letterId}` : `Hikâye sayfa ${w.pageIndex + 1}`}</div>
          <div className="sent">{w.text}</div>
          {(w.analysis?.errors || []).map((e, i) => <div key={i} className="tiny err">✎ {ERR_TR[e.type] || e.type}: “{e.said}” → {e.better}</div>)}
        </div>
      ))}
    </div>
  );
}

function WeekTab() {
  const { packs, pack, refresh } = useApp();
  const [msg, setMsg] = useState('');
  const [imported, setImported] = useState({});
  useEffect(() => { kv.get('importedPacks', {}).then(setImported); }, [packs]);
  return (
    <div>
      <div className="card">
        <h3>Bu haftanın paketi</h3>
        <select value={pack?.id} onChange={async (e) => { await setCurrentWeek(e.target.value); await refresh(); syncSoon(300); }}>
          {sortedPacks(packs).map((p) => <option key={p.id} value={p.id}>Hafta {p.week}: {p.title} ({p.level}){imported[p.id] ? ' · yüklendi' : ''}</option>)}
        </select>
        <p className="tiny muted">Hedef kalıplar: {(pack?.chunks || []).map((c) => c.text).join(' · ')}</p>
      </div>
      <div className="card">
        <h3>1) Haftalık raporu indir</h3>
        <p className="tiny muted">Bu dosyayı Claude'a (Project sohbetine) gönderin; bir sonraki haftanın paketi buna göre hazırlanır.</p>
        <div className="row wrap">
          {[7, 14].map((d) => (
            <button key={d} className="btn primary" onClick={async () => download(await buildWeeklyReport(d), `pip-rapor-${new Date().toLocaleDateString('sv')}-${d}g.json`)}>Son {d} gün raporu</button>
          ))}
          <button className="btn" onClick={async () => download({ events: await events.all(), learner: await getLearner(), books: await kv.get('books', {}), letters: await kv.get('letters', {}) }, `pip-yedek-${new Date().toLocaleDateString('sv')}.json`)}>Tam yedek</button>
        </div>
      </div>
      <div className="card">
        <h3>2) Yeni hafta paketini yükle</h3>
        <input type="file" accept="application/json,.json" onChange={async (e) => {
          const f = e.target.files[0];
          if (!f) return;
          try {
            const p = JSON.parse(await f.text());
            const problems = await importPack(p);
            if (problems.length) return setMsg('Sorun: ' + problems.join(', '));
            await setCurrentWeek(p.id);
            await refresh();
            syncSoon(300);
            setMsg(`Yüklendi ve seçildi: Hafta ${p.week} — ${p.title}${cloudOn() ? ' (kızınızın iPad\'ine de gönderiliyor)' : ''}`);
          } catch (err) {
            setMsg('Dosya okunamadı: ' + err.message);
          }
        }} />
        {msg && <p>{msg}</p>}
        {Object.keys(imported).length > 0 && (
          <div className="tiny">Yüklenen paketler: {Object.values(imported).map((p) => (
            <span key={p.id} className="chip static">{p.id} <button className="link" onClick={async () => { await removeImported(p.id); await refresh(); syncSoon(300); }}>kaldır</button></span>
          ))}</div>
        )}
      </div>
    </div>
  );
}

function SettingsTab() {
  const { settings, health, refresh } = useApp();
  const [s, setS] = useState(settings);
  const [saved, setSaved] = useState(false);
  const upd = (k) => (e) => { setS({ ...s, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }); setSaved(false); };
  return (
    <div>
      <div className="card form">
        <label>Çocuğun adı<input value={s.childName} onChange={upd('childName')} /></label>
        <label>Haftada kaç gün
          <select value={s.daysPerWeek} onChange={(e) => setS({ ...s, daysPerWeek: Number(e.target.value) })}>
            <option value={3}>3 gün (A, B, C oturumları)</option>
            <option value={4}>4 gün (A, B, C, D oturumları)</option>
          </select>
        </label>
        <label>Oturum süresi üst sınırı (dk)<input type="number" min={10} max={40} value={s.sessionMinutes} onChange={upd('sessionMinutes')} /></label>
        <label>Veli PIN<input type="password" inputMode="numeric" value={s.parentPin} onChange={upd('parentPin')} /></label>
        <button className="btn primary" onClick={async () => { await saveSettings(s); setSaved(true); await refresh(); syncSoon(300); }}>Kaydet</button>
        {saved && <p className="tiny">Kaydedildi ✓</p>}
      </div>
      <CharacterCard s={s} setS={setS} />
      <div className="card">
        <h3>Sistem durumu</h3>
        <p className="tiny">Mod: {health.mock ? 'Demo (API anahtarı yok)' : 'Canlı'} · Model: {health.chatModel || '—'} · Ses tanıma: {health.stt ? 'açık' : 'kapalı (klavye)'} · Ses: {health.tts || '—'}</p>
      </div>
      <DeviceCard />
      <ResetCard />
    </div>
  );
}

function DeviceCard() {
  const { role, health, refresh } = useApp();
  if (!health.cloud) return null;
  return (
    <div className="card">
      <h3>Bu cihaz</h3>
      <p className="tiny">Şu an: <b>{role === 'parent' ? 'Veli cihazı' : 'Çocuk cihazı'}</b>. Çocuk cihazı ilerlemeyi buluta gönderir; veli cihazı sadece izler ve ayarları yönetir.</p>
      <button className="btn small" onClick={async () => { const r = role === 'parent' ? 'child' : 'parent'; await kv.set('deviceRole', r); setRole(r); await refresh(); }}>
        {role === 'parent' ? 'Bu cihazı çocuk cihazı yap' : 'Bu cihazı veli cihazı yap'}
      </button>
    </div>
  );
}

function ResetCard() {
  const { refresh, health } = useApp();
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  async function run(scope) {
    setMsg('Sıfırlanıyor…');
    try {
      await resetEverywhere(scope);
      setConfirm('');
      setMsg(scope === 'all' ? 'Her şey sıfırlandı.' : 'İlerleme sıfırlandı.');
      await refresh();
    } catch (e) {
      setMsg('Hata: ' + e.message);
    }
  }
  return (
    <div className="card danger">
      <h3>Sıfırla</h3>
      <p className="tiny muted">
        {health.cloud ? 'Sıfırlama buluttaki veriyi de siler ve kızınızın iPad\'ine de uygulanır. ' : ''}Önce Hafta & rapor sekmesinden “Tam yedek” almanız önerilir. Onaylamak için kutuya SIL yazın.
      </p>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="SIL" />
      <div className="reset-opts">
        <button className="btn" disabled={confirm !== 'SIL'} onClick={() => run('progress')}>
          İlerlemeyi sıfırla
          <span className="tiny muted">Konuşmalar, kelimeler, yıldızlar, mektuplar, hikâyeler, plan ve hafta. Ad, PIN ve karakter kalır.</span>
        </button>
        <button className="btn danger-btn" disabled={confirm !== 'SIL'} onClick={() => run('all')}>
          Her şeyi sıfırla
          <span className="tiny">Yukarıdakiler + ad, PIN, karakter ve yüklenen paketler. Uygulama ilk kurulum ekranına döner.</span>
        </button>
      </div>
      {msg && <p className="tiny">{msg}</p>}
    </div>
  );
}

const MOODS = [
  ['idle', 'Normal (zorunlu)'],
  ['talking', 'Konuşurken (ağzı açık)'],
  ['happy', 'Mutlu'],
  ['thinking', 'Düşünürken'],
  ['surprised', 'Şaşırmış'],
  ['listening', 'Dinlerken'],
];
const VOICES = ['marin', 'cedar', 'coral', 'shimmer', 'nova', 'sage', 'ballad', 'alloy', 'verse', 'fable', 'ash', 'echo', 'onyx'];

function CharacterCard({ s, setS }) {
  const { customImage, refresh } = useApp();
  const imgs = customImage || {};
  const [saved, setSaved] = useState(false);
  async function setMood(mood, file) {
    const all = { ...(await kv.get('characterImages', {})) };
    if (!all.idle && (await kv.get('characterImage', null))) all.idle = await kv.get('characterImage');
    all[mood] = await fileToDataUrl(file, 512, 0.8);
    await kv.set('characterImages', all);
    await refresh();
    syncSoon(300);
  }
  async function clearAll() {
    await kv.set('characterImages', null);
    await kv.del('characterImage');
    await refresh();
    syncSoon(300);
  }
  return (
    <div className="card form">
      <h3>Karakter</h3>
      <p className="tiny muted">Kızınızın kendi çizdiği ya da kullanım izni açık (ör. CC0) bir karakter kullanın. Bulut açıksa görseller kızınızın iPad'ine de gönderilir.</p>
      <label>Adı<input value={s.characterName} onChange={(e) => { setS({ ...s, characterName: e.target.value }); setSaved(false); }} /></label>
      <label>Kısa tarifi (İngilizce — karakterin kişiliğini belirler)
        <input value={s.characterDescription} onChange={(e) => { setS({ ...s, characterDescription: e.target.value }); setSaved(false); }} placeholder="a cheerful young pop singer who loves animals" />
      </label>
      <label>Ses
        <select value={s.voice} onChange={(e) => setS({ ...s, voice: e.target.value })}>
          {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <button className="btn primary" onClick={async () => { await saveSettings(s); setSaved(true); await refresh(); syncSoon(300); }}>Karakteri kaydet</button>
      {saved && <p className="tiny">Kaydedildi ✓</p>}
      <h4>Görseller (her ruh hali için bir resim; sadece “Normal” yeterli)</h4>
      <div className="mood-grid">
        {MOODS.map(([m, label]) => (
          <label key={m} className="mood">
            {imgs[m] ? <img src={imgs[m]} alt="" /> : <span className="mood-empty">+</span>}
            <span className="tiny">{label}</span>
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && setMood(m, e.target.files[0])} />
          </label>
        ))}
      </div>
      {imgs.idle && <button className="btn small" onClick={clearAll}>Varsayılan karaktere (Pip) dön</button>}
    </div>
  );
}
