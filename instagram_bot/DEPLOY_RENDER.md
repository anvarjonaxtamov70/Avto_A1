# 📸 Instagram Bot — Render.com'da bepul 24/7 deploy

Bu qo'llanma botni [Render.com](https://render.com) bepul tarifida doimiy
(24/7) ishlatib turishni qadam-baqadam ko'rsatadi.

---

## 1. Tayyorgarlik

Sizga kerak bo'ladi:
- **Telegram bot tokeni** — [@BotFather](https://t.me/BotFather) dan oling
- **GitHub akkaunt** (bu repo allaqachon bor)
- **Render.com akkaunt** (bepul, GitHub bilan kirish mumkin)

---

## 2. Render'da Web Service yaratish

1. [Render Dashboard](https://dashboard.render.com) ga kiring
2. **New +** → **Web Service** ni bosing
3. Bu GitHub repozitoriyani ulang (`Avto_A1`)
4. Sozlamalar:
   - **Root Directory:** `instagram_bot`
   - **Runtime:** `Docker`
   - **Plan:** `Free`
   - **Health Check Path:** `/health`

> Yoki `render.yaml` (Blueprint) orqali avtomatik: **New +** → **Blueprint** →
> repozitoriyani tanlang.

---

## 3. Environment Variables (muhit o'zgaruvchilari)

Render dashboard → **Environment** bo'limida qo'shing:

| Kalit | Qiymat | Majburiymi |
|-------|--------|------------|
| `BOT_TOKEN` | BotFather'dan olingan token | ✅ MAJBURIY |
| `ADMIN_ID` | Telegram ID'ingiz | ➖ ixtiyoriy |
| `IG_COOKIES_CONTENT` | Instagram cookies matni | ➖ tavsiya |
| `PROXY_URL` | residential proxy | ➖ tavsiya |

---

## 4. Instagram cookies (tavsiya etiladi)

Instagram ko'p videolar uchun login talab qiladi va bulut IP'larni bloklaydi.
Cookies qo'shish ishonchlilikni oshiradi:

1. Brauzerga **"Get cookies.txt LOCALLY"** kengaytmasini o'rnating
2. Instagram'ga kirib turgan holda, kengaytma orqali cookies'ni eksport qiling
3. Fayl mazmunini to'liq nusxalang
4. Render env'iga `IG_COOKIES_CONTENT` sifatida joylashtiring

> ⚠️ Cookies'ni hech kimga bermang — bu sizning Instagram sessiyangiz.

---

## 5. Proxy (agar IP bloklansa)

Instagram Render datacenter IP'larni tez-tez bloklaydi. Agar `429` yoki
`rate limit` xatosi ko'p chiqsa, **residential proxy** qo'shing:

```
PROXY_URL=http://user:pass@host:port
```

> Datacenter (arzon/bepul) proxy Instagram'da deyarli ishlamaydi — residential kerak.

---

## 6. Deploy va tekshirish

1. **Create Web Service** ni bosing
2. Render Docker image quradi (~2-5 daqiqa)
3. Log'da `📸 Instagram bot ishga tushdi!` ko'rinsa — tayyor ✅
4. Telegram'da botga Instagram Reels linkini yuboring — HD video qaytadi

---

## Muammolarni hal qilish

| Muammo | Yechim |
|--------|--------|
| Bot javob bermaydi | Render log'ini tekshiring; `BOT_TOKEN` to'g'rimi? |
| "Login talab qilyapti" | `IG_COOKIES_CONTENT` qo'shing |
| "Rate limit / 429" | 15-30 daqiqa kuting yoki `PROXY_URL` qo'shing |
| Bot uxlab qoladi | Health-check `/health` yoqilganini tekshiring |

---

Batafsil savol bo'lsa — README.md ga qarang.
