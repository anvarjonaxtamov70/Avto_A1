# 🎵 Music Downloader Bot

YouTube'dan (yoki qo'shiq nomi bo'yicha qidirib) musiqani **yuqori sifatli MP3**
qilib yuklab beruvchi Telegram bot. `yt-dlp` + `ffmpeg` ishlatadi.

## Imkoniyatlari

- 🔗 **YouTube linki** yuborilsa — videoni MP3 ga aylantirib beradi
- 🔎 **Qo'shiq nomi** yozilsa — YouTube'dan o'zi qidirib topadi (`ytsearch`)
- 🎚 **Sifat tanlash**: 128 / 192 / 320 kbps (default = 320, eng yuqori)
- 🏷 Metadata (nom, ijrochi) va muqova rasm MP3 ichiga joylanadi
- 🔑 **PO Token provider** ichiga o'rnatilgan — datacenter IP'lardagi YouTube
  "bot" blokini avtomatik ochadi (qo'shimcha sozlash shart emas)
- 🔁 Bir nechta `player_client` bo'yicha avtomatik fallback (web/tv/mweb/android)
- 🍪 Ixtiyoriy cookies bilan ishonchlilikni yanada oshirish
- ☁️ Render.com bepul tarifda **24/7** ishlaydi (self-ping bilan uxlab qolmaydi)

## Fayllar

| Fayl | Vazifasi |
|------|----------|
| `bot.py` | Botning asosiy kodi (aiogram 3.x) |
| `diag_utils.py` | Toza (stdlib) yordamchi funksiyalar — test qilinadi |
| `tests/` | `pytest` testlari (`pytest -v`) |
| `requirements.txt` | Python kutubxonalari (yt-dlp + PO Token plagini) |
| `Dockerfile` | ffmpeg + Node.js + PO Token server bilan Docker image |
| `start.sh` | PO Token serverni va botni ishga tushiruvchi skript |
| `render.yaml` | Render bepul deploy sozlamasi |
| `.env.example` | Sozlamalar namunasi |
| `DEPLOY_RENDER.md` | Bepul 24/7 deploy qo'llanmasi |

## 🩺 Diagnostika (`/diag`)

Agar yuklash ishlamasa, Telegram'da botga **`/diag`** yuboring. Bot har bir
bosqichni sinab, hisobot beradi:

- Python / yt-dlp versiyasi
- `ffmpeg` va `node` mavjudligi
- PO Token plagini (pip) o'rnatilganmi
- PO Token serveri ishlayaptimi (`127.0.0.1:4416`)
- cookies bormi
- **har bir `player_client` (web/mweb/tv/android/ios) bo'yicha sinov** — qaysi
  biri ishlaydi, qaysi biri qanday xato beradi

Natijada ❌ belgili xatolarni Kiro'ga forward qiling — aniq sababini topamiz.

> Faqat admin ishlatishi uchun `ADMIN_ID` env'iga o'z Telegram ID'ingizni yozing.

## 🧪 Testlar

```bash
cd music_bot
pytest -v        # diag_utils funksiyalari uchun birlik testlar
```

## Tez ishga tushirish (lokal, test uchun)

```bash
cd music_bot
cp .env.example .env        # va BOT_TOKEN ni to'ldiring
# ffmpeg o'rnatilgan bo'lishi kerak (apt install ffmpeg / brew install ffmpeg)
pip install -r requirements.txt
python bot.py
```

Telegram'da botingizga YouTube linkini yoki qo'shiq nomini yuboring.

## Bulutga (Render) joylash

Doimiy bepul 24/7 ishlatish uchun **`DEPLOY_RENDER.md`** qo'llanmasiga qarang.

## 🚧 YouTube "Sign in to confirm you're not a bot" blokini hal qilish

YouTube bulut (datacenter) IP'larni — masalan Render'ni — ko'pincha "bot" deb
biladi. Bot PO Token va ko'p-client fallback ishlatadi, lekin **ba'zi videolar**
baribir login (cookies) talab qiladi. Eng zo'rdan eng pastgacha yechimlar:

### 1) 🥇 Botni UY IP'sida ishlating (eng zo'r, bepul, ishonchli)
Residential (uy) IP bloklanmaydi. Botni doim yoniq qurilmada ishga tushiring:
- **Android telefon (Termux):** `pkg install python ffmpeg && pip install -r requirements.txt && python bot.py`
- Raspberry Pi yoki doim yoniq kompyuter
- Bu holda cookies ham, proxy ham **kerak emas**. PORT env bo'lmagani uchun
  health-server/self-ping avtomatik o'chadi.

### 2) 🥈 Cookies (Render'da qolsangiz)
Asosiy emas, **zaxira (burner) Google akkaunt** oching va incognito'dan cookies
eksport qiling → `YT_COOKIES_CONTENT` env. Batafsil: `DEPLOY_RENDER.md`.

### 3) 🥉 Residential proxy (pullik, eng kuchli bulut yechimi)
`PROXY_URL` env'iga residential proxy bering:
`http://user:pass@host:port` yoki `socks5://host:port`.
⚠️ Bepul/datacenter proxy YouTube'da deyarli ishlamaydi.

> Holatni tekshirish: botga `/diag <youtube-link>` yuboring — cookies/proxy
> bor-yo'qligini va qaysi client ishlashini ko'rsatadi.

## ⚠️ Yuridik eslatma

Mualliflik huquqi bilan himoyalangan kontentni ruxsatsiz yuklab olish ko'p
mamlakatlarda qonunга zid. Botni faqat **shaxsiy/ta'limiy** maqsadda yoki
o'zingiz huquqiga ega bo'lgan kontent uchun ishlating.
