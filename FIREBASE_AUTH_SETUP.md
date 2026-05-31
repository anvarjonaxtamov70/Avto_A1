# Firebase Auth — sozlash ko'rsatmasi (7-qadam)

Bu PR Telegram foydalanuvchisini **haqiqiy Firebase foydalanuvchisiga** aylantiradi: Worker `initData`'ni HMAC bilan tekshiradi va `uid = Telegram ID` bilan **custom token** beradi. Mijoz shu token bilan `signInWithCustomToken` qiladi. Shundan keyingina `database.rules.json` (6-qadam) to'liq kuchga kiradi.

> ✅ **Xavfsizlik kafolati:** Mijoz tarafdagi auth **best-effort** (fonda) ishlaydi. Worker hali deploy qilinmagan yoki Secret'lar sozlanmagan bo'lsa ham, **jonli bot avvalgidek ishlayveradi** (DB qoidalari hali ochiq). Auth barqaror ishlaganini ko'rgachgina rules'ni yoqasiz — pastdagi 4-bosqich.

---

## Nima o'zgardi (kod)

| Fayl | O'zgarish |
|---|---|
| `cloudflare-worker.js` | `/auth` endpoint qo'shildi (initData HMAC tekshiruvi + Firebase custom token, RS256 JWT). Eski `sendMessage` proxy o'zgarishsiz ishlaydi. |
| `index.html` | `firebase-auth.js` SDK qo'shildi; init paytida `/auth`ga so'rov yuborib `signInWithCustomToken` qiladi (`window._authReady`). |

---

## Sizning qadamlaringiz (taxminan 10 daqiqa)

### 1️⃣ Firebase service-account kalitini oling
1. Firebase Console → ⚙️ **Project settings** → **Service accounts**.
2. **Generate new private key** → JSON yuklab olinadi.
3. JSON ichidan 2 ta qiymat kerak:
   - `client_email` (masalan `firebase-adminsdk-xxxx@avtoa1shop.iam.gserviceaccount.com`)
   - `private_key` (`-----BEGIN PRIVATE KEY-----` bilan boshlanadi)

### 2️⃣ Cloudflare Worker'ga Secret'lar qo'shing
Cloudflare → Workers → `avtoa1bot` → **Settings** → **Variables and Secrets** → **Add** (turi: **Secret**):

| Secret nomi | Qiymati |
|---|---|
| `BOT_TOKEN` | (allaqachon bor — bot tokeni) |
| `FIREBASE_CLIENT_EMAIL` | yuqoridagi `client_email` |
| `FIREBASE_PRIVATE_KEY` | yuqoridagi `private_key` (to'liq, BEGIN/END qatorlari bilan) |

> `private_key`'ni JSON'dan ko'chirsangiz ichida `\n` literal bo'lishi mumkin — muammo emas, Worker ularni avtomatik haqiqiy newline'ga aylantiradi.

### 3️⃣ Worker'ni qayta deploy qiling
`cloudflare-worker.js`ning yangi kodini Worker'ga joylang va **Deploy** bosing.

**Tez test (terminalda):**
```bash
# Telegram bot ichida ilovani ochib, konsolda `tg.initData` ni nusxalang, keyin:
curl -X POST https://avtoa1bot.anvaraxtamov70.workers.dev/auth \
  -H "Content-Type: application/json" \
  -d '{"initData":"<bu yerga initData>"}'
# Kutilgan javob: {"ok":true,"token":"...","uid":"<telegram id>"}
```

Botni ochganda brauzer konsolida `[Auth] Firebase'ga kirildi (uid=...)` yashil log ko'rinsa — ishladi. ✅

### 4️⃣ (Faqat 3-qadam ishlagach) DB qoidalarini yoqing
1. DB'da admin allowlist'ni yarating:
   ```json
   { "admins": { "5105291033": true, "483425630": true } }
   ```
2. `database.rules.json` (6-qadam PR'idagi) ni Firebase Console → Realtime Database → **Rules** ga qo'ying va **Publish**.
3. Avval bitta sinov foydalanuvchi bilan: profil ochilishi, savat, buyurtma ishlayotganini tekshiring.
4. Muammo bo'lsa — eski (ochiq) rules'ni qaytaring; bot darrov tiklanadi (rollback).

---

## ⚠️ Eslatmalar
- **APK / brauzer rejimi:** `tg.initData` bo'lmagani uchun auth o'tkazib yuboriladi. Bunday foydalanuvchilar uchun rules'ni yoqishdan oldin alohida yechim kerak (yoki ularni faqat ommaviy `products` bilan cheklash).
- **Referral ikki tomonlama bonus:** rules egalik bo'yicha cross-user yozuvni bloklaydi — bu bonusni keyin server (Worker) tomoniga ko'chirish kerak.
- **Service-account kaliti** — eng maxfiy sir. Faqat Cloudflare Secret sifatida saqlanadi, hech qachon repo/kodga qo'yilmaydi.
