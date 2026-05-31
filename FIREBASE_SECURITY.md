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

## 5. ⚠️ Deploy bo'yicha MUHIM ogohlantirish

`database.rules.json` **AUTH yoqilgandan keyingina** Console'ga qo'yilsin.

- Hozir ilovada auth yo'q, shuning uchun bu qoidalarni **hozir** qo'ysangiz — barcha o'qish/yozish **rad etiladi** va **jonli bot ishlamay qoladi**.
- Bu fayl avtomatik deploy qilinmaydi (repoda faqat GitHub Pages workflow bor, Firebase deploy yo'q). U — **maqsadli namuna va yo'l xaritasi**.

To'g'ri tartib:
1. (Keyingi qadam) Worker'da custom-token auth'ni joriy qilish + mijozda `signInWithCustomToken`.
2. DB'da `admins/{uid}: true` ni yaratish.
3. `database.rules.json` ni Console → Rules ga qo'yib, avval **bitta sinov foydalanuvchi** bilan test qilish.
4. Hammasi ishlasa — referral ikki tomonlama bonusini server tomoniga ko'chirish (4-bandga qarang).

---

## 6. Maxsus eslatmalar

- **Referral (ikki tomonlama bonus):** Egalik qoidalari bir foydalanuvchining **boshqa** foydalanuvchi tuguniga (`users/{referrerUid}/phase2`) yozishini **ataylab bloklaydi**. Shuning uchun taklif qilgan tomonning bonusi **server tomonida** (Worker yoki Cloud Function) berilishi kerak. Bu cheklov PR #10 izohida ham qayd etilgan edi.
- **Client-trust cheklovi:** Egasi o'z `users/{uid}` tuguniga erkin yozadi, demak cashback/balansni client'da soxtalashtirishi mumkin. To'liq himoya uchun pul/bonusga oid yozuvlar server-authoritative bo'lishi kerak (keyingi bosqich).
- **Indekslar:** Kodda faqat `products` uchun `limitToLast(30)` bor (kalit tartibida — `.indexOn` shart emas). `orderByChild`/`equalTo` query'lar yo'q.

---

## 7. Qisqacha xulosa

- ❌ Hozir: auth yo'q → DB faqat Console qoidalari bilan himoyalangan; ular ochiq bo'lsa — jiddiy PII va yaxlitlik xavfi.
- ✅ Bu PR: auditni hujjatlashtiradi va xavfsiz `database.rules.json` (target) ni repoga qo'shadi.
- ⏭️ Keyingi qadam: Worker custom-token auth'ni joriy qilib, shu qoidalarni faollashtirish.
