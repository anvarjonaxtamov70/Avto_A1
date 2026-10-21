# =====================================================================
#  order_ops.py — BUYURTMA TUGMALARI VA WORKER BILAN ALOQA (sof modul)
# ---------------------------------------------------------------------
#  Nega alohida fayl: bot.py aiogram'ni import qiladi, bu esa sinovni
#  og'irlashtiradi. Bu yerdagi hamma narsa SOF (yoki faqat aiohttp) —
#  `tests/test_order_buttons.py` uni to'g'ridan-to'g'ri sinaydi.
#
#  YAGONA HAQIQAT MANBAI — Cloudflare Worker:
#    Buyurtma holatini (stok qaytarish, cashback, holat mashinasi, mijozga
#    va adminlarga xabar) FAQAT Worker o'zgartiradi. Bot o'zi bazaga
#    yozmaydi — Worker'ga imzolangan so'rov yuboradi. Ilgari AI agenti
#    `users/{uid}/orders` ga o'zi yozib, markaziy yozuvni NOTO'G'RI kalit
#    bilan yaratardi: baza ikkiga bo'linar, bekor qilinganda tovar omborga
#    qaytmasdi, cashback hisoblanmasdi.
#
#  IMZO (cloudflare-worker.js `verifyBotAuth` bilan AYNAN bir xil):
#    kalit = SHA256("avto-a1-bot-auth|" + BOT_TOKEN)
#    xabar = "a1bot|<route>|<ts>|<actor>|<maydon1>|<maydon2>..."
#    sig   = HMAC-SHA256(kalit, xabar).hex()
# =====================================================================

import hashlib
import hmac
import logging
import time

ORDER_STATUSES = ["kutilmoqda", "qabul", "yolda", "yetkazildi", "bekor_qilingan"]
# Worker ORDER_TRANSITIONS bilan bir xil (sinov tekshiradi).
ORDER_TRANSITIONS = {
    "kutilmoqda": ["qabul", "bekor_qilingan"],
    "qabul": ["yolda", "bekor_qilingan"],
    "yolda": ["yetkazildi", "bekor_qilingan"],
    "yetkazildi": ["bekor_qilingan"],
    "bekor_qilingan": [],
}
STATUS_FROM_CODE = {"q": "qabul", "y": "yolda", "d": "yetkazildi", "x": "bekor_qilingan"}
STATUS_LABELS = {
    "kutilmoqda": "⏳ Kutilmoqda",
    "qabul": "✅ Qabul qilindi",
    "yolda": "🚚 Yo'lda",
    "yetkazildi": "🏁 Yetkazildi",
    "bekor_qilingan": "❌ Bekor qilingan",
}

# Watchdog FAQAT `retryAt` maydoni bor hodisalarni oladi (Firebase indeksi
# bilan). Bu maydonni faqat YANGI Worker qo'yadi va yetkazilganda / voz
# kechilganda o'chiradi. Shuning uchun:
#   • eski oqimdagi (mijoz brauzeri xabar bergan) hodisalar hech qachon
#     qayta yuborilmaydi — admin eski kartochkalar bilan ko'milmaydi;
#   • yetkazilmay "osilib" qolgan eski yozuvlar so'rov oynasini to'ldirib,
#     yangi xatolarni yashirib qo'ymaydi.
def outbox_query_params(now_ms, limit=25):
    """Watchdog uchun indekslangan RTDB so'rovi (vaqti kelgan hodisalar)."""
    return {"orderBy": '"retryAt"', "startAt": "1", "endAt": str(int(now_ms)),
            "limitToFirst": str(int(limit))}


def _bot_auth_key(bot_token):
    return hashlib.sha256(("avto-a1-bot-auth|" + str(bot_token)).encode("utf-8")).digest()


def bot_auth(bot_token, route, actor, fields, ts=None):
    """Worker uchun `botAuth` obyekti."""
    ts = int(ts if ts is not None else time.time())
    parts = ["a1bot", route, str(ts), str(actor)] + ["" if f is None else str(f) for f in fields]
    sig = hmac.new(_bot_auth_key(bot_token), "|".join(parts).encode("utf-8"),
                   hashlib.sha256).hexdigest()
    return {"ts": ts, "actor": str(actor), "sig": sig}


# ---------------------------------------------------------------------
#  TUGMALAR
#  ⚠️ cloudflare-worker.js `orderAdminKeyboard` bilan AYNAN bir xil.
#     Kutilgan natija `.github/order-keyboards.json` da — ikkala tomon
#     sinovi ham shu faylni tekshiradi.
# ---------------------------------------------------------------------
def order_admin_keyboard(status, short):
    rows = []
    if status == "kutilmoqda":
        rows.append([{"text": "✅ Qabul qilish", "callback_data": f"ord:q:{short}"}])
    if status == "qabul":
        rows.append([{"text": "🚚 Yo'lga chiqdi", "callback_data": f"ord:y:{short}"}])
    if status == "yolda":
        rows.append([{"text": "🏁 Yetkazildi", "callback_data": f"ord:d:{short}"}])
    if status in ("kutilmoqda", "qabul", "yolda"):
        rows.append([{"text": "❌ Bekor qilish", "callback_data": f"ordc:x:{short}"}])
    if status == "yetkazildi":
        rows.append([{"text": "↩️ Qaytarildi (bekor)", "callback_data": f"ordc:x:{short}"}])
    return {"inline_keyboard": rows}


def order_confirm_keyboard(code, short, current_status=None):
    """Xavfli amal (bekor / qaytarish) uchun ikkinchi bosqich."""
    if current_status == "yetkazildi":
        yes = "⚠️ Ha, qaytarildi (tovar omborga)"
    else:
        yes = "⚠️ Ha, bekor qilish"
    return {"inline_keyboard": [
        [{"text": yes, "callback_data": f"ord:{code}:{short}"}],
        [{"text": "⬅️ Orqaga", "callback_data": f"ordb:{short}"}],
    ]}


def parse_order_callback(data):
    """`(amal, holat_kodi, qisqa_kalit)`; tanilmasa `(None, None, None)`.

    amal: "set" (bajarish), "confirm" (tasdiq so'rash), "back" (qaytish).
    """
    s = str(data or "")
    parts = s.split(":")
    short_ok = lambda k: 8 <= len(k) <= 40 and all(c in "0123456789abcdef" for c in k)
    if len(parts) == 3 and parts[0] in ("ord", "ordc") and parts[1] in STATUS_FROM_CODE and short_ok(parts[2]):
        return ("set" if parts[0] == "ord" else "confirm"), parts[1], parts[2]
    if len(parts) == 2 and parts[0] == "ordb" and short_ok(parts[1]):
        return "back", None, parts[1]
    return None, None, None


def status_error_text(status_code, data):
    """Worker xatosini admin tushunadigan matnga aylantiradi."""
    err = str((data or {}).get("error") or "").strip()
    cur = (data or {}).get("currentStatus") or (data or {}).get("from")
    if status_code == 404 and not err:
        return ("Worker eski versiyada — /order-status topilmadi. "
                "cloudflare-worker.js ni Cloudflare'ga qayta joylang.")
    if status_code == 401 and ("initData" in err or "botAuth" in err):
        if "initData" in err:
            return ("Worker eski versiyada (bot imzosini tanimaydi). "
                    "cloudflare-worker.js ni Cloudflare'ga qayta joylang.")
        return f"Imzo rad etildi: {err}. BOT_TOKEN Worker va botda bir xilmi?"
    if "o'tishi mumkin emas" in err or "o'zgargan" in err or "mos emas" in err:
        label = STATUS_LABELS.get(str(cur), str(cur or "boshqa"))
        return f"Holat allaqachon o'zgargan (hozir: {label}). Kartochka yangilandi."
    if "bajarilmoqda" in err or (data or {}).get("retryable"):
        return "Boshqa o'zgarish bajarilmoqda — bir necha soniyadan keyin qayta bosing."
    if status_code == 0:
        return f"Worker'ga ulanib bo'lmadi: {err or 'tarmoq xatosi'}"
    return f"Bajarilmadi: {err or ('HTTP ' + str(status_code))}"


async def worker_post(worker_url, route, body, timeout=30):
    """`(http_status, data)`. Tarmoq xatosida `(0, {"error": ...})`."""
    import aiohttp  # faqat haqiqiy chaqiruvda kerak — sinovlar aiohttp'siz ishlaydi
    url = str(worker_url).rstrip("/") + "/" + route.lstrip("/")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=body,
                                    timeout=aiohttp.ClientTimeout(total=timeout)) as r:
                try:
                    data = await r.json(content_type=None)
                except Exception:
                    data = None
                return r.status, (data if isinstance(data, dict) else {})
    except Exception as e:
        logging.warning("Worker %s so'rovi xatosi: %s", route, e)
        return 0, {"error": str(e)[:200]}


async def worker_order_status(worker_url, bot_token, actor, uid, order_id, status,
                              expected_from="", post=None):
    """Holatni Worker orqali o'zgartiradi. `(ok, http_status, data)`."""
    uid, order_id, status = str(uid), str(order_id), str(status)
    expected_from = str(expected_from or "")
    body = {
        "uid": uid, "orderId": order_id, "status": status,
        "botAuth": bot_auth(bot_token, "order-status", actor,
                            [uid, order_id, status, expected_from]),
    }
    if expected_from:
        body["expectedFrom"] = expected_from
    code, data = await (post or worker_post)(worker_url, "/order-status", body)
    return bool(code == 200 and data.get("ok")), code, data


async def worker_order_notify(worker_url, bot_token, actor, outbox_key, post=None):
    body = {"outboxKey": str(outbox_key),
            "botAuth": bot_auth(bot_token, "order-notify", actor, [str(outbox_key)])}
    code, data = await (post or worker_post)(worker_url, "/order-notify", body)
    return bool(code == 200 and data.get("ok")), code, data


def outbox_keys_to_retry(raw, now_ms):
    """Watchdog qayta urishi kerak bo'lgan outbox kalitlari (vaqti eng oldin kelgani birinchi)."""
    if not isinstance(raw, dict):
        return []
    picked = []
    for key, ev in raw.items():
        if not isinstance(ev, dict) or ev.get("delivered") is True:
            continue
        if ev.get("type") not in ("order_created", "order_status"):
            continue
        try:
            retry_at = int(ev.get("retryAt") or 0)
            lease_until = int(ev.get("leaseUntil") or 0)
        except (TypeError, ValueError):
            continue
        if retry_at <= 0 or retry_at > now_ms or lease_until > now_ms:
            continue
        # ⚠️ Urinishlar soni / yoshi bo'yicha bu yerda FILTRLAMAYMIZ: voz kechishni
        #    Worker hal qiladi va `retryAt` ni o'chiradi. Bot o'zi o'tkazib yuborsa,
        #    yozuv `retryAt` bilan indeks boshida abadiy qolib, yangi xatolarni
        #    yashirardi.
        picked.append((retry_at, key))
    picked.sort()
    return [k for _, k in picked]
