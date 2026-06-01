# Ivy bot — Telegram suhbat qatlami

Bu bot `/start` dan keyin mijozni **nafis** kutib oladi, ro'yxatdan o'tkazadi (ism, telefon, viloyat), mijoz bilan **AI suhbat** quradi va **Mini App (do'kon)** ni ochadi. Mini App'ni to'ldiradi (almashtirmaydi): buyurtma xabarlari allaqachon Mini App + Cloudflare Worker orqali kelgani uchun bot ularni takrorlamaydi.

## Imkoniyatlar
- ✨ Chiroyli `/start` salomi + qaytgan mijozga iliq kutib olish
- 📝 Ro'yxatdan o'tkazish: ism → telefon → viloyat (Firebase `users/<id>/profile` ga yoziladi)
- 💎 "Butikka kirish" — Mini App'ni ism/telefon/viloyat bilan ochadi
- 🤖 AI suhbat (Groq) — nafis go'zallik maslahatchisi (kalit bo'lmasa soddalashtirilgan rejim)
- 📸 Aktual storis: admin rasm/video + `#kategoriya` yuboradi (masalan `#aksiya`)
- 📞 Aloqa
- 🆕 Yangi ro'yxatdan adminlarga bildirishnoma

## ⚠️ Xavfsizlik
Hech qanday token/kalit kodda **saqlanmaydi** — hammasi `.env` orqali. Avval Telegram tokeningiz va Groq kalitingizni (agar ular ochiq joyga tushgan bo'lsa) **yangilang**.

## O'rnatish va ishga tushirish

```bash
cd ivy_jewelry_cosmetics/bot

# 1) virtual muhit (ixtiyoriy, tavsiya etiladi)
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 2) kutubxonalar
pip install -r requirements.txt

# 3) sozlamalar
cp .env.example .env
# .env ichini to'ldiring: BOT_TOKEN (majburiy), ADMIN_IDS, GROQ_API_KEY (ixtiyoriy)

# 4) (ixtiyoriy) Firebase yozuvi uchun service account
#   Firebase Console -> Project Settings -> Service accounts -> Generate new private key
#   yuklab olingan JSON'ni shu papkaga `serviceAccount.json` deb saqlang.

# 5) ishga tushirish
python3 bot.py
```

Bot doimiy ishlashi uchun serverda (VPS) `screen`/`tmux`, `systemd` yoki `pm2` ostida ishga tushiring.

## Eslatmalar
- `serviceAccount.json` bo'lmasa — bot baribir ishlaydi, lekin profilni Firebase'ga yozmaydi (Mini App ism/telefonni URL orqali baribir oladi).
- `GROQ_API_KEY` bo'lmasa — AI suhbat o'rniga iliq javob + do'kon tugmasi chiqadi.
- Mini App URL'i GitHub Pages: agar boshqa manzilga deploy qilsangiz, `.env` dagi `MINI_APP_URL` ni yangilang.
