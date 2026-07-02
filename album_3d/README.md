# 📖 3D Foto Albom (Telegram Mini App)

Rasmlar **haqiqiy kitobdek 3D varaqlanadigan** foto albom. GitHub Pages'da
sayt (Telegram Mini App) + rasm qo'shadigan Telegram bot — xuddi **Avto_A1** kabi.

## Qismlar

| Fayl | Vazifa |
|------|--------|
| `index.html` | 3D flipbook Mini App (page-flip kutubxonasi) |
| `bot/bot.py` | Admin rasm tashlaydi → Firebase'ga `file_id` yoziladi |
| `cloudflare-worker.js` | Rasmlarni token'siz uzatuvchi proxy (`/media?id=`) |
| `database.rules.json` | Firebase qoidalari (albom ochiq o'qish, admin yozadi) |

## Qanday ishlaydi

1. **Admin** botga rasm(lar) tashlaydi → bot rasm `file_id` sini Firebase
   `album/pages` ga yozadi.
2. **Mini App** (`index.html`) Firebase'dan ro'yxatni o'qiydi va har rasmni
   kitob sahifasi qilib chizadi — sahifalar 3D varaqlanadi.
3. Rasmlar **Cloudflare Worker** orqali ko'rsatiladi → BOT_TOKEN yashirin qoladi.

> Firebase/Worker sozlanmagan bo'lsa, `index.html` DEMO rasmlar bilan baribir
> ishlaydi — 3D varaqlashni darhol sinab ko'rishingiz mumkin.

## Sozlash (qisqacha)

1. **@BotFather** — yangi bot oching, tokenni oling.
2. **Firebase** — Realtime Database yarating; `database.rules.json` ni deploy qiling.
3. **Cloudflare Worker** — `cloudflare-worker.js` ni joylang, `BOT_TOKEN` ni Secret qiling.
4. `index.html` ichida `FIREBASE_CONFIG` va `WORKER_URL` ni to'ldiring.
5. **Bot** — `bot/.env.example` → `.env`, qiymatlarni to'ldiring, Render'ga deploy qiling
   (`bot/render.yaml`).
6. GitHub Pages: sayt `https://<user>.github.io/Avto_A1/album_3d/` da ochiladi.
   BotFather → Mini App URL sifatida shu manzilni qo'ying.

## Sinov

Botga rasm tashlang → "📖 Albomni ochish" tugmasini bosing → sahifalarni varaqlang.
