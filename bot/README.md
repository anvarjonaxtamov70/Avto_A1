# Avto A1 — Telegram bot

Toza, ortiqchasiz versiya. Maxfiy kalitlar `.env` faylда, kodda token yo'q.

## Nima o'zgardi (eski koddan)
- **Ko'p tillilik (o'zbek / rus)** — yangi mijoz `/start` da tilni tanlaydi, tanlov profilga (`users/<id>/profile/lang`) saqlanadi. Mijozga ko'rinadigan barcha matnlar (ro'yxatdan o'tish, menyu, aloqa, buyurtma holati, AI javoblari) tanlangan tilda. Tilni keyin ham almashtirish mumkin: **`/til`** buyrug'i yoki menyudagi **🌐 Til / Язык** tugmasi orqali. Barcha matnlar `TEXTS` lug'atida, `t(lang, key)` yordamchisi orqali olinadi.
- **Storis kategoriyalari ro'yxati** — admin hashteglarni yoddan bilishi shart emas: **`/storis`** (yoki `/kategoriyalar`) buyrug'i barcha kategoriyalarni izohi bilan ko'rsatadi. Noto'g'ri hashteg yuborilsa, xato xabarining o'zi ham shu ro'yxatni chiqaradi. Ro'yxat `STORY_CATEGORY_INFO` da bitta joyda turadi (tekshiruv to'plami undan avtomatik hosil bo'ladi).
- **Storis 401 tuzatildi** — Firebase'ga `serviceAccount.json` orqali **admin token** bilan yoziladi (`fb_url()` yordamchisi). Bir xil tuzatish `products`, `orders`, `ai_requests`, `ai_admin_tasks` ga ham tegishli.
- **Ortiqcha kod olib tashlandi** — Yandex/DuckDuckGo/Google rasm qidiruvi, `remove.bg`, ImgBB, PDF import (ishlamaydigan/keraksiz).
- **Groq yaxshilandi** — markaziy `groq_chat()` (retry + xato boshqaruvi), modellar bitta joyda (`GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL`), AI tushsa bot qulamaydi.

## Buyruqlar

Buyruqlar Telegram'dagi **«Menu»** tugmasida ham ko'rinadi (`set_my_commands`).
Admin buyruqlari faqat adminlarning o'z chatida ko'rinadi — mijozlar ularni ko'rmaydi.

| Buyruq | Kimga | Vazifa |
|--------|-------|--------|
| `/start` | hammaga | Boshlash / til tanlash / asosiy menyu |
| `/help`, `/yordam` | hammaga | Bot nimalar qila oladi + buyruqlar ro'yxati |
| `/til`, `/language` | hammaga | Til (o'zbek/rus) tanlash oynasi |
| `/bekor`, `/cancel` | hammaga | Boshlangan amalni (ro'yxatdan o'tish, Excel import) to'xtatadi |
| `/storis`, `/kategoriyalar` | admin | Storis hashteg-kategoriyalari ro'yxati |
| `/hisobot`, `/report` | do'kon egasi | Savdo va ombor bo'yicha tez hisobot |

## Bot endi HECH QACHON jim qolmaydi

Ilgari bot faqat **matn** va **rasm** ga javob berardi. Qolgan hamma narsa —
ovozli xabar, doiracha, audio, stiker, GIF, lokatsiya, kontakt, hashtegsiz
video, so'rovnoma — hech qanday handlerga tushmasdi va bot **butunlay jim**
qolardi. Mijoz uchun bu "bot buzuq" degani.

Endi har bir tur uchun javob bor, oxirida esa **universal to'r**
(`handle_anything_else`) turadi — kelajakda Telegram yangi xabar turi
qo'shsa ham bot javobsiz qolmaydi.

Shu bilan birga:

- **Buyruqlar FSM holatida ham ishlaydi.** Ilgari Excel importni yarim yo'lda
  tashlab ketgan admin `/start` ham, boshqa hech narsa ham qila olmasdi —
  faqat botni qayta ishga tushirish qutqarardi.
- **Yangi mijozning birinchi xabari javobsiz qolmaydi.** `/start` dan keyin
  til tugmalarini bosmasdan yozgan odam ilgari HECH QANDAY javob olmasdi.
- **Bildirishnomalar barcha adminlarga** boradi (ilgari faqat birinchisiga).
- **So'rov cheklovi (rate limit)** — bitta odam AI limitini hamma uchun
  tugatib qo'ymaydi. Sozlash: `RL_AI_MAX`, `RL_AI_WINDOW`, `RL_PHOTO_MAX`,
  `RL_PHOTO_WINDOW`. Adminlarga cheklov qo'llanmaydi.

## O'rnatish

```bash
pip install -r requirements.txt
cp .env.example .env        # keyin .env ni to'ldiring
python bot.py
```

## serviceAccount.json (MAJBURIY — storis ishlashi uchun)

1. Firebase Console -> ⚙️ Project Settings -> **Service accounts**
2. **Generate new private key** -> yuklab olingan JSON
3. Uni shu papkaga **`serviceAccount.json`** deb saqlang

> `.env` va `serviceAccount.json` `.gitignore` da — ular hech qachon GitHub'ga ketmaydi.

## AI ommaviy import (`bulk_import_fixed.py`)

`bot.py` shu moduldagi `process_ai_bulk_requests_v2()` ni chaqiradi. Modul:

- Firebase `ai_bulk_requests` tugunini poylaydi (admin Mini App'da yozgan erkin matnli ro'yxat).
- Matnni **Groq AI** bilan `{nomi, narx_usd}` ko'rinishiga keltiradi (AI ishlamasa — regex zaxira tahlilchi).
- `usd_rate` va `markup_pct` asosida so'mdagi narxni hisoblab, mahsulotlarni **qoralama** (`is_draft=true`) qilib `products` ga qo'shadi.
- ID poyga holatini oldini olish uchun Excel import bilan **umumiy `products_lock`** ishlatadi.

> Eslatma: avval bu fayl repoda yo'q edi va bot ishga tushmasdi (`ModuleNotFoundError`). Endi qaytadan qo'shildi.

