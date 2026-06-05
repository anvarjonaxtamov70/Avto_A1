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


def _node_items(node):
    """Firebase tugunini (dict YOKI list) (kalit, qiymat) juftliklariga aylantiradi.
    RTDB ketma-ket raqamli kalitlarni list qilib qaytaradi; .items() to'g'ridan-to'g'ri
    chaqirilsa AttributeError beradi. Bu yordamchi har ikki holatni qo'llab-quvvatlaydi."""
    if not node:
        return []
    if isinstance(node, dict):
        return list(node.items())
    if isinstance(node, list):
        return [(str(i), v) for i, v in enumerate(node)]
    return []

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


async def _read_products_raw(session, fb_url):
    """`products` tugunini RAW (dict/list/None) ko'rinishida o'qiydi."""
    async with session.get(fb_url("products")) as r:
        if r.status != 200:
            raise RuntimeError(f"products o'qib bo'lmadi (status={r.status})")
        return await r.json()


def _product_offsets(raw):
    """RAW products dan (keyingi_id, keyingi_indeks) ni hisoblaydi.
    Butun massivni qayta yozmaslik (append-only) uchun keyingi_indeks kerak."""
    if isinstance(raw, list):
        items = [p for p in raw if isinstance(p, dict)]
        next_index = len(raw)
    elif isinstance(raw, dict):
        items = [v for v in raw.values() if isinstance(v, dict)]
        nums = [int(k) for k in raw.keys() if str(k).isdigit()]
        next_index = (max(nums) + 1) if nums else len(raw)
    else:
        items, next_index = [], 0
    next_id = max([p.get("id", 0) for p in items], default=0) + 1
    return next_id, next_index


async def _append_products_safe(session, fb_url, new_products, start_index, max_probe=64):
    """Yangi mahsulotlarni massivga XAVFSIZ (atomik) append qiladi.

    Har bir mahsulot uchun bo'sh slot topiladi va u ETag (if-match) bilan ATOMIK
    egallanadi. Slot band bo'lsa yoki 412 (poyga) qaytsa — keyingi slotga o'tiladi,
    shu sababli mavjud mahsulotlar ustidan HECH QACHON yozilmaydi (#3).
    Hammasi yozilsa True, qattiq xatoda False.
    """
    if not new_products:
        return True
    idx = start_index
    for p in new_products:
        placed = False
        probes = 0
        while probes < max_probe:
            probes += 1
            try:
                async with session.get(fb_url(f"products/{idx}"),
                                       headers={"X-Firebase-ETag": "true"}) as gr:
                    etag = gr.headers.get("ETag")
                    value = await gr.json()
            except Exception as e:
                log.error(f"AI bulk: products[{idx}] ETag o'qish xatosi: {e}")
                return False
            if value is not None:
                idx += 1  # slot band — ustidan yozmaymiz
                continue
            headers = {"if-match": etag} if etag else {}
            try:
                async with session.put(fb_url(f"products/{idx}"), json=p, headers=headers) as pr:
                    if pr.status == 200:
                        placed = True
                        idx += 1
                        break
                    if pr.status == 412:  # poyga: slotni boshqasi egalladi
                        idx += 1
                        continue
                    log.error(f"AI bulk: products[{idx}] yozilmadi (status={pr.status})")
                    return False
            except Exception as e:
                log.error(f"AI bulk: products[{idx}] PUT xatosi: {e}")
                return False
        if not placed:
            log.error("AI bulk: bo'sh slot topilmadi (max_probe tugadi)")
            return False
    return True


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
                    for uid, data in _node_items(requests):
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
            raw = await _read_products_raw(session, fb_url)
        except Exception as e:
            log.error(f"AI bulk: products o'qishda xato ({uid}): {e}")
            await _finish(session, fb_url, uid, status="error", error=str(e), added=0)
            return

        next_id, next_index = _product_offsets(raw)

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

        # Har bir mahsulotni bo'sh slotga ETag (if-match) bilan ATOMIK qo'shamiz.
        # Shunda admin Mini App'da boshqa mahsulotlarga kiritgan o'zgarishlar
        # (tahrir/o'chirish/qo'shish) ustidan HECH QACHON yozib yuborilmaydi.
        ok = await _append_products_safe(session, fb_url, new_products, next_index)
        if not ok:
            await _finish(session, fb_url, uid, status="error",
                          error="products yozilmadi (Firebase xatosi)", added=0)
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
