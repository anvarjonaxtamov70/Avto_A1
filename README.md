# Avto A1 — Telegram Mini App

Avto ehtiyot qismlari uchun **Telegram Mini App** (Web App) katalogi. Butun ilova bitta `index.html` faylida — Telegram bot ichida ochiladi, GitHub Pages orqali xizmat qiladi.

## Imkoniyatlar

- 🛒 Mahsulot katalogi (avto modellari va bo'limlar bo'yicha)
- 👤 Foydalanuvchi profili, manzillar va buyurtmalar tarixi
- 🎁 **Cashback** — har xariddan bonus
- 🏆 **Yutuqlar (Achievements)** — progress va badge'lar
- 📊 **Shaxsiy analitika** — sarf grafiklari va statistika
- 🔗 **Referral** tizimi (ikki tomonlama bonus)
- 🔔 **Bildirishnomalar** (buyurtma, cashback, yutuq, kafolat)
- 🌙 **Dark / Light** rejim (Ivory & Gold light teması)
- 🛡 **Kafolat kuzatuvi** — har mahsulotga 14 kun

## Texnologiyalar

- **Frontend:** bitta `index.html` (inline HTML + CSS + JS, tashqi build kerak emas)
- **Ma'lumotlar bazasi:** Firebase Realtime Database (v8 SDK)
- **Bot xabarlari:** Cloudflare Worker proxy (`cloudflare-worker.js`)
- **Hosting:** GitHub Pages (auto-deploy)
- **CI:** GitHub Actions (PR tekshiruvi)

## Loyiha tuzilishi

```
Avto_A1/
├─ index.html              # Butun ilova (HTML + CSS + JS inline)
├─ cloudflare-worker.js    # Telegram sendMessage proxy (token shu yerda maxfiy)
├─ banners/                # Slider banerlari (SVG)
│  ├─ banner1.svg
│  ├─ banner2.svg
│  └─ banner3.svg
├─ .nojekyll               # GitHub Pages uchun Jekyll'ni o'chiradi
└─ .github/
   ├─ validate.js          # PR tekshiruv skripti (sintaksis + token skaneri)
   └─ workflows/
      ├─ deploy.yml         # main'ga push'da Pages'ga auto-deploy
      └─ pr-check.yml       # har PR'da validate.js ishga tushadi
```

## Xavfsizlik — Telegram token

Telegram bot tokeni **kodda saqlanmaydi**. Barcha `sendMessage` chaqiruvlari Cloudflare Worker proxy (`cloudflare-worker.js`) orqali o'tadi; token faqat Cloudflare ichida `BOT_TOKEN` **Secret** sifatida turadi.

Worker'ni sozlash:

1. Cloudflare'da yangi Worker yarating va `cloudflare-worker.js` kodini joylang.
2. Worker sozlamalarida `BOT_TOKEN` nomli **Secret** qo'shing (bot tokeningiz).
3. `index.html` ichidagi `TG_PROXY` manzilini Worker URL'ingizga moslang.

> ⚠️ Token GitHub git tarixida hamon ko'rinishi mumkin — eskisini BotFather'da `/revoke` qilib, yangisini Cloudflare Secret'ga qo'ying.

## Deploy (GitHub Pages)

`main` branch'ga har push bo'lganda `.github/workflows/deploy.yml` avtomatik Pages'ga deploy qiladi.

Birinchi marta yoqish:

1. **Settings → Pages → Source** → **GitHub Actions** ni tanlang.
2. 2–3 daqiqa kuting — sayt tayyor bo'ladi: `https://anvarjonaxtamov70.github.io/Avto_A1/`
3. BotFather'da bot Menu Button / Mini App URL'ini shu manzilga qo'ying.

## CI — PR tekshiruvi

Har bir PR (`main`'ga) ochilganda `.github/workflows/pr-check.yml` ishga tushib `node .github/validate.js` ni bajaradi. U:

1. `index.html` ichidagi barcha inline `<script>` bloklarining **JS sintaksisini** tekshiradi.
2. Hech qaysi faylda **ochiq Telegram bot tokeni** qolib ketmaganini skanerlaydi.

Xato bo'lsa PR'da qizil ✗, toza bo'lsa yashil ✓ ko'rinadi.

## Mahalliy ko'rish

Bu statik sayt — oddiy HTTP server yetarli:

```bash
# Loyiha papkasida
python3 -m http.server 8000
# keyin brauzerda: http://localhost:8000
```

> Eslatma: Telegram WebApp va Firebase'ga bog'liq funksiyalar to'liq faqat haqiqiy Telegram bot muhitida ishlaydi.
