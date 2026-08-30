# Firebase Realtime Database — Xavfsizlik auditi va qoidalar (rules)

> **6-qadam:** Firebase Realtime Database qoidalarini tekshirish.
> Bu hujjat auditda nima topilganini, asosiy xavfni va tavsiya etilgan `database.rules.json` ni qanday xavfsiz joriy qilishni tushuntiradi.

---

## 1. Hozirgi holat (audit natijasi)

`index.html` tahlilidan:

| Element | Holat |
|---|---|
| Firebase SDK | v8.10.1 (`firebase-app`, `firebase-database`) |
| `databaseURL` | `https://avtoa1shop-default-rtdb.firebaseio.com/` |
| **Firebase Authentication** | ❌ **Umuman ishlatilmaydi** |
| Foydalanuvchi ID | `parseInt(tg.initDataUnsafe.user.id)` — Telegram ID (imzo **tekshirilmaydi**) |
| Admin aniqlash | Faqat client-side: `ADMIN_IDS = [5105291033, 483425630]` |
| Repodagi rules fayli | ❌ Yo'q edi (qoidalar faqat Firebase Console'da) |

### Ishlatilayotgan ma'lumot yo'llari (paths)

```
users/{uid}/profile        users/{uid}/cart        users/{uid}/wishlist
users/{uid}/orders         users/{uid}/my_car      users/{uid}/addresses
users/{uid}/phase2         products                reviews/{productId}/{uid}
refcodes/{code}            stories                 broadcasts
bts_branches               notify_requests/{productId}/{uid}
ai_requests/{uid}          ai_bulk_requests/{uid}  ai_admin_tasks/{taskId}
```

---

## 2. 🔴 Asosiy xavf

Ilovada **Firebase Authentication yo'q**, va `databaseURL` mijoz kodida ochiq. Bu degani:

- Qoidalar `auth.uid` ga **bog'lana olmaydi** — DB hech qaysi yozuv kim tomonidan qilinayotganini bilmaydi.
- Agar Console'dagi qoidalar ochiq bo'lsa (`".read": true, ".write": true` yoki muddati o'tgan test rejimi), unda **internetdagi har kim**:
  - Barcha foydalanuvchilarning **shaxsiy ma'lumotlarini** (ism, telefon, manzil, buyurtmalar tarixi) o'qiy oladi → **PII sizib chiqishi**.
  - `products`, `users` va boshqa tugunlarni **o'zgartirishi yoki butunlay o'chirishi** mumkin.
  - Cashback/bonus balansini istalgancha **soxtalashtirishi** mumkin.
- **Client-side admin tekshiruvi** (`currentUser === ADMIN_ID`) DB uchun **himoya emas** — uni brauzerda chetlab o'tish juda oson. Yagona haqiqiy chegara — Realtime Database qoidalari.

> ⚠️ Birinchi tavsiya: Firebase Console → Realtime Database → Rules bo'limini **hoziroq** tekshiring. Agar u yerda `".read": true` / `".write": true` tursa — bu ochiq baza.

---

## 3. Tavsiya etilgan yechim (to'g'ri arxitektura)

Auth bo'lmasa, qoidalar bilan har bir foydalanuvchini himoya qilib bo'lmaydi. To'liq yechim — **server tomonida Telegram'ni tasdiqlab, Firebase Auth orqali kirish**:

1. **Cloudflare Worker** (bizda allaqachon bor) yangi `/auth` endpoint oladi:
   - Mijozdan `Telegram.WebApp.initData` ni qabul qiladi.
   - Uni bot tokeni bilan **HMAC-SHA256** orqali tekshiradi (Telegram'ning hujjatlashtirilgan algoritmi). Token Worker'da Secret sifatida turadi.
   - Tekshiruv o'tsa, `uid = String(telegram_user_id)` bilan **Firebase custom token** yaratadi (Firebase Admin / service account).
2. **Mijoz** `firebase-auth.js` ni yuklab, DB'ga murojaatdan oldin `firebase.auth().signInWithCustomToken(token)` qiladi.
3. `users/{uid}` kalitlari `auth.uid` bilan **bir xil** bo'ladi → qoidalar egalik (ownership) bo'yicha ishlaydi.
4. Adminlar DB'da `admins/{uid}: true` ko'rinishida belgilanadi (allowlist).

Shundagina ushbu repodagi `database.rules.json` to'liq kuchga kiradi.

---

## 4. `database.rules.json` — tavsiya etilgan qoidalar

Ushbu repoga **xavfsiz target qoidalar** qo'shildi (`database.rules.json`). Qisqacha mantiq:

| Yo'l | O'qish (read) | Yozish (write) |
|---|---|---|
| `users/{uid}` | faqat egasi yoki admin | faqat egasi yoki admin |
| `products`, `stories`, `bts_branches` | hamma (ommaviy katalog) | faqat admin |
| `broadcasts`, `ai_admin_tasks` | faqat admin | faqat admin |
| `reviews/{productId}/{uid}` | hamma | faqat o'sha foydalanuvchi |
| `refcodes/{code}` | tizimga kirgan | faqat yaratish (mavjudini qayta yozib bo'lmaydi), qiymat = o'z uid |
| `ai_requests/{uid}`, `ai_bulk_requests/{uid}` | egasi (admin hammasini) | egasi yoki admin |
| `notify_requests/{productId}/{uid}` | admin | egasi yoki admin |
| ildiz (boshqa hammasi) | yopiq | yopiq |

Admin allowlist'ni bir marta DB'da yarating:

```json
{
  "admins": {
    "5105291033": true,
    "483425630": true
  }
}
```

---

## 5. ✅ Deploy holati (2026.08 dan boshlab)

`database.rules.json` **endi joriy holatga mos** va uni Console'ga qo'yish **xavfsiz** —
ilova buzilmaydi.

**Nima o'zgardi:** ilgari bu fayl "maqsadli namuna" edi — u `auth` talab qiladigan
qat'iy qoidalarni saqlardi. Ilovada esa auth **best-effort** (majburiy emas), shuning
uchun o'sha faylni qo'yish **hamma o'qish/yozishni rad etib**, do'konni to'xtatib
qo'yardi. Ya'ni repoda mina yotgan edi: kim `Deploy Firebase qoidalari` workflow'ini
ishga tushirsa — ilova o'lardi.

**Endi:** fayl haqiqatda deploy qilingan ruxsatlarni (`.read`/`.write`) **aynan
saqlaydi**, lekin ustiga **`.validate`** qoidalari qo'shilgan. `.validate` auth
TALAB QILMAYDI — u har qanday yozuvda ishlaydi va ma'lumot **shaklini**
tekshiradi. Shuning uchun himoya ilovani buzmasdan qo'shildi.

`.validate` nimalarni to'xtatadi:

| Hujum | Natija |
|---|---|
| Konsoldan `cashbackTotal: 999999999` | ❌ rad etiladi (chegara + monotonlik) |
| `cashbackSpent` ni 0 ga tushirib cashbackni qayta ishlatish | ❌ rad etiladi (monoton) |
| Soxta 1 mlrd so'mlik buyurtma | ❌ rad etiladi |
| `payable` ni `total` dan katta qilish | ❌ rad etiladi |
| O'ylab topilgan holat (`status: "vip_bepul"`) | ❌ rad etiladi (5 ta haqiqiy holat) |
| Izohga 99 yulduz qo'yish | ❌ rad etiladi (1..5) |
| `ref('products').remove()` — katalogni o'chirish | ❌ rad etiladi |

> ⚠️ **ESKIRGAN BO'LIM.** Yuqoridagi matn 2026.08 holatini tasvirlaydi, o'shanda
> `users`/`products`/`orders` hamon ochiq edi va bu fayl ataylab "ochiq holatga"
> tushirilgan edi. **2026.09 dan boshlab qoidalar haqiqatan qattiqlashtirildi** —
> 11-bandga qarang. 4-banddagi jadval endi haqiqatga MOS.

---

## 6. Maxsus eslatmalar

- **Referral (ikki tomonlama bonus):** Egalik qoidalari bir foydalanuvchining **boshqa** foydalanuvchi tuguniga (`users/{referrerUid}/phase2`) yozishini **ataylab bloklaydi**. Shuning uchun taklif qilgan tomonning bonusi **server tomonida** (Worker yoki Cloud Function) berilishi kerak. Bu cheklov PR #10 izohida ham qayd etilgan edi.
- **Client-trust cheklovi:** Egasi o'z `users/{uid}` tuguniga erkin yozadi, demak cashback/balansni client'da soxtalashtirishi mumkin. To'liq himoya uchun pul/bonusga oid yozuvlar server-authoritative bo'lishi kerak (keyingi bosqich).
- **Indekslar:** Kodda faqat `products` uchun `limitToLast(30)` bor (kalit tartibida — `.indexOn` shart emas). `orderByChild`/`equalTo` query'lar yo'q.

---

## 7. Qisqacha xulosa

> ⚠️ Quyidagi uch qator 2026.08 holatini tasvirlaydi. Eng yangi holat — 11-band.

- ❌ Hozir: auth yo'q → DB faqat Console qoidalari bilan himoyalangan; ular ochiq bo'lsa — jiddiy PII va yaxlitlik xavfi.
- ✅ Bu PR: auditni hujjatlashtiradi va xavfsiz `database.rules.json` (target) ni repoga qo'shadi.
- ⏭️ Keyingi qadam: Worker custom-token auth'ni joriy qilib, shu qoidalarni faollashtirish.

**2026.09 holati:** Worker custom-token auth ishlayapti va qoidalar
qattiqlashtirildi — 11-bandga qarang.


---

## 8. 🆕 YANGILANISH — kod darajasidagi tuzatishlar (bu PR)

> Quyidagilar **kodga allaqachon kiritildi**. Qolgani — Firebase Console va Cloudflare Worker'da **bir martalik qo'lda sozlash** (kod orqali bajarib bo'lmaydi).

### Kodda bajarilgani
- **Ochiq proxy yopildi.** `cloudflare-worker.js` ning `/` (sendMessage) yo'li endi `initData` HMAC bilan tekshiradi va `chat_id` ni cheklaydi:
  - oddiy mijoz — faqat **o'ziga** yoki **adminga**;
  - admin — istalgan chatga (mijozga javob, broadcast);
  - `initData` yo'q (APK/brauzer) — faqat **adminga** (mijozlarni soxta xabar bilan aldash vektori yopildi).
  - Mijoz tomonida barcha yuborishlar `tgProxySend()` orqali ketadi (`initData` avtomatik qo'shiladi).
- **XSS yopildi.** Sharh (`r.text`, `r.userName`) va buyurtma chati (`msg.text`) endi `escHtml()` bilan chiqariladi.
- **Telegram HTML inʼyeksiyasi yopildi.** `parse_mode:"HTML"` xabarlarda mahsulot nomi/mijoz matni `escTg()` bilan ekranlanadi (xabar `400` bilan rad etilmaydi).
- **Stok data-loss tuzatildi.** Buyurtmada endi butun `products` massivi `.set()` bilan qayta yozilmaydi; faqat sotilgan mahsulot/razmer stoki **atomik `transaction`** bilan kamaytiriladi (`_decrementStock`).
- **Referral ikki tomonlama bonus** endi Worker `/referral` endpoint orqali (admin huquqi bilan, idempotent) beriladi. `refcodes` qiymati `String(uid)` yoziladi (qoida `newData.val() === auth.uid` bilan mos).
- **Anti-DevTools** (F12/o'ng tugma/`Ctrl+U`/`user-select:none`) olib tashlandi — UX/accessibility tiklandi.
- Qoidalarga **`referralRedeemed`** tuguni qo'shildi (Worker takror bonusni bloklash uchun ishlatadi; mijoz yoza olmaydi).

### Go-live (qo'lda) tartibi
1. **Cloudflare Worker > Settings > Variables** (Secret):
   - `BOT_TOKEN`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (allaqachon kerak edi).
   - Ixtiyoriy: `ADMIN_IDS="5105291033,483425630"`, `FIREBASE_DB_URL="https://avtoa1shop-default-rtdb.firebaseio.com"`, `REFERRAL_BONUS="20000"`.
   - Service account'da **Realtime Database** yozish huquqi borligiga ishonch hosil qiling (`/referral` admin yozuvi uchun).
2. **Firebase Console > Realtime Database > Rules** — `database.rules.json` ni qo'ying.
3. **DB'da admin allowlist** yarating (bir marta, import yoki qo'lda):
   ```json
   { "admins": { "5105291033": true, "483425630": true } }
   ```
4. Bitta sinov foydalanuvchi bilan tekshiring: buyurtma berish, sharh, chat, referral.
5. (Ixtiyoriy, kelgusi bosqich) Cashback/balansni ham server-authoritative qilish — hozir egasi o'z tuguniga yozadi.


---

## 9. 🆕 Qoidalarni bir tugma bilan joriy qilish (avtomatlashtirish)

Endi `database.rules.json` ni Console'ga **qo'lda nusxalash shart emas**. Repoga quyidagilar qo'shildi:

- `firebase.json` — qoidalar fayli manzili (`database.rules`).
- `.firebaserc` — standart loyiha (`avtoa1shop`).
- `.github/workflows/deploy-rules.yml` — **faqat qo'lda** (workflow_dispatch) ishga tushadigan deploy.

### Bir martalik sozlash
1. Firebase Console → Project Settings → **Service accounts** → *Generate new private key* → JSON yuklab oling. Service account'da **Firebase Realtime Database Admin** roli bo'lsin.
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - Nomi: `FIREBASE_SERVICE_ACCOUNT`
   - Qiymati: yuklab olingan JSON faylning **to'liq matni**.

### Joriy qilish
GitHub → **Actions → "Deploy Firebase qoidalari" → Run workflow**. Tugagach qoidalar jonli bo'ladi.

> Qoida o'zgartirilganda — faylni tahrirlab, PR/commit qiling, so'ng workflow'ni qayta ishga tushiring. Workflow **avtomatik emas**, shuning uchun tasodifan joriy bo'lib ketmaydi.

---

## 10. ✅ `users` o'qishi YOPILDI (2026.09)

Bu bo'lim ilgari "hali qilinmagan" deb turgan edi. **Endi bajarildi** —
11-bandga qarang.

Admin panelining butun `users` daraxtini o'qishi saqlanib qoldi: `users`
tugunining o'zida `.read` = **admin**, har bir `users/$uid` da esa `.read` =
**o'sha mijozning o'zi**. Ya'ni admin hammasini ko'radi, mijoz faqat o'zini,
begona odam esa **hech narsani**.

`admins/{uid}` yozuvi bor-yo'qligiga bog'liqlik ham olib tashlandi: qoidalarda
admin tekshiruvi `admins/{uid} === true` **YOKI** qattiq yozilgan uid ro'yxati
bo'yicha ishlaydi. Ikkalasi ham server tomonda — brauzerdan o'zgartirib
bo'lmaydi (`auth.uid` = Worker `/auth` HMAC bilan tasdiqlagan Telegram ID).

Shunga qaramay `admins` tugunini to'ldirish **tavsiya etiladi** — keyinchalik
yangi admin qo'shganda qoidalar faylini tahrirlash kerak bo'lmaydi:

```
admins
  └── 5105291033: true
  └── 483425630: true
  └── 5302078: true
```

---

## 11. 🔴 KRITIK TUZATISH (2026.09) — nima o'zgardi

### Yopilgan teshiklar

| Tugun | Ilgari | Endi |
|---|---|---|
| `users` | `.read: true` + `.write: true` — **har kim** butun mijozlar bazasini o'qiy/o'chira olardi | butun ro'yxat: admin; har bir yozuv: faqat egasi |
| `products` | `.write: "newData.exists()"` — har kim narxlarni 0 qilardi | yozish: faqat admin (`stock` — tasdiqlangan mijoz faqat **kamaytiradi**) |
| `orders` | `.write: "newData.exists()"` — soxta buyurtma / o'chirish | mijoz faqat yangi yaratadi; o'zgartirish: admin |
| `reviews` | har kim istalgan nomdan sharh yozardi | faqat `auth.uid === $uid` |
| `refcodes` | `.write: true` — referal kodni o'ziga o'girish | faqat bir marta yaratish, qiymat = o'z uid |
| `stories` | har kim yozardi | faqat admin |
| `notify_requests` | to'liq ochiq | o'qish: admin, yozish: o'z nomidan |
| `ai_requests` | to'liq ochiq — begona odam AI budjetini yoqardi | faqat o'z suhbati |
| `ai_bulk_requests`, `ai_admin_tasks` | to'liq ochiq — prompt injection + budjet | faqat admin |

### Kod tomonidagi tuzatishlar

- **XSS (saqlangan):** `escHtml()` qo'shildi — o'xshash tovarlar sarlavhasi,
  tovar kodi, **mijoz ismi admin panelida** (eng xavflisi: mijoz ismiga skript
  yozib admin sessiyasini egallash mumkin edi), storis `src`/`poster`
  atributlari.
- **`_jsAttr()` yordamchisi:** `onclick="fn('...')"` ichidagi matn uchun ikki
  qatlamli escape (avval JS, keyin HTML). Ilgari `replace(/'/g,"\\'")` edi —
  mijoz ismidagi `"` yoki `<` atributdan chiqib ketardi.
- **`trackOrder()`:** ilgari bitta buyurtmani topish uchun **barcha** mijozlarning
  ma'lumotini yuklardi (maxfiylik + tezlik muammosi). Endi faqat o'z
  buyurtmalari ichidan izlaydi — DB'ga murojaat ham kamaydi.
- **Auth jim qolmaydi:** Telegram ichida auth o'rnatilmasa endi ochiq
  ogohlantirish chiqadi (ilgari jimgina sinardi).

### ⚠️ Deploy qilishdan OLDIN majburiy tekshiruv

Qoidalar **auth ishlashiga bog'liq**. Agar Worker `/auth` ishlamasa (yoki
`BOT_TOKEN` secret'i sozlanmagan bo'lsa), ilova hech narsa o'qiy olmaydi.

1. Mini App'ni Telegram'dan ochib, ogohlantirish toast'i chiqmasligini tekshiring.
2. Admin panelini ochib ko'ring: mijozlar, statistika, buyurtmalar yuklanishi kerak.
3. Bitta sinov buyurtma bering.
4. Shundan keyin `Deploy Firebase qoidalari` workflow'ini ishga tushiring.

### Qolgan (ataylab) bo'shliqlar

- **Telegram'siz foydalanuvchilar** (`apk_*`, `tg_url_*`) auth ola olmaydi,
  shuning uchun ularning yozuvlari ochiq qoldi — aks holda brauzer/APK
  foydalanuvchilari umuman ishlamay qolardi. Ammo **butun ro'yxatni to'kib
  olish endi imkonsiz** (kalitlarni sanab chiqib bo'lmaydi). To'liq yechim —
  bu yo'lni Firebase anonymous auth'ga o'tkazish.
- **Stok kamaytirish:** tasdiqlangan mijoz `stock` ni kamaytira oladi (buyurtma
  paytidagi zaxira yo'li). Asosiy yo'l — Worker `/stock-commit`. Worker
  o'chirilgan bo'lsa zaxira yo'l ishlaydi; narx/katalogga tegib bo'lmaydi.
- **ImgBB kaliti** (`index.html`) hamon kodda — uni almashtirish va Worker
  orqali proxy qilish alohida ish.
- **Telegram bot tokeni** git tarixida qolgan (`index.html.backup` blob'i).
  Faylni o'chirish yetarli EMAS — **@BotFather'da tokenni almashtirish shart**.
  Bu token bir vaqtning o'zida `initData` ni tekshiradigan HMAC siri hamdir.
