# Ommaviy ishga tushirish ro'yxati

Bu fayl bitta savolga javob beradi: **do'konni ommaga reklama qilish mumkinmi?**

Holat belgilari: ✅ tayyor · ⏳ sizdan kutilmoqda · ❌ to'siq

---

## 🔴 Ommaviy chiqishdan OLDIN shart

### 1. ⏳ Baza qoidalarini joriy qilish

**Nima uchun:** hozir jonli bazada `users` va `products` tugunlari ochiq. Ya'ni
internetdagi har kim barcha mijozlarning ismi, telefoni, manzili va buyurtma
tarixini yuklab olishi — yoki **hammasini o'chirib tashlashi** mumkin.
`database.rules.json` repoda tayyor, lekin Firebase'ga hali qo'yilmagan
(`Deploy Firebase qoidalari` workflow'i 0 marta yurgan).

**Tartib muhim** — qoidalar `auth` ga tayanadi. Auth ishlamasa, mijozlar
buyurtma bera olmay qoladi.

1. **Botni Telegram'dan oching** → Mini App → **Admin** bo'limi.
2. Panel tepasidagi «Xavfsiz ulanish» qatoriga qaraysiz:
   - 🟢 **yashil** («Xavfsiz ulanish ishlayapti, ID: …») → davom eting
   - 🔴 **qizil** → **TO'XTANG.** Qoidalarni qo'ymang, sababi shu qatorda yozilgan.
     Odatda Cloudflare Worker'da `BOT_TOKEN` sozlanmagan bo'ladi.
3. Yashil bo'lsa: Actions → **Bazaning zaxira nusxasi** → Run workflow
   (avval nusxa, keyin o'zgarish — 2-bandga qarang).
4. Actions → **Deploy Firebase qoidalari** → Run workflow.
5. Darhol tekshiring: katalog ochiladi, savatga qo'shiladi, **bitta sinov
   buyurtma** o'tadi, admin panelda mijozlar ko'rinadi.
6. Biror narsa ishlamasa — Firebase Console → Realtime Database → Rules →
   avvalgi holatga qaytaring (Console o'zi versiya tarixini saqlaydi).

### 2. ⏳ Zaxira nusxa (`BACKUP_PASSPHRASE` qo'shish)

**Nima uchun:** ilgari backup mexanizmi umuman yo'q edi. Bu 1-band bilan birga
eng xavfli holat: bazani har kim o'chirishi mumkin va tiklash uchun hech narsa
yo'q.

Endi `backup.yml` har kecha 01:00 (Toshkent) to'liq nusxa oladi, **AES-256 bilan
shifrlaydi** va 90 kun saqlaydi.

> Shifrlash shart, chunki bu repo **ochiq** — ochiq repoda artifact'ni
> internetdagi har kim yuklab oladi, nusxada esa mijoz telefonlari bor.

**Sizdan:** Settings → Secrets and variables → Actions → New repository secret
→ nomi `BACKUP_PASSPHRASE`, qiymati uzun tasodifiy parol (20+ belgi).
**Parolni alohida, xavfsiz joyda saqlang** — yo'qolsa nusxalar ochilmaydi.

Keyin bir marta qo'lda ishga tushirib, ishlaganini ko'ring.

**Tiklash:**
```bash
gpg --batch --passphrase 'PAROL' -d avtoa1-backup.json.gz.gpg | gunzip > db.json
firebase database:set / db.json --project avtoa1shop   # ⚠️ ustiga yozadi
```

### 3. ⏳ Bot tokenini almashtirish

`index.html.backup` fayli o'chirilgan, lekin blob **git tarixida qolgan** va repo
ochiq — reponi klon qilgan har kim tokenni oladi. Token bir vaqtning o'zida
`initData`ni tekshiradigan **HMAC siri** hamdir, ya'ni oqishi ikki barobar xavfli.

@BotFather → `/mybots` → bot → API Token → **Revoke current token**.
Yangi tokenni qo'yish kerak: Render (`BOT_TOKEN`) va Cloudflare Worker (`BOT_TOKEN`).

### 4. ✅ Bot ish vaqtida uxlamaydi

Ilgari keep-alive 09:00–18:50 ishlardi, do'kon esa 21:00 gacha. Kechqurun —
eng savdoli payt — bot uxlab qolardi va mijoz 30–60 soniya javob kutardi.

Tuzatildi: 08:50 da «isitish» + 09:00–21:50 har 10 daqiqada.
Render bepul kvotasi hisobga olindi (~403 soat/oy, chegara 750).

---

## 🟠 Birinchi hafta

### 5. Cloudflare Worker'da so'rov cheklovi yo'q
`/auth` har chaqiruvda Firebase token yasaydi, `/stock-commit` Google token
oladi — keshsiz. Cloudflare bepul tarifi kuniga 100 000 so'rov. Bir kishi
bemalol tugatib do'konni to'xtatishi mumkin.

### 6. Firebase tarifini aniqlash — ⏳ sizdan
Bepul (Spark) tarifda **bir vaqtda 100 ulanish** chegarasi bor. Ilova doimiy
ulanish ochadi, ya'ni 100 dan ko'p mijoz birga ochsa 101-chisi hech narsa
ko'rmaydi. Ommaviy reklamadan oldin bilish shart.
Firebase Console → Usage and billing → qaysi reja ko'rsatilgan.

### 7. ImgBB kaliti hamon `index.html`da
Almashtirish + Worker orqali proxy qilish kerak.

### 8. Monitoring yo'q
Bot o'lsa, siz buni mijoz shikoyat qilganda bilasiz.

---

## 🟡 O'sish bilan

- Admin panel butun `users` daraxtini **7 joyda** o'qiydi. 500 mijozda
  sezilmaydi, 10 000 da panel sekinlashadi va Firebase kvotasini yeydi.
- Muddatli aksiya tugaganda narx faqat admin ilovani ochganda tiklanadi
  (server tomoniga o'tkazish kerak).
- Maxfiylik siyosati matni yo'q (ism, telefon, manzil yig'iladi).

---

## Xulosa

| | |
|---|---|
| Funksional tayyorlik | ✅ tayyor |
| Operatsion xavfsizlik | ❌ 1, 2, 3-bandlar bajarilmagan |
| **Kichik doira** (20–50 mijoz, tanish-bilish) | ✅ mumkin |
| **Ommaviy reklama** | ❌ 1–3 bandlardan keyin |
