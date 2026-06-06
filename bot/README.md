# Avto A1 — Telegram bot

Toza, ortiqchasiz versiya. Maxfiy kalitlar `.env` faylда, kodda token yo'q.

## Nima o'zgardi (eski koddan)
- **Ko'p tillilik (o'zbek / rus)** — yangi mijoz `/start` da tilni tanlaydi, tanlov profilga (`users/<id>/profile/lang`) saqlanadi. Mijozga ko'rinadigan barcha matnlar (ro'yxatdan o'tish, menyu, aloqa, buyurtma holati, AI javoblari) tanlangan tilda. Tilni keyin ham almashtirish mumkin: **`/til`** buyrug'i yoki menyudagi **🌐 Til / Язык** tugmasi orqali. Barcha matnlar `TEXTS` lug'atida, `t(lang, key)` yordamchisi orqali olinadi.
- **Storis kategoriyalari ro'yxati** — admin hashteglarni yoddan bilishi shart emas: **`/storis`** (yoki `/kategoriyalar`) buyrug'i barcha kategoriyalarni izohi bilan ko'rsatadi. Noto'g'ri hashteg yuborilsa, xato xabarining o'zi ham shu ro'yxatni chiqaradi. Ro'yxat `STORY_CATEGORY_INFO` da bitta joyda turadi (tekshiruv to'plami undan avtomatik hosil bo'ladi).
- **Storis 401 tuzatildi** — Firebase'ga `serviceAccount.json` orqali **admin token** bilan yoziladi (`fb_url()` yordamchisi). Bir xil tuzatish `products`, `orders`, `ai_requests`, `ai_admin_tasks` ga ham tegishli.
- **Ortiqcha kod olib tashlandi** — Yandex/DuckDuckGo/Google rasm qidiruvi, `remove.bg`, ImgBB, PDF import (ishlamaydigan/keraksiz).
- **Groq yaxshilandi** — markaziy `groq_chat()` (retry + xato boshqaruvi), modellar bitta joyda (`GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL`), AI tushsa bot qulamaydi.

## Admin buyruqlari

| Buyruq | Vazifa |
|--------|--------|
| `/storis`, `/kategoriyalar` | Storis hashteg-kategoriyalari ro'yxatini izohi bilan ko'rsatadi |
| `/til`, `/language` | Til (o'zbek/rus) tanlash oynasini ochadi (hammaga ochiq) |

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

