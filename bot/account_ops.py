# =====================================================================
#  account_ops.py — YAGONA HISOB va STORIS JAVOBLARI (sof modul)
# ---------------------------------------------------------------------
#  Telegram ID — mijozning ASOSIY hisobi (Mini App, ilova, sayt). Bot bu
#  yerda uch ish qiladi:
#    1) Ilova/saytdan raqam bo'yicha kirish: Worker (/login-phone) mijozga
#       3 ta 2 xonali tugma yuboradi (`tgl:p:<nonce>:<raqam>`). Ekrandagi
#       raqam tanlansa `tg_login/<nonce>` yoziladi — ilova AYNAN shu Telegram
#       hisobiga kiradi. Noto'g'ri raqam yoki «Men emasman» — so'rov yopiladi.
#    2) Kontakt (raqam) ulashilsa va u foydalanuvchining O'Z raqami bo'lsa
#       (`contact.user_id == from_user.id`) — `phone_index/<raqam>` va
#       `users/<id>/verify` yoziladi (ilovada shu raqam bilan kirish uchun).
#    3) Storis javobi kartochkasidagi «✍️ Javob yozish» (`sra:<qisqa>`) —
#       admin javobi Worker (/story-answer) orqali mijozga boradi.
#  Hamma narsa SOF: tests/test_account_ops.py aiogram'siz sinaydi.
# =====================================================================

import re

from order_ops import bot_auth, worker_post

NONCE_RE = re.compile(r"^[0-9a-f]{32}$")
SHORT_RE = re.compile(r"^[0-9a-f]{20}$")
LOGIN_REQ_TTL_MS = 10 * 60 * 1000


def phone_digits(value):
    """Worker `phoneDigits` va ilova bilan bir xil: faqat raqamlar, 9 xonali -> 998..."""
    d = re.sub(r"\D", "", str(value or ""))
    if len(d) == 9:
        return "998" + d
    if 10 <= len(d) <= 15:
        return d
    return ""


def contact_is_own(contact_user_id, from_user_id):
    """Kontakt foydalanuvchining O'Z raqamimi? Boshqa odamning kontakt
    kartochkasini yuborish raqamni tasdiqlamaydi."""
    try:
        return contact_user_id is not None and int(contact_user_id) == int(from_user_id)
    except (TypeError, ValueError):
        return False


def verified_phone_updates(user_id, digits, now_ms, src="bot"):
    """BITTA root PATCH uchun yo'llar: raqam indeksi + users/{id}/verify."""
    uid = str(int(user_id))
    return {
        f"phone_index/{digits}": {"uid": uid, "at": int(now_ms), "src": src},
        f"users/{uid}/verify": {"phone": "+" + digits, "at": int(now_ms), "src": src},
    }


def parse_login_callback(data):
    """`tgl:` tugmalari: ("pick", nonce, raqam) | ("ok"|"no", nonce, None) | (None, None, None)."""
    parts = str(data or "").split(":")
    if (len(parts) == 4 and parts[0] == "tgl" and parts[1] == "p"
            and NONCE_RE.match(parts[2]) and re.fullmatch(r"[1-9]\d", parts[3])):
        return "pick", parts[2], parts[3]
    if len(parts) == 3 and parts[0] == "tgl" and parts[1] in ("ok", "no") and NONCE_RE.match(parts[2]):
        return parts[1], parts[2], None
    return None, None, None


def login_pick_decision(req, from_user_id, code, now_ms, ttl_ms=LOGIN_REQ_TTL_MS):
    """Telegram'dagi raqam tanlovi bo'yicha qaror: `(natija, yangi_holat)`.

    natija: "ok" | "bad" | "expired" | "missing" | "foreign" | "done".
    yangi_holat — `tg_login_req/<nonce>/state` ga yoziladigan qiymat
    (None — yozilmaydi). Bitta so'rov FAQAT bir marta hal qilinadi:
    noto'g'ri raqam tanlansa ham qayta tanlab bo'lmaydi (taxmin qilib
    topishning oldi olinadi).
    """
    if not isinstance(req, dict):
        return "missing", None
    if str(req.get("uid")) != str(from_user_id):
        return "foreign", None
    if str(req.get("state") or "") != "sent":
        return "done", None
    try:
        at = int(req.get("at") or 0)
    except (TypeError, ValueError):
        at = 0
    if at <= 0 or now_ms - at > ttl_ms:
        return "expired", "expired"
    if str(code) == str(req.get("code")):
        return "ok", "ok"
    return "bad", "bad"


def deny_decision(req, from_user_id):
    """«❌ Men emasman»: so'rovni yopish kerakmi? "no" | "missing" | "foreign" | "done"."""
    if not isinstance(req, dict):
        return "missing"
    if str(req.get("uid")) != str(from_user_id):
        return "foreign"
    if str(req.get("state") or "") != "sent":
        return "done"
    return "no"


LOGIN_RESULT_TEXTS = {
    "ok": "✅ <b>Kirish tasdiqlandi!</b>\n\nIlovaga qayting — u o'zi ochiladi.",
    "bad": ("⛔ <b>Noto'g'ri raqam tanlandi</b> — so'rov bekor qilindi.\n\n"
            "Bu siz bo'lsangiz, ilovada qaytadan urinib ko'ring. "
            "Siz bo'lmasangiz — hisobingiz xavfsiz, hech narsa qilish shart emas."),
    "expired": "⌛ So'rov eskirgan. Ilovada qaytadan urinib ko'ring.",
    "done": "Bu so'rov allaqachon yopilgan.",
    "missing": "So'rov topilmadi (eskirgan bo'lishi mumkin).",
    "no": ("❌ <b>Kirish rad etildi.</b>\n\n"
           "Hisobingiz xavfsiz. Kimdir raqamingizni so'rasa — hech kimga aytmang."),
}


def parse_story_callback(data):
    s = str(data or "")
    if s.startswith("sra:") and SHORT_RE.match(s[4:]):
        return s[4:]
    return None


async def worker_story_answer(worker_url, bot_token, actor, short, text, post=None):
    """Admin javobini Worker orqali mijozga yuboradi. `(ok, http_status, data)`."""
    body = {"short": str(short), "text": str(text),
            "botAuth": bot_auth(bot_token, "story-answer", actor, [str(short), str(text)])}
    code, data = await (post or worker_post)(worker_url, "/story-answer", body)
    return bool(code == 200 and data.get("ok")), code, data


def story_answer_error_text(status_code, data):
    err = str((data or {}).get("error") or "").strip()
    if status_code == 404 and err in ("", "topilmadi"):
        return ("Worker eski versiyada — /story-answer topilmadi. "
                "cloudflare-worker.js ni Cloudflare'ga qayta joylang.")
    if status_code == 404:
        return "Mijoz javobi topilmadi (o'chirilgan bo'lishi mumkin)."
    if status_code == 401:
        return f"Imzo rad etildi: {err or 'botAuth'}. BOT_TOKEN Worker va botda bir xilmi?"
    if status_code == 0:
        return f"Worker'ga ulanib bo'lmadi: {err or 'tarmoq xatosi'}"
    return f"Yuborilmadi: {err or ('HTTP ' + str(status_code))}"
