# 📸 Instagram Downloader Bot

Instagram **Reels**, **post** va **video** linklarini **yuqori sifatda (HD)** yuklab beruvchi Telegram bot.

## Xususiyatlar

- 📥 Instagram Reels / Post / Video / TV yuklash
- 🎬 Eng yuqori sifat (HD, `bestvideo+bestaudio`)
- 🧹 Caption'siz (toza) video yuboriladi
- ⏱ 90s timeout + progress indikator — **hech qachon qotib qolmaydi**
- 🔒 Cookies qo'llab-quvvatlash (login talab qiladigan videolar uchun)
- 🌐 Proxy qo'llab-quvvatlash (Instagram IP blokini chetlab o'tish)
- ☁️ Render 24/7 (health-server + self-ping)

## Qanday ishlaydi

1. Foydalanuvchi botga Instagram link tashlaydi
2. Bot avtomatik yuqori sifatda yuklab, Telegramga yuboradi

## Lokal ishga tushirish

```bash
pip install -r requirements.txt
# ffmpeg o'rnatilgan bo'lishi kerak (HD video+audio birlashtirish uchun)
cp .env.example .env   # BOT_TOKEN ni to'ldiring
python bot.py
```

## Deploy

Render.com bepul deploy uchun `DEPLOY_RENDER.md` ga qarang.

## Muhim eslatma

Instagram bulut IP'larni (Render, Railway) tez-tez bloklaydi va ba'zi videolar
login talab qiladi. Ishonchli ishlashi uchun:
- `IG_COOKIES_CONTENT` — Instagram cookies qo'shing
- `PROXY_URL` — residential proxy (eng kuchli yechim)

> ⚠️ Mualliflik huquqi himoyalangan kontentni faqat shaxsiy maqsadda yuklab oling.
