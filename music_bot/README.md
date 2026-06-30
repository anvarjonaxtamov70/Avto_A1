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
| `requirements.txt` | Python kutubxonalari (yt-dlp + PO Token plagini) |
| `Dockerfile` | ffmpeg + Node.js + PO Token server bilan Docker image |
| `start.sh` | PO Token serverni va botni ishga tushiruvchi skript |
| `render.yaml` | Render bepul deploy sozlamasi |
| `.env.example` | Sozlamalar namunasi |
| `DEPLOY_RENDER.md` | Bepul 24/7 deploy qo'llanmasi |

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

## ⚠️ Yuridik eslatma

Mualliflik huquqi bilan himoyalangan kontentni ruxsatsiz yuklab olish ko'p
mamlakatlarda qonunга zid. Botni faqat **shaxsiy/ta'limiy** maqsadda yoki
o'zingiz huquqiga ega bo'lgan kontent uchun ishlating.
