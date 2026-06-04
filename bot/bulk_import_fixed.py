# =====================================================================
#  AVTO A1 — AI ommaviy import moduli
#  bot.py shu moduldagi process_ai_bulk_requests_v2() ni chaqiradi.
#
#  Vazifa:
#    1) Firebase 'ai_bulk_requests' tugunini poylab turadi.
#    2) Admin Mini App'da yozgan erkin matnli ro'yxatni
#       (mas: "Damas kalotka - 15$") Groq AI yordamida
#       [{name, price_usd}] ko'rinishida tuzilmalashtiradi.
#       AI ishlamasa — oddiy regex tahlilchi ishlaydi (fallback).
#    3) usd_rate va markup_pct asosida so'mdagi yakuniy narxni hisoblaydi.
#    4) Mahsulotlarni 'products' ga QORALAMA (is_draft=True) qo'shadi.
#    5) So'rov holatini yangilaydi: needs_processing=False, status="done",
#       added=<son>, processed_at=<vaqt>. Xato bo'lsa status="error".
#
#  Muhim:
#    - fb_url(path) — bot.py'dan uzatiladigan, token bilan to'liq RTDB URL
#      quradigan funksiya (admin yozuvi 401 bermasligi uchun).
#    - products_lock — bot.py'dagi asyncio.Lock. Excel import bilan AYNI
#      vaqtda ishlaganda ID poyga holatini (race condition) oldini oladi.
# =====================================================================

import asyncio
import json
import logging
import math
import os
import re
import time

import aiohttp

log = logging.getLogger(__name__)

GROQ_TEXT_MODEL = os.getenv("GROQ_TEXT_MODEL", "llama-3.3-70b-versatile")

# Bir so'rovda nechta qatorni qabul qilamiz (suiiste'mol/qotishni oldini olish)
MAX_LINES = 200
# Bir tsiklda nechta so'rovni qayta ishlaymiz
POLL_INTERVAL = 3


def _round_price(price_usd: float, usd_rate: float, markup_pct: float) -> int:
    """USD narxni so'mga aylantirib, ustama qo'shib, 1000 ga yumaloqlaydi."""
    raw = price_usd * usd_rate * (1.0 + markup_pct / 100.0)
    return int(math.ceil(raw / 1000.0) * 1000)


def _regex_parse_lines(raw_text: str):
    """AI ishlamaganda zaxira tahlilchi.

    Har bir qatordan nom va USD narxni ajratadi. Qo'llab-quvvatlanadigan
    ko'rinishlar: 'Nomi - 15$', 'Nomi 15', 'Nomi — 15 usd', 'Nomi: 15$'.
    """
    items = []
    for line in raw_text.splitlines():
        line = line.strip()
        if not line:
            continue
        # Oxiridagi sonni (narx) topamiz
        m = re.search(r"([0-9]+(?:[.,][0-9]+)?)\s*(?:\$|usd|у\.?е\.?|dollar)?\s*$", line, re.IGNORECASE)
        if not m:
            continue
        try:
            price = float(m.group(1).replace(",", "."))
        except ValueError:
            continue
        if price <= 0:
            continue
        # Narxdan oldingi qism — nom (ajratuvchilarni tozalaymiz)
        name = line[: m.start()].strip(" -—:•\t")
        if not name:
            continue
        items.append({"name": name[:120], "price_usd": price})
    return items


async def _ai_parse_lines(groq_client, raw_text: str):
    """Groq AI bilan erkin matnni tuzilmaga aylantiradi. None qaytarsa fallback."""
    if groq_client is None:
        return None
    prompt = (
        "Quyidagi avto-zapchast ro'yxatini JSON ga aylantir. "
        "Har bir element uchun mahsulot nomi (name) va USD dagi narxi (price_usd, son) ni ajrat. "
        "Narxi yo'q yoki tushunarsiz qatorlarni tashlab ket. "
        "Faqat shu ko'rinishda JSON qaytar: "
        '{"items":[{"name":"...","price_usd":12.5}]}\n\n'
        f"RO'YXAT:\n{raw_text}"
    )
    try:
        resp = await groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "Sen aniq ishlaydigan JSON ajratuvchisan. Faqat to'g'ri JSON qaytarasan."},
                {"role": "user", "content": prompt},
            ],
            model=GROQ_TEXT_MODEL,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        content = (resp.choices[0].message.content or "").strip()
        data = json.loads(content)
        items = data.get("items") if isinstance(data, dict) else None
        if not isinstance(items, list):
            return None
        clean = []
        for it in items:
            if not isinstance(it, dict):
                continue
            name = str(it.get("name", "")).strip()
            try:
                price = float(it.get("price_usd"))
            except (TypeError, ValueError):
                continue
            if name and price > 0:
                clean.append({"name": name[:120], "price_usd": price})
        return clean or None
    except Exception as e:
        log.warning(f"AI bulk parse xatosi (fallback ishlatiladi): {e}")
        return None


async def _read_products(session, fb_url):
    async with session.get(fb_url("products")) as r:
        if r.status != 200:
            raise RuntimeError(f"products o'qib bo'lmadi (status={r.status})")
        data = await r.json()
    return [p for p in (data or []) if p is not None]


async def process_ai_bulk_requests_v2(bot, fb_url, groq_client, fetch_image=None, products_lock=None):
    """ai_bulk_requests tugunini doimiy poylab, AI yordamida qoralama mahsulot qo'shadi.

    Parametrlar:
      bot            — aiogram Bot (adminga xabar yuborish uchun, ixtiyoriy).
      fb_url         — token bilan RTDB URL quradigan funksiya: fb_url("products").
      groq_client    — AsyncGroq mijoz (None bo'lsa regex fallback).
      fetch_image    — nom bo'yicha rasm qaytaradigan async funksiya (ixtiyoriy).
      products_lock  — asyncio.Lock (Excel import bilan ID poyga holatini oldini olish).
    """
    # fb_url string bo'lib kelib qolsa (eski chaqiruv), uni funksiyaga aylantiramiz.
    if isinstance(fb_url, str):
        base = fb_url.rstrip("/")
        fb_url = lambda path, _b=base: f"{_b}/{path}.json"

    lock = products_lock or asyncio.Lock()

    async with aiohttp.ClientSession() as session:
        while True:
            try:
                async with session.get(fb_url("ai_bulk_requests")) as resp:
                    if resp.status != 200:
                        await asyncio.sleep(POLL_INTERVAL)
                        continue
                    requests = await resp.json()

                if requests:
                    for uid, data in list(requests.items()):
                        if not isinstance(data, dict) or data.get("needs_processing") is not True:
                            continue
                        await _process_single(session, fb_url, groq_client, fetch_image, lock, bot, uid, data)
            except aiohttp.ClientError as e:
                log.error(f"AI bulk: tarmoq xatosi: {e}")
            except Exception as e:
                log.error(f"AI bulk: kutilmagan xato: {e}", exc_info=True)

            await asyncio.sleep(POLL_INTERVAL)


async def _process_single(session, fb_url, groq_client, fetch_image, lock, bot, uid, data):
    """Bitta ai_bulk_requests/{uid} so'rovini qayta ishlaydi."""
    # Avval bayroqni o'chiramiz — ikki marta qayta ishlanmasligi uchun
    try:
        await session.patch(fb_url(f"ai_bulk_requests/{uid}"), json={"needs_processing": False})
    except Exception as e:
        log.error(f"AI bulk: needs_processing yangilanmadi ({uid}): {e}")
        return

    raw_text = str(data.get("raw_text", "")).strip()
    try:
        usd_rate = float(data.get("usd_rate", 12600))
    except (TypeError, ValueError):
        usd_rate = 12600.0
    try:
        markup_pct = float(data.get("markup_pct", 25))
    except (TypeError, ValueError):
        markup_pct = 25.0

    if not raw_text:
        await _finish(session, fb_url, uid, status="error", error="Matn bo'sh", added=0)
        return

    # Juda uzun ro'yxatni cheklaymiz
    lines = [ln for ln in raw_text.splitlines() if ln.strip()][:MAX_LINES]
    raw_text = "\n".join(lines)

    # 1) AI bilan tahlil, bo'lmasa regex fallback
    parsed = await _ai_parse_lines(groq_client, raw_text)
    if not parsed:
        parsed = _regex_parse_lines(raw_text)

    if not parsed:
        await _finish(session, fb_url, uid, status="error",
                      error="Hech qanday mahsulot ajratib bo'lmadi", added=0)
        return

    partiya_nomi = f"AI_{time.strftime('%d_%m_%Y_%H_%M')}"

    # 2) products'ni o'qib-yozishni LOCK ostida bajaramiz (ID poyga holatini oldini olish)
    async with lock:
        try:
            current = await _read_products(session, fb_url)
        except Exception as e:
            log.error(f"AI bulk: products o'qishda xato ({uid}): {e}")
            await _finish(session, fb_url, uid, status="error", error=str(e), added=0)
            return

        next_id = (max([p.get("id", 0) for p in current], default=0) + 1)

        new_products = []
        for it in parsed:
            img = ""
            if fetch_image is not None:
                try:
                    img = await fetch_image(it["name"]) or ""
                except Exception:
                    img = ""
            new_products.append({
                "id": next_id,
                "name": it["name"],
                "price": _round_price(it["price_usd"], usd_rate, markup_pct),
                "unit": "dona",
                "desc": "",
                "category": "umumiy",
                "categories": ["umumiy"],
                "brand": "Umumiy",
                "model": "Umumiy",
                "img": img,
                "images": [img] if img else [],
                "product_type": "oddiy",
                "stock": 10,
                "is_draft": True,
                "batch_id": partiya_nomi,
                "has_conflict": False,
            })
            next_id += 1

        current.extend(new_products)
        try:
            async with session.put(fb_url("products"), json=current) as r:
                if r.status != 200:
                    raise RuntimeError(f"products yozilmadi (status={r.status})")
        except Exception as e:
            log.error(f"AI bulk: products yozishda xato ({uid}): {e}")
            await _finish(session, fb_url, uid, status="error", error=str(e), added=0)
            return

    added = len(new_products)
    await _finish(session, fb_url, uid, status="done", error="", added=added)
    log.info(f"AI bulk: {added} ta qoralama qo'shildi (uid={uid}, partiya={partiya_nomi})")

    # Adminni xabardor qilamiz (ixtiyoriy)
    if bot is not None and added:
        try:
            await bot.send_message(
                chat_id=int(uid),
                text=(f"AI ommaviy import tugadi: <b>{added} ta</b> tovar "
                      "qoralama sifatida qo'shildi.\n'Qoralamalar' bo'limidan tasdiqlang."),
                parse_mode="HTML",
            )
        except Exception as e:
            log.warning(f"AI bulk: adminga xabar yuborilmadi ({uid}): {e}")


async def _finish(session, fb_url, uid, status, error, added):
    """So'rov holatini yakuniy qiymatga yangilaydi."""
    try:
        await session.patch(fb_url(f"ai_bulk_requests/{uid}"), json={
            "needs_processing": False,
            "status": status,
            "error": error,
            "added": added,
            "processed_at": int(time.time() * 1000),
        })
    except Exception as e:
        log.error(f"AI bulk: yakuniy holat yozilmadi ({uid}): {e}")
