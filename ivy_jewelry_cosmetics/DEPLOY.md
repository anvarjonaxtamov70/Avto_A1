# Ivy — 24/7 deploy qo'llanmasi

## Nega Cloudflare Workers? (tanlangan optimal usul)
Bu loyiha uchun eng to'g'ri yechim — **Cloudflare Workers** (serverless):
- ♾️ **24/7 ishlaydi** — alohida server/VPS, kompyuter kerak emas.
- 💸 **Bepul** (kunlik 100k so'rov) — kichik-o'rta do'kon uchun yetarli.
- ⚡ **Cold-start yo'q**, global tez; xizmat ko'rsatish/yangilash deyarli nol.
- 🔗 Allaqachon `/auth` (Firebase token) va sendMessage proxy shu Worker'da — bitta joyda.
- 🤖 Bot **Webhook** rejimida (polling emas) — Telegram update'larni to'g'ridan-to'g'ri Worker'ga yuboradi.

> Python bot (polling) endi **kerak emas** — Worker hammasini bajaradi. Ikkalasini bir vaqtda ishlatib bo'lmaydi (Telegram bitta usulга ruxsat beradi).

---

## A usuli — Dashboard orqali (eng oson, 3 daqiqa)
1. **Cloudflare → Workers & Pages → `ivy`** worker → **Edit code**.
2. `cloudflare-worker.js` mazmunini to'liq nusxalab joylang → **Deploy**.
3. **Settings → Variables and Secrets** da quyidagilar borligini tekshiring (Secret sifatida):
   - `BOT_TOKEN` — @Ivy_jewelry_cosmetics_bot tokeni (MAJBURIY)
   - `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — admin/auth uchun (MAJBURIY)
   - `GROQ_API_KEY` — AI suhbat uchun (ixtiyoriy), `GROQ_MODEL` (ixtiyoriy)
   - `WEBHOOK_SECRET` — webhook himoyasi uchun (ixtiyoriy)
4. **Webhook'ni ulang** — brauzerda bir marta oching (token URL'da emas!):
   ```
   https://ivy.anvaraxtamov70.workers.dev/set-webhook
   ```
   `{"ok":true,...}` chiqsa — tayyor. ✅

## B usuli — Wrangler CLI / Git auto-deploy (professional)
```bash
npm install -g wrangler
wrangler login
cd ivy_jewelry_cosmetics
# Secret'larni o'rnatish:
wrangler secret put BOT_TOKEN
wrangler secret put FIREBASE_CLIENT_EMAIL
wrangler secret put FIREBASE_PRIVATE_KEY
wrangler secret put GROQ_API_KEY        # ixtiyoriy
# Deploy:
wrangler deploy
# Webhook:
#   brauzerda https://ivy.anvaraxtamov70.workers.dev/set-webhook ni oching
```
Yoki **Cloudflare → Workers → Connect to Git** orqali shu repo'ni ulang — har `git push` da avtomatik deploy bo'ladi (`wrangler.toml` shu papkada).

---

## Tekshirish
- Brauzer: `https://ivy.anvaraxtamov70.workers.dev/` → `Ivy Worker ishlayapti ✅`
- Telegram: botga **/start** → chiroyli salom + "💎 Butikni ochish" tugmasi (kompyuter o'chiq bo'lsa ham).
- Webhook holati: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

## Webhook endpointlari
| Yo'l | Vazifa |
|---|---|
| `GET /set-webhook` | Webhook'ni o'zini ulaydi (token env'dan) |
| `POST /webhook` | Telegram update'lari (`/start`, suhbat) |
| `POST /auth` | Firebase custom token |
| `POST /` | sendMessage proxy (Mini App) |
