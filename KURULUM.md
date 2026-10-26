# Pip & Me — Kurulum Rehberi

Yaklaşık 30 dakika sürer. Sonunda iPad'de ana ekranda bir "Pip & Me" uygulaması olur.

## 1. API anahtarları (10 dk)

**Anthropic (Pip'in beyni)**
1. https://platform.claude.com adresinde hesap açın, ödeme yöntemi ekleyin.
2. *Settings → Limits* bölümünden aylık harcama limitini **15 $** yapın.
3. *API Keys → Create Key* → anahtarı kopyalayın (`sk-ant-...`).

**OpenAI (ses tanıma + Pip'in sesi)**
1. https://platform.openai.com → *API keys → Create new secret key* (`sk-...`).
2. *Limits* bölümünden aylık bir üst sınır koyun (ör. 10 $).

## 2. Kodu GitHub'a yükleyin (5 dk)

1. https://github.com/new → depo adı `pip-and-me`, **Private** seçin → *Create repository*.
2. *uploading an existing file* bağlantısına tıklayın ve zip'ten çıkan klasörün **içindekileri** sürükleyin (`node_modules` ve `dist` yoksa sorun değil) → *Commit changes*.

> İsterseniz bu adımı ben yapabilirim: GitHub bağlantısı üzerinden sizin hesabınızda özel repoyu oluşturup kodu yüklerim.

## 3. Vercel'de yayınlayın (5 dk)

1. https://vercel.com → *Continue with GitHub* ile girin (ücretsiz Hobby planı yeterli).
2. *Add New → Project* → `pip-and-me` reposunu *Import* edin. Framework otomatik **Vite** seçilir.
3. *Environment Variables* bölümüne ekleyin:

   | Ad | Değer |
   | --- | --- |
   | `ANTHROPIC_API_KEY` | Anthropic anahtarınız |
   | `OPENAI_API_KEY` | OpenAI anahtarınız |
   | `APP_PASSCODE` | Kendi belirlediğiniz bir kod (ör. `zoot2027`) |

4. *Deploy* → birkaç dakika sonra `https://pip-and-me-xxxx.vercel.app` gibi bir adres verir.

## 4. iPad'e kurun (5 dk)

1. iPad'de **Safari** ile adresi açın.
2. Erişim kodunu ve kızınızın adını girin → *Başla*.
3. *Paylaş* (kare + ok) → **Ana Ekrana Ekle**. Artık uygulama gibi açılır.
4. İlk kez mikrofona dokunduğunda iPad mikrofon izni ister → *İzin Ver*.
5. Sağ üstteki **Veli** düğmesi → kendinize bir PIN belirleyin.

## 5. Haftalık döngü

1. Hafta sonunda: **Veli → Hafta & rapor → Son 7 gün raporu** → inen `.json` dosyasını Claude'daki **Daily** Project sohbetine gönderin.
2. Claude yeni hafta paketini (`week-05.json` gibi) hazırlar.
3. **Veli → Hafta & rapor → Yeni hafta paketini yükle** → dosyayı seçin. Uygulama yeni haftaya geçer; yeniden kurulum gerekmez.

## Mac'te yerel çalıştırma (isteğe bağlı)

```bash
cd pip-and-me
npm install
cp .env.example .env   # anahtarları .env içine yazın
npm run dev            # http://localhost:5173
```

Not: iPad, Mac'teki yerel adrese bağlandığında mikrofon çalışmaz (Safari mikrofon için HTTPS ister). iPad için Vercel adresini kullanın.

## Sık karşılaşılanlar

- **"Demo modu" yazıyor:** `ANTHROPIC_API_KEY` girilmemiş ya da girildikten sonra yeniden *Deploy* yapılmamış (Vercel → Deployments → *Redeploy*).
- **Mikrofon düğmesi yok, klavye çıkıyor:** `OPENAI_API_KEY` eksik.
- **Pip'in sesi robotik:** OpenAI sesi kullanılamıyor, cihaz sesi devrede. `TTS_PROVIDER=openai` ve anahtarı kontrol edin.
- **6 Ocak 2027'den önce:** OpenAI'ın şu anki ses modeli (`gpt-4o-mini-tts`) kapanıyor. Aralık ayında yeni ses servisine geçişi birlikte yapacağız.
- **Veriler nerede?** Kızınızın iPad'inde ve (bulut senkronu açıksa) Vercel hesabınızdaki Upstash veritabanında. Ayda bir *Tam yedek* indirmeniz yine de önerilir.

## Karakteri değiştirmek

**Veli → Ayarlar → Karakter** bölümünden:

- **Adı** ve **kısa tarifi** (İngilizce, ör. `a cheerful young pop singer who loves animals`). Karakter konuşurken bu tarife göre davranır; içerikteki "Pip" adları da otomatik olarak yeni adla değişir.
- **Ses:** 13 sesten birini seçin (ör. kız karakter için `coral`, `shimmer` ya da `nova`).
- **Görseller:** Her ruh hali için bir resim (normal, konuşurken, mutlu, düşünürken, şaşırmış, dinlerken). Sadece "Normal" bile yeterli; "Konuşurken" resmi eklerseniz konuşma sırasında ağız açılıp kapanır.

Görsellerin kızınızın kendi çizimi ya da kullanım izni açık (CC0 gibi) olması gerekir; dizi ve film karakterleri telif hakkıyla korunur.

## Bulut senkronu ve cihazlar

Vercel → projeniz → *Storage* → **Upstash (Redis)** bağlıysa senkron otomatik açılır (bağlantı bilgilerini Vercel ekler; bağladıktan sonra bir kez *Redeploy* yapın).

İlk açılışta her cihaz için seçim yapılır:

- **Çocuk cihazı** (kızınızın iPad'i): dersler burada yapılır. İlerleme her oturumdan sonra ve iki dakikada bir buluta gönderilir.
- **Veli cihazı** (Mac, telefon): doğrudan veli paneli açılır. Özet, konuşmalar ve raporlar buluttan gelir. Ayar, karakter ve hafta paketi değişiklikleri kızınızın iPad'ine gider. Veli cihazında *Önizle* ile çocuk ekranına bakabilirsiniz; orada yapılanlar ilerlemeye yazılmaz.

Rol sonradan **Veli → Ayarlar → Bu cihaz** bölümünden değiştirilebilir.

## Sıfırlama

**Veli → Ayarlar → Sıfırla** (kutuya `SIL` yazın):

- **İlerlemeyi sıfırla:** konuşmalar, kelimeler, yıldızlar, mektuplar, hikâyeler, plan ve hafta silinir; ad, PIN ve karakter kalır.
- **Her şeyi sıfırla:** yukarıdakilere ek olarak ad, PIN, karakter ve yüklenen paketler de silinir; uygulama kurulum ekranına döner (cihaz rolü korunur).

Bulut açıksa sıfırlama buluttaki veriyi de siler ve diğer cihazlara bir sonraki açılışta uygulanır.
