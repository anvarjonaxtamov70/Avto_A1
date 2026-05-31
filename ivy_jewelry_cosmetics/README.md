# Ivy — Jewelry & Cosmetics Boutique (Telegram Mini App)

Ayollar kosmetikasi, parvarish vositalari va nafis taqinchoqlar uchun **Telegram Mini App** (Web App) butigi. Butun ilova bitta `index.html` faylida — Telegram bot ichida ochiladi, GitHub Pages orqali xizmat qiladi.

> 💎 Ushbu loyiha "Avto A1" shablonining barcha texnik yechimlarini (Firebase Realtime Database tuzilmasi, Cloudflare Worker proxy, skeleton animatsiyalari, silliq o'tishlar, savat → buyurtma oqimi, qidiruv) saqlab qolgan holda, butunlay yangi **nafis va minimalist** brending bilan qayta ishlangan.

## ✨ Vibe va dizayn

- **Uslub:** premium, toza, nafis (elegant) — hashamatli go'zallik saloni hissi.
- **Palitra:** oq + o'ta och pastel pushti fon; harakatga undovchi tugmalar uchun **rose gold / dusty pink** aksentlar.
- **Tipografika:** `Playfair Display` (sarlavhalar — nafis serif) + `Montserrat` (asosiy matn).
- **Animatsiyalar:** mayin "shimmer" skeleton yuklanish, yumshoq fade + sirpanish o'tishlari (`prefers-reduced-motion` hurmat qilinadi).

## 🛍 Kategoriyalar

1. 💄 **Kosmetika (Makiyaj)** — lab bo'yog'i, tonal asos, tush, palitralar...
2. 🧴 **Yuz va tana parvarishi** — zardob (serum), krem, niqob, tozalovchilar...
3. 💍 **Nafis taqinchoqlar** — marjon, sirg'a, uzuk, bilakuzuk...
4. 🎀 **Soch aksessuarlari** — qisqich, gajak (rezinka), obruch, taroq...

## 🎯 Marketing va konversiya triggerlari

- **Birinchi xarid 10% chegirma** — birinchi kirgan mijozga jozibali qalqib chiquvchi (pop-up) oyna + promo-kod `IVY10`.
- **FOMO** — mahsulot kartochkalarida "🔥 Trendda", "⏳ Faqat N ta qoldi", "👀 Bugun N kishi oldi" belgilari.
- **Cross-sell** — savatga qo'shilganda "Ko'pincha shu bilan olishadi" tavsiya varag'i (xarid chekini oshiradi).
- **Bepul yetkazib berish progressi** — savatda ma'lum summagacha qancha qolganini ko'rsatuvchi mayin progress bar.

## 🧱 Texnologiyalar

- **Frontend:** bitta `index.html` (inline HTML + CSS + JS, tashqi build kerak emas).
- **Ma'lumotlar bazasi:** Firebase Realtime Database (v8 SDK) — Firebase sozlanmagan bo'lsa, ichki demo katalogga (sample data) avtomatik o'tadi, shuning uchun brauzerda ham to'liq ishlaydi.
- **Bot xabarlari:** Cloudflare Worker proxy (`cloudflare-worker.js`) — token faqat Worker ichida `BOT_TOKEN` **Secret** sifatida.
- **Hosting:** GitHub Pages (auto-deploy).
- **CI:** GitHub Actions (`pr-check.yml` → `validate.js`).

## 📂 Tuzilma

```
ivy_jewelry_cosmetics/
├─ index.html              # Butun ilova (HTML + CSS + JS inline)
├─ cloudflare-worker.js    # Telegram sendMessage + /auth proxy (token shu yerda maxfiy)
├─ database.rules.json     # Firebase Realtime Database qoidalari
├─ .nojekyll               # GitHub Pages uchun Jekyll'ni o'chiradi
└─ .github/
   ├─ validate.js          # PR tekshiruv (JS sintaksis + token skaneri)
   └─ workflows/
      ├─ deploy.yml         # main'ga push'da Pages'ga auto-deploy
      └─ pr-check.yml       # har PR'da validate.js ishga tushadi
```

## ⚙️ Sozlash

1. **Firebase:** `index.html` ichidagi `firebaseConfig` ni o'z loyihangiz ma'lumotlari bilan to'ldiring va `database.rules.json` ni Firebase Console'ga qo'ying.
2. **Cloudflare Worker:** `cloudflare-worker.js` ni Worker'ga joylang; `BOT_TOKEN` (va auth uchun `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) Secret'larini qo'shing. So'ng `index.html` dagi `TG_PROXY` ni Worker URL'ingizga moslang.
3. **Admin ID:** `index.html` dagi `ADMIN_IDS` ga buyurtma xabarlarini oladigan Telegram ID('lar)ni yozing.
4. **BotFather:** Mini App URL'ini GitHub Pages manziliga qo'ying.

> ⚠️ Telegram bot tokeni **hech qachon** kodda saqlanmaydi — faqat Cloudflare Secret'da.

## 🖥 Mahalliy ko'rish

Bu statik sayt — oddiy HTTP server yetarli:

```bash
python3 -m http.server 8000
# brauzerda: http://localhost:8000
```

> Firebase sozlanmagan bo'lsa, ilova ichki demo katalog bilan ishlaydi (savat/buyurtma `localStorage`'da). Telegram'ga bog'liq funksiyalar to'liq faqat haqiqiy Telegram bot muhitida ishlaydi.
