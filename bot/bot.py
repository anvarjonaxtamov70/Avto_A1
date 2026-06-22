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
import pandas as pd
from dotenv import load_dotenv

import google.auth.transport.requests
from google.oauth2 import service_account

from groq import AsyncGroq
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (InlineKeyboardMarkup, InlineKeyboardButton,
                           ReplyKeyboardMarkup, KeyboardButton,
                           ReplyKeyboardRemove, WebAppInfo)

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

ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "5105291033,483425630").replace(" ", "").split(",") if x]
ADMIN_ID = ADMIN_IDS[0] if ADMIN_IDS else 0

# Groq modellari (bitta joyda — almashtirish oson)
GROQ_TEXT_MODEL = os.getenv("GROQ_TEXT_MODEL", "llama-3.3-70b-versatile")
GROQ_VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

# Firebase service-account JSON (401 xatosini hal qiladi)
SERVICE_ACCOUNT_FILE = os.path.join(BASE_DIR, os.getenv("SERVICE_ACCOUNT_FILE", "serviceAccount.json"))

if not API_TOKEN:
    raise SystemExit("BOT_TOKEN .env faylda topilmadi. .env.example dan .env yarating.")

groq_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


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
        "choose_lang": "Tilni tanlang / Выберите язык:",
        "lang_set": "Til o'zgartirildi: O'zbekcha",
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
        "contact_info": ("<b>Avto_A1 bilan bog'lanish:</b>\n\n"
                         "Admin: Anvar\n"
                         "Telefon: +998 88 289 30 30\n"
                         "Telegram: @anvaraxtamov2004"),
        "photo_thanks": "Rasm uchun rahmat!\n\nZapchastlarni ko'rish uchun do'konni oching.",
        "ai_busy": "Kechirasiz, hozir bandman. Birozdan keyin yozing.",
        "phone_send": "Raqamni yuborish",
        "order_qabul": "Buyurtmangiz qabul qilindi!",
        "order_yolda": "Buyurtmangiz yo'lga chiqdi!",
        "order_yetkazildi": "Buyurtmangiz yetkazildi. Rahmat!",
        "order_bekor_qilingan": "Buyurtmangiz bekor qilindi.",
    },
    "ru": {
        "welcome_new": "Здравствуйте! Добро пожаловать в магазин Avto_A1!",
        "choose_lang": "Tilni tanlang / Выберите язык:",
        "lang_set": "Язык изменён: Русский",
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
        "contact_info": ("<b>Связаться с Avto_A1:</b>\n\n"
                         "Админ: Анвар\n"
                         "Телефон: +998 88 289 30 30\n"
                         "Telegram: @anvaraxtamov2004"),
        "photo_thanks": "Спасибо за фото!\n\nОткройте магазин, чтобы посмотреть запчасти.",
        "ai_busy": "Извините, сейчас я занят. Напишите чуть позже.",
        "phone_send": "Отправить номер",
        "order_qabul": "Ваш заказ принят!",
        "order_yolda": "Ваш заказ в пути!",
        "order_yetkazildi": "Ваш заказ доставлен. Спасибо!",
        "order_bekor_qilingan": "Ваш заказ отменён.",
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


# AI suhbat tarixi: 1 soat faolsiz bo'lsa yoki 2000 tadan oshsa tozalanadi
ai_sessions = BoundedTTLCache(max_size=2000, ttl_seconds=3600)
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
async def groq_chat(messages, model=None, temperature=0.5, max_retries=3):
    """Groq chat. Vaqtinchalik xatoda qayta uriniadi. Muvaffaqiyatsizda None."""
    if groq_client is None:
        return None
    model = model or GROQ_TEXT_MODEL
    delay = 1.5
    for attempt in range(1, max_retries + 1):
        try:
            resp = await groq_client.chat.completions.create(
                messages=messages,
                model=model,
                temperature=temperature,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            logging.warning(f"Groq urinish {attempt}/{max_retries} xato: {e}")
            if attempt < max_retries:
                await asyncio.sleep(delay)
                delay *= 2
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
                            parts.append("omborda bor" if _in_stock(p) else "borligini aniqlash kerak")
                            return " | ".join(parts)

                        prod_context = "\n".join(_prod_line(p) for p in relevant) or "(hozircha mos tovar yo'q)"
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
                                "5. Bazada bo'lmasa: qisqa uzr + qaysi mashinaga kerakligini so'ra yoki "
                                "+998(88)289-30-30 raqamiga yo'naltir.\n\n"
                                "CHEKLOV: faqat BAZAdagi tovarlarni tavsiya qil, narxni o'zing to'qima, "
                                "ochiq havola yozma.\n\n"
                                f"DO'KON BAZASI (mavjud tovarlar):\n{prod_context}"
                            )
                        }]
                        for m in messages:
                            role = "user" if m.get("sender") == "user" else "assistant"
                            groq_msgs.append({"role": role, "content": str(m.get("text", ""))})

                        bot_reply = await groq_chat(groq_msgs, temperature=0.4)
                        if bot_reply is None:
                            bot_reply = "Kechirasiz, hozir javob bera olmayapman. Birozdan keyin urinib ko'ring."

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
@dp.message(F.document)
async def handle_document_import(message: types.Message, state: FSMContext, bot: Bot):
    if message.from_user.id not in ADMIN_IDS:
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


@dp.message(ImportState.rate)
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


@dp.message(ImportState.markup)
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


def lang_inline_kb():
    """Til tanlash inline klaviaturasi (har holatda ishlaydi — callback orqali)."""
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🇺🇿 O'zbekcha", callback_data="setlang:uz"),
        InlineKeyboardButton(text="🇷🇺 Русский", callback_data="setlang:ru"),
    ]])


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
        await message.answer(t(DEFAULT_LANG, "choose_lang"), reply_markup=lang_inline_kb())
        await state.set_state(Register.lang)


@dp.message(Command("til", "language"))
async def change_language_command(message: types.Message):
    await message.answer(t(DEFAULT_LANG, "choose_lang"), reply_markup=lang_inline_kb())


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
    prof["lang"] = lang
    users_db[user_id] = prof
    await firebase_patch(f"users/{user_id}/profile", {"lang": lang})
    try:
        await call.message.edit_text(t(lang, "lang_set"))
    except Exception:
        pass
    await call.message.answer(
        t(lang, "menu"),
        reply_markup=main_menu(lang, registered=bool(prof.get("phone"))),
    )
    await call.answer()


@dp.message(Register.name)
async def get_name(message: types.Message, state: FSMContext):
    await state.update_data(name=message.text)
    data = await state.get_data()
    lang = data.get("lang", DEFAULT_LANG)
    await message.answer(t(lang, "ask_phone"), reply_markup=phone_kb(lang), parse_mode="HTML")
    await state.set_state(Register.phone)


@dp.message(Register.phone)
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


@dp.message(Register.region)
async def get_region(message: types.Message, state: FSMContext):
    region = message.text
    data = await state.get_data()
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
    try:
        await bot.send_message(chat_id=ADMIN_ID, text=admin_text, parse_mode="HTML")
    except Exception as e:
        logging.error(f"Adminga xabar xatosi: {e}")

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
    await message.answer(t(DEFAULT_LANG, "choose_lang"), reply_markup=lang_inline_kb())


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
    await message.answer(t(lang, "contact_info"), parse_mode="HTML")


@dp.message(Command("storis", "kategoriyalar"))
async def story_categories_command(message: types.Message):
    # Admin storis hashteglarini yoddan bilishi shart emas — shu buyruq ro'yxatni ko'rsatadi.
    if message.from_user.id not in ADMIN_IDS:
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
                    cust_lang = await get_user_lang(int(uid))
                    await bot.send_message(chat_id=int(uid), text=t(cust_lang, mijozga_xabar))
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
    lang = await get_user_lang(message.from_user.id)
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text=shop_label(lang), web_app=WebAppInfo(url=MINI_APP_URL))]])
    await message.reply(t(lang, "photo_thanks"), reply_markup=kb)


@dp.message(F.text)
async def handle_ai_chat(message: types.Message, state: FSMContext):
    if await state.get_state() is not None:
        return
    try:
        await bot.send_chat_action(chat_id=message.chat.id, action="typing")
        user_id = message.from_user.id
        lang = await get_user_lang(user_id)
        if user_id not in ai_sessions:
            lang_rule = ("Foydalanuvchi rus tilida yozyapti — javobni RUS tilida ber. "
                         if lang == "ru" else
                         "Foydalanuvchi o'zbek tilida yozyapti — javobni O'ZBEK tilida ber. ")
            ai_sessions[user_id] = [{
                "role": "system",
                "content": ("Sen 'Avto_A1' avto-ehtiyot qismlar do'konining tajribali "
                            "sotuvchi-maslahatchisisan. " + lang_rule +
                            "JUDA QISQA va lo'nda javob ber (1-2 gap), tirik mutaxassis kabi, foydali maslahat bilan. "
                            "So'rov noaniq bo'lsa — qaysi mashina/yili kabi 1 ta aniq savol ber. "
                            "Aniq zapchast yoki narx so'ralsa, do'konda bor-yo'qligini ko'rish uchun: "
                            "'Pastdagi tugmani bosib onlayn do'konimizdan qidiring' de. "
                            "Hech qachon ochiq link yozma. "
                            "Manzil: Samarqand yangi zapchast bozor, 19-sektor, 2-do'kon. "
                            "Tel: +998(88)289-30-30")
            }]
        ai_sessions[user_id].append({"role": "user", "content": message.text})

        bot_reply = await groq_chat(ai_sessions[user_id], temperature=0.5)
        if bot_reply is None:
            await message.reply(t(lang, "ai_busy"))
            return

        ai_sessions[user_id].append({"role": "assistant", "content": bot_reply})
        if len(ai_sessions[user_id]) > 10:
            ai_sessions[user_id] = [ai_sessions[user_id][0]] + ai_sessions[user_id][-9:]

        kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
            text=shop_label(lang), web_app=WebAppInfo(url=MINI_APP_URL))]])
        await message.reply(bot_reply, reply_markup=kb)
    except Exception as e:
        logging.error(f"AI chat xatosi: {e}")
        await message.reply(t(DEFAULT_LANG, "ai_busy"))


# =====================================================================
# YANGI BUYURTMALARNI POYLASH
# =====================================================================
async def process_new_orders(bot: Bot):
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                # #2: butun 'orders' tugunini emas, faqat eng so'nggi buyurtmalarni
                # o'qiymiz (createdAt indekslangan). Shunda buyurtmalar soni o'ssa ham
                # har so'rovda yuklama CHEKLANGAN bo'ladi (cheksiz o'smaydi).
                params = {"orderBy": '"createdAt"', "limitToLast": 100}
                async with session.get(fb_url("orders", params)) as resp:
                    if resp.status == 200:
                        orders = await resp.json()
                        if orders:
                            for order_id, order_data in fb_items(orders):
                                if not isinstance(order_data, dict):
                                    continue
                                if order_data.get("notified_admin"):
                                    continue
                                customer_name = order_data.get("customer_name", "Noma'lum")
                                phone = order_data.get("phone", "Noma'lum")
                                address = order_data.get("address", "Noma'lum")
                                total = order_data.get("total_price", 0)
                                items = order_data.get("items", [])
                                platforma = "Telegram" if order_data.get("is_telegram") else "APK / Web"

                                text = (
                                    f"<b>YANGI BUYURTMA! ({platforma})</b>\n\n"
                                    f"Ism: <b>{esc(customer_name)}</b>\n"
                                    f"Tel: <code>{esc(phone)}</code>\n"
                                    f"Manzil: {esc(address)}\n\n<b>Tovarlar:</b>\n"
                                )
                                for item in items:
                                    text += f"- {esc(item.get('name'))} x {esc(item.get('quantity', 1))} dona\n"
                                text += f"\n<b>Umumiy: {total:,.0f} so'm</b>\nID: #{esc(order_id)}"

                                # #5: AVVAL flagni o'rnatamiz, KEYIN xabar yuboramiz.
                                # PATCH muvaffaqiyatsiz bo'lsa — xabar yuborilmaydi va
                                # keyingi tsiklda qayta uriniladi (takror yuborish yo'q).
                                async with session.patch(fb_url(f"orders/{order_id}"),
                                                         json={"notified_admin": True}) as pr:
                                    if pr.status != 200:
                                        continue
                                try:
                                    await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="HTML")
                                except Exception as e:
                                    # Xabar uzilsa flagni qaytaramiz — keyingi tsiklda qayta urinadi
                                    logging.error(f"Admin xabar xatosi, flag qaytarilmoqda: {e}")
                                    await session.patch(fb_url(f"orders/{order_id}"),
                                                        json={"notified_admin": False})
            except Exception as e:
                logging.error(f"Buyurtma tekshirish xatosi: {e}")
            await asyncio.sleep(5)


async def fetch_yandex_image(query):
    # bulk_import_fixed shu funksiyani kutadi — saqlab qolamiz (rasm qidiruv o'chirilgan)
    return ""


# =====================================================================
# BOTNI ISHGA TUSHIRISH
# =====================================================================
async def main():
    logging.info("Bot ishga tushdi!")
    global products_lock
    products_lock = asyncio.Lock()  # event loop ishga tushgach yaratamiz

    # Birinchi tokenni OLDINDAN olamiz (to_thread — event loop bloklanmaydi),
    # so'ng fonda muntazam yangilab turuvchi vazifani ishga tushiramiz.
    await refresh_firebase_token()
    asyncio.create_task(firebase_token_refresher())

    asyncio.create_task(process_mini_app_ai())
    asyncio.create_task(process_ai_bulk_requests_v2(bot, fb_url, groq_client, fetch_yandex_image, products_lock))
    asyncio.create_task(process_ai_admin_tasks(bot))
    asyncio.create_task(process_new_orders(bot))

    # #6: avval webhookni va kutilayotgan yangilanishlarni tozalaymiz — bu
    # "409 Conflict" (webhook + getUpdates yoki eski navbat) sababini yo'qotadi.
    # Eslatma: botni AYNI vaqtda IKKI nusxada ishga tushirmang — Telegram baribir
    # 409 beradi (har bir bot uchun faqat bitta getUpdates iste'molchisi bo'ladi).
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot, drop_pending_updates=True,
                           allowed_updates=dp.resolve_used_update_types())


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Bot to'xtatildi.")
