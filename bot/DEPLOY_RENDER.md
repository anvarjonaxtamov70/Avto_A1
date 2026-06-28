# Avto_A1 botini Render.com'da BEPUL va 24/7 ishlatish

Bu qo'llanma botni kompyuteringizdan **Render.com** bepul serveriga ko'chiradi.
Shundan keyin bot kompyuteringiz o'chsa ham **uzluksiz** ishlaydi.

> ✅ **Nega Render?** Oracle Cloud'dan farqli, Render bepul tarif uchun **kredit karta
> so'ramaydi** va serverga SSH qilish, fayl ko'chirish shart emas — hammasi brauzerdan,
> bir necha tugma bilan. GitHub'ga ulanadi: kodni yangilasangiz, server o'zi yangilanadi.

> ⚠️ **ENG MUHIM QOIDA:** bot faqat **bitta joyda** ishlashi mumkin. Render'da ishga
> tushgach, **kompyuteringizdagi (VS Code) botni to'xtating** (terminalda `Ctrl+C`),
> aks holda Telegram `409 Conflict` xatosini beradi.

> ℹ️ **Bepul tarif haqida muhim nuqta:** Render bepul "web service" **15 daqiqa
> harakatsizlikdan keyin uxlab qoladi**. Buni oldini olish uchun 6-QADAMda tekin "ping"
> xizmatini sozlaymiz — u botni har 10 daqiqada uyg'otib turadi, shunda u **24/7**
> ishlaydi. Bu qadamni albatta bajaring!

---

## 0-QADAM: Nima kerak

- **GitHub akkaunti** (kod allaqachon `github.com/anvarjonaxtamov70/Avto_A1` da).
- `.env` faylidagi qiymatlar: kamida `BOT_TOKEN` va `GROQ_API_KEY`.
- `serviceAccount.json` fayli (Firebase Console'dan) — storis va profil yozish uchun.

---

## 1-QADAM: serviceAccount.json ni "matnga" aylantirish

Render'ga faylni `scp` bilan yuborib bo'lmaydi. Buning o'rniga uning **matnini**
`SERVICE_ACCOUNT_JSON` degan sozlamaga qo'yamiz. Bot ishga tushganda fayilni shu
matndan o'zi tiklaydi.

**Eng oson yo'l (base64 bilan — bir qatorga aylantiradi):**

Kompyuteringiz terminalida (`serviceAccount.json` shu papkada bo'lsin):

```bash
# Linux / Mac:
base64 -w0 serviceAccount.json   # natijani to'liq nusxalang

# Mac'da -w0 ishlamasa:
base64 serviceAccount.json | tr -d '\n'
```

Windows (PowerShell):
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccount.json"))
```

> Chiqqan uzun matnni saqlab qo'ying — 3-QADAMda `SERVICE_ACCOUNT_JSON` ga qo'yasiz.
> (Xohlasangiz base64 qilmasdan, JSON faylning butun matnini `{...}` ko'rinishida
> ham qo'ysa bo'ladi — bot ikkalasini ham tushunadi.)

---

## 2-QADAM: Render'ga kirish

1. https://render.com ga kiring → **Get Started** / **Sign Up**.
2. **GitHub bilan** ro'yxatdan o'ting (eng oson — repo'ni ko'rishga ruxsat beradi).

---

## 3-QADAM: Blueprint orqali xizmat yaratish (eng oson)

Repoda tayyor **`render.yaml`** fayli bor — Render barcha sozlamalarni undan o'qiydi.

1. Render panelida: **New +** → **Blueprint**.
2. `Avto_A1` repozitoriysini tanlang (kerak bo'lsa GitHub'ga ulashga ruxsat bering).
3. Render `render.yaml` ni topadi va **avto-a1-bot** xizmatini ko'rsatadi.
4. **Maxfiy qiymatlarni** so'raydi (ular GitHub'ga tushmaydi) — to'ldiring:
   - `BOT_TOKEN` — @BotFather'dan olgan tokeningiz
   - `GROQ_API_KEY` — https://console.groq.com dan
   - `SERVICE_ACCOUNT_JSON` — 1-QADAMda olgan uzun matn (base64 yoki JSON)
5. **Apply** / **Create** bosing.

> **Muqobil (qo'lda):** Blueprint ishlatmasangiz, **New + → Web Service** → repo'ni
> tanlang → **Root Directory:** `bot`, **Build:** `pip install -r requirements.txt`,
> **Start:** `python bot.py`, **Instance Type:** **Free**. So'ng yuqoridagi env
> qiymatlarni **Environment** bo'limida qo'lda qo'shing.

---

## 4-QADAM: Deploy va tekshirish

1. Render avtomatik **build** qiladi va botni ishga tushiradi (1-3 daqiqa).
2. **Logs** bo'limini oching. `Bot ishga tushdi!` yozuvini ko'rsangiz — tayyor.
3. Telegram'da botingizga `/start` yozib tekshiring.

> Endi **kompyuteringizdagi botni to'xtating** (`Ctrl+C`) — bitta nusxa qoidasi.

---

## 5-QADAM: serviceAccount.json ishlayotganini tasdiqlash

Loglarda `serviceAccount.json env'dan tiklandi.` ko'rinsa — Firebase yozuvlari
(storis, profil) ishlaydi. Agar `serviceAccount.json topilmadi` chiqsa,
`SERVICE_ACCOUNT_JSON` qiymatini qayta tekshiring.

---

## 6-QADAM (MUHIM): Botni uxlab qolishdan saqlash

Bepul web service 15 daqiqa harakatsizlikdan keyin uxlaydi. Buni **2 usul** bilan
hal qilamiz:

### A) Avtomatik (self-ping) — qo'shimcha sozlash SHART EMAS ✅
Bot endi o'zining manziliga har ~10 daqiqada "ping" yuboradi va shu bilan o'zini
uyg'oq tutadi. Render xizmatga `RENDER_EXTERNAL_URL` ni **avtomatik beradi**, shuning
uchun siz hech narsa qilishingiz kerak emas — deploy bo'lishi bilan ishlaydi.
Logda `Self-ping yoqildi: ...` va `Self-ping: 200` ko'rinsa — ishlayapti.

> Interval kerak bo'lsa: `KEEP_ALIVE_INTERVAL` env'iga soniyada qiymat bering
> (default `600` = 10 daqiqa). Boshqa platformada manzil o'zi berilmasa,
> `KEEP_ALIVE_URL` env'iga to'liq manzilni (mas. `https://...onrender.com`) qo'ying.

### B) Tashqi ping (ixtiyoriy zaxira) 🔁
Yanada ishonchli bo'lishi uchun tekin "uptime" xizmatini ham qo'shsangiz bo'ladi
(masalan, server qayta ishga tushib self-ping ulgurmagan holatlar uchun):
1. Render manzilingizni nusxalang (mas. `https://avto-a1-bot.onrender.com`).
2. **UptimeRobot** (https://uptimerobot.com) yoki **cron-job.org** da monitor yarating:
   - **URL:** `https://avto-a1-bot.onrender.com/health`
   - **Interval:** har **5–10 daqiqa**.

---

## Kodni yangilaganda (kelajakda)

GitHub'ning `main` branchiga yangi o'zgarish tushsa, Render **o'zi** qayta deploy
qiladi (`autoDeploy: true`). Hech narsa qilish shart emas. Qo'lda ham mumkin:
Render panelida **Manual Deploy → Deploy latest commit**.

---

## Tez-tez uchraydigan muammolar

- **`409 Conflict` loglarda** → bot ikki joyda ishlayapti. Kompyuteringizdagi
  (VS Code) nusxasini to'xtating. Faqat Render nusxasi qolsin.
- **Bot bir oz "uxlab", sekin javob beradi** → keep-alive ping sozlanmagan
  (6-QADAM) yoki interval katta. Intervalни 5-10 daqiqaga qo'ying.
- **Storis yozilmayapti / loglarda "serviceAccount.json topilmadi"** →
  `SERVICE_ACCOUNT_JSON` qiymati noto'g'ri/bo'sh. 1-QADAMni qayta bajaring.
- **`BOT_TOKEN .env faylda topilmadi`** → Render'da `BOT_TOKEN` env'i kiritilmagan.
  Environment bo'limidan qo'shing va qayta deploy qiling.
- **Oyiga 750 soat limiti** → bitta bepul web service uchun bu butun oyga yetadi
  (24/7). Boshqa bepul xizmatlar ishlatib turgan bo'lsangizgina e'tibor bering.

---

## Eslatma: Oracle Cloud varianti ham bor

Agar to'liq uxlamaydigan, "ping" kerak bo'lmaydigan server xohlasangiz, `DEPLOY.md`
faylidagi **Oracle Cloud** qo'llanmasidan foydalaning (u ham bepul, lekin ro'yxatdan
o'tishda kredit karta so'raydi va sozlash biroz murakkabroq).
