# 💎 Ivy botni Render.com'da BEPUL va 24/7 ishlatish

Bu qo'llanma Ivy — Jewelry & Cosmetics botini **Render.com** bepul serveriga
joylaydi. Shundan keyin bot kompyuteringiz o'chsa ham **uzluksiz (24/7)** ishlaydi.

> ✅ Render bepul tarif uchun **kredit karta so'ramaydi**. Hammasi brauzerdan,
> bir necha tugma bilan bo'ladi. GitHub'ga ulanadi — kodni yangilasangiz, server
> o'zi qayta deploy bo'ladi.

> ⚠️ **ENG MUHIM QOIDA:** bot faqat **bitta joyda** ishlashi mumkin. Render'da
> ishga tushgach, **kompyuteringizdagi botni to'xtating** (terminalda `Ctrl+C`),
> aks holda Telegram `409 Conflict` xatosini beradi va bot ishlamay qoladi.

---

## 0-QADAM: Nima kerak
- **GitHub akkaunti** (kod `github.com/anvarjonaxtamov70/Avto_A1` da).
- **`BOT_TOKEN`** — @BotFather'dan olingan token (MAJBURIY).
- Ixtiyoriy: **`GROQ_API_KEY`** (AI suhbat uchun), **`serviceAccount.json`**
  (profil/storis Firebase'ga yozish uchun).

---

## 1-QADAM: serviceAccount.json ni "matnga" aylantirish  *(ixtiyoriy)*
Firebase yozuvlari (profil/storis) kerak bo'lsa. Kerak bo'lmasa — bu qadamni
o'tkazib yuboring, suhbat baribir ishlaydi.

Render'ga faylni ko'chirib bo'lmaydi — uning **matnini** `SERVICE_ACCOUNT_JSON`
sozlamasiga qo'yamiz. Bot ishga tushganda fayilni o'zi tiklaydi.

`serviceAccount.json` shu papkada bo'lsin, terminalda:
```bash
# Linux / Mac:
base64 -w0 serviceAccount.json          # natijani to'liq nusxalang
# Mac'da -w0 ishlamasa:
base64 serviceAccount.json | tr -d '\n'
```
Windows (PowerShell):
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccount.json"))
```
> Chiqqan uzun matnni saqlab qo'ying — 3-QADAMda `SERVICE_ACCOUNT_JSON` ga qo'yasiz.

---

## 2-QADAM: Render'ga kirish
1. https://render.com → **Get Started** / **Sign Up**.
2. **GitHub bilan** ro'yxatdan o'ting (repo'ni ko'rishga ruxsat beradi).

---

## 3-QADAM: Web Service yaratish (qo'lda — eng ishonchli)
Repo ildizida bir nechta bot bor, shuning uchun **qo'lda** usul tavsiya etiladi:

1. Render panelida: **New +** → **Web Service**.
2. `Avto_A1` repozitoriysini tanlang (kerak bo'lsa GitHub'ga ulashga ruxsat bering).
3. Sozlamalarni shunday to'ldiring:
   - **Root Directory:** `ivy_jewelry_cosmetics/bot`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python bot.py`
   - **Instance Type:** **Free**
4. **Environment** bo'limida quyidagi o'zgaruvchilarni qo'shing:

   | Key | Value |
   |---|---|
   | `BOT_TOKEN` | @BotFather tokeningiz *(majburiy)* |
   | `GROQ_API_KEY` | https://console.groq.com dan *(ixtiyoriy)* |
   | `SERVICE_ACCOUNT_JSON` | 1-QADAMdagi uzun matn *(ixtiyoriy)* |
   | `ADMIN_IDS` | `1209673004,5105291033` |
   | `MINI_APP_URL` | `https://anvarjonaxtamov70.github.io/Avto_A1/ivy_jewelry_cosmetics/` |
   | `FIREBASE_DB_URL` | `https://ivyj-6d8e4-default-rtdb.asia-southeast1.firebasedatabase.app` |
   | `KEEP_ALIVE_INTERVAL` | `600` |

5. **Create Web Service** bosing.

> **Muqobil (Blueprint):** repo ildizida boshqa `render.yaml` bo'lmasa,
> **New + → Blueprint** → repo'ni tanlang — Render `ivy_jewelry_cosmetics/bot/render.yaml`
> ni topib, sozlamalarni o'zi to'ldiradi (faqat maxfiy qiymatlarni kiritasiz).

---

## 4-QADAM: Deploy va tekshirish
1. Render avtomatik **build** qiladi va botni ishga tushiradi (1-3 daqiqa).
2. **Logs** bo'limini oching. Quyidagilarni ko'rsangiz — tayyor:
   - `✅ Ivy bot ishga tushdi!`
   - `Health server ...-portda ishga tushdi`
   - `Self-ping yoqildi: ...` va biroz o'tib `Self-ping: 200`
3. Telegram'da botga `/start` yozib tekshiring.

> Endi **kompyuteringizdagi botni to'xtating** (`Ctrl+C`) — bitta nusxa qoidasi.

---

## 5-QADAM: Uxlab qolishdan saqlash — allaqachon hal qilingan ✅
Bepul web service 15 daqiqa harakatsizlikdan keyin uxlaydi. Bot endi **o'zini
o'zi** har ~10 daqiqada uyg'otadi (`/health` ga self-ping). Render
`RENDER_EXTERNAL_URL` ni **avtomatik beradi**, shuning uchun qo'shimcha sozlash
**shart emas**. Logda `Self-ping: 200` ko'rinsa — ishlayapti.

> Yanada ishonchli bo'lishi uchun zaxira sifatida tekin **UptimeRobot**
> (https://uptimerobot.com) da monitor qo'shsangiz bo'ladi:
> **URL:** `https://<sizning-manzil>.onrender.com/health`, **interval:** 5–10 daqiqa.

---

## Kodni yangilaganda (kelajakda)
`main` branchga o'zgarish tushsa, Render **o'zi** qayta deploy qiladi
(`autoDeploy`). Qo'lda: **Manual Deploy → Deploy latest commit**.

---

## Tez-tez uchraydigan muammolar
- **`409 Conflict`** → bot ikki joyda ishlayapti. Kompyuteringizdagi nusxani
  to'xtating. Faqat Render nusxasi qolsin.
- **`BOT_TOKEN ... kerak!`** → Render'da `BOT_TOKEN` env kiritilmagan. Environment
  bo'limidan qo'shib, qayta deploy qiling.
- **Storis/profil yozilmayapti** → `SERVICE_ACCOUNT_JSON` bo'sh yoki noto'g'ri.
  1-QADAMni qayta bajaring. (AI suhbat busiz ham ishlaydi.)
- **AI javob bermayapti** → `GROQ_API_KEY` yo'q yoki `GROQ_MODEL` eskirgan.
  https://console.groq.com dan aktual model nomini qo'ying.
- **Bot sekin javob beradi ("uxlab qolgan")** → logda `Self-ping: 200` bor-yo'qligini
  tekshiring; bo'lmasa `RENDER_EXTERNAL_URL` yoki `KEEP_ALIVE_URL` ni tekshiring.
