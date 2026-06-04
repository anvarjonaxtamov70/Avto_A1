# Avto A1 — Telegram bot

Toza, ortiqchasiz versiya. Maxfiy kalitlar `.env` faylда, kodda token yo'q.

## Nima o'zgardi (eski koddan)
- **Storis 401 tuzatildi** — Firebase'ga `serviceAccount.json` orqali **admin token** bilan yoziladi (`fb_url()` yordamchisi). Bir xil tuzatish `products`, `orders`, `ai_requests`, `ai_admin_tasks` ga ham tegishli.
- **Ortiqcha kod olib tashlandi** — Yandex/DuckDuckGo/Google rasm qidiruvi, `remove.bg`, ImgBB, PDF import (ishlamaydigan/keraksiz).
- **Groq yaxshilandi** — markaziy `groq_chat()` (retry + xato boshqaruvi), modellar bitta joyda (`GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL`), AI tushsa bot qulamaydi.

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

