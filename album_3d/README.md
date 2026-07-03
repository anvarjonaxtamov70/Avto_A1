# 📖 3D Foto Albom (Telegram Mini App)

Rasmlar **haqiqiy kitobdek 3D varaqlanadigan** foto albom. GitHub Pages'da
sayt (Telegram Mini App) + rasm qo'shadigan Telegram bot.

**Firebase KERAK EMAS** — hamma narsa bitta Cloudflare Worker (+ KV) da.

## Qismlar

| Fayl | Vazifa |
|------|--------|
| `index.html` | 3D flipbook Mini App (page-flip). Worker `/list` dan rasmlarni o'qiydi |
| `cloudflare-worker.js` | Rasm ro'yxati (KV) + rasm proxy. `/list`, `/media`, `/add`, `/clear` |
| `bot/bot.py` | Admin rasm tashlaydi → Worker `/add` ga yuboradi |

## Qanday ishlaydi

1. **Admin** botga rasm tashlaydi → bot rasm `file_id` sini Worker'ga yuboradi
   (`POST /add`) → Worker uni **KV**'da saqlaydi.
2. **Mini App** Worker'dan `/list` o'qiydi va har rasmni kitob sahifasi qilib
   chizadi — sahifalar 3D varaqlanadi.
3. Rasmlar `/media?id=<file_id>` orqali ko'rsatiladi → **BOT_TOKEN yashirin** qoladi.

> Worker sozlanmagan/bo'sh bo'lsa, `index.html` DEMO rasmlar bilan ishlaydi.

## Sozlash (qadam-baqadam)

### 1. Cloudflare Worker
1. `cloudflare-worker.js` kodini Worker'ga joylang (Deploy).
2. **Settings → Variables and Secrets** ga qo'shing:
   - `BOT_TOKEN` — album botining tokeni (@BotFather) — **Secret**
   - `WORKER_SECRET` — o'zingiz o'ylab topgan maxfiy parol — **Secret**
3. **Settings → Bindings → Add → KV Namespace**:
   - Avval **KV namespaces** bo'limida yangi namespace yarating (masalan `album`)
   - Worker'ga bogʻlang, **Variable name:** `ALBUM_KV`
4. Qayta **Deploy** qiling.

### 2. Sayt (Mini App)
- `index.html` da `WORKER_URL` allaqachon qo'yilgan. Boshqa Worker bo'lsa,
  o'shani yozing (oxirida `/` shart emas).

### 3. Bot (Render.com)
1. `bot/.env.example` → `.env`, to'ldiring: `BOT_TOKEN`, `ADMIN_IDS`,
   `WORKER_URL`, `WORKER_SECRET` (Worker'dagi bilan AYNAN bir xil).
2. Render'ga deploy qiling (`bot/render.yaml`).

### 4. BotFather
- Mini App URL: `https://<user>.github.io/Avto_A1/album_3d/`

## Sinov
Botga rasm tashlang → "📖 Albomni ochish" → sahifalarni varaqlang.
`/clear` — albomni tozalaydi (admin).
