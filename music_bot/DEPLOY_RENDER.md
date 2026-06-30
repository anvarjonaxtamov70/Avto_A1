# 🎵 Music botni Render.com'da BEPUL va 24/7 ishlatish

Bu qo'llanma musiqa botini **Render.com** bepul serveriga joylaydi.
Shundan keyin bot kompyuteringiz o'chsa ham **uzluksiz** ishlaydi —
xuddi Avto_A1 bot kabi.

> ✅ **Nega Render?** Bepul tarif uchun **kredit karta so'ramaydi**, GitHub'ga
> ulanadi (kodni yangilasangiz server o'zi yangilanadi) va hammasi brauzerdan
> bir necha tugma bilan sozlanadi.

> ⚠️ **MUHIM:** bot faqat **bitta joyda** ishlashi mumkin. Render'da ishga
> tushgach, kompyuteringizdagi botni to'xtating (`Ctrl+C`), aks holda Telegram
> `409 Conflict` xatosini beradi.

> ℹ️ Bepul "web service" 15 daqiqa harakatsizlikdan keyin uxlaydi. Bot o'zini
> har 10 daqiqada "ping" qilib uyg'oq tutadi (self-ping) — qo'shimcha sozlash
> shart emas, deploy bo'lishi bilan ishlaydi.

> 🐳 **Diqqat:** Bu bot `ffmpeg` ga muhtoj, shuning uchun **Docker** runtime'da
> ishga tushadi. Render buni `Dockerfile` orqali avtomatik quradi.

---

## 0-QADAM: Nima kerak

- **GitHub akkaunti** (kod allaqachon `github.com/anvarjonaxtamov70/Avto_A1`
  ichidagi `music_bot/` papkasida).
- **BOT_TOKEN** — Telegram'da [@BotFather](https://t.me/BotFather) dan yangi bot
  yarating va tokenni oling.

---

## 1-QADAM: Render'ga kirish

1. https://render.com ga kiring → **Get Started** / **Sign Up**.
2. **GitHub bilan** ro'yxatdan o'ting (repo'ni ko'rishga ruxsat beradi).

---

## 2-QADAM: Web Service yaratish (qo'lda — tavsiya etiladi)

> Repo ildizida Avto_A1 bot uchun boshqa `render.yaml` borligi sababli, bu
> yangi bot uchun **qo'lda** xizmat yaratish eng ishonchli yo'l.

1. Render panelida: **New +** → **Web Service**.
2. `Avto_A1` repozitoriysini tanlang (kerak bo'lsa GitHub'ga ulashга ruxsat bering).
3. Quyidagicha to'ldiring:
   - **Name:** `music-bot` (yoki xohlagan nom)
   - **Root Directory:** `music_bot`
   - **Runtime / Language:** **Docker** (Render `Dockerfile` ni o'zi topadi)
   - **Instance Type:** **Free**
4. **Environment Variables** bo'limiga qo'shing:
   - `BOT_TOKEN` = @BotFather'dan olgan tokeningiz   *(majburiy)*
   - `DEFAULT_QUALITY` = `320`   *(ixtiyoriy)*
5. **Create Web Service** bosing.

> **Muqobil (Blueprint):** Agar xohlasangiz, **New + → Blueprint** → repo'ni
> tanlang. Lekin repo ildizida bir nechta `render.yaml` bo'lgani uchun qo'lda
> usul aniqroq ishlaydi.

---

## 3-QADAM: Deploy va tekshirish

1. Render Docker image'ni **build** qiladi (ffmpeg o'rnatiladi — 2-5 daqiqa).
2. **Logs** bo'limini oching. `🎵 Music bot ishga tushdi!` ko'rinsa — tayyor.
3. Telegram'da botingizga YouTube linkini yoki qo'shiq nomini yuboring.
4. Sifatni tanlang → bot MP3 faylни yuboradi. ✅

> Endi kompyuteringizdagi botni to'xtating (`Ctrl+C`) — bitta nusxa qoidasi.

---

## 4-QADAM: 24/7 ishlashini ta'minlash (self-ping)

Bot Render bergan `RENDER_EXTERNAL_URL` manziliga har 10 daqiqada "ping"
yuboradi va uyg'oq turadi. Logda `Self-ping yoqildi: ...` va `Self-ping: 200`
ko'rinsa — ishlayapti. **Qo'shimcha sozlash shart emas.**

Yanada ishonchliroq bo'lishi uchun (ixtiyoriy) tashqi "uptime" xizmatini ham
qo'shsangiz bo'ladi:
- [UptimeRobot](https://uptimerobot.com) yoki [cron-job.org](https://cron-job.org)
- **URL:** `https://music-bot-xxxx.onrender.com/health`
- **Interval:** har 5-10 daqiqa

---

## ⚠️ YouTube "Sign in to confirm you're not a bot" muammosi

Ba'zan bulut serverlarining IP'larini YouTube "bot" deb hisoblab, yuklashni
bloklaydi. Buni hal qilish uchun **cookies** ishlatish mumkin:

1. Brauzeringizda YouTube'ga kiring (login bo'ling).
2. "Get cookies.txt" kabi brauzer kengaytmasi bilan `cookies.txt` ni eksport qiling.
3. Faylni `music_bot/` papkasiga qo'ying (u `.gitignore` da — GitHub'ga tushmaydi).
   Render'da esa Secret File sifatida `cookies.txt` qo'shing
   (Settings → Secret Files), yo'l: `/app/cookies.txt`.

Bot `COOKIES_FILE` (default `cookies.txt`) mavjud bo'lsa avtomatik ishlatadi.

---

## Kodni yangilaganda (kelajakda)

GitHub'ning tegishli branchiga o'zgarish tushsa, Render **o'zi** qayta deploy
qiladi (`autoDeploy: true`). Qo'lda ham mumkin: **Manual Deploy → Deploy latest commit**.

---

## Tez-tez uchraydigan muammolar

- **`409 Conflict` loglarda** → bot ikki joyda ishlayapti. Kompyuteringizdagi
  nusxani to'xtating. Faqat Render nusxasi qolsin.
- **`BOT_TOKEN topilmadi`** → Render'da `BOT_TOKEN` env'i kiritilmagan.
  Environment bo'limidan qo'shing va qayta deploy qiling.
- **"Sign in to confirm you're not a bot"** → yuqoridagi cookies bo'limiga qarang.
- **Fayl juda katta (~50 MB dan oshsa)** → Telegram bot chegarasi. Pastroq sifat
  (128/192 kbps) tanlang yoki qisqaroq audio yuklang.
- **ffmpeg xatosi** → bu bot **Docker** runtime'da bo'lishi shart (Python runtime
  emas). 2-QADAMda **Docker** tanlanganini tekshiring.
