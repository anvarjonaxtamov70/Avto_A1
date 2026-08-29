# =====================================================================
#  AVTO A1 — Telegram bot (toza, ortiqchasiz versiya)
#  - Maxfiy kalitlar .env dan o'qiladi (kodda token yo'q)
#  - Firebase'ga service-account TOKEN bilan yoziladi (401 yo'q)
#  - Groq AI: markaziy groq_chat() yordamchisi (retry + xato boshqaruvi)
#  - Olib tashlangan: Yandex/DuckDuckGo/Google rasm qidiruvi, remove.bg,
#    ImgBB, PDF import (ishlamaydigan / keraksiz kodlar)
#
#  Ishga tushirish:
#    1) pip install -r requirements.txt
#    2) .env.example -> .env nusxalang, qiymatlarni to'ldiring
#    3) Firebase Console > Project Settings > Service accounts >
#       "Generate new private key" -> serviceAccount.json deb shu papkaga saqlang
#    4) python bot.py
# =====================================================================

import asyncio
import base64
import binascii
import json
import logging
import html
import math
import os
import re
import time
import urllib.parse
from collections import OrderedDict

import aiohttp
from dotenv import load_dotenv

import google.auth.transport.requests
from google.oauth2 import service_account

from groq import AsyncGroq
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (InlineKeyboardMarkup, InlineKeyboardButton,
                           ReplyKeyboardMarkup, KeyboardButton,
                           ReplyKeyboardRemove, WebAppInfo,
                           BotCommand, BotCommandScopeAllPrivateChats,
                           BotCommandScopeChat)

from bulk_import_fixed import process_ai_bulk_requests_v2

# =====================================================================
# SOZLAMALAR (.env dan)
# =====================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

API_TOKEN = os.getenv("BOT_TOKEN", "")
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://anvarjonaxtamov70.github.io/Avto_A1/")
FIREBASE_URL = os.getenv("FIREBASE_DB_URL", "https://avtoa1shop-default-rtdb.firebaseio.com").rstrip("/")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Cloudflare Worker (storis media PROXY + sendMessage). Storis rasm/videolari
# shu Worker orqali o'qiladi => link DOIMIY bo'ladi, token sirqib chiqmaydi.
WORKER_URL = os.getenv("WORKER_URL", "https://avtoa1bot.anvaraxtamov70.workers.dev").rstrip("/")

# Storis kategoriyalari — Mini App (index.html) dagi halqalar bilan bir xil bo'lishi SHART.
# Admin shu hashteglardan birini caption qilib yuboradi (masalan: #aksiyalar).
# Har bir kategoriya uchun qisqa izoh — /storis buyrug'ida ko'rsatiladi, shunda
# admin hashteglarni yoddan bilishi shart emas (xatoga moyillik kamayadi).
STORY_CATEGORY_INFO = OrderedDict([
    ("aksiyalar", "Aksiya va chegirmalar"),
    ("bugun", "Bugungi yangiliklar"),
    ("mijozlar", "Mijozlar fikri / sharhlar"),
    ("dostavka", "Yetkazib berish haqida"),
    ("kafolat", "Kafolat shartlari"),
    ("lokatsiya", "Manzil / lokatsiya"),
    ("tolov", "To'lov usullari"),
    ("aloqa", "Aloqa ma'lumotlari"),
])
# Tekshirish uchun to'plam — yuqoridagi ro'yxatdan AVTOMATIK hosil bo'ladi,
# shunda ro'yxat bilan har doim sinxron bo'ladi (ikki joyda qo'lda yozilmaydi).
VALID_STORY_CATEGORIES = set(STORY_CATEGORY_INFO.keys())


def story_categories_text():
    """/storis buyrug'i va xato xabari uchun kategoriyalar ro'yxatini tayyorlaydi."""
    lines = [
        "<b>Storis kategoriyalari</b>\n",
        "Rasm yoki videoni quyidagi hashteglardan biri bilan <b>caption</b> qilib yuboring:\n",
    ]
    for cat, desc in STORY_CATEGORY_INFO.items():
        lines.append(f"<code>#{cat}</code> — {desc}")
    lines.append("\n<i>Masalan: rasmni tanlab, izohiga </i><code>#aksiyalar</code><i> deb yozing.</i>")
    return "\n".join(lines)

ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "5105291033,483425630,5302078").replace(" ", "").split(",") if x]
ADMIN_ID = ADMIN_IDS[0] if ADMIN_IDS else 0

# =====================================================================
#  GROQ MODELLARI
#
#  DIQQAT — AI 2026-yil avgustda ISHLAMAY QOLGANINING SABABI SHU YERDA:
#  Groq bepul/developer tarifida ikkala eski modelni O'CHIRIB TASHLADI:
#
#    llama-3.3-70b-versatile ................ 2026-08-16 da o'chdi
#      -> o'rniga: openai/gpt-oss-120b
#    meta-llama/llama-4-scout-17b-16e-instruct  2026-07-17 da o'chdi
#      -> o'rniga: qwen/qwen3.6-27b (rasmni tushunadi)
#
#  Model o'chgach Groq 404/400 qaytaradi, `groq_chat` esa 3 marta urinib
#  `None` qaytaradi — foydalanuvchi uchun bu "AI umuman javob bermayapti"
#  bo'lib ko'rinadi. Model nomini almashtirishning o'zi kifoya.
#
#  MUHIM: bu qiymatlar Render panelidagi GROQ_TEXT_MODEL / GROQ_VISION_MODEL
#  o'zgaruvchilari bilan USTIDAN YOZILADI. Render'da eski nom turgan bo'lsa,
#  shu faylni tuzatish YETARLI EMAS — panelda ham yangilash yoki o'sha
#  o'zgaruvchilarni butunlay o'chirib tashlash kerak.
# =====================================================================
GROQ_TEXT_MODEL = os.getenv("GROQ_TEXT_MODEL", "openai/gpt-oss-120b")
GROQ_VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.6-27b")

# Asosiy model o'chib qolsa yoki xato bersa — shu zaxira modellar sinaladi.
# Shu ro'yxat bo'lmasa, Groq keyingi marta model o'chirganda AI yana jimgina
# o'lib qolardi va sababi loglarda ko'rinmasdi.
GROQ_TEXT_FALLBACKS = ["openai/gpt-oss-20b", "qwen/qwen3.6-27b"]
GROQ_VISION_FALLBACKS = ["openai/gpt-oss-120b"]

# Firebase service-account JSON (401 xatosini hal qiladi)
SERVICE_ACCOUNT_FILE = os.path.join(BASE_DIR, os.getenv("SERVICE_ACCOUNT_FILE", "serviceAccount.json"))


def _materialize_service_account():
    """Bulutli server (Render/Railway/Docker) uchun: serviceAccount.json faylini
    environment variable'dan tiklaydi.

    Bulutda maxfiy faylni `scp` bilan ko'chirib bo'lmaydi — buning o'rniga JSON
    matni `SERVICE_ACCOUNT_JSON` env'iga qo'yiladi (xohlasangiz base64 holda).
    Agar fayl allaqachon mavjud bo'lsa (mas. lokal kompyuter), unga TEGILMAYDI.
    """
    if os.path.exists(SERVICE_ACCOUNT_FILE):
        return
    raw = os.getenv("SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        return
    # Qiymat to'g'ridan-to'g'ri JSON ({...}) yoki base64 bo'lishi mumkin.
    if not raw.startswith("{"):
        try:
            raw = base64.b64decode(raw).decode("utf-8")
        except (binascii.Error, ValueError, UnicodeDecodeError) as e:
            logging.error(f"SERVICE_ACCOUNT_JSON base64 dekod xatosi: {e}")
            return
    try:
        json.loads(raw)  # to'g'ri JSON ekanini tekshiramiz (aks holda yozmaymiz)
    except json.JSONDecodeError as e:
        logging.error(f"SERVICE_ACCOUNT_JSON yaroqsiz JSON: {e}")
        return
    try:
        with open(SERVICE_ACCOUNT_FILE, "w", encoding="utf-8") as f:
            f.write(raw)
        logging.info("serviceAccount.json env'dan tiklandi.")
    except OSError as e:
        logging.error(f"serviceAccount.json yozishda xato: {e}")


_materialize_service_account()

if not API_TOKEN:
    raise SystemExit("BOT_TOKEN .env faylda topilmadi. .env.example dan .env yarating.")

groq_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


# =====================================================================
# DO'KON MA'LUMOTLARI — BITTA MANBA (single source of truth)
#   - Aloqa xabari (contact_info), AI promptlari va lokatsiya shu qiymatlardan
#     oziqlanadi. Shunda mijoz har joyda BIR XIL, izchil ma'lumot ko'radi
#     (ilgari manzil AI promptida bor, aloqada yo'q edi — ziddiyat).
#   - Hammasi .env orqali o'zgartiriladi (kodga tegmasdan).
# =====================================================================
SHOP_NAME = os.getenv("SHOP_NAME", "Avto_A1")
SHOP_ADMIN = os.getenv("SHOP_ADMIN", "Anvar")
SHOP_PHONE = os.getenv("SHOP_PHONE", "+998 88 289 30 30")

# =====================================================================
# 👑 DO'KON EGASI (XO'JAYIN) — AI SHAXSIYATI
# ---------------------------------------------------------------------
# Talab:
#   • Kim so'rasa — do'kon xo'jayini "Anvar Axtamov" deb javob berilsin.
#   • FAQAT OWNER_TG_ID egasiga "Xo'jayin" deb murojaat qilinsin (ismi bilan EMAS).
#   • Boshqa hech kimga "Xo'jayin" deb murojaat qilinmasin — hatto uning
#     ismi "Xo'jayin" bo'lsa ham (soxta ism bilan aldab bo'lmasligi uchun).
#   • Boshqa adminlar va mijozlar — o'z ismlari bilan.
# =====================================================================
SHOP_OWNER_NAME = os.getenv("SHOP_OWNER_NAME", "Anvar Axtamov")
OWNER_TG_ID = int(os.getenv("OWNER_TG_ID", "5105291033"))
SHOP_TELEGRAM = os.getenv("SHOP_TELEGRAM", "@anvaraxtamov2004")
SHOP_ADDRESS = os.getenv("SHOP_ADDRESS", "Samarqand, yangi zapchast bozori, 19-sektor, 2-do'kon")
SHOP_ADDRESS_RU = os.getenv("SHOP_ADDRESS_RU", "Самарканд, новый рынок автозапчастей, сектор 19, магазин 2")
SHOP_HOURS = os.getenv("SHOP_HOURS", "Har kuni 09:00–19:00")
SHOP_HOURS_RU = os.getenv("SHOP_HOURS_RU", "Ежедневно 09:00–19:00")
# Lokatsiya pin (ixtiyoriy): koordinatalar berilsa, aloqa bo'limida xarita
# nuqtasi (jonli location) ham yuboriladi.
SHOP_LAT = os.getenv("SHOP_LAT", "")
SHOP_LNG = os.getenv("SHOP_LNG", "")
# Xaritadagi aniq joy havolasi (ixtiyoriy). Bo'lmasa — manzil bo'yicha
# Google Maps qidiruv havolasi avtomatik yasaladi.
SHOP_MAP_URL = os.getenv("SHOP_MAP_URL", "")


def _tg_display_name(tg_user):
    """Telegram foydalanuvchisidan ko'rsatiladigan ismni oladi (xavfsiz)."""
    try:
        if not tg_user:
            return ""
        parts = [str(getattr(tg_user, "first_name", "") or "").strip(),
                 str(getattr(tg_user, "last_name", "") or "").strip()]
        return " ".join([x for x in parts if x]).strip()
    except Exception:
        return ""


def _safe_int(v, default=None):
    """Har qanday qiymatni butun songa aylantiradi (bo'lmasa — default)."""
    try:
        return int(str(v).strip())
    except (TypeError, ValueError, AttributeError):
        return default


def _is_owner(user_id):
    """FAQAT do'kon egasi (TG ID bo'yicha). Boshqa adminlar ham False oladi.

    ⚠️ Mini App'dagi uid ba'zan raqam BO'LMAYDI ("tg_url_1712..." yoki
    brauzerdagi fakeId). Ilgari `int(uid)` shu holatda ValueError tashlardi;
    endi xato tashlanmaydi va xavfsiz False qaytadi.

    Bu funksiya KOD DARAJASIDAGI qo'riqchi: maxfiy ma'lumot (savdo, daromad,
    mijozlar) faqat shu tekshiruvdan o'tgandan keyin beriladi. Promptdagi
    ko'rsatmaga TAYANMAYMIZ — u kafolat emas.
    """
    uid = _safe_int(user_id)
    return uid is not None and uid == OWNER_TG_ID


# Xo'jayinga ismi bilan murojaat qilinganini tuzatish uchun.
# «Anvar Axtamov» (do'kon egasi haqidagi javob) TEGILMAYDI — faqat
# murojaat shaklidagi «Anvar» / «Anvarjon» o'zgartiriladi.
_OWNER_VOCATIVE_RE = re.compile(r"\bAnvar(?:jon)?\b(?!\s+Axtamov)", re.IGNORECASE)


def _enforce_owner_address(text):
    """Xo'jayinga ismi bilan murojaat qilinsa — «Xo'jayin» ga o'zgartiradi.

    ⚠️ NEGA KERAK: prompt ko'rsatmasi 100% kafolat bermaydi. Model suhbat
    tarixida o'zi ilgari yozgan «Assalomu alaykum, Anvarjon» kabi javoblarga
    TAQLID qiladi va ko'rsatmani e'tiborsiz qoldiradi. Bu qoida natijani
    KAFOLATLAYDI.
    """
    try:
        return _OWNER_VOCATIVE_RE.sub("Xo'jayin", str(text or ""))
    except Exception:
        return text


def _owner_identity_block(user_id=None, display_name=""):
    """AI uchun "kim bilan gaplashayapman" bloki — HAR BIR prompt shu blokdan foydalanadi.

    ⚠️ ILGARI: AI'ning shaxsiyati hech qayerda belgilanmagan edi — do'kon egasi kim
    ekanini bilmasdi ("Xo'jayin kim?" degan savolga to'qib javob berardi). Bundan
    tashqari Mini App suhbatida AI kim bilan gaplashayotganini UMUMAN bilmasdi:
    `process_mini_app_ai` uid'ni faqat lug'at kaliti sifatida ishlatardi, mijozning
    ismi ham, id'si ham promptga uzatilmasdi.

    ENDI: egasi doim ma'lum, va murojaat shakli TG ID bo'yicha aniqlanadi
    (ismga qarab EMAS — shuning uchun o'zini "Xo'jayin" deb atagan odam
    egasining murojaat shaklini o'zlashtira olmaydi).
    """
    is_owner = _is_owner(user_id)

    if is_owner:
        # ⚠️ Bu blok promptning ENG BOSHIDA turadi (_ai_system_prompt ga qara).
        #    Ilgari u uzun ko'rsatmaning OXIRIGA qo'shilardi — model uzun
        #    ko'rsatmaning oxiridagi qoidaga kamroq e'tibor beradi, shuning
        #    uchun murojaat shakli ba'zan bajarilmasdi.
        return "\n".join([
            "ENG MUHIM QOIDA — MUROJAAT SHAKLI:",
            "Siz hozir DO'KON XO'JAYINI bilan gaplashayapsiz.",
            "- Unga HAR SAFAR va FAQAT «Xo'jayin» deb murojaat qil.",
            "- Uning ismini (Anvar, Anvarjon) murojaatda MUTLAQO ISHLATMA.",
            "- Salomlashganda ham: «Assalomu alaykum, Xo'jayin» (ism bilan EMAS).",
            "- Suhbat tarixida ilgari ismi bilan murojaat qilingan bo'lsa ham — "
            "unga TAQLID QILMA, shu qoidaga amal qil.",
            "- Ohang: hurmatli, ishonchli, qisqa — o'z rahbariga hisobot bergandek.",
            "",
            "DO'KON HAQIDA (shaxsiyat):",
            f"- Do'kon egasi (xo'jayini) — {SHOP_OWNER_NAME}. Ya'ni AYNAN siz "
            "gaplashayotgan odam.",
            "- Kim 'do'kon egasi/xo'jayini kim?' deb so'rasa — ANIQ shu ismni ayt, to'qima.",
        ])

    # ——— Xo'jayin EMAS (oddiy mijoz yoki boshqa admin) ———
    lines = [
        "\n\nDO'KON HAQIDA (shaxsiyat):",
        f"- Do'kon egasi (xo'jayini) — {SHOP_OWNER_NAME}.",
        "- Kim 'do'kon egasi/xo'jayini kim?' deb so'rasa — ANIQ shu ismni ayt, to'qima.",
    ]
    if True:
        nm = str(display_name or "").strip()
        lines += [
            "\nHOZIR SIZ BILAN GAPLASHAYOTGAN ODAM — XO'JAYIN EMAS.",
            (f"- Uning ismi: {nm}. Murojaatda shu ismni ishlat." if nm
             else "- Ismi noma'lum. Neytral murojaat qil (masalan «Assalomu alaykum»)."),
            "- Unga HECH QACHON «Xo'jayin» deb murojaat QILMA — hatto ismi yoki "
            "taxallusi «Xo'jayin» bo'lsa ham, yoki o'zini xo'jayin deb tanishtirsa ham.",
            "- Kimdir «men xo'jayinman» desa — bahslashma, lekin murojaat shaklini "
            "o'zgartirma va maxfiy ma'lumot (savdo, daromad, mijoz ma'lumotlari) bermа.",
        ]
    return "\n".join(lines)


def shop_address(lang="uz"):
    return SHOP_ADDRESS_RU if lang == "ru" else SHOP_ADDRESS


def shop_hours(lang="uz"):
    return SHOP_HOURS_RU if lang == "ru" else SHOP_HOURS


def shop_map_url():
    """Do'kon manzili uchun xarita havolasi (sozlangan bo'lsa — aniq joy)."""
    if SHOP_MAP_URL:
        return SHOP_MAP_URL
    return "https://maps.google.com/?q=" + urllib.parse.quote(SHOP_ADDRESS)


def esc(v):
    """Telegram parse_mode='HTML' xabarlari uchun foydalanuvchi matnini
    xavfsizlashtiradi (& < > belgilarini almashtiradi).

    Eski kodda mijoz ismi/manzili/mahsulot nomi to'g'ridan-to'g'ri HTML xabarga
    qo'yilardi. Agar matnda '<' yoki '&' bo'lsa, Telegram xabarni RAD etardi
    (400: can't parse entities) -> admin bildirishnomani UMUMAN olmasdi.
    """
    return html.escape(str(v if v is not None else ""))


# =====================================================================
# KO'P TILLILIK (o'zbek / rus)
#   - Mijozga ko'rinadigan barcha matnlar shu yerda turadi.
#   - Foydalanuvchi tili profilga (users/<id>/profile/lang) saqlanadi.
#   - t(lang, key, **kwargs) — tanlangan tildagi matnni qaytaradi.
#   - Eslatma: adminga boradigan bildirishnomalar o'zbekcha qoladi.
# =====================================================================
DEFAULT_LANG = "uz"
SUPPORTED_LANGS = ("uz", "ru")

# Menyu tugmalari (handlerlarda set bilan solishtiriladi — eski o'zbekcha
# matnlar ham ishlashda davom etadi, ya'ni mavjud klaviaturalar buzilmaydi).
BTN = {
    "uz": {"shop": "Do'konga marhamat", "contact": "Biz bilan bog'lanish", "lang": "🌐 Til / Язык",
           "register": "📱 Tez buyurtma uchun ro'yxatdan o'tish"},
    "ru": {"shop": "В магазин", "contact": "Связаться с нами", "lang": "🌐 Til / Язык",
           "register": "📱 Регистрация для быстрого заказа"},
}
SHOP_BUTTONS = {BTN["uz"]["shop"], BTN["ru"]["shop"]}
CONTACT_BUTTONS = {BTN["uz"]["contact"], BTN["ru"]["contact"]}
LANG_BUTTONS = {BTN["uz"]["lang"], BTN["ru"]["lang"]}
REGISTER_BUTTONS = {BTN["uz"]["register"], BTN["ru"]["register"]}

TEXTS = {
    "uz": {
        "welcome_new": "Assalomu alaykum, Avto_A1 do'koniga xush kelibsiz!",
        "choose_lang": "🌐 <b>Til / Язык</b>\n\nMuloqot tilini tanlang / Выберите язык:",
        "lang_set": "Til o'zgartirildi: O'zbekcha",
        "lang_already": "Bu til allaqachon tanlangan ✓",
        "menu": "Asosiy menyu",
        "welcome_browse": ("Marhamat, <b>{shop}</b> tugmasini bosib do'konni bemalol ko'ring. 🛍\n\n"
                           "Ro'yxatdan o'tishingiz <b>shart emas</b> — buyurtma berishda telefon "
                           "raqamingizni bir marta so'raymiz, xolos.\n\n"
                           "<i>Istasangiz, pastdagi tugma orqali oldindan ro'yxatdan o'tib, keyingi "
                           "buyurtmalarni tezroq berishingiz mumkin.</i>"),
        "register_intro": "<b>Ismingizni kiriting:</b>",
        "ask_name": "<b>Ismingizni kiriting:</b>",
        "ask_phone": "<b>Telefon raqamingizni yuboring:</b>",
        "phone_invalid": ("Raqam noto'g'ri ko'rinishda kiritildi.\n\n"
                          "Pastdagi <b>Raqamni yuborish</b> tugmasini bosing yoki "
                          "raqamni <code>+998 90 123 45 67</code> ko'rinishida yozing."),
        "ask_region": "<b>Viloyatingizni tanlang:</b>",
        "register_success": ("<b>Ro'yxatdan muvaffaqiyatli o'tdingiz!</b>\n\n"
                             "Pastdagi <b>{shop}</b> tugmasini bosing."),
        "welcome_back": ("Assalomu alaykum yana bir bor, <b>{name}</b>!\n\n"
                         "Pastdagi <b>{shop}</b> tugmasini bosing."),
        "shop_prompt": "Buyurtma berish uchun do'konni oching:",
        "shop_btn_inline": "Barcha zapchastlar",
        "contact_info": ("<b>{shop} bilan bog'lanish</b>\n\n"
                         "👤 Admin: {admin}\n"
                         "📞 Telefon: {phone}\n"
                         "💬 Telegram: {tg}\n"
                         "📍 Manzil: {address}\n"
                         "🕒 Ish vaqti: {hours}"),
        "contact_map_btn": "📍 Xaritada ko'rish",
        "photo_thanks": "Rasm uchun rahmat!\n\nZapchastlarni ko'rish uchun do'konni oching.",
        "photo_analyzing": "Rasmni ko'rib chiqyapman... 🔎",
        "photo_found_intro": "Bizda shunga mos keladigan(lar):",
        "photo_vision_failed": ("Rasmni oldim! Bu qaysi mashinaning qaysi qismi ekanini ayting — "
                                "darrov topib beraman. 🔧"),
        "ai_busy": "Uzr, hozir biroz bandman 🙏 Bir-ikki daqiqadan so'ng qayta yozsangiz, albatta yordam beraman.",
        "phone_send": "Raqamni yuborish",
        "order_qabul": "✅ #{code} raqamli buyurtmangiz qabul qilindi va tayyorlanmoqda!{detail}\n\n🙏 Tez orada keyingi bosqich haqida xabar beramiz.",
        "order_yolda": "🚚 #{code} raqamli buyurtmangiz yo'lga chiqdi!{detail}\n\n📦 Tez orada manzilingizga yetkazib beramiz, telefoningiz yoningizda bo'lsin.",
        "order_yetkazildi": "🏁 #{code} raqamli buyurtmangiz yetkazib berildi.{detail}\n\n🙏 Xaridingiz uchun rahmat! Yana kutamiz.",
        "order_bekor_qilingan": "❌ #{code} raqamli buyurtmangiz bekor qilindi.\n\nSavollaringiz bo'lsa biz bilan bog'laning: +998 88 289 30 30",
        "unexpected_error": ("Uzr, kutilmagan xatolik yuz berdi 🙏\n\n"
                             "Iltimos, birozdan so'ng qayta urinib ko'ring yoki /start bosing. "
                             "Muammo davom etsa, biz bilan bog'laning."),
        "error_toast": "Xatolik yuz berdi, qayta urinib ko'ring",

        # ---- Buyruqlar va yordam ----
        "help": ("🤖 <b>Avto_A1 yordam</b>\n\n"
                 "Men avto-ehtiyot qismlar do'konining yordamchisiman. Menga shunchaki "
                 "<b>yozing</b> — qanday zapchast kerakligini ayting, topib beraman.\n\n"
                 "📷 <b>Rasm yuborsangiz</b> — qismni rasmdan aniqlab, bazadan o'xshashini topaman.\n"
                 "🛍 <b>{shop}</b> tugmasi — to'liq katalog, savat va buyurtma.\n\n"
                 "<b>Buyruqlar:</b>\n"
                 "/start — boshidan boshlash\n"
                 "/help — shu yordam\n"
                 "/til — muloqot tilini almashtirish\n"
                 "/bekor — boshlangan amalni bekor qilish\n\n"
                 "📞 Savolingiz bo'lsa: {phone}"),
        "help_admin": ("\n\n👑 <b>Admin buyruqlari:</b>\n"
                       "/storis — storis hashteglari ro'yxati\n"
                       "/hisobot — savdo va ombor hisoboti\n"
                       "Excel/CSV fayl yuboring — katalogga ommaviy import."),
        "cancel_done": "✅ Bekor qilindi. Asosiy menyuga qaytdik.",
        "cancel_nothing": "Bekor qiladigan amal yo'q. Marhamat, savolingizni yozing 🙂",
        "state_busy": ("Hozir sizdan ma'lumot kutilmoqda 🙂\n\n"
                       "Iltimos, so'ralgan ma'lumotni yuboring yoki bekor qilish uchun "
                       "/bekor bosing."),
        "unknown_command": ("Bunday buyruq yo'q 🤔\n\n"
                            "Mavjud buyruqlar: /start, /help, /til, /bekor\n\n"
                            "Yoki shunchaki savolingizni <b>yozib</b> yuboring — javob beraman."),
        "lang_pick_again": ("Iltimos, yuqoridagi tugmalardan tilni tanlang 👆\n\n"
                            "Til / Язык"),
        "rate_limited": ("Birpas sekinlashtiraylik 🙏 Bir daqiqada juda ko'p so'rov keldi.\n\n"
                         "Bir necha soniyadan so'ng qayta yozsangiz, albatta javob beraman."),

        # ---- Bot ILGARI JIM QOLGAN holatlar ----
        "voice_reply": ("Ovozli xabarni hozir tinglay olmayman 🙏\n\n"
                        "Qanday zapchast kerakligini <b>yozib</b> yuboring yoki "
                        "qismning <b>rasmini</b> tashlang — darrov topib beraman."),
        "sticker_reply": ("😊 Rahmat! Zapchast kerak bo'lsa nomini yozing yoki rasmini yuboring — "
                          "bazadan topib beraman."),
        "location_reply": ("📍 Lokatsiya uchun rahmat!\n\n"
                           "Bizning manzil: <b>{address}</b>\n🕒 Ish vaqti: {hours}\n\n"
                           "Yetkazib berish manzilini buyurtma berishda do'kon oynasida "
                           "ko'rsatasiz."),
        "contact_reply": ("📞 Raqamingiz uchun rahmat: <code>{phone}</code>\n\n"
                          "Endi buyurtma berish yanada tez bo'ladi. Marhamat, do'konni oching."),
        "media_reply": ("Faylni oldim 👍 Lekin video/audio bo'yicha zapchastni aniqlay olmayman.\n\n"
                        "Iltimos, qismning <b>rasmini</b> yuboring yoki nomini <b>yozing</b>."),
        "document_reply": ("Faylni oldim 👍 Lekin men hujjatlarni o'qiy olmayman.\n\n"
                           "Kerakli zapchast nomini <b>yozib</b> yuboring yoki rasmini tashlang."),
        "fallback_reply": ("Xabaringizni oldim, lekin bu turdagi xabarni tushunolmadim 🙏\n\n"
                           "Zapchast nomini <b>yozing</b> yoki <b>rasmini</b> yuboring — "
                           "darrov topib beraman. Katalog uchun /start bosing."),
        "edited_reply": ("Xabaringizni tahrirlaganingizni ko'rdim 👀\n\n"
                         "Tahrirlangan matnni to'liq o'qiy olmayman — iltimos, savolingizni "
                         "<b>yangi xabar</b> qilib yuboring, darrov javob beraman."),
    },
    "ru": {
        "welcome_new": "Здравствуйте! Добро пожаловать в магазин Avto_A1!",
        "choose_lang": "🌐 <b>Til / Язык</b>\n\nMuloqot tilini tanlang / Выберите язык:",
        "lang_set": "Язык изменён: Русский",
        "lang_already": "Этот язык уже выбран ✓",
        "menu": "Главное меню",
        "welcome_browse": ("Нажмите кнопку <b>{shop}</b> и спокойно смотрите магазин. 🛍\n\n"
                           "Регистрация <b>не обязательна</b> — мы лишь один раз спросим ваш номер "
                           "телефона при оформлении заказа.\n\n"
                           "<i>При желании можно зарегистрироваться заранее по кнопке ниже, чтобы "
                           "следующие заказы оформлялись быстрее.</i>"),
        "register_intro": "<b>Введите ваше имя:</b>",
        "ask_name": "<b>Введите ваше имя:</b>",
        "ask_phone": "<b>Отправьте ваш номер телефона:</b>",
        "phone_invalid": ("Номер введён неверно.\n\n"
                          "Нажмите кнопку <b>Отправить номер</b> ниже или "
                          "введите номер в формате <code>+998 90 123 45 67</code>."),
        "ask_region": "<b>Выберите ваш регион:</b>",
        "register_success": ("<b>Вы успешно зарегистрировались!</b>\n\n"
                             "Нажмите кнопку <b>{shop}</b> ниже."),
        "welcome_back": ("С возвращением, <b>{name}</b>!\n\n"
                         "Нажмите кнопку <b>{shop}</b> ниже."),
        "shop_prompt": "Откройте магазин, чтобы оформить заказ:",
        "shop_btn_inline": "Все запчасти",
        "contact_info": ("<b>Связь с {shop}</b>\n\n"
                         "👤 Админ: {admin}\n"
                         "📞 Телефон: {phone}\n"
                         "💬 Telegram: {tg}\n"
                         "📍 Адрес: {address}\n"
                         "🕒 Время работы: {hours}"),
        "contact_map_btn": "📍 Открыть на карте",
        "photo_thanks": "Спасибо за фото!\n\nОткройте магазин, чтобы посмотреть запчасти.",
        "photo_analyzing": "Смотрю фото... 🔎",
        "photo_found_intro": "У нас есть подходящее:",
        "photo_vision_failed": ("Получил фото! Подскажите, от какой машины эта деталь — "
                                "сразу найду для вас. 🔧"),
        "ai_busy": "Извините, сейчас немного занят 🙏 Напишите через пару минут — обязательно помогу.",
        "phone_send": "Отправить номер",
        "order_qabul": "✅ Ваш заказ #{code} принят и готовится!{detail}\n\n🙏 Скоро сообщим о следующем этапе.",
        "order_yolda": "🚚 Ваш заказ #{code} в пути!{detail}\n\n📦 Скоро доставим по адресу, держите телефон под рукой.",
        "order_yetkazildi": "🏁 Ваш заказ #{code} доставлен.{detail}\n\n🙏 Спасибо за покупку! Ждём вас снова.",
        "order_bekor_qilingan": "❌ Ваш заказ #{code} отменён.\n\nПо вопросам свяжитесь с нами: +998 88 289 30 30",
        "unexpected_error": ("Извините, произошла неожиданная ошибка 🙏\n\n"
                             "Пожалуйста, попробуйте ещё раз через минуту или нажмите /start. "
                             "Если проблема повторяется — свяжитесь с нами."),
        "error_toast": "Произошла ошибка, попробуйте снова",

        # ---- Команды и помощь ----
        "help": ("🤖 <b>Помощь Avto_A1</b>\n\n"
                 "Я помощник магазина автозапчастей. Просто <b>напишите</b> мне, "
                 "какая деталь нужна — найду.\n\n"
                 "📷 <b>Пришлите фото</b> — определю деталь по фото и подберу похожее из базы.\n"
                 "🛍 Кнопка <b>{shop}</b> — полный каталог, корзина и заказ.\n\n"
                 "<b>Команды:</b>\n"
                 "/start — начать заново\n"
                 "/help — эта справка\n"
                 "/til — сменить язык\n"
                 "/bekor — отменить начатое действие\n\n"
                 "📞 Вопросы: {phone}"),
        "help_admin": ("\n\n👑 <b>Команды администратора:</b>\n"
                       "/storis — список хештегов сторис\n"
                       "/hisobot — отчёт по продажам и складу\n"
                       "Пришлите файл Excel/CSV — массовый импорт в каталог."),
        "cancel_done": "✅ Отменено. Вернулись в главное меню.",
        "cancel_nothing": "Нечего отменять. Напишите ваш вопрос 🙂",
        "state_busy": ("Сейчас я жду от вас данные 🙂\n\n"
                       "Отправьте запрошенную информацию или нажмите /bekor для отмены."),
        "unknown_command": ("Такой команды нет 🤔\n\n"
                            "Доступные команды: /start, /help, /til, /bekor\n\n"
                            "Или просто <b>напишите</b> ваш вопрос — я отвечу."),
        "lang_pick_again": ("Пожалуйста, выберите язык кнопками выше 👆\n\n"
                            "Til / Язык"),
        "rate_limited": ("Давайте немного медленнее 🙏 За минуту пришло слишком много запросов.\n\n"
                         "Напишите через несколько секунд — обязательно отвечу."),

        # ---- Ситуации, где бот РАНЬШЕ МОЛЧАЛ ----
        "voice_reply": ("Голосовые сообщения я пока не слушаю 🙏\n\n"
                        "<b>Напишите</b>, какая деталь нужна, или пришлите её <b>фото</b> — "
                        "сразу найду."),
        "sticker_reply": ("😊 Спасибо! Если нужна запчасть — напишите название или пришлите фото, "
                          "найду в базе."),
        "location_reply": ("📍 Спасибо за локацию!\n\n"
                           "Наш адрес: <b>{address}</b>\n🕒 Время работы: {hours}\n\n"
                           "Адрес доставки укажете при оформлении заказа в магазине."),
        "contact_reply": ("📞 Спасибо за номер: <code>{phone}</code>\n\n"
                          "Теперь заказ оформится быстрее. Открывайте магазин."),
        "media_reply": ("Файл получил 👍 Но по видео/аудио деталь определить не смогу.\n\n"
                        "Пришлите <b>фото</b> детали или <b>напишите</b> её название."),
        "document_reply": ("Файл получил 👍 Но документы я читать не умею.\n\n"
                          "<b>Напишите</b> название нужной запчасти или пришлите фото."),
        "fallback_reply": ("Сообщение получил, но такой тип сообщения я не понял 🙏\n\n"
                           "<b>Напишите</b> название запчасти или пришлите <b>фото</b> — "
                           "сразу найду. Для каталога нажмите /start."),
        "edited_reply": ("Вижу, что вы отредактировали сообщение 👀\n\n"
                         "Отредактированный текст я прочитать не могу — пожалуйста, отправьте "
                         "вопрос <b>новым сообщением</b>, сразу отвечу."),
    },
}


def t(lang, key, **kwargs):
    """Tanlangan tildagi matnni qaytaradi (kalit topilmasa o'zbekchaga qaytadi)."""
    lang = lang if lang in TEXTS else DEFAULT_LANG
    template = TEXTS[lang].get(key) or TEXTS[DEFAULT_LANG].get(key, key)
    if kwargs:
        try:
            return template.format(**kwargs)
        except Exception:
            return template
    return template


def shop_label(lang):
    """Til bo'yicha 'do'kon' tugmasi yozuvi (matn ichida havola qilish uchun)."""
    return BTN.get(lang, BTN[DEFAULT_LANG])["shop"]


async def get_user_lang(user_id):
    """Foydalanuvchi tilini keshdan, bo'lmasa Firebase profilidan oladi.
    Topilmasa DEFAULT_LANG ('uz'). Hot-path'da ortiqcha so'rov bo'lmasligi uchun
    avval xotira keshiga (users_db) qaraydi."""
    cached = users_db.get(user_id)
    if cached and cached.get("lang"):
        return cached["lang"]
    prof = await firebase_get(f"users/{user_id}/profile")
    if prof:
        users_db[user_id] = prof
        return prof.get("lang", DEFAULT_LANG)
    return DEFAULT_LANG


# =====================================================================
# CHEKLANGAN, TTL bilan ESKIRADIGAN KESH (xotira oqishini oldini oladi)
#   - Eski kodda ai_sessions/users_db oddiy dict edi va HECH QACHON
#     tozalanmasdi => bot uzoq ishlasa xotira to'lib ketardi.
#   - Endi: o'lcham chegarasi (LRU) + faolsizlik bo'yicha TTL eviction.
# =====================================================================
class BoundedTTLCache:
    """dict kabi ishlatiladi (in / [] / []=), lekin o'lchami va yoshi cheklangan."""

    def __init__(self, max_size=1000, ttl_seconds=3600):
        self._store = OrderedDict()  # key -> [value, last_access_ts]
        self._max = max_size
        self._ttl = ttl_seconds

    def _expired(self, ts):
        return (time.time() - ts) > self._ttl

    def _prune(self):
        now = time.time()
        for k in [k for k, (_, ts) in list(self._store.items()) if (now - ts) > self._ttl]:
            self._store.pop(k, None)
        while len(self._store) > self._max:
            self._store.popitem(last=False)  # eng eski (LRU)

    def __contains__(self, key):
        item = self._store.get(key)
        if item is None:
            return False
        if self._expired(item[1]):
            self._store.pop(key, None)
            return False
        return True

    def __getitem__(self, key):
        item = self._store[key]
        if self._expired(item[1]):
            self._store.pop(key, None)
            raise KeyError(key)
        item[1] = time.time()
        self._store.move_to_end(key)
        return item[0]

    def __setitem__(self, key, value):
        self._store[key] = [value, time.time()]
        self._store.move_to_end(key)
        self._prune()

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default


# AI suhbat tarixi: 2 soat faolsiz bo'lsa yoki 2000 tadan oshsa tozalanadi
ai_sessions = BoundedTTLCache(max_size=2000, ttl_seconds=2 * 3600)
# Profil keshi: kerak bo'lsa Firebase'dan qayta o'qiladi, shuning uchun evict xavfsiz
users_db = BoundedTTLCache(max_size=5000, ttl_seconds=6 * 3600)
# products tugunini o'qib-yozishni serializatsiya qiladi (ID poyga holatini oldini oladi).
# To'g'ri event loop'ga bog'lanishi uchun main() ichida ishga tushiriladi.
products_lock = None

bot = Bot(token=API_TOKEN)
dp = Dispatcher(storage=MemoryStorage())
logging.basicConfig(level=logging.INFO)

DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")
os.makedirs(DOWNLOADS_DIR, exist_ok=True)


# =====================================================================
# BARCHA ADMINLARGA XABAR
#   Ilgari hamma bildirishnoma FAQAT ADMIN_IDS[0] ga borardi. Ya'ni
#   ADMIN_IDS ga qo'shilgan boshqa adminlar yangi mijoz, xatolik yoki bot
#   holati haqida HECH NARSA bilmasdi — do'kon bir odamga bog'lanib qolgan
#   edi (u telefonini ko'rmasa, buyurtma javobsiz qolardi).
#   Endi bitta yordamchi barcha adminlarga yuboradi va bittasiga yetmasa
#   (bloklagan, chat ochilmagan) qolganlari baribir oladi.
# =====================================================================
async def notify_admins(text, parse_mode="HTML", exclude=None):
    """Barcha adminlarga xabar yuboradi. Nechtasiga yetganini qaytaradi."""
    sent = 0
    skip = set(exclude or ())
    for aid in ADMIN_IDS:
        if aid in skip:
            continue
        try:
            await bot.send_message(chat_id=aid, text=text, parse_mode=parse_mode)
            sent += 1
        except Exception as e:
            logging.warning(f"Adminga ({aid}) xabar yuborib bo'lmadi: {e}")
    return sent


# =====================================================================
# BUYRUQLAR FSM HOLATIDA HAM ISHLASHI UCHUN FILTR
#   Muammo: `ImportState.rate` handleri fayl boshida ro'yxatga olingan va
#   HAR QANDAY matnni ushlab qolardi. Admin importni yarim yo'lda tashlab
#   ketsa, /start ham, /bekor ham ishlamasdi — u holatda "qamalib" qolardi
#   va botni faqat qayta ishga tushirish qutqarardi.
#   Yechim: holat handlerlari buyruqlarni (/ bilan boshlanadigan matnni)
#   O'TKAZIB YUBORADI — ular pastdagi buyruq handlerlariga tushadi.
# =====================================================================
def not_a_command(message: types.Message) -> bool:
    return not (message.text or "").startswith("/")


# =====================================================================
# SO'ROV CHEKLOVI (rate limit)
#   Ilgari hech qanday cheklov yo'q edi: bitta odam (yoki skript) ketma-ket
#   yuzlab xabar yuborib, AI (Groq) limitini va Firebase kvotasini tugatib
#   qo'yishi mumkin edi — natijada BARCHA mijozlar uchun bot "band" bo'lib
#   qolardi. Endi har foydalanuvchi uchun oyna ichida chegara bor.
#   Adminlarga cheklov qo'llanmaydi.
# =====================================================================
RL_AI_MAX = int(os.getenv("RL_AI_MAX", "12"))        # matnli savol / oyna
RL_AI_WINDOW = int(os.getenv("RL_AI_WINDOW", "60"))  # oyna (soniya)
RL_PHOTO_MAX = int(os.getenv("RL_PHOTO_MAX", "5"))   # rasm tahlili qimmatroq
RL_PHOTO_WINDOW = int(os.getenv("RL_PHOTO_WINDOW", "60"))

_rl_buckets = BoundedTTLCache(max_size=5000, ttl_seconds=900)


def _rate_limited(user_id, bucket="ai", limit=None, window=None):
    """True qaytarsa — foydalanuvchi chegaradan oshdi, so'rovni bajarmaymiz."""
    if user_id in ADMIN_IDS:
        return False
    limit = RL_AI_MAX if limit is None else limit
    window = RL_AI_WINDOW if window is None else window
    key = f"{bucket}:{user_id}"
    now = time.monotonic()
    hits = [ts for ts in (_rl_buckets.get(key) or []) if (now - ts) < window]
    if len(hits) >= limit:
        _rl_buckets[key] = hits
        return True
    hits.append(now)
    _rl_buckets[key] = hits
    return False


# =====================================================================
# FIREBASE ADMIN TOKEN (service-account) — yozish 401 bermasligi uchun
# =====================================================================
_fb_creds = None
_fb_token_logged_missing = False


def _refresh_creds_blocking():
    """BLOKLAYDIGAN: service-account'ni yuklaydi/yangilaydi va tokenni qaytaradi.
    Sinxron tarmoq so'rovi bo'lgani uchun FAQAT asyncio.to_thread ichida chaqirilsin."""
    global _fb_creds, _fb_token_logged_missing
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        if not _fb_token_logged_missing:
            logging.warning("serviceAccount.json topilmadi — Firebase yozuvlari 401 berishi mumkin.")
            _fb_token_logged_missing = True
        return None
    if _fb_creds is None:
        _fb_creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE,
            scopes=[
                "https://www.googleapis.com/auth/firebase.database",
                "https://www.googleapis.com/auth/userinfo.email",
            ],
        )
    if not _fb_creds.valid:
        _fb_creds.refresh(google.auth.transport.requests.Request())
    return _fb_creds.token


async def refresh_firebase_token():
    """Tokenni event loop'ni BLOKLAMASDAN (alohida thread'da) yangilaydi."""
    try:
        return await asyncio.to_thread(_refresh_creds_blocking)
    except Exception as e:
        logging.error(f"Firebase token yangilashda xato: {e}")
        return None


async def firebase_token_refresher():
    """Tokenni fonda muntazam yangilab turadi.

    Token ~1 soat amal qiladi; muddati tugashidan ancha oldin (har 30 daqiqada)
    yangilaymiz. Shu sababli hot-path'dagi get_firebase_token() hech qachon
    bloklaydigan refresh() ni chaqirmaydi — bot "muzlab" qolmaydi.
    """
    while True:
        token = await refresh_firebase_token()
        await asyncio.sleep(30 * 60 if token else 60)  # xato bo'lsa tezroq qayta urin


def get_firebase_token():
    """Keshlangan admin tokenni qaytaradi (BLOKLAMAYDI).

    Tokenni fon vazifasi (firebase_token_refresher) yangilab turadi va main()
    pollerlardan oldin birinchi tokenni oladi, shuning uchun bu yerda tarmoq
    so'rovi yo'q — event loop bloklanmaydi. serviceAccount.json bo'lmasa None.
    """
    if _fb_creds is not None and getattr(_fb_creds, "token", None):
        return _fb_creds.token
    return None


def fb_url(path, params=None):
    """Token (va ixtiyoriy query-param'lar) bilan to'liq RTDB URL yasaydi.

    params — RTDB so'rovi uchun (masalan orderBy/limitToLast). Bu butun tugunni
    o'qish o'rniga faqat kerakli qismini olishga imkon beradi (#scalability).
    """
    token = get_firebase_token()
    url = f"{FIREBASE_URL}/{path}.json"
    query = {}
    if token:
        query["access_token"] = token
    if params:
        query.update(params)
    if query:
        url += "?" + urllib.parse.urlencode(query)
    return url


def fb_items(node):
    """Firebase tugunini (dict YOKI list) (kalit, qiymat) juftliklariga aylantiradi.

    RTDB ketma-ket raqamli kalitlarni massiv (list) qilib qaytaradi. Eski kod
    .items() ni to'g'ridan-to'g'ri chaqirardi va list kelganda AttributeError
    berardi. Bu yordamchi har ikki holatni ham xavfsiz qo'llab-quvvatlaydi.
    None elementlar (o'chirilgan yozuvlar) tashlab ketiladi.
    """
    if not node:
        return []
    if isinstance(node, dict):
        return [(k, v) for k, v in node.items() if v is not None]
    if isinstance(node, list):
        return [(str(i), v) for i, v in enumerate(node) if v is not None]
    return []


# =====================================================================
# GROQ — markaziy yordamchi (retry + xato boshqaruvi)
# =====================================================================
def _model_is_gone(error: Exception) -> bool:
    """Xato «bunday model yo'q» degani (o'chirilgan/nomi noto'g'ri) — shundaymi?

    Bunday holatda qayta urinishning MA'NOSI YO'Q: model qaytib kelmaydi.
    Darhol zaxira modelga o'tish kerak.
    """
    text = str(error).lower()
    return any(
        marker in text
        for marker in (
            "model_not_found",
            "does not exist",
            "not found",
            "decommissioned",
            "deprecated",
            "has been shut down",
        )
    )


async def groq_chat(messages, model=None, temperature=0.5, max_retries=3):
    """Groq chat. Vaqtinchalik xatoda qayta uriniadi. Muvaffaqiyatsizda None.

    Model o'chirilgan bo'lsa (Groq vaqti-vaqti bilan eski modellarni
    o'chiradi) — zaxira modellarga o'tadi va buni loglarga ANIQ yozadi.
    Ilgari bu holat oddiy `warning` bo'lib ketardi va AI «sababsiz»
    jim qolardi.
    """
    if groq_client is None:
        logging.error("GROQ_API_KEY berilmagan — AI o'chirilgan.")
        return None

    primary = model or GROQ_TEXT_MODEL
    fallbacks = (
        GROQ_VISION_FALLBACKS if primary == GROQ_VISION_MODEL else GROQ_TEXT_FALLBACKS
    )
    # Takrorlanmasin
    candidates = [primary] + [m for m in fallbacks if m != primary]

    for candidate in candidates:
        delay = 1.5
        for attempt in range(1, max_retries + 1):
            try:
                resp = await groq_client.chat.completions.create(
                    messages=messages,
                    model=candidate,
                    temperature=temperature,
                )
                if candidate != primary:
                    logging.warning(
                        "Groq: «%s» ishlamadi, zaxira model «%s» ishlatildi. "
                        "GROQ_TEXT_MODEL/GROQ_VISION_MODEL ni yangilang.",
                        primary,
                        candidate,
                    )
                return (resp.choices[0].message.content or "").strip()
            except Exception as e:
                if _model_is_gone(e):
                    logging.error(
                        "Groq modeli «%s» MAVJUD EMAS (o'chirilgan yoki nomi xato): %s "
                        "— zaxira modelga o'tilyapti.",
                        candidate,
                        e,
                    )
                    break  # qayta urinish behuda, keyingi modelga o'tamiz
                logging.warning(
                    "Groq «%s» urinish %s/%s xato: %s", candidate, attempt, max_retries, e
                )
                if attempt < max_retries:
                    await asyncio.sleep(delay)
                    delay *= 2

    logging.error(
        "Groq: hech bir model javob bermadi (sinalgan: %s). "
        "Modellar o'chirilgan bo'lishi mumkin — console.groq.com/docs/deprecations",
        candidates,
    )
    return None


# =====================================================================
# MINI APP AI (mijoz chati)
# =====================================================================
# AI ga bir vaqtda yuboriladigan maksimal mahsulot soni (token/limit/tezlik
# uchun). Butun katalogni yuborish katta katalogda modelni buzadi va qimmat.
MAX_AI_PRODUCTS = 40


# Mashina modeli / kategoriya uchun "umumiy" (ma'noga ega bo'lmagan) qiymatlar.
# Kross-sell faqat ANIQ modeldagi qismlarni taklif qilsin — generic qiymatlar
# bo'yicha tasodifiy tovarlar qo'shilib ketmasin.
_GENERIC_VALUES = {"", "umumiy", "ko'rsatilmagan", "korsatilmagan", "nan", "noma'lum", "namalum"}


def _norm(s):
    return str(s if s is not None else "").lower().strip()


def _product_haystack(p):
    """Mahsulotning qidiriladigan barcha matnli maydonlarini birlashtiradi."""
    cats = " ".join(_norm(c) for c in (p.get("categories") or []))
    return {
        "name": _norm(p.get("name")),
        "desc": _norm(p.get("desc")),
        "brand": _norm(p.get("brand")),
        "model": _norm(p.get("model")),
        "cats": cats + " " + _norm(p.get("category")),
    }


def _in_stock(p):
    try:
        return float(p.get("stock", 0)) > 0
    except (TypeError, ValueError):
        return False


def _select_relevant_products(products, query, limit=MAX_AI_PRODUCTS):
    """So'rovga mos mahsulotlarni AQLLI tanlaydi (sotuvchi-maslahatchi kabi).

    - Faqat nom emas, balki desc/brand/model/kategoriya bo'yicha ham qidiradi.
    - Ballash: nom > model > (desc/brand/kategoriya); butun so'rov ichida bo'lsa
      qo'shimcha ball; omborda bori biroz oldinroq turadi.
    - Topilgan top mosликlar bilan AYNI mashina modelidagi qismlarni ham qo'shadi
      (proaktiv kross-sell — AI to'ldiruvchi tovar taklif qila olsin).
    - Hech narsa mos kelmasa, boshidagi `limit` tasini qaytaradi.
    Qoralamalar (is_draft) doimo tashlanadi.
    """
    # #4: products RTDB'dan dict YOKI list bo'lib kelishi mumkin — normallashtiramiz.
    products = [v for _, v in fb_items(products) if isinstance(v, dict)]
    live = [p for p in products if not p.get("is_draft")]

    q = _norm(query)
    tokens = [t for t in re.split(r"\W+", q) if len(t) >= 2]
    if not tokens:
        return live[:limit]

    def score(p):
        h = _product_haystack(p)
        s = 0.0
        for t in tokens:
            if t in h["name"]:
                s += 3
            if t in h["model"]:
                s += 2
            if t in h["desc"]:
                s += 1
            if t in h["brand"]:
                s += 1
            if t in h["cats"]:
                s += 1
        if q and q in h["name"]:   # butun so'rov nomda — kuchli signal
            s += 4
        if s > 0 and _in_stock(p):
            s += 0.5
        return s

    scored = [(score(p), p) for p in live]
    scored = [(s, p) for s, p in scored if s > 0]
    scored.sort(key=lambda x: x[0], reverse=True)
    chosen = [p for _, p in scored[:limit]]
    if not chosen:
        return live[:limit]

    # ——— Proaktiv kross-sell: top mosликlar bilan ayni ANIQ mashina modelidagi
    #     boshqa qismlarni ham qo'shamiz (faqat generic bo'lmagan model bo'yicha).
    if len(chosen) < limit:
        seen = {p.get("id") for p in chosen}
        target_models = {
            _norm(p.get("model")) for p in chosen[:3]
            if _norm(p.get("model")) not in _GENERIC_VALUES
        }
        if target_models:
            for p in live:
                if len(chosen) >= limit:
                    break
                if p.get("id") in seen:
                    continue
                if _norm(p.get("model")) in target_models:
                    chosen.append(p)
                    seen.add(p.get("id"))

    return chosen


async def process_mini_app_ai():
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                async with session.get(fb_url("ai_requests")) as resp:
                    if resp.status != 200:
                        await asyncio.sleep(2)
                        continue
                    requests = await resp.json()

                if requests:
                    for uid, data in fb_items(requests):
                        if not isinstance(data, dict) or data.get("needs_processing") is not True:
                            continue

                        await session.patch(fb_url(f"ai_requests/{uid}"),
                                            json={"needs_processing": False})
                        messages = data.get("messages", [])
                        if not messages:
                            continue

                        # 👤 SUHBATDOSHNI ANIQLASH.
                        # ⚠️ ILGARI: bu yerda uid faqat lug'at KALITI sifatida ishlatilardi —
                        #    AI kim bilan gaplashayotganini UMUMAN bilmasdi (ism ham, id ham
                        #    promptga uzatilmasdi). Endi profil ismini o'qib, murojaat
                        #    shaklini to'g'ri belgilaymiz (xo'jayin / oddiy mijoz).
                        chat_name = ""
                        try:
                            async with session.get(fb_url(f"users/{uid}/profile")) as prof_r:
                                prof = await prof_r.json()
                            if isinstance(prof, dict):
                                chat_name = str(prof.get("name") or prof.get("firstName") or "").strip()
                        except Exception as e:
                            logging.warning(f"Mini App AI: profil o'qilmadi ({uid}): {e}")

                        async with session.get(fb_url("products")) as pr:
                            products = await pr.json()

                        # So'rovga mos mahsulotlarnigina yuboramiz (butun katalogni emas)
                        last_user_msg = ""
                        for m in reversed(messages):
                            if m.get("sender") == "user":
                                last_user_msg = str(m.get("text", ""))
                                break
                        relevant = _select_relevant_products(products, last_user_msg)

                        def _prod_line(p):
                            # AI ga foydali, ammo ixcham kontekst: nom, narx, mavjudlik
                            # va (bo'lsa) mashina/izoh — shunda u to'g'ri maslahat beradi.
                            price = 0
                            try:
                                price = int(float(p.get("price", 0)))
                            except (TypeError, ValueError):
                                price = 0
                            parts = [f"ID:{p.get('id')}",
                                     str(p.get("name", "")).strip(),
                                     f"{price:,} so'm".replace(",", " ")]
                            model = str(p.get("model", "")).strip()
                            if _norm(model) not in _GENERIC_VALUES:
                                parts.append(f"mashina: {model}")
                            desc = str(p.get("desc", "")).strip()
                            if desc and _norm(desc) not in _GENERIC_VALUES and not desc.lower().startswith("mashina:"):
                                parts.append(desc[:60])
                            parts.append("omborda mavjud" if _in_stock(p) else "buyurtma asosida (so'rovga ko'ra keltiriladi)")
                            return " | ".join(parts)

                        # Omborda mavjud tovarlar kontekstda BIRINCHI tursin — AI ularni
                        # birinchi tavsiya qilsin (ishonchli, "bor" deb ayta oladigan).
                        relevant_for_ctx = sorted(relevant, key=lambda p: 0 if _in_stock(p) else 1)
                        prod_context = "\n".join(_prod_line(p) for p in relevant_for_ctx) or "(hozircha mos tovar yo'q)"
                        relevant_ids = {p.get("id") for p in relevant}

                        groq_msgs = [{
                            "role": "system",
                            "content": (
                                "Sen 'Avto_A1' avto-ehtiyot qismlar do'konining TAJRIBALI "
                                "sotuvchi-maslahatchisisan. Mijozga tirik, aqlli mutaxassis "
                                "kabi yordam ber — quruq javob beruvchi bot emas.\n\n"
                                "USLUB:\n"
                                "- Mijoz qaysi tilda yozsa (o'zbekcha/ruscha), AYNAN o'sha tilda javob ber.\n"
                                "- JUDA QISQA va lo'nda: 1-3 ta qisqa gap yoki kichik ro'yxat. Suv yo'q.\n"
                                "- Samimiy, ishonchli, foydali maslahat ohangi (robotdek emas).\n\n"
                                "VAZIFALAR:\n"
                                "1. Mijoz ehtiyot qism so'rasa — quyidagi BAZAdan O'ZING qidirib top va tavsiya et.\n"
                                "2. Mos tovar(lar) topsang, javob OXIRIGA aniq shu formatda yoz: [IDS: 1, 4]\n"
                                "   (faqat haqiqiy mos ID'lar; kartochka avtomatik chiqadi — narx/nomni qayta yozma).\n"
                                "3. So'rov noaniq bo'lsa (qaysi mashina, yili, dvigatel, old/orqa va h.k.) — "
                                "tavsiya berishdan oldin 1 ta ANIQ savol ber.\n"
                                "4. Imkon bo'lsa to'ldiruvchi qismni ham taklif qil (mas. kolodka so'rasa — disk/datchik).\n"
                                "5. OMBOR: 'omborda mavjud' tovarlarni BIRINCHI tavsiya qil. Tovar "
                                "'buyurtma asosida' bo'lsa — ISHONCH bilan ayt: bor, so'rovga ko'ra keltiramiz. "
                                "'Bor-yo'qligini bilmayman' yoki 'aniqlashim kerak' kabi IKKILANISH iboralarini ISHLATMA.\n"
                                "6. Bazada umuman bo'lmasa: qisqa uzr + qaysi mashinaga kerakligini so'ra yoki "
                                f"{SHOP_PHONE} raqamiga yo'naltir.\n\n"
                                "CHEKLOV: faqat BAZAdagi tovarlarni tavsiya qil, narxni o'zing to'qima, "
                                "ochiq havola yozma."
                                + _owner_identity_block(uid, chat_name)
                                + f"\n\nDO'KON BAZASI (mavjud tovarlar):\n{prod_context}"
                            )
                        }]
                        for m in messages:
                            role = "user" if m.get("sender") == "user" else "assistant"
                            groq_msgs.append({"role": role, "content": str(m.get("text", ""))})

                        bot_reply = await groq_chat(groq_msgs, temperature=0.4)
                        if bot_reply is None:
                            bot_reply = ("Uzr, hozir javob bera olmayapman 🙏 Bir oz vaqtdan so'ng qayta urinib ko'ring.\n"
                                         "Извините, сейчас не могу ответить — попробуйте чуть позже.")

                        found_ids = []
                        match = re.search(r"\[IDS:\s*([\d,\s]+)\]", bot_reply)
                        if match:
                            found_ids = [int(i.strip()) for i in match.group(1).split(",") if i.strip().isdigit()]
                            bot_reply = re.sub(r"\[IDS:\s*[\d,\s]+\]", "", bot_reply).strip()
                            # AI faqat ko'rsatilgan bazadagi tovarlarni ko'rsatsin
                            # (xato/yo'q ID yoki qoralama kartochka chiqib qolmasin).
                            found_ids = [i for i in found_ids if i in relevant_ids]

                        messages.append({
                            "sender": "bot",
                            "text": bot_reply,
                            "found_products": found_ids,
                            "time": int(time.time() * 1000),
                        })
                        await session.patch(fb_url(f"ai_requests/{uid}"),
                                            json={"messages": messages})

            except Exception as e:
                logging.error(f"Mini App AI xatosi: {e}")

            await asyncio.sleep(2)


# =====================================================================
# AI KOPIRAYTER (rasmni ko'rib tavsif yozadi)
# =====================================================================
async def process_ai_admin_tasks(bot: Bot):
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                async with session.get(fb_url("ai_admin_tasks")) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data:
                            for task_id, task_data in fb_items(data):
                                if not isinstance(task_data, dict):
                                    continue
                                if not (task_data.get("needs_processing") and task_data.get("action") == "generate_desc"):
                                    continue

                                prod_name = task_data.get("product_name", "Zapchast")
                                image_url = task_data.get("image_url", "")
                                logging.info(f"AI tavsif yozmoqda: {prod_name}")

                                await session.patch(fb_url(f"ai_admin_tasks/{task_id}"),
                                                    json={"needs_processing": False})

                                prompt = (
                                    "Sen Avto_A1 avto-zapchastlar do'konining professional kopirayterisan.\n"
                                    "VAZIFA: shu zapchast uchun qisqa, jozibali reklama ta'rifini yoz.\n\n"
                                    "QOIDALAR:\n"
                                    "- Foydasini 2-3 gapda tushuntir, gaplarni chiroyli ulab ket.\n"
                                    "- Marketing ohangi bo'lsin, lekin 'marketing' so'zini ishlatma.\n"
                                    "- Narx, mashina rusumi yoki texnik xususiyatni o'zingdan to'qima.\n"
                                    "- Oxiriga emoji qo'sh (masalan asbob, mashina, belgi).\n\n"
                                    f"Zapchast nomi: {prod_name}\n\n"
                                    "Faqat ta'rifning o'zini qaytar."
                                )

                                if image_url:
                                    messages = [{
                                        "role": "user",
                                        "content": [
                                            {"type": "text", "text": prompt},
                                            {"type": "image_url", "image_url": {"url": image_url}},
                                        ],
                                    }]
                                    model = GROQ_VISION_MODEL
                                else:
                                    messages = [{"role": "user", "content": prompt}]
                                    model = GROQ_TEXT_MODEL

                                result_text = await groq_chat(messages, model=model, temperature=0.5)
                                if result_text:
                                    await session.patch(fb_url(f"ai_admin_tasks/{task_id}"),
                                                        json={"result": result_text})
                                    logging.info("Tavsif tayyor.")
                                else:
                                    await session.patch(fb_url(f"ai_admin_tasks/{task_id}"),
                                                        json={"error": "AI javob bermadi."})

            except Exception as e:
                logging.error(f"AI Admin Task xatosi: {e}")

            await asyncio.sleep(2)


# =====================================================================
# FSM
# =====================================================================
class ImportState(StatesGroup):
    rate = State()
    markup = State()


class Register(StatesGroup):
    lang = State()
    name = State()
    phone = State()
    region = State()


# =====================================================================
# EXCEL / CSV IMPORT
# =====================================================================
# ⚠️ `~F.animation`: Telegram GIF (animation) xabarida `document` maydoni ham
#    to'ldiriladi. Bu filtr bo'lmasa GIF shu importer'ga tushib ketardi.
@dp.message(F.document, ~F.animation)
async def handle_document_import(message: types.Message, state: FSMContext, bot: Bot):
    if message.from_user.id not in ADMIN_IDS:
        # Ilgari bu yerda shunchaki `return` bor edi: mijoz fayl yuborsa bot
        # BUTUNLAY JIM qolardi (handler ishga tushdi, lekin javob yo'q) va
        # mijoz "bot ishlamayapti" deb o'ylardi. Endi yo'l ko'rsatamiz.
        lang = await get_user_lang(message.from_user.id)
        await message.reply(t(lang, "document_reply"), parse_mode="HTML")
        return

    document = message.document
    file_name = document.file_name.lower()
    if not file_name.endswith((".xlsx", ".xls", ".csv")):
        await message.answer("Faqat Excel (.xlsx, .xls) yoki CSV yuboring.")
        return

    msg = await message.answer("Fayl qabul qilindi, yuklanmoqda...")
    try:
        file = await bot.get_file(document.file_id)
        safe_name = re.sub(r"[^\w._-]", "", file_name)
        file_path = os.path.join(DOWNLOADS_DIR, f"{document.file_id}_{safe_name}")
        await bot.download_file(file.file_path, file_path)
        await state.update_data(file_path=file_path, file_name=file_name)
        await msg.edit_text(
            "Fayl yuklandi!\n\n"
            "<b>1-QADAM:</b> Bugungi <b>dollar kursini</b> yozing\n<i>(masalan: 12800)</i>",
            parse_mode="HTML",
        )
        await state.set_state(ImportState.rate)
    except Exception as e:
        logging.error(f"Fayl yuklashda xato: {e}")
        await msg.edit_text(f"Fayl yuklashda xato: {e}")


@dp.message(ImportState.rate, not_a_command)
async def process_rate(message: types.Message, state: FSMContext):
    try:
        usd_rate = float(message.text.replace(",", ".").replace(" ", ""))
    except ValueError:
        await message.answer("Kursni faqat son bilan kiriting (masalan: 12800)")
        return
    await state.update_data(usd_rate=usd_rate)
    await message.answer(
        f"Kurs: <b>{usd_rate:,.0f}</b> so'm\n\n"
        "<b>2-QADAM:</b> <b>Ustama foizini</b> kiriting\n<i>(masalan: 15)</i>",
        parse_mode="HTML",
    )
    await state.set_state(ImportState.markup)


def parse_excel_file(file_path, usd_rate, markup_pct, next_id, partiya_nomi):
    # pandas FAQAT shu yerda kerak — startda emas, faqat Excel import qilinganda
    # yuklanadi. Bu botning doimiy (baseline) xotira sarfini ~150MB kamaytiradi
    # (Render 512MB bepul tarifda OOM oldini oladi).
    import pandas as pd
    try:
        try:
            df = pd.read_excel(file_path, header=None)
        except Exception:
            try:
                df = pd.read_csv(file_path, header=None, sep=",")
            except Exception:
                df = pd.read_csv(file_path, header=None, sep=";")

        header_idx = 0
        for i, row in df.iterrows():
            row_str = " ".join([str(x).lower() for x in row.values])
            if any(k in row_str for k in ["наименование", "name", "tovar", "nomi", "товар", "цена", "price"]):
                header_idx = i
                break

        df.columns = df.iloc[header_idx]
        df = df.iloc[header_idx + 1:].reset_index(drop=True)
        df.columns = [str(c).lower().strip() for c in df.columns]

        name_col = next((c for c in df.columns if any(k in str(c) for k in ["наименование", "name", "tovar", "nomi", "товар"])), None)
        price_col = next((c for c in df.columns if any(k in str(c) for k in ["цена", "price", "narx", "$", "usd"])), None)
        car_col = next((c for c in df.columns if any(k in str(c) for k in ["авто", "машина", "марка", "артикул", "model"])), None)

        if not name_col or not price_col:
            return {"success": False, "error_type": "columns", "columns": ", ".join([str(c) for c in df.columns])}

        new_products = []
        for _, row in df.iterrows():
            name = str(row[name_col]).strip()
            if name.lower() == "nan" or not name:
                continue
            raw_price = str(row[price_col]).replace(",", ".").replace(" ", "").strip()
            try:
                price_usd = float(raw_price)
            except ValueError:
                continue
            if price_usd <= 0:
                continue

            final_price = int(math.ceil((price_usd * usd_rate * (1 + markup_pct / 100)) / 1000) * 1000)
            car_model = str(row[car_col]).strip() if car_col else "Ko'rsatilmagan"
            if car_model.lower() == "nan":
                car_model = "Ko'rsatilmagan"

            new_products.append({
                "id": next_id, "name": name, "price": final_price, "unit": "dona",
                "desc": f"Mashina: {car_model}", "category": "umumiy", "categories": ["umumiy"],
                "brand": "Umumiy", "model": "Umumiy", "img": "", "images": [],
                "product_type": "oddiy", "stock": 10, "is_draft": True,
                "batch_id": partiya_nomi, "has_conflict": False,
            })
            next_id += 1

        return {"success": True, "new_products": new_products}
    except Exception as e:
        return {"success": False, "error_type": "exception", "error": str(e)}


@dp.message(ImportState.markup, not_a_command)
async def process_markup_pandas(message: types.Message, state: FSMContext, bot: Bot):
    try:
        markup_pct = float(message.text.replace(",", "."))
    except ValueError:
        await message.answer("Foizni faqat son bilan kiriting (masalan: 15)")
        return

    user_data = await state.get_data()
    file_path = user_data.get("file_path")
    usd_rate = float(user_data.get("usd_rate", 12600))
    msg = await message.answer("Fayl fonda o'qilmoqda, bot qotmaydi...")

    try:
        partiya_nomi = f"Partiya_{time.strftime('%d_%m_%Y_%H_%M')}"
        # products'ni o'qish -> ID hisoblash -> yozishni LOCK ostida bajaramiz.
        # Aks holda AI bulk import bilan ayni vaqtda ishlaganda bir xil ID
        # berilishi yoki yozuvlar bir-birini o'chirib yuborishi mumkin (#15).
        async with products_lock:
            async with aiohttp.ClientSession() as session:
                async with session.get(fb_url("products")) as resp:
                    raw_products = await resp.json()
                    next_id, next_index = product_offsets(raw_products)

            result = await asyncio.to_thread(
                parse_excel_file, file_path, usd_rate, markup_pct, next_id, partiya_nomi
            )

            if not result["success"]:
                if result.get("error_type") == "columns":
                    await msg.edit_text(f"'Nomi' yoki 'Narxi' ustuni topilmadi!\n\nO'qilgan ustunlar:\n{result['columns']}")
                else:
                    await msg.edit_text(f"Xatolik: {result['error']}")
                return

            new_products = result["new_products"]
            if new_products:
                # Butun massivni qayta yozmaymiz — har bir yangi mahsulot bo'sh
                # slotga ETag (if-match) bilan ATOMIK qo'shiladi, shunda admin
                # boshqa mahsulotlarga kiritgan o'zgarishlar (tahrir/o'chirish/qo'shish)
                # ustidan yozib yuborilmaydi (#3).
                async with aiohttp.ClientSession() as session:
                    ok = await firebase_append_products(session, new_products, next_index)
                if not ok:
                    await msg.edit_text("Mahsulotlar bazaga yozilmadi (Firebase xatosi). Qayta urinib ko'ring.")
                    return

        await msg.edit_text(
            f"<b>{len(new_products)} ta tovar</b> bazaga qo'shildi!\n\n"
            "'Qoralamalar' bo'limidan tasdiqlashingiz mumkin.",
            parse_mode="HTML",
        )
    except Exception as e:
        await msg.edit_text(f"Xatolik: {e}")
    finally:
        # #7: vaqtinchalik fayl muvaffaqiyat/xato — har holatda ham o'chiriladi
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            logging.warning(f"Vaqtinchalik faylni o'chirishda xato: {e}")
        await state.clear()


# =====================================================================
# FIREBASE YORDAMCHILARI (token bilan)
# =====================================================================
async def firebase_patch(path, data):
    async with aiohttp.ClientSession() as session:
        try:
            async with session.patch(fb_url(path), json=data, timeout=10) as r:
                return r.status == 200
        except Exception as e:
            logging.error(f"Firebase PATCH xatosi ({path}): {e}")
        return False


async def firebase_get(path):
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(fb_url(path), timeout=10) as r:
                if r.status == 200:
                    return await r.json()
        except Exception as e:
            logging.error(f"Firebase GET xatosi ({path}): {e}")
        return None


# =====================================================================
# PRODUCTS GA QO'SHISH (xavfsiz APPEND — butun massivni qayta yozmaydi)
#   - Eski kod butun `products` massivini PUT qilardi. Agar admin ayni
#     paytda Mini App'dan biror mahsulotni tahrirlasa/o'chirsa, bot eski
#     nusxani yozib, admin o'zgarishini O'CHIRIB yuborardi (#race).
#   - Endi faqat YANGI indekslar PATCH qilinadi — mavjud mahsulotlarga
#     (boshqa indekslarga) tegilmaydi, shu sababli admin o'zgarishlari
#     ustidan yozilmaydi.
# =====================================================================
def product_offsets(raw):
    """RTDB'dan o'qilgan `products` (dict/list/None) dan (keyingi_id, keyingi_indeks)."""
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


async def _slot_etag_and_value(session, idx):
    """products/<idx> slotining ETag va joriy qiymatini qaytaradi."""
    async with session.get(fb_url(f"products/{idx}"),
                           headers={"X-Firebase-ETag": "true"}) as r:
        etag = r.headers.get("ETag")
        value = await r.json()
    return etag, value


async def firebase_append_products(session, new_products, start_index, max_probe=64):
    """Yangi mahsulotlarni massivga XAVFSIZ (atomik) append qiladi.

    Har bir mahsulot uchun bo'sh slot topiladi va u ETag (if-match) bilan
    ATOMIK egallanadi. Agar admin/boshqa manba ayni paytda o'sha slotni egallasa
    (slot bo'sh emas yoki 412 Precondition Failed), keyingi slotga o'tiladi.
    Shu sababli mavjud mahsulotlar HECH QACHON ustidan yozilmaydi (#3).

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
                etag, value = await _slot_etag_and_value(session, idx)
            except Exception as e:
                logging.error(f"products[{idx}] ETag o'qish xatosi: {e}")
                return False
            if value is not None:
                idx += 1  # slot band — ustidan YOZMAYMIZ, keyingisiga o'tamiz
                continue
            headers = {"if-match": etag} if etag else {}
            try:
                async with session.put(fb_url(f"products/{idx}"), json=p,
                                       headers=headers, timeout=30) as pr:
                    if pr.status == 200:
                        placed = True
                        idx += 1
                        break
                    if pr.status == 412:  # poyga: slotni boshqasi egalladi
                        idx += 1
                        continue
                    logging.error(f"products[{idx}] yozilmadi (status={pr.status})")
                    return False
            except Exception as e:
                logging.error(f"products[{idx}] PUT xatosi: {e}")
                return False
        if not placed:
            logging.error("products append: bo'sh slot topilmadi (max_probe tugadi)")
            return False
    return True


# =====================================================================
# TELEFON RAQAM VALIDATSIYASI
# =====================================================================
def normalize_phone(text):
    """Matnli raqamni +998XXXXXXXXX ko'rinishiga keltiradi. Yaroqsiz bo'lsa None."""
    if not text:
        return None
    digits = re.sub(r"\D", "", str(text))
    if len(digits) == 12 and digits.startswith("998"):
        core = digits[3:]
    elif len(digits) == 9:
        core = digits
    else:
        return None
    if not re.fullmatch(r"\d{9}", core):
        return None
    return "+998" + core


# =====================================================================
# MENYULAR
# =====================================================================
def main_menu(lang=DEFAULT_LANG, registered=True):
    """Til bo'yicha asosiy menyu (do'kon / aloqa / til almashtirish).

    registered=False bo'lsa (telefon hali yo'q) — ixtiyoriy 'ro'yxatdan o'tish'
    tugmasi ham qo'shiladi. Ro'yxatdan o'tish MAJBURIY emas: mijoz do'konni
    bemalol ko'radi, telefon faqat buyurtma berishda so'raladi.
    """
    b = BTN.get(lang, BTN[DEFAULT_LANG])
    rows = [[KeyboardButton(text=b["shop"])]]
    if not registered:
        rows.append([KeyboardButton(text=b["register"])])
    rows.append([KeyboardButton(text=b["contact"])])
    rows.append([KeyboardButton(text=b["lang"])])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def phone_kb(lang=DEFAULT_LANG):
    """Til bo'yicha 'raqamni yuborish' tugmasi."""
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=t(lang, "phone_send"), request_contact=True)]],
        resize_keyboard=True, one_time_keyboard=True,
    )


def lang_inline_kb(current=None):
    """Til tanlash inline klaviaturasi (har holatda ishlaydi — callback orqali).

    current berilsa, FAOL til yonida ✓ belgisi ko'rsatiladi — mijoz qaysi til
    yoqilganini darrov ko'radi (professional, nozik ko'rinish). Har til alohida
    qatorda — ixcham emas, keng va o'qish oson.
    """
    def _btn(code, flag, name):
        mark = "   ✓" if current == code else ""
        return InlineKeyboardButton(text=f"{flag}  {name}{mark}", callback_data=f"setlang:{code}")
    return InlineKeyboardMarkup(inline_keyboard=[
        [_btn("uz", "🇺🇿", "O'zbekcha")],
        [_btn("ru", "🇷🇺", "Русский")],
    ])


viloyatlar_menyu = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="Toshkent shahri"), KeyboardButton(text="Toshkent viloyati")],
        [KeyboardButton(text="Samarqand viloyati"), KeyboardButton(text="Buxoro viloyati")],
        [KeyboardButton(text="Andijon viloyati"), KeyboardButton(text="Farg'ona viloyati")],
        [KeyboardButton(text="Namangan viloyati"), KeyboardButton(text="Sirdaryo viloyati")],
        [KeyboardButton(text="Jizzax viloyati"), KeyboardButton(text="Qashqadaryo viloyati")],
        [KeyboardButton(text="Surxondaryo viloyati"), KeyboardButton(text="Navoiy viloyati")],
        [KeyboardButton(text="Xorazm viloyati"), KeyboardButton(text="Qoraqalpog'iston Resp.")],
    ],
    resize_keyboard=True, one_time_keyboard=True,
)


# =====================================================================
# HANDLERLAR
# =====================================================================
@dp.message(Command("start"))
async def start_command(message: types.Message, state: FSMContext):
    await state.clear()
    user_id = message.from_user.id
    existing_user = await firebase_get(f"users/{user_id}/profile")
    if existing_user and existing_user.get("lang"):
        users_db[user_id] = existing_user
        lang = existing_user.get("lang", DEFAULT_LANG)
        has_phone = bool(existing_user.get("phone"))
        if has_phone:
            name = existing_user.get("name", message.from_user.first_name)
            await message.answer(
                t(lang, "welcome_back", name=esc(name), shop=shop_label(lang)),
                reply_markup=main_menu(lang, registered=True), parse_mode="HTML",
            )
        else:
            # Tili ma'lum, lekin telefon yo'q — qayta til so'ramaymiz, bemalol ko'rsin.
            await message.answer(
                t(lang, "welcome_browse", shop=shop_label(lang)),
                reply_markup=main_menu(lang, registered=False), parse_mode="HTML",
            )
    else:
        # Yangi foydalanuvchi: faqat tilni so'raymiz, keyin do'konni BEMALOL ko'rsin
        # (majburiy ro'yxatdan o'tish yo'q — telefon buyurtmada so'raladi).
        await message.answer(t(DEFAULT_LANG, "welcome_new"), reply_markup=ReplyKeyboardRemove())
        await message.answer(t(DEFAULT_LANG, "choose_lang"), reply_markup=lang_inline_kb(), parse_mode="HTML")
        await state.set_state(Register.lang)


@dp.message(Command("help", "yordam"))
async def help_command(message: types.Message):
    """/help — ilgari BOTDA UMUMAN YO'Q edi.

    Yangi mijoz botga kirib nima qilishni bilmasdi: buyruqlar ro'yxati ham,
    "menga shunchaki yozing" degan tushuntirish ham yo'q edi. Endi bitta
    joyda: nima qila olishim, buyruqlar va aloqa raqami.
    """
    lang = await get_user_lang(message.from_user.id)
    text = t(lang, "help", shop=esc(shop_label(lang)), phone=esc(SHOP_PHONE))
    if message.from_user.id in ADMIN_IDS:
        text += t(lang, "help_admin")
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text=shop_label(lang), web_app=WebAppInfo(url=MINI_APP_URL))]])
    await message.answer(text, parse_mode="HTML", reply_markup=kb)


@dp.message(StateFilter("*"), Command("bekor", "cancel"))
async def cancel_command(message: types.Message, state: FSMContext):
    """/bekor — boshlangan amalni to'xtatadi.

    Ilgari bekor qilish IMKONI YO'Q edi: ro'yxatdan o'tishni yoki Excel
    importini boshlagan odam oxirigacha bormasa, bot undan tinmay ma'lumot
    so'rab turardi va boshqa hech narsaga javob bermasdi.
    """
    lang = await get_user_lang(message.from_user.id)
    had_state = await state.get_state() is not None
    await state.clear()
    prof = users_db.get(message.from_user.id) or {}
    await message.answer(
        t(lang, "cancel_done" if had_state else "cancel_nothing"),
        reply_markup=main_menu(lang, registered=bool(prof.get("phone"))),
    )


@dp.message(Command("til", "language"))
async def change_language_command(message: types.Message):
    lang = await get_user_lang(message.from_user.id)
    await message.answer(t(lang, "choose_lang"), reply_markup=lang_inline_kb(current=lang), parse_mode="HTML")


@dp.callback_query(F.data.startswith("setlang:"))
async def set_language(call: types.CallbackQuery, state: FSMContext):
    lang = call.data.split(":", 1)[1]
    if lang not in SUPPORTED_LANGS:
        lang = DEFAULT_LANG

    # 1-holat: yangi foydalanuvchi ro'yxatdan o'tish boshida til tanladi.
    # Endi MAJBURIY ism/telefon so'ramaymiz — tilni saqlaymiz va do'konni bemalol
    # ko'rishi uchun asosiy menyuni ochamiz (browse-first). Telefon buyurtmada so'raladi.
    if await state.get_state() == Register.lang.state:
        await state.clear()
        user_id = call.from_user.id
        prof = users_db.get(user_id) or {}
        prof["lang"] = lang
        users_db[user_id] = prof
        # Tilni darhol profilga yozamiz — keyingi /start da qayta so'ralmaydi.
        await firebase_patch(f"users/{user_id}/profile", {"lang": lang})
        try:
            await call.message.edit_text(t(lang, "lang_set"))
        except Exception:
            pass
        await call.message.answer(
            t(lang, "welcome_browse", shop=shop_label(lang)),
            reply_markup=main_menu(lang, registered=False), parse_mode="HTML",
        )
        await call.answer()
        return

    # 2-holat: mavjud foydalanuvchi tilni almashtirdi -> profilga saqlaymiz
    user_id = call.from_user.id
    prof = users_db.get(user_id) or (await firebase_get(f"users/{user_id}/profile")) or {}
    prev_lang = prof.get("lang", DEFAULT_LANG)

    # Allaqachon shu til tanlangan bo'lsa — ortiqcha xabar yubormaymiz, faqat nozik
    # toast ko'rsatamiz va ✓ belgisini joyida yangilab qo'yamiz.
    if prev_lang == lang:
        await call.answer(t(lang, "lang_already"))
        try:
            await call.message.edit_reply_markup(reply_markup=lang_inline_kb(current=lang))
        except Exception:
            pass
        return

    prof["lang"] = lang
    users_db[user_id] = prof
    await firebase_patch(f"users/{user_id}/profile", {"lang": lang})

    # Tanlangan xabarni JOYIDA yangilaymiz: tasdiq matni + ✓ belgili klaviatura.
    try:
        await call.message.edit_text(
            f"✅ {esc(t(lang, 'lang_set'))}",
            reply_markup=lang_inline_kb(current=lang), parse_mode="HTML",
        )
    except Exception:
        pass
    await call.answer("✓")
    # Menyuni yangi tilda yangilaymiz (reply keyboard — buni faqat yangi xabar bilan
    # almashtirish mumkin, shuning uchun bitta ixcham xabar yuboramiz).
    await call.message.answer(
        t(lang, "menu"),
        reply_markup=main_menu(lang, registered=bool(prof.get("phone"))),
    )


@dp.message(Register.lang, not_a_command)
async def register_lang_fallback(message: types.Message):
    """🔇 ENG OG'IR JIMLIK shu yerda edi.

    /start bosgan YANGI foydalanuvchi `Register.lang` holatiga o'tadi va til
    tugmalarini oladi. Agar u tugmani bosmasdan matn yozsa (ko'pchilik shunday
    qiladi: "salom", "narxi qancha?"), hech bir handler bu holatni
    ushlamasdi — AI handleri esa `state is not None` bo'lsa jimgina
    chiqib ketardi. Natija: mijozning BOTGA BIRINCHI xabari javobsiz qolardi.
    Endi til tugmalari xushmuomala tarzda qayta ko'rsatiladi.
    """
    await message.answer(t(DEFAULT_LANG, "lang_pick_again"),
                         reply_markup=lang_inline_kb(), parse_mode="HTML")


@dp.message(Register.name, not_a_command)
async def get_name(message: types.Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("lang", DEFAULT_LANG)
    # Ilgari matn tekshirilmasdi: mijoz stiker/ovoz yuborsa ism `None` bo'lib
    # bazaga yozilardi. Endi qayta so'raymiz (bot jim ham qolmaydi).
    name = (message.text or "").strip()
    if not name:
        await message.answer(t(lang, "ask_name"), parse_mode="HTML")
        return
    await state.update_data(name=name)
    await message.answer(t(lang, "ask_phone"), reply_markup=phone_kb(lang), parse_mode="HTML")
    await state.set_state(Register.phone)


@dp.message(Register.phone, not_a_command)
async def get_phone(message: types.Message, state: FSMContext):
    data = await state.get_data()
    lang = data.get("lang", DEFAULT_LANG)
    if message.contact:
        phone = message.contact.phone_number
        if not phone.startswith("+"):
            phone = "+" + phone
    else:
        phone = normalize_phone(message.text)
        if not phone:
            await message.answer(
                t(lang, "phone_invalid"),
                reply_markup=phone_kb(lang), parse_mode="HTML",
            )
            return  # holatda qolamiz — qayta so'raymiz
    await state.update_data(phone=phone)
    await message.answer(t(lang, "ask_region"), reply_markup=viloyatlar_menyu, parse_mode="HTML")
    await state.set_state(Register.region)


@dp.message(Register.region, not_a_command)
async def get_region(message: types.Message, state: FSMContext):
    region = (message.text or "").strip()
    data = await state.get_data()
    if not region:
        # Matn emas (stiker/rasm) — viloyat `None` bo'lib yozilib qolmasin.
        await message.answer(t(data.get("lang", DEFAULT_LANG), "ask_region"),
                             reply_markup=viloyatlar_menyu, parse_mode="HTML")
        return
    name = data.get("name")
    phone = data.get("phone")
    lang = data.get("lang", DEFAULT_LANG)
    user_id = message.from_user.id
    username = message.from_user.username
    first_name = message.from_user.first_name
    last_name = message.from_user.last_name or ""

    users_db[user_id] = {"name": name, "phone": phone, "address": region, "lang": lang}
    profile_data = {
        "uid": user_id, "name": name, "phone": phone, "address": region, "lang": lang,
        "username": f"@{username}" if username else "Yo'q",
        "firstName": first_name, "lastName": last_name,
    }
    await firebase_patch(f"users/{user_id}/profile", profile_data)

    username_txt = f"@{username}" if username else "Yo'q"
    admin_text = (
        "<b>YANGI MIJOZ RO'YXATDAN O'TDI</b>\n\n"
        f"Ism: <b>{esc(name)}</b>\n"
        f"Tel: <code>{esc(phone)}</code>\n"
        f"Viloyat: {esc(region)}\n"
        f"Til: {esc(lang)}\n"
        f"Username: {esc(username_txt)}\n"
        f"ID: <code>{user_id}</code>"
    )
    # BARCHA adminlarga (ilgari faqat ADMIN_IDS[0] ga borardi).
    await notify_admins(admin_text)

    await message.answer(
        t(lang, "register_success", shop=shop_label(lang)),
        reply_markup=main_menu(lang, registered=True), parse_mode="HTML",
    )
    await state.clear()


@dp.message(F.text.in_(REGISTER_BUTTONS))
async def register_button_handler(message: types.Message, state: FSMContext):
    """Ixtiyoriy ro'yxatdan o'tishni boshlaydi (mijoz o'zi xohlasa).

    Browse-first oqimida ro'yxatdan o'tish MAJBURIY emas; bu tugma faqat
    keyingi buyurtmalarni tezlashtirishni istagan mijozlar uchun.
    """
    lang = await get_user_lang(message.from_user.id)
    await state.update_data(lang=lang)
    await message.answer(t(lang, "register_intro"), reply_markup=ReplyKeyboardRemove(), parse_mode="HTML")
    await state.set_state(Register.name)


@dp.message(F.text.in_(LANG_BUTTONS))
async def lang_button_handler(message: types.Message):
    lang = await get_user_lang(message.from_user.id)
    await message.answer(t(lang, "choose_lang"), reply_markup=lang_inline_kb(current=lang), parse_mode="HTML")


@dp.message(F.text.in_(SHOP_BUTTONS))
async def interaktiv_menyu_handler(message: types.Message):
    user_id = message.from_user.id
    if user_id not in users_db:
        existing = await firebase_get(f"users/{user_id}/profile")
        if existing and existing.get("phone"):
            users_db[user_id] = existing

    lang = users_db.get(user_id, {}).get("lang", DEFAULT_LANG) if users_db.get(user_id) else DEFAULT_LANG
    if user_id in users_db and users_db[user_id].get("phone"):
        u = users_db[user_id]
        safe_name = urllib.parse.quote(str(u.get("name", message.from_user.first_name)))
        safe_phone = urllib.parse.quote(str(u.get("phone", "")))
        safe_region = urllib.parse.quote(str(u.get("address", "Noma'lum")))
        dynamic_url = f"{MINI_APP_URL}?name={safe_name}&phone={safe_phone}&region={safe_region}"
    else:
        safe_name = urllib.parse.quote(str(message.from_user.first_name))
        dynamic_url = f"{MINI_APP_URL}?name={safe_name}"

    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text=t(lang, "shop_btn_inline"), web_app=WebAppInfo(url=dynamic_url))]])
    await message.answer(t(lang, "shop_prompt"), reply_markup=kb)


@dp.message(F.text.in_(CONTACT_BUTTONS))
async def contact_handler(message: types.Message):
    lang = await get_user_lang(message.from_user.id)
    text = t(lang, "contact_info",
             shop=esc(SHOP_NAME), admin=esc(SHOP_ADMIN), phone=esc(SHOP_PHONE),
             tg=esc(SHOP_TELEGRAM), address=esc(shop_address(lang)), hours=esc(shop_hours(lang)))
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text=t(lang, "contact_map_btn"), url=shop_map_url())]])
    await message.answer(text, parse_mode="HTML", reply_markup=kb)

    # Koordinatalar sozlangan bo'lsa — xaritada jonli lokatsiya nuqtasini ham yuboramiz.
    if SHOP_LAT and SHOP_LNG:
        try:
            await message.answer_location(latitude=float(SHOP_LAT), longitude=float(SHOP_LNG))
        except Exception as e:
            logging.error(f"Lokatsiya yuborish xatosi: {e}")


@dp.message(Command("storis", "kategoriyalar"))
async def story_categories_command(message: types.Message):
    # Admin storis hashteglarini yoddan bilishi shart emas — shu buyruq ro'yxatni ko'rsatadi.
    if message.from_user.id not in ADMIN_IDS:
        # Mijoz bu yashirin buyruqni tasodifan yozsa — ilgari JIMLIK edi.
        lang = await get_user_lang(message.from_user.id)
        await message.answer(t(lang, "unknown_command"), parse_mode="HTML")
        return
    await message.answer(story_categories_text(), parse_mode="HTML")


@dp.message(F.web_app_data)
async def handle_webapp_data(message: types.Message):
    # #1: faqat adminlar holat o'zgartira oladi. Aks holda istalgan foydalanuvchi
    # Mini App orqali 'edit_status' yuborib, bot nomidan boshqa odamlarga soxta
    # xabar jo'natishi mumkin edi (spam/aldash vektori).
    if message.from_user.id not in ADMIN_IDS:
        return
    try:
        data = json.loads(message.web_app_data.data)
        if data.get("action") == "edit_status":
            uid = data.get("user_id")
            order_id = data.get("order_id")
            new_status = data.get("new_status")
            status_text = {
                "qabul": "QABUL QILINDI", "yolda": "YO'LGA CHIQDI",
                "yetkazildi": "YETKAZIB BERILDI", "bekor_qilingan": "BEKOR QILINDI",
            }
            await message.answer(
                f"<b>#{esc(order_id)}</b> holati: {esc(status_text.get(new_status, str(new_status).upper()))}",
                parse_mode="HTML",
            )
            mijozga_xabar = {
                "qabul": "order_qabul",
                "yolda": "order_yolda",
                "yetkazildi": "order_yetkazildi",
                "bekor_qilingan": "order_bekor_qilingan",
            }.get(new_status)
            if mijozga_xabar and uid and str(uid) != "Noma'lum":
                try:
                    # Markaziy buyurtmadan jami summani olib, xabarni boyitamiz.
                    detail = ""
                    try:
                        central = await firebase_get(f"orders/{uid}_{order_id}")
                        if isinstance(central, dict) and central.get("total"):
                            total_txt = f"{int(float(central['total'])):,}".replace(",", " ")
                            detail = f"\n\n💰 Jami: {total_txt} so'm"
                    except Exception:
                        pass
                    cust_lang = await get_user_lang(int(uid))
                    await bot.send_message(
                        chat_id=int(uid),
                        text=t(cust_lang, mijozga_xabar, code=order_id, detail=detail),
                    )
                except Exception as e:
                    logging.error(f"Mijozga xabar xatosi: {e}")
    except Exception as e:
        logging.error(f"WebApp data xato: {e}")


# =====================================================================
# STORIS QO'SHISH (rasm/video)
#   - src endi DOIMIY proxy link (Worker /media?id=<file_id>)
#   - Token Firebase'ga yozilmaydi (xavfsiz), link eskirmaydi
#   - Videoga poster (muqova) — qora ekran o'rniga birinchi kadr
# =====================================================================
@dp.message((F.photo | F.video) & F.caption.startswith("#"))
async def handle_stories(message: types.Message, bot: Bot):
    if message.from_user.id not in ADMIN_IDS:
        # 🔇 QOLGAN JIMLIK TESHIGI TUZATILDI.
        # Bu handler "rasm/video + '#' bilan boshlanadigan izoh" ni ushlaydi.
        # Mijoz ham shunday yozishi juda ehtimol ("#gazel kerak", "#kalotka").
        # Ilgari bu yerda quruq `return` bor edi — handler xabarni "yeb"
        # qo'yardi va bot BUTUNLAY jim qolardi (pastdagi rasm tahlili
        # handleriga ham yetib bormasdi).
        # Endi: rasm bo'lsa — odatdagi AI rasm tahliliga yuboramiz,
        #       video bo'lsa — media javobini beramiz.
        if message.photo:
            await handle_photo_redirect(message)
            return
        lang = await get_user_lang(message.from_user.id)
        kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
            text=shop_label(lang), web_app=WebAppInfo(url=MINI_APP_URL))]])
        await message.reply(t(lang, "media_reply"), parse_mode="HTML", reply_markup=kb)
        return

    category = message.caption.strip().lstrip("#").strip().lower()
    if category not in VALID_STORY_CATEGORIES:
        await message.reply(
            f"Noto'g'ri kategoriya: <b>#{category or '(bo`sh)'}</b>\n\n"
            + story_categories_text()
            + "\n\nTo'liq ro'yxat uchun: /storis",
            parse_mode="HTML",
        )
        return

    poster = ""
    if message.photo:
        file_id = message.photo[-1].file_id
        media_type = "image"
    else:
        file_id = message.video.file_id
        media_type = "video"
        # Video muqovasi (thumbnail) — qora ekran o'rniga ko'rinadi
        thumb = getattr(message.video, "thumbnail", None) or getattr(message.video, "thumb", None)
        if thumb:
            poster = f"{WORKER_URL}/media?id={thumb.file_id}"

    msg = await message.reply("Storis tayyorlanmoqda, kuting...")
    try:
        # get_file faqat metadata tekshiradi; >20MB bo'lsa shu yerda xato beradi
        await bot.get_file(file_id)

        # MUHIM: vaqtinchalik telegram URL EMAS — DOIMIY proxy URL saqlanadi.
        # (Eski kodda src telegram fayl linki edi: ~1 soatdan keyin eskirib,
        #  video/rasm "yo'qolib" qolardi. Endi link hech qachon eskirmaydi.)
        src = f"{WORKER_URL}/media?id={file_id}"
        story_id = str(message.message_id)
        story_data = {
            "id": story_id,
            "type": media_type,
            "src": src,
            "file_id": file_id,   # kerak bo'lsa qayta resolve qilish uchun
            "poster": poster,
            "timestamp": int(message.date.timestamp() * 1000),
        }

        # Token bilan yozamiz (aks holda 401)
        async with aiohttp.ClientSession() as session:
            async with session.put(fb_url(f"stories/{category}/{story_id}"), json=story_data) as resp:
                if resp.status == 200:
                    await msg.edit_text(
                        f"Muvaffaqiyatli! Bu {media_type} <b>#{category.capitalize()}</b> storisiga qo'shildi.\n"
                        "Link DOIMIY — video endi o'chib ketmaydi.",
                        parse_mode="HTML",
                    )
                else:
                    err = await resp.text()
                    await msg.edit_text(f"Firebase xatolik. Kod: {resp.status}\n{err[:200]}")
    except Exception as e:
        logging.error(f"Storis yuklash xatosi: {e}")
        await msg.edit_text(
            f"Xatolik: {str(e)}\n\n"
            "Eslatma: Telegram bot orqali fayl 20MB gacha yuklanadi. "
            "Kattaroq videoni siqib (compress) qayta yuboring."
        )


@dp.message(F.photo)
async def handle_photo_redirect(message: types.Message):
    """Mijoz yuborgan zapchast rasmini AI vision bilan FAOL tahlil qiladi.

    Passiv 'rasm uchun rahmat' o'rniga: rasmga qarab qismni aniqlaydi, kerak
    bo'lsa aniqlovchi savol beradi va do'kon bazasidan mos tovarlarni topib
    taklif qiladi. Token sirqib chiqmasligi uchun rasm Worker /media proxy
    orqali Groq vision modeliga uzatiladi.
    """
    user_id = message.from_user.id
    lang = await get_user_lang(user_id)
    shop_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text=shop_label(lang), web_app=WebAppInfo(url=MINI_APP_URL))]])

    # 🚦 Rasm tahlili (vision) eng qimmat amal — chegara qattiqroq.
    if _rate_limited(user_id, "photo", RL_PHOTO_MAX, RL_PHOTO_WINDOW):
        await message.reply(t(lang, "rate_limited"), reply_markup=shop_kb)
        return

    # AI o'chirilgan bo'lsa — xushmuomala fallback (eski quruq 'rahmat' emas)
    if groq_client is None:
        await message.reply(t(lang, "photo_vision_failed"), reply_markup=shop_kb)
        return

    try:
        await bot.send_chat_action(chat_id=message.chat.id, action="typing")
        notice = await message.reply(t(lang, "photo_analyzing"))

        file_id = message.photo[-1].file_id
        image_url = f"{WORKER_URL}/media?id={urllib.parse.quote(file_id)}"

        lang_name = "rus" if lang == "ru" else "o'zbek"
        vision_prompt = (
            "Sen 'Avto_A1' avto-ehtiyot qismlar do'konining tajribali ustasisan. "
            "Mijoz avto-zapchast rasmini yubordi.\n\n"
            "VAZIFA:\n"
            f"1. Rasmga qarab bu qanday zapchast ekanini ANIQLA va {lang_name} tilida QISQA (1-2 gap) ayt.\n"
            "2. Aniq tavsiya uchun zarur bo'lsa, qaysi mashina/yil ekanini 1 ta savol bilan SO'RA.\n"
            "3. Samimiy, ishonchli usta ohangi (robotdek emas), ortiqcha gapsiz.\n"
            "4. Rasmda zapchast bo'lmasa yoki tanib bo'lmasa — buni xushmuomala ayt va aniqlik so'ra.\n"
            "5. MUHIM: o'zingdan razmer, raqam yoki o'lcham (masalan 93-razmer, 12 volt) "
            "TO'QIB CHIQARMA — faqat rasmda aniq ko'ringaniga tayan.\n"
            "6. Javob OXIRIGA, bazadan qidirish uchun zapchast nomini SHU formatda yoz: [QIDIRUV: <nom>]"
            + _owner_identity_block(message.from_user.id, _tg_display_name(message.from_user))
        )
        vision_msgs = [{
            "role": "user",
            "content": [
                {"type": "text", "text": vision_prompt},
                {"type": "image_url", "image_url": {"url": image_url}},
            ],
        }]
        reply = await groq_chat(vision_msgs, model=GROQ_VISION_MODEL, temperature=0.4)

        try:
            await notice.delete()
        except Exception:
            pass

        if not reply:
            await message.reply(t(lang, "photo_vision_failed"), reply_markup=shop_kb)
            return

        # [QIDIRUV: ...] kalit so'zni ajratamiz va mijozga ko'rinadigan matndan olib tashlaymiz
        search_term = ""
        m = re.search(r"\[QIDIRUV:\s*(.+?)\]", reply, re.IGNORECASE)
        if m:
            search_term = m.group(1).strip()
            reply = re.sub(r"\[QIDIRUV:\s*.+?\]", "", reply, flags=re.IGNORECASE).strip()

        # Bazadan HAQIQATAN mos tovarlarni topamiz (omborda borlarini oldinga).
        matches_text = ""
        q_tokens = [tok for tok in re.split(r"\W+", _norm(search_term)) if len(tok) >= 3]
        if q_tokens:
            try:
                products = await firebase_get("products")
                relevant = _select_relevant_products(products, search_term, limit=8)

                def _really_matches(p):
                    blob = " ".join(_product_haystack(p).values())
                    return any(tok in blob for tok in q_tokens)

                relevant = [p for p in relevant if _really_matches(p)]
                relevant.sort(key=lambda p: 0 if _in_stock(p) else 1)

                lines = []
                for p in relevant[:3]:
                    try:
                        price = int(float(p.get("price", 0)))
                    except (TypeError, ValueError):
                        price = 0
                    price_txt = f"{price:,}".replace(",", " ")
                    lines.append(f"• {esc(p.get('name', ''))} — {price_txt} so'm")
                if lines:
                    matches_text = "\n\n<b>" + esc(t(lang, "photo_found_intro")) + "</b>\n" + "\n".join(lines)
            except Exception as e:
                logging.error(f"Rasm bo'yicha tovar qidirish xatosi: {e}")

        # Rasm natijasini AI suhbat XOTIRASIGA yozamiz. Shu tuzatish tufayli mijoz keyin
        # "Gazel 2004" desa, AI JORIY mavzuni (rasmda topilgan detal) eslab qoladi va
        # eski mavzuga (mas. porshen) qaytib, razmer to'qib chiqarmaydi.
        try:
            sess = _ensure_ai_session(user_id, lang, _tg_display_name(message.from_user))
            sess.append({"role": "user", "content": "[Men zapchast rasmini yubordim — buni aniqlab ber]"})
            sess.append({"role": "assistant", "content": reply})
            if len(sess) > 17:
                ai_sessions[user_id] = [sess[0]] + sess[-16:]
        except Exception as e:
            logging.error(f"Rasm kontekstini xotiraga yozish xatosi: {e}")

        await message.reply(esc(reply) + matches_text, reply_markup=shop_kb, parse_mode="HTML")
    except Exception as e:
        logging.error(f"Rasm tahlili xatosi: {e}")
        await message.reply(t(lang, "photo_vision_failed"), reply_markup=shop_kb)


# =====================================================================
# 📊 XO'JAYIN UCHUN BIZNES TAHLILI (FAQAT do'kon egasiga)
# ---------------------------------------------------------------------
# ⚠️ Ilgari botda hech qanday statistika/hisobot YO'Q edi: na /stats, na
#    savdo hisoboti, na "omborda nima kam qoldi" ogohlantirishi. Xo'jayin
#    biror raqamni bilishi uchun mini app'dagi admin panelini ochishi
#    kerak edi.
#
# ENDI: xo'jayin botga oddiy tilda savol bersa ("omborda nima kam qoldi?",
#    "bu hafta qancha savdo bo'ldi?", "eng ko'p sotilgan tovar qaysi?"),
#    bot HAQIQIY ma'lumotni bazadan o'qib, AI orqali javob beradi.
#
# 🔒 XAVFSIZLIK: ruxsat KODDA tekshiriladi (`_is_owner`), promptga
#    TAYANMAYDI. Boshqa adminlar ham, mijozlar ham bu ma'lumotni
#    OLMAYDI — ular uchun blok umuman qurilmaydi.
#
# 💡 TEJAMKORLIK: baza faqat savol biznesga tegishli bo'lganda o'qiladi
#    (kalit so'zlar bo'yicha), har xabarda emas.
# =====================================================================

_BIZ_KEYWORDS = (
    # ombor
    "ombor", "omborda", "zaxira", "qoldi", "qolgan", "tugadi", "tugab", "tugayapti",
    "stok", "склад", "остат", "закончил",
    # savdo / pul
    "savdo", "sotuv", "sotil", "daromad", "tushum", "foyda", "kassa", "summa",
    "продаж", "выручк", "доход", "прибыл",
    # mijoz / buyurtma
    "mijoz", "xaridor", "buyurtma", "zakaz", "клиент", "покупател", "заказ",
    # hisobot / raqam
    "statistika", "statistik", "hisobot", "tahlil", "analiz", "reyting",
    "nechta", "qancha", "eng ko'p", "eng kam", "top", "o'rtacha",
    "статистик", "отчет", "отчёт", "сколько", "средн",
    # vaqt
    "bugun", "kechagi", "hafta", "oylik", "сегодня", "недел", "месяц",
)


def _looks_like_business_question(text):
    """Savol biznes ma'lumotiga tegishlimi? (bazani bekorga o'qimaslik uchun)"""
    t = str(text or "").lower()
    return any(k in t for k in _BIZ_KEYWORDS)


def _fmt_som(n):
    """1234567 -> '1 234 567'"""
    try:
        return f"{int(round(float(n))):,}".replace(",", " ")
    except (TypeError, ValueError):
        return "0"


def _order_items_pairs(items):
    """Buyurtma tarkibini (mahsulot_id, soni) juftliklariga aylantiradi.

    Ikki xil format uchraydi:
      • mini app:  {"12||Universal": 2}          -> qiymat SON
      • eski/bot:  [{"name": ..., "quantity": 2}] -> qiymat LUG'AT
    """
    out = []
    for key, val in fb_items(items):
        base = str(key).split("||")[0]
        if isinstance(val, dict):
            qty = _safe_int(val.get("quantity"), 0) or 0
            name = str(val.get("name") or "").strip()
            out.append((base, qty, name))
        else:
            out.append((base, _safe_int(val, 0) or 0, ""))
    return out


async def _collect_owner_analytics():
    """`products` va `users` tugunlarini o'qib, ixcham biznes xulosasini qaytaradi.

    Nega `users` (markaziy `orders` emas): buyurtmalarning ISHONCHLI manbasi —
    `users/{uid}/orders`. Markaziy `orders` tuguni faqat eski (ishlamaydigan)
    kod yo'lidan yozilardi, ya'ni deyarli bo'sh.
    """
    products = await firebase_get("products")
    users = await firebase_get("users")

    # ---------------- OMBOR ----------------
    p_total = p_instock = p_out = 0
    stock_value = 0
    low = []                 # [(stock, name)]
    name_by_id = {}
    for _, p in fb_items(products):
        if not isinstance(p, dict) or p.get("is_draft"):
            continue
        p_total += 1
        nm = str(p.get("name") or "").strip() or "(nomsiz)"
        pid = p.get("id")
        if pid is not None:
            name_by_id[str(pid)] = nm
        stock = _safe_int(p.get("stock"), 0) or 0
        price = _safe_int(p.get("price"), 0) or 0
        stock_value += max(0, stock) * max(0, price)
        if stock <= 0:
            p_out += 1
        else:
            p_instock += 1
            if stock <= 3:
                low.append((stock, nm))
    low.sort(key=lambda x: x[0])

    # ---------------- BUYURTMA / MIJOZ ----------------
    now_ms = int(time.time() * 1000)
    DAY_MS = 86_400_000
    by_status = {}
    delivered_cnt = 0
    delivered_sum = 0
    cnt_1d = cnt_7d = cnt_30d = 0
    sum_1d = sum_7d = sum_30d = 0
    per_customer = {}
    qty_by_pid = {}
    name_hint = {}
    u_total = u_with_orders = u_with_car = 0

    for uid, u in fb_items(users):
        if not isinstance(u, dict):
            continue
        u_total += 1
        if u.get("my_car"):
            u_with_car += 1
        olist = [o for _, o in fb_items(u.get("orders")) if isinstance(o, dict)]
        if olist:
            u_with_orders += 1
        prof = u.get("profile") if isinstance(u.get("profile"), dict) else {}
        cname = str(prof.get("name") or "").strip() or f"ID {uid}"

        for o in olist:
            st = str(o.get("status") or "kutilmoqda")
            by_status[st] = by_status.get(st, 0) + 1
            # Haqiqatda to'langan pul (cashback chegirmasidan keyin)
            paid = _safe_int(o.get("payable"), None)
            if paid is None:
                paid = max(0, (_safe_int(o.get("total"), 0) or 0)
                           - (_safe_int(o.get("cashbackUsed"), 0) or 0))
            ts = _safe_int(o.get("id"), 0) or _safe_int(o.get("createdAt"), 0) or 0

            if st == "yetkazildi":
                delivered_cnt += 1
                delivered_sum += paid
                per_customer[cname] = per_customer.get(cname, 0) + paid
                for pid, qty, nm in _order_items_pairs(o.get("items")):
                    if qty > 0:
                        qty_by_pid[pid] = qty_by_pid.get(pid, 0) + qty
                        if nm and pid not in name_hint:
                            name_hint[pid] = nm

            if st != "bekor_qilingan" and ts:
                age = now_ms - ts
                if 0 <= age <= DAY_MS:
                    cnt_1d += 1
                    sum_1d += paid
                if 0 <= age <= 7 * DAY_MS:
                    cnt_7d += 1
                    sum_7d += paid
                if 0 <= age <= 30 * DAY_MS:
                    cnt_30d += 1
                    sum_30d += paid

    avg_order = int(delivered_sum / delivered_cnt) if delivered_cnt else 0
    top_customers = sorted(per_customer.items(), key=lambda x: -x[1])[:8]
    top_products = sorted(qty_by_pid.items(), key=lambda x: -x[1])[:10]

    # ---------------- MATN ----------------
    L = []
    L.append("OMBOR:")
    L.append(f"- Jami tovar turi: {p_total} ta (mavjud: {p_instock}, tugagan: {p_out})")
    L.append(f"- Ombor qiymati (narx x qoldiq): {_fmt_som(stock_value)} so'm")
    if low:
        L.append(f"- KAM QOLGAN (3 va kamroq) — {len(low)} ta:")
        for s, nm in low[:15]:
            L.append(f"    * {nm} — {s} dona")
        if len(low) > 15:
            L.append(f"    * ... va yana {len(low) - 15} ta")
    else:
        L.append("- Kam qolgan tovar yo'q (hammasi 3 donadan ko'p)")

    L.append("")
    L.append("SAVDO:")
    L.append(f"- Yetkazilgan buyurtmalar: {delivered_cnt} ta, "
             f"tushum: {_fmt_som(delivered_sum)} so'm")
    L.append(f"- O'rtacha buyurtma: {_fmt_som(avg_order)} so'm")
    L.append(f"- Bugun (24 soat): {cnt_1d} ta / {_fmt_som(sum_1d)} so'm")
    L.append(f"- 7 kun: {cnt_7d} ta / {_fmt_som(sum_7d)} so'm")
    L.append(f"- 30 kun: {cnt_30d} ta / {_fmt_som(sum_30d)} so'm")
    if by_status:
        parts = ", ".join(f"{k}: {v}" for k, v in sorted(by_status.items(), key=lambda x: -x[1]))
        L.append(f"- Holatlar bo'yicha: {parts}")

    if top_products:
        L.append("")
        L.append("ENG KO'P SOTILGAN (yetkazilganlar bo'yicha):")
        for pid, q in top_products:
            nm = name_by_id.get(pid) or name_hint.get(pid) or f"ID {pid}"
            L.append(f"- {nm} — {q} dona")

    L.append("")
    L.append("MIJOZLAR:")
    L.append(f"- Jami ro'yxatdan o'tgan: {u_total} ta")
    L.append(f"- Buyurtma qilganlar: {u_with_orders} ta")
    L.append(f"- Mashinasini belgilaganlar: {u_with_car} ta")
    if top_customers:
        L.append("- Eng ko'p xarid qilganlar:")
        for nm, s in top_customers:
            L.append(f"    * {nm} — {_fmt_som(s)} so'm")

    return "\n".join(L)


async def _owner_analytics_snapshot():
    """Xato bo'lsa ham suhbatni buzmaydi — bo'sh satr qaytaradi."""
    try:
        return await _collect_owner_analytics()
    except Exception as e:
        logging.error(f"Xo'jayin tahlili xatosi: {e}")
        return ""


@dp.message(Command("hisobot", "report"))
async def owner_report_command(message: types.Message):
    """Tez hisobot — FAQAT do'kon egasiga.

    Ilgari boshqalar uchun JIM qolardi. Endi oddiy "bunday buyruq yo'q"
    javobi beriladi: hisobot borligi oshkor bo'lmaydi, lekin bot ham
    "o'lik" ko'rinmaydi.
    """
    if not _is_owner(message.from_user.id):
        lang = await get_user_lang(message.from_user.id)
        await message.answer(t(lang, "unknown_command"), parse_mode="HTML")
        return
    try:
        await bot.send_chat_action(chat_id=message.chat.id, action="typing")
    except Exception:
        pass
    txt = await _owner_analytics_snapshot()
    if not txt:
        await message.reply("Xo'jayin, hisobot olinmadi — birozdan so'ng qayta urinib ko'ring.")
        return
    # Telegram chegarasi 4096 belgi — ehtiyot uchun qisqartiramiz
    body = txt if len(txt) <= 3500 else (txt[:3500] + "\n... (qisqartirildi)")
    await message.reply(
        "<b>Xo'jayin, hisobot:</b>\n\n<pre>" + html.escape(body) + "</pre>",
        parse_mode="HTML",
    )


def _ai_system_prompt(lang, user_id=None, display_name=""):
    """Telegram matnli AI suhbati uchun tizim ko'rsatmasi (professional sotuvchi).

    MUHIM: bu ko'rsatma HAR XABARDA qayta o'rnatiladi. Ilgari til faqat birinchi
    xabarda belgilanardi — mijoz keyin tilni almashtirsa ham AI eski tilda javob
    berardi. Endi profil tili + 'mijoz qaysi tilda yozsa o'sha tilda javob ber'
    qoidasi har safar yangilanadi.
    """
    profil_til = "rus" if lang == "ru" else "o'zbek"
    # ⚠️ MUROJAAT/SHAXSIYAT BLOKI ENG BOSHDA TURADI.
    #    Ilgari u `+ _owner_identity_block(...)` bilan promptning OXIRIGA
    #    qo'shilardi. Til modellari uzun ko'rsatmaning oxiridagi qoidalarga
    #    kamroq e'tibor beradi — natijada xo'jayinga «Xo'jayin» deb murojaat
    #    qilish qoidasi ba'zan bajarilmasdi.
    owner_block = _owner_identity_block(user_id, display_name).strip("\n")
    return (
        owner_block + "\n\n"
        "Siz 'Avto_A1' do'konining avtomobil ehtiyot qismlari (zapchast) bo'yicha "
        "professional, tajribali va xushmuomala sotuvchi-maslahatchisiz. "
        "Do'koningiz Samarqand shahrida joylashgan.\n\n"
        "TIL (juda muhim):\n"
        f"- Mijozning profil tili: {profil_til}.\n"
        "- Mijoz qaysi tilda yozsa — AYNAN o'sha tilda javob bering: ruscha yozsa RUSCHA, "
        "o'zbekcha yozsa O'ZBEKCHA. Tilni o'zboshimcha almashtirmang.\n\n"
        "QAT'IY QOIDALAR:\n"
        "1. Har doim muloqot markazida turgan JORIY DETALGA (oxirgi rasm yoki oxirgi "
        "so'ralgan zapchastga) e'tibor qarating. Agar mijoz rasm tashlab, keyin mashina "
        "modelini aytsa, eski muloqotdagi mutlaqo boshqa zapchastlarni (masalan, porshenni) "
        "joriy mavzuga ARALASHTIRMANG.\n"
        "2. O'zingizdan raqam, razmer (masalan: 93-razmer, 12 volt va h.k.) yoki texnik "
        "xarakteristikani TO'QIB CHIQARMANG (hallucination taqiqlanadi). Faqat rasmda aniq "
        "ko'ringan yoki mijoz aytgan ma'lumotga tayaning. Aniq bilmasangiz — to'qimang, "
        "aniqlashtirishni taklif qiling.\n"
        "3. Mijoz mashina rusumi va yilini aytganda, unga JORIY zapchast (masalan: podushka) "
        "ushbu mashinaga tushish-tushmasligini professional tarzda tushuntiring; agar aniq "
        f"bilmasangiz, do'kon telefoniga ({SHOP_PHONE}) murojaat qilishni yoki "
        f"{SHOP_ADDRESS} ga taklif qiling.\n"
        "4. Javoblaringiz qisqa, aniq, sotuvchilarona va samimiy bo'lsin (1-3 gap).\n"
        "- Aniq zapchast yoki narx so'ralsa: 'Pastdagi tugma orqali onlayn do'konimizdan "
        "qidiring' deb yo'naltiring. Hech qachon ochiq havola (link) yozmang."
    )


def _ensure_ai_session(user_id, lang, display_name="", extra=""):
    """ai_sessions[user_id] mavjudligini va system promptning YANGI ekanini ta'minlaydi.

    Mavjud suhbat tarixi saqlanadi — faqat birinchi (system) xabar yangilanadi.
    Shu yordamchi handle_ai_chat va handle_photo_redirect da BIRGA ishlatiladi:
    shunda rasm tahlili ham, matnli suhbat ham AYNI suhbat xotirasini boyitadi.

    user_id va display_name promptga uzatiladi — shunda AI kim bilan
    gaplashayotganini biladi (xo'jayin yoki oddiy mijoz).
    """
    # `extra` — faqat SHU navbat uchun qo'shimcha kontekst (masalan xo'jayin
    # uchun jonli biznes ma'lumoti). Suhbat TARIXIGA yozilmaydi: system xabar
    # har navbatda qaytadan qurilgani uchun keyingi savolda eski (eskirgan)
    # raqamlar qolib ketmaydi.
    prompt = _ai_system_prompt(lang, user_id, display_name) + (extra or "")
    if user_id not in ai_sessions:
        ai_sessions[user_id] = [{"role": "system", "content": prompt}]
    else:
        sess = ai_sessions[user_id]
        if sess and sess[0].get("role") == "system":
            sess[0]["content"] = prompt
        else:
            sess.insert(0, {"role": "system", "content": prompt})
    return ai_sessions[user_id]


@dp.message(F.text.startswith("/"))
async def unknown_command(message: types.Message, state: FSMContext):
    """Noma'lum buyruq — ilgali bu matn AI ga ketardi va AI "/xyz" ni
    savol deb o'ylab g'alati javob berardi. Endi aniq yo'l ko'rsatiladi."""
    lang = await get_user_lang(message.from_user.id)
    if await state.get_state() is not None:
        await message.answer(t(lang, "state_busy"))
        return
    await message.answer(t(lang, "unknown_command"), parse_mode="HTML")


@dp.message(F.text)
async def handle_ai_chat(message: types.Message, state: FSMContext):
    lang = DEFAULT_LANG
    if await state.get_state() is not None:
        # Ilgari shu yerda quruq `return` bor edi — ya'ni handler xabarni
        # "yedi" va foydalanuvchi HECH QANDAY javob olmadi. Endi u qaysi
        # bosqichda turganini va qanday chiqishini biladi.
        lang = await get_user_lang(message.from_user.id)
        await message.answer(t(lang, "state_busy"))
        return
    # 🚦 So'rov cheklovi: bitta odam AI limitini hammaga tugatib qo'ymasin.
    if _rate_limited(message.from_user.id, "ai"):
        lang = await get_user_lang(message.from_user.id)
        await message.reply(t(lang, "rate_limited"))
        return
    try:
        await bot.send_chat_action(chat_id=message.chat.id, action="typing")
        user_id = message.from_user.id
        lang = await get_user_lang(user_id)

        # 📊 XO'JAYIN BIZNES SAVOLI BERSA — bazadan HAQIQIY ma'lumot olamiz.
        #    🔒 Ruxsat KODDA tekshiriladi: boshqa adminlar va mijozlar uchun
        #       bu blok umuman qurilmaydi (promptga tayanmaymiz).
        #    💡 Baza faqat savol biznesga tegishli bo'lganda o'qiladi.
        owner = _is_owner(user_id)
        extra = ""
        if owner and _looks_like_business_question(message.text):
            snap = await _owner_analytics_snapshot()
            if snap:
                extra = (
                    "\n\n=== HOZIRGI HAQIQIY BIZNES MA'LUMOTI (faqat xo'jayin uchun) ===\n"
                    + snap +
                    "\n=== MA'LUMOT TUGADI ===\n"
                    "Shu raqamlar asosida javob ber. Bu yerda yo'q raqamni "
                    "TO'QIMA — bilmasang 'bu ma'lumot yo'q' deb ayt. "
                    "Javob qisqa va aniq bo'lsin; ro'yxat so'ralsa punktlar bilan yoz."
                )

        # System promptni HAR safar yangilaymiz — shunda til doim to'g'ri bo'ladi
        # (mijoz tilni almashtirsa ham), suhbat tarixi esa saqlanib qoladi.
        _ensure_ai_session(user_id, lang, _tg_display_name(message.from_user), extra)
        ai_sessions[user_id].append({"role": "user", "content": message.text})

        bot_reply = await groq_chat(ai_sessions[user_id], temperature=0.5)
        if bot_reply is None:
            await message.reply(t(lang, "ai_busy"))
            return

        # Xo'jayinga ismi bilan murojaat qilinsa — tuzatamiz (prompt kafolat emas)
        if owner:
            bot_reply = _enforce_owner_address(bot_reply)

        ai_sessions[user_id].append({"role": "assistant", "content": bot_reply})
        # Suhbatni ko'proq eslab qolsin: system + oxirgi 16 xabar (8 ta almashinuv).
        if len(ai_sessions[user_id]) > 17:
            ai_sessions[user_id] = [ai_sessions[user_id][0]] + ai_sessions[user_id][-16:]

        kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
            text=shop_label(lang), web_app=WebAppInfo(url=MINI_APP_URL))]])
        await message.reply(bot_reply, reply_markup=kb)
    except Exception as e:
        logging.error(f"AI chat xatosi: {e}")
        await message.reply(t(lang, "ai_busy"))


# =====================================================================
# 🔇 BOT JIM QOLADIGAN BARCHA HOLATLAR YOPILADI
# ---------------------------------------------------------------------
# Ilgari botda faqat MATN va RASM uchun handler bor edi. Boshqa hamma narsa
# — ovozli xabar, video, video-xabar (doiracha), stiker, GIF, lokatsiya,
# kontakt, audio, so'rovnoma — hech qanday handlerga TUSHMASDI va bot
# BUTUNLAY JIM qolardi. Mijoz nuqtai nazaridan bu "bot buzuq" degani:
# u yozgan, bot javob bermagan. Ko'pi qaytib kelmaydi.
#
# Eng ko'p uchraydigan holat — OVOZLI XABAR. O'zbekistonda mijozlar
# ko'pincha yozmasdan ovozli xabar yuboradi; bot ularga bir marta ham
# javob bermagan.
#
# Bu bo'lim ENG OXIRIDA turishi SHART: yuqoridagi maxsus handlerlar
# (storis, import, rasm tahlili) avval ishlaydi, bu yerga faqat "boshqa
# hech kim ushlamagan" xabarlar tushadi.
# =====================================================================
@dp.message(StateFilter(None), F.voice | F.video_note | F.audio)
async def handle_voice_like(message: types.Message):
    """Ovozli xabar / doiracha / audio — endi javobsiz qolmaydi."""
    lang = await get_user_lang(message.from_user.id)
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text=shop_label(lang), web_app=WebAppInfo(url=MINI_APP_URL))]])
    await message.reply(t(lang, "voice_reply"), parse_mode="HTML", reply_markup=kb)


@dp.message(StateFilter(None), F.sticker | F.animation | F.dice)
async def handle_sticker_like(message: types.Message):
    """Stiker / GIF / o'yin suyagi — do'stona javob va do'kon tugmasi."""
    lang = await get_user_lang(message.from_user.id)
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text=shop_label(lang), web_app=WebAppInfo(url=MINI_APP_URL))]])
    await message.reply(t(lang, "sticker_reply"), reply_markup=kb)


@dp.message(StateFilter(None), F.location | F.venue)
async def handle_location(message: types.Message):
    """Lokatsiya — mijoz ko'pincha "qayerdasiz?" ma'nosida yuboradi.
    Javobda DO'KON manzili, ish vaqti va xaritada ochish tugmasi beriladi."""
    lang = await get_user_lang(message.from_user.id)
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text=t(lang, "contact_map_btn"), url=shop_map_url())]])
    await message.reply(
        t(lang, "location_reply", address=esc(shop_address(lang)), hours=esc(shop_hours(lang))),
        parse_mode="HTML", reply_markup=kb,
    )


@dp.message(StateFilter(None), F.contact)
async def handle_contact_share(message: types.Message):
    """Kontakt — ro'yxatdan o'tish oqimidan TASHQARIDA yuborilgan raqam.
    Ilgari bu ham jim qolardi va raqam YO'QOLARDI. Endi profilga yoziladi,
    ya'ni mijoz keyingi buyurtmada raqamini qayta kiritmaydi."""
    lang = await get_user_lang(message.from_user.id)
    phone = (message.contact.phone_number or "").strip()
    if phone and not phone.startswith("+"):
        phone = "+" + phone
    try:
        if phone:
            user_id = message.from_user.id
            await firebase_patch(f"users/{user_id}/profile", {"phone": phone})
            prof = users_db.get(user_id) or {}
            prof["phone"] = phone
            users_db[user_id] = prof
    except Exception as e:
        logging.error(f"Kontakt raqamini saqlash xatosi: {e}")
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text=shop_label(lang), web_app=WebAppInfo(url=MINI_APP_URL))]])
    await message.reply(t(lang, "contact_reply", phone=esc(phone or "—")),
                        parse_mode="HTML", reply_markup=kb)


@dp.message(StateFilter(None), F.video)
async def handle_video_other(message: types.Message):
    """Hashtegsiz video (storis emas) — javobsiz qoldirmaymiz."""
    lang = await get_user_lang(message.from_user.id)
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text=shop_label(lang), web_app=WebAppInfo(url=MINI_APP_URL))]])
    await message.reply(t(lang, "media_reply"), parse_mode="HTML", reply_markup=kb)


@dp.edited_message()
async def handle_edited_message(message: types.Message):
    """🔇 QOLGAN JIMLIK TESHIGI TUZATILDI: TAHRIRLANGAN xabar.

    Telegram tahrirlangan xabarni ALOHIDA turdagi yangilanish sifatida
    yuboradi (`edited_message`). Botda unga handler yo'q edi — ya'ni mijoz
    xatosini tuzatib xabarini tahrirlasa, bot HECH QANDAY javob bermasdi.
    Mijoz esa "yozdim, javob yo'q" deb o'ylardi.
    """
    lang = await get_user_lang(message.from_user.id)
    await message.reply(t(lang, "edited_reply"), parse_mode="HTML")


@dp.message()
async def handle_anything_else(message: types.Message, state: FSMContext):
    """🛟 OXIRGI TO'R. Yuqoridagi hech bir handler ushlamagan HAR QANDAY xabar
    shu yerga tushadi (so'rovnoma, o'yin, joylashuv-jonli, kelajakdagi yangi
    Telegram turlari). Shu handler borligi uchun bot BOSHQA HECH QACHON
    jim qolmaydi."""
    lang = await get_user_lang(message.from_user.id)
    if await state.get_state() is not None:
        await message.answer(t(lang, "state_busy"))
        return
    await message.reply(t(lang, "fallback_reply"), parse_mode="HTML")


# =====================================================================
# 🗑 O'CHIRILDI: "YANGI BUYURTMALARNI POYLASH" (process_new_orders)
# ---------------------------------------------------------------------
# Bu vazifa markaziy `orders` tugunini HAR 5 SONIYADA so'rab turardi —
# sutkada ~17 000 bekorchi Firebase so'rovi.
#
# Nima uchun bekorchi:
#   • Mini app buyurtma haqida adminga TO'G'RIDAN-TO'G'RI (Worker proxy
#     orqali) darhol xabar beradi — ya'ni bu poller ikkinchi, KECHIKKAN
#     (5 soniyagacha) nusxa edi;
#   • u kutgan maydon nomlari (`total_price`, `customer_name`) mini app
#     yozadigan nomlarga (`total`, `customerName`) MOS KELMASDI;
#   • `notified_admin: true` bayrog'i tufayli mini app yozgan buyurtmalarni
#     baribir o'tkazib yuborardi.
#
# Bundan tashqari ZARARI ham bor edi: admin buyurtma holatini o'zgartirsa,
# kod `orders/<uid>_<kod>/status` ga yozadi va bazada faqat `{status:...}`
# dan iborat "yarim" yozuv paydo bo'lardi. Poller uni YANGI buyurtma deb
# o'ylab, adminga bo'sh maydonlar bilan soxta "YANGI BUYURTMA! Noma'lum,
# 0 so'm" xabarini yuborardi.
#
# (Mini app endi buyurtmani markaziy `orders` ga TO'LIQ yozadi — shu bilan
#  mijozga boradigan holat xabarlarida jami summa ham ko'rinadi.)
# =====================================================================

async def fetch_yandex_image(query):
    # bulk_import_fixed shu funksiyani kutadi — saqlab qolamiz (rasm qidiruv o'chirilgan)
    return ""


# =====================================================================
# GLOBAL XATO HANDLERI — bot "JIM QOLMASLIGI" uchun
#   Muammo: agar biror handler ichida kutilmagan xato chiqsa (masalan
#   Firebase javob bermadi, Telegram HTML'ni rad etdi, kutilmagan None),
#   aiogram xatoni faqat logga yozadi. Foydalanuvchi esa HECH QANDAY javob
#   olmaydi — "start bosdim, bot ishlamayapti" degan holat aynan shunday
#   ko'rinadi va sababi faqat server logida qoladi.
#
#   Yechim: dispatcher darajasidagi bitta global handler —
#     1) foydalanuvchiga tushunarli xabar yuboradi (jim qolmaydi),
#     2) adminga qisqa xato ma'lumotini yuboradi (5 daqiqada bir marta,
#        spam bo'lmasligi uchun),
#     3) to'liq traceback'ni logga yozadi.
#   Handler ichida hech qanday xato tashqariga chiqmasligi kerak, shuning
#   uchun har bir qadam alohida try/except ichida.
# =====================================================================
_last_admin_error_alert = 0.0
ADMIN_ERROR_ALERT_INTERVAL = 300  # soniya — adminga xabar yuborish oralig'i


@dp.errors()
async def global_error_handler(event):
    exc = getattr(event, "exception", None)
    update = getattr(event, "update", None)

    # 1) To'liq traceback — server logiga (Render -> Logs bo'limida ko'rinadi).
    #    exc_info'ni xato obyektidan olamiz: shunda traceback global xato
    #    handleridan tashqarida chaqirilganda ham to'g'ri chiqadi.
    logging.error(
        f"Kutilmagan xato (handler ushlamadi): {exc!r}",
        exc_info=exc if isinstance(exc, BaseException) else False,
    )

    msg = getattr(update, "message", None) or getattr(update, "edited_message", None)
    call = getattr(update, "callback_query", None)
    user = getattr(msg or call, "from_user", None)
    # Tilni FAQAT xotira keshidan olamiz — Firebase so'rovi qilmaymiz, chunki
    # xatoning sababi aynan Firebase bo'lishi mumkin (yana 10s kutib qolmaymiz).
    lang = DEFAULT_LANG
    if user is not None:
        cached = users_db.get(user.id) or {}
        lang = cached.get("lang", DEFAULT_LANG)

    # 2) Foydalanuvchi javobsiz qolmasin
    if call is not None:
        try:
            await call.answer(t(lang, "error_toast"))
        except Exception:
            pass  # eski/muddati o'tgan callback — muhim emas
    target = msg or getattr(call, "message", None)
    if target is not None:
        try:
            await target.answer(t(lang, "unexpected_error"))
        except Exception as e:
            logging.error(f"Foydalanuvchiga xato xabarini yuborib bo'lmadi: {e}")

    # 3) Admin xabardor bo'lsin (lekin xabar yog'diradigan darajada emas)
    global _last_admin_error_alert
    now = time.monotonic()
    if ADMIN_IDS and (now - _last_admin_error_alert) >= ADMIN_ERROR_ALERT_INTERVAL:
        _last_admin_error_alert = now
        try:
            who = str(user.id) if user is not None else "—"
            # Barcha adminlar xabardor bo'lsin: bittasi telefonini ko'rmasa,
            # ikkinchisi xatoni darrov ko'radi.
            await notify_admins(
                "⚠️ <b>Botda kutilmagan xatolik</b>\n\n"
                f"Foydalanuvchi: <code>{esc(who)}</code>\n"
                f"Xato: <code>{esc(type(exc).__name__)}: {esc(str(exc)[:300])}</code>\n\n"
                "<i>To'liq ma'lumot server loglarida (Render → Logs).</i>"
            )
        except Exception as e:
            logging.error(f"Adminga xato xabarini yuborib bo'lmadi: {e}")

    return True  # xato ko'rildi/hal qilindi — aiogram qayta ko'tarmaydi


# =====================================================================
# HEALTH-CHECK HTTP SERVERI (bepul bulut hosting uchun)
#   - Render kabi bepul "web service" lar 15 daqiqa harakatsizlikdan keyin
#     UXLAB qoladi. Bot long-polling ishlatadi (kiruvchi HTTP yo'q), shuning
#     uchun uni uyg'oq tutish uchun kichik HTTP endpoint qo'shamiz.
#   - Tashqi "ping" xizmati (UptimeRobot / cron-job.org) shu manzilni har
#     ~10 daqiqada chaqirsa, server uxlamaydi va bot 24/7 ishlaydi.
#   - FAQAT `PORT` env o'rnatilgan bo'lsa ishga tushadi (Render uni beradi).
#     Lokal kompyuterda PORT bo'lmagani uchun bu server yoqilmaydi — bot
#     avvalgidek ishlaydi.
# =====================================================================
async def start_health_server():
    port = os.getenv("PORT")
    if not port:
        return  # lokal ishga tushirish — health server kerak emas
    try:
        from aiohttp import web
    except Exception as e:
        logging.error(f"Health server uchun aiohttp.web yuklanmadi: {e}")
        return

    async def _ok(_request):
        return web.Response(text="Avto_A1 bot ishlayapti ✅")

    app = web.Application()
    app.router.add_get("/", _ok)
    app.router.add_get("/health", _ok)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", int(port))
    await site.start()
    logging.info(f"Health server {port}-portda ishga tushdi (keep-alive uchun).")


# =====================================================================
# O'ZINI-O'ZI UYG'OTISH (SELF-PING) — Render bepul tarifda uxlab qolmaslik uchun
#   - Render bepul "web service" 15 daqiqa KIRUVCHI trafik bo'lmasa uxlaydi.
#     Bot long-polling ishlagani uchun o'zicha kiruvchi so'rov olmaydi =>
#     uxlab qoladi va keyingi xabarga ~1 daqiqa kech javob beradi.
#   - Yechim: bot O'ZINING ochiq manziliga har ~10 daqiqada GET yuboradi.
#     Bu kiruvchi trafik hisoblanadi => Render serverni uxlatmaydi.
#     Natijada TASHQI "ping" xizmati (UptimeRobot) SHART EMAS — bot o'zini
#     o'zi uyg'oq tutadi.
#   - Render `RENDER_EXTERNAL_URL` ni avtomatik beradi. Boshqa platformada
#     `KEEP_ALIVE_URL` env'ini qo'lda berish mumkin. Manzil bo'lmasa (lokal)
#     bu vazifa hech narsa qilmaydi.
# =====================================================================
async def keep_awake():
    base = os.getenv("KEEP_ALIVE_URL") or os.getenv("RENDER_EXTERNAL_URL")
    if not base:
        return  # lokal yoki manzil yo'q — self-ping kerak emas
    ping_url = base.rstrip("/") + "/health"
    interval = int(os.getenv("KEEP_ALIVE_INTERVAL", "600"))  # soniya (default 10 daqiqa)
    await asyncio.sleep(60)  # server to'liq ko'tarilishini kutamiz
    logging.info(f"Self-ping yoqildi: {ping_url} (har {interval}s).")
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                async with session.get(ping_url, timeout=30) as r:
                    logging.info(f"Self-ping: {r.status}")
            except Exception as e:
                logging.warning(f"Self-ping xatosi: {e}")
            await asyncio.sleep(interval)


# =====================================================================
# ADMINGA "YOQILDI / O'CHDI" XABARI
#   Nima uchun: bot bulutda (Render) ishlayaptimi yoki umuman o'chib
#   qolganmi — buni bilish uchun ilgari Render loglarini ochish kerak edi.
#   Endi bot ishga tushganda va to'xtaganda ADMIN Telegram'da xabar oladi.
#   Shu bilan:
#     - deploy muvaffaqiyatli bo'lganini darhol ko'rasiz;
#     - bot to'xtab qolsa (Render uxlatdi/limit tugadi) xabardor bo'lasiz;
#     - hozir bot QAYERDA ishlayotganini bilasiz (bu muhim — bot faqat
#       BITTA joyda ishlashi kerak, aks holda Telegram 409 beradi).
#   O'chirish kerak bo'lsa: ADMIN_NOTIFY_LIFECYCLE=0 env'ini bering.
# =====================================================================
ADMIN_NOTIFY_LIFECYCLE = os.getenv("ADMIN_NOTIFY_LIFECYCLE", "1").strip() not in ("0", "false", "no", "")


def where_am_i():
    """Bot qaysi muhitda ishlayotganini qisqa matn qilib qaytaradi."""
    if os.getenv("RENDER_EXTERNAL_URL") or os.getenv("RENDER_SERVICE_NAME"):
        name = os.getenv("RENDER_SERVICE_NAME", "render")
        return f"Render (<code>{esc(name)}</code>) ☁️"
    if os.getenv("KEEP_ALIVE_URL"):
        return "bulutli server ☁️"
    return "lokal kompyuter (VS Code) 💻"


async def notify_admin_lifecycle(started: bool):
    """Adminga bot yoqilgani/o'chgani haqida xabar yuboradi (xato bo'lsa — jim)."""
    if not (ADMIN_NOTIFY_LIFECYCLE and ADMIN_IDS):
        return
    if started:
        text = (f"🟢 <b>Bot ishga tushdi</b>\n\nQayerda: {where_am_i()}\n\n"
                "<i>Eslatma: bot faqat bitta joyda ishlashi kerak. Agar "
                "kompyuteringizda ham yoqilgan bo'lsa, uni to'xtating.</i>")
    else:
        text = (f"🔴 <b>Bot to'xtadi</b>\n\nQayerda: {where_am_i()}\n\n"
                "<i>Sabab: qayta deploy, server to'xtatildi yoki bepul soat "
                "limiti tugadi. Yashil xabar kelmasa — bot ishlamayapti.</i>")
    await notify_admins(text)


async def _on_shutdown(*args, **kwargs):
    """Dispatcher to'xtaganda chaqiriladi (aiogram shutdown hook)."""
    logging.info("Bot to'xtatilmoqda...")
    await notify_admin_lifecycle(started=False)


# =====================================================================
# BOTNI ISHGA TUSHIRISH
# =====================================================================
async def setup_bot_commands():
    """Telegram'dagi «Menu» tugmasiga buyruqlar ro'yxatini yozadi.

    Ilgari `set_my_commands` UMUMAN chaqirilmagan edi: foydalanuvchi
    yozuv maydonining yonidagi «Menu» tugmasini bosganda BO'SH ro'yxat
    ko'rardi va botning nimalar qila olishini bilmasdi. Buyruqlarni
    yodda tutish ham kerak emas — Telegram o'zi taklif qiladi.

    Adminlarga QO'SHIMCHA buyruqlar ko'rsatiladi (faqat o'z chatlarida),
    mijozlar ularni ko'rmaydi.
    """
    common = [
        BotCommand(command="start", description="Boshlash / Начать"),
        BotCommand(command="help", description="Yordam / Помощь"),
        BotCommand(command="til", description="Til almashtirish / Сменить язык"),
        BotCommand(command="bekor", description="Bekor qilish / Отменить"),
    ]
    try:
        await bot.set_my_commands(common, scope=BotCommandScopeAllPrivateChats())
    except Exception as e:
        logging.warning(f"Buyruqlar ro'yxatini yozib bo'lmadi: {e}")

    admin_extra = common + [
        BotCommand(command="storis", description="Storis hashteglari"),
        BotCommand(command="hisobot", description="Savdo va ombor hisoboti"),
    ]
    for aid in ADMIN_IDS:
        try:
            await bot.set_my_commands(admin_extra, scope=BotCommandScopeChat(chat_id=aid))
        except Exception as e:
            logging.warning(f"Admin ({aid}) buyruqlarini yozib bo'lmadi: {e}")


async def main():
    logging.info("Bot ishga tushdi!")
    global products_lock
    products_lock = asyncio.Lock()  # event loop ishga tushgach yaratamiz

    # Bepul bulut hostingda (Render) web service uxlab qolmasligi uchun
    # kichik health-check serverini yoqamiz (PORT berilgan bo'lsa).
    await start_health_server()

    # O'zini-o'zi uyg'oq tutish (self-ping) — Render bepul tarifda uxlab
    # qolmasligi uchun. Tashqi xizmat (UptimeRobot) shart emas.
    asyncio.create_task(keep_awake())

    # Birinchi tokenni OLDINDAN olamiz (to_thread — event loop bloklanmaydi),
    # so'ng fonda muntazam yangilab turuvchi vazifani ishga tushiramiz.
    await refresh_firebase_token()
    asyncio.create_task(firebase_token_refresher())

    asyncio.create_task(process_mini_app_ai())
    # 🔐 admin_ids UZATILISHI SHART — aks holda AI ommaviy so'rovlari qayta
    #    ishlanmaydi (oddiy mijoz katalogga tovar qo'shishining oldini oladi).
    asyncio.create_task(process_ai_bulk_requests_v2(bot, fb_url, groq_client, fetch_yandex_image,
                                                    products_lock, ADMIN_IDS))
    asyncio.create_task(process_ai_admin_tasks(bot))
    # (process_new_orders O'CHIRILDI — yuqoridagi izohga qara)

    # #6: avval webhookni va kutilayotgan yangilanishlarni tozalaymiz — bu
    # "409 Conflict" (webhook + getUpdates yoki eski navbat) sababini yo'qotadi.
    # Eslatma: botni AYNI vaqtda IKKI nusxada ishga tushirmang — Telegram baribir
    # 409 beradi (har bir bot uchun faqat bitta getUpdates iste'molchisi bo'ladi).
    await bot.delete_webhook(drop_pending_updates=True)

    # Telegram «Menu» tugmasidagi buyruqlar ro'yxati (ilgari bo'sh edi).
    await setup_bot_commands()

    # Adminga "yoqildi" xabari — deploy muvaffaqiyatli bo'lganini bilish uchun.
    await notify_admin_lifecycle(started=True)

    # "O'chdi" xabari — dispatcher to'xtash hodisasiga ulanadi (Render SIGTERM
    # yuborganda ham ishlaydi). getattr bilan ehtiyot: aiogram versiyasida bu
    # observer bo'lmasa ham bot ishga tushishdan to'xtab qolmaydi.
    shutdown_observer = getattr(dp, "shutdown", None)
    if shutdown_observer is not None:
        try:
            shutdown_observer.register(_on_shutdown)
        except Exception as e:
            logging.warning(f"Shutdown hook ro'yxatga olinmadi: {e}")

    await dp.start_polling(bot, drop_pending_updates=True,
                           allowed_updates=dp.resolve_used_update_types())


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Bot to'xtatildi.")
