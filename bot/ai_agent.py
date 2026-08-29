# =====================================================================
#  ai_agent.py — XO'JAYIN AI AGENTI (1-qism: O'QISH vositalari)
# =====================================================================
#  MUAMMO (bu modul yechayotgan):
#    Ilgari xo'jayin biznes savoli bersa, `_collect_owner_analytics()`
#    BUTUN `products` + BUTUN `users` tugunini o'qib, ~3-4 KB matnli
#    xulosani system promptga tiqardi. Bu uch jihatdan yomon edi:
#      1) Savol "Gazel porsheni qancha qoldi?" bo'lsa ham butun baza
#         o'qilardi — sekin va Firebase kvotasini yeydi.
#      2) AI faqat O'SHA tayyor xulosadagi raqamlarni ko'rardi. Xulosada
#         yo'q narsani (masalan aniq bir tovar narxi) so'rasa — TO'QIB
#         yozish xavfi bor edi.
#      3) AI hech qanday AMAL bajara olmasdi.
#
#  YECHIM: tool calling (function calling). AI endi kerakli ma'lumotni
#  O'ZI so'rab oladi — aniq, maqsadli so'rov bilan. Har bir "vosita"
#  (tool) — oddiy Python funksiyasi. AI Firebase'ga HECH QACHON
#  to'g'ridan tegmaydi; u faqat shu funksiyalarni chaqirishni SO'RAYDI,
#  bajarishni esa KOD hal qiladi.
#
#  XAVFSIZLIK ASOSI (bu 2-qismda yozish vositalari qo'shilganda hayotiy):
#    • Ruxsat KODDA tekshiriladi (`owner_only`), promptda EMAS. Prompt —
#      ko'rsatma, kafolat emas; uni mijoz matni bilan aldash mumkin.
#    • Bu modulda YOZISH vositasi UMUMAN YO'Q. Barcha vositalar faqat
#      o'qiydi. Yozish (narx/qoldiq/status) keyingi PR'da, MAJBURIY
#      tasdiq tugmasi bilan qo'shiladi.
#    • Model o'ylab topgan vosita nomi yoki buzuq argument — xato dict
#      qaytaradi, dastur yiqilmaydi.
#
#  MODEL: `openai/gpt-oss-120b` (bot.py dagi joriy GROQ_TEXT_MODEL) tool
#  calling'ni qo'llab-quvvatlaydi — model almashtirish SHART EMAS.
# =====================================================================

import asyncio
import json
import logging
import os
import random
import time

from fb_utils import (fb_items, fmt_som, is_generic, norm, order_items_pairs,
                      order_paid, order_ts, price_of, product_label, safe_int,
                      sizes_of, stock_of, tokenize)

# =====================================================================
#  SOZLAMALAR
#
#  ⚠️ NEGA `init()` ICHIDA O'QILADI (modul yuklanganda EMAS):
#     `bot.py` da `load_dotenv()` IMPORTLARDAN KEYIN chaqiriladi. Agar bu
#     qiymatlar modul yuklanish paytida o'qilsa, `.env` fayldagi
#     AI_AGENT_ENABLED va boshqalar HAR DOIM e'tiborsiz qolardi (jimgina —
#     eng yomon xato turi). Shuning uchun konfiguratsiya `init()` da,
#     ya'ni .env yuklangandan keyin o'qiladi.
# =====================================================================
# Agentni ishlab turgan serverda DARHOL o'chirish uchun bayroq. Tool
# calling kutilmagan xato bersa, Render panelida AI_AGENT_ENABLED=0
# qo'yish kifoya — bot eski (snapshot) yo'liga qaytadi, deploy shart emas.
AGENT_ENABLED = True
# Vosita chaqiruvlari halqasi necha marta aylanishi mumkin. Har aylanish =
# 1 ta Groq so'rovi. 4 — real savollar uchun yetarli (mas. "avval qidir,
# keyin batafsilini ol"), lekin cheksiz halqaga yo'l qo'ymaydi.
MAX_TOOL_ROUNDS = 4
# Bitta aylanishda bajariladigan maksimal vosita soni (model ba'zan
# 10 ta chaqiruvni birdan so'raydi).
MAX_CALLS_PER_ROUND = 5
# Bitta vosita natijasining maksimal uzunligi (belgi) — kontekstni
# to'ldirib yubormaslik uchun.
TOOL_RESULT_LIMIT = 6000
# O'qish vositalarini ham audit jurnaliga yozishmi (odatda shart emas —
# faqat nosozlikni izlashda yoqiladi).
AUDIT_READS = False

# ——— YOZISH (2-qism) ———
# Yozish vositalarini butunlay o'chirish bayrog'i. O'chirilganda agent
# faqat o'qiydi (1-qismdagi holat). O'qishni saqlab, yozishni tezda
# to'xtatish kerak bo'lsa — aynan shu.
WRITE_ENABLED = True
# Tasdiq tugmasi qancha vaqt amal qiladi (soniya).
PENDING_TTL_SEC = 300
# Bitta savolda AI eng ko'p nechta o'zgartirish taklif qila oladi.
MAX_PENDING_PER_TURN = 3
# Narx shu foizdan ko'p o'zgarsa — tasdiq kartochkasida KATTA ogohlantirish.
BIG_CHANGE_PCT = 50
# Ommaviy amalda eng ko'p nechta tovarga tegish mumkin.
MAX_BULK_ITEMS = 30

# Ro'yxatlarda qaytariladigan maksimal element (AI kontekstini tejash).
_MAX_LIST = 25


def _flag(name, default=False):
    """Env bayrog'ini o'qiydi ("1/true/yes/on" -> True)."""
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def _load_config():
    """.env yuklangandan KEYIN sozlamalarni o'qiydi (init ichidan)."""
    global AGENT_ENABLED, MAX_TOOL_ROUNDS, MAX_CALLS_PER_ROUND
    global TOOL_RESULT_LIMIT, AUDIT_READS, WRITE_ENABLED
    global PENDING_TTL_SEC, MAX_PENDING_PER_TURN, BIG_CHANGE_PCT, MAX_BULK_ITEMS
    AGENT_ENABLED = _flag("AI_AGENT_ENABLED", True)
    WRITE_ENABLED = _flag("AI_AGENT_WRITE_ENABLED", True)
    AUDIT_READS = _flag("AI_AUDIT_READS", False)
    # Chegaralar: aqldan ozgan qiymat (0 yoki 500) kiritilsa ham bot
    # ishlashda davom etsin.
    MAX_TOOL_ROUNDS = max(1, min(safe_int(os.getenv("AI_AGENT_MAX_ROUNDS"), 4) or 4, 8))
    MAX_CALLS_PER_ROUND = max(1, min(safe_int(os.getenv("AI_AGENT_MAX_CALLS"), 5) or 5, 10))
    TOOL_RESULT_LIMIT = max(1000, min(safe_int(os.getenv("AI_AGENT_RESULT_LIMIT"), 6000) or 6000, 20000))
    PENDING_TTL_SEC = max(60, min(safe_int(os.getenv("AI_AGENT_CONFIRM_TTL"), 300) or 300, 3600))
    MAX_PENDING_PER_TURN = max(1, min(safe_int(os.getenv("AI_AGENT_MAX_PENDING"), 3) or 3, 10))
    BIG_CHANGE_PCT = max(5, min(safe_int(os.getenv("AI_AGENT_BIG_CHANGE_PCT"), 50) or 50, 500))
    MAX_BULK_ITEMS = max(1, min(safe_int(os.getenv("AI_AGENT_MAX_BULK"), 30) or 30, 100))


# =====================================================================
#  BOG'LIQLIKLAR (dependency injection)
#  bot.py ishga tushganda bir marta to'ldiradi. Shu yondashuv
#  `bulk_import_fixed.py` dagi naqsh bilan bir xil va aylanma import
#  muammosini butunlay yo'q qiladi (ai_agent -> bot importi YO'Q).
# =====================================================================
class AgentDeps:
    """Agent ishlashi uchun kerak bo'lgan tashqi funksiyalar."""

    def __init__(self, firebase_get, firebase_patch, groq_raw, is_owner,
                 firebase_get_etag=None, firebase_put=None,
                 firebase_delete=None, firebase_query=None):
        self.firebase_get = firebase_get      # async (path) -> dict|list|None
        self.firebase_patch = firebase_patch  # async (path, data) -> bool
        self.groq_raw = groq_raw              # async (messages, tools=..., ...) -> message|None
        self.is_owner = is_owner              # (user_id) -> bool
        # ——— Yozish uchun (2-qism). Berilmasa — yozish vositalari
        #     o'zini o'chiradi va aniq xato qaytaradi (jimgina buzilmaydi).
        self.firebase_get_etag = firebase_get_etag  # async (path) -> (etag, value)
        self.firebase_put = firebase_put            # async (path, data, etag) -> (ok, status)
        self.firebase_delete = firebase_delete      # async (path) -> bool
        self.firebase_query = firebase_query        # async (path, params) -> dict|None

    def can_write(self):
        """Yozish uchun kerakli hamma narsa berilganmi."""
        return bool(self.firebase_get_etag and self.firebase_put)


_deps = None


def init(firebase_get, firebase_patch, groq_raw, is_owner,
         firebase_get_etag=None, firebase_put=None,
         firebase_delete=None, firebase_query=None):
    """bot.py `main()` ichidan bir marta chaqiriladi."""
    global _deps
    _load_config()   # .env allaqachon yuklangan — endi sozlamalarni o'qish xavfsiz
    _deps = AgentDeps(firebase_get, firebase_patch, groq_raw, is_owner,
                      firebase_get_etag=firebase_get_etag,
                      firebase_put=firebase_put,
                      firebase_delete=firebase_delete,
                      firebase_query=firebase_query)
    logging.info(
        "AI agent: %s | vositalar: %d o'qish + %d yozish | aylanish: %d | "
        "yozish %s",
        "YOQILGAN" if AGENT_ENABLED else "O'CHIRILGAN",
        sum(1 for s in TOOLS.values() if not s.mutating),
        sum(1 for s in TOOLS.values() if s.mutating),
        MAX_TOOL_ROUNDS,
        "TAYYOR" if _deps.can_write() else "O'CHIRILGAN (yordamchilar berilmagan)",
    )
    return _deps


class AgentResult:
    """Agent navbatining natijasi.

    Sinf (tuple emas) — chunki 2-qismda `pending` qo'shildi va keyinchalik
    ham qo'shilishi mumkin. Tuple bo'lsa har qo'shimchada barcha
    chaqiruvchilarni tuzatish kerak bo'lardi.
    """

    def __init__(self, text=None, calls=None, pending=None):
        self.text = text            # AI javobi (str) yoki None (xato)
        self.calls = calls or []    # [(vosita, argumentlar, xato_bormi)]
        self.pending = pending or []  # tasdiq kutayotgan amallar

    def __iter__(self):
        """Eski `text, calls = ...` shakli ham ishlashi uchun."""
        return iter((self.text, self.calls))


def is_enabled():
    """Agent ishlatishga tayyormi (yoqilgan va bog'liqliklar berilgan)."""
    return bool(AGENT_ENABLED and _deps is not None)


# =====================================================================
#  NAVBAT KONTEKSTI (per-turn cache)
#  Bitta savol ichida AI 3-4 marta vosita chaqirishi mumkin va ularning
#  ko'pi AYNI `products` tugunini talab qiladi. Keshsiz har chaqiruv
#  yangi tarmoq so'rovi bo'lardi — sekin va kvota isrofi.
#  Kesh FAQAT bitta navbat (bitta savol) davomida yashaydi, shuning
#  uchun ma'lumot eskirib qolmaydi.
# =====================================================================
class TurnContext:
    def __init__(self, deps, user_id):
        self.deps = deps
        self.user_id = user_id
        self._cache = {}
        self.calls = []          # [(vosita_nomi, argumentlar, xato_bormi)]
        self.pending = []        # tasdiq kutayotgan amallar (2-qism)

    async def node(self, path):
        """RTDB tugunini keshlab o'qiydi (bitta navbatda bir marta)."""
        if path not in self._cache:
            self._cache[path] = await self.deps.firebase_get(path)
        return self._cache[path]

    async def products(self):
        """Katalog: faqat lug'at bo'lgan yozuvlar, RTDB indeksi bilan birga.

        Indeks (`_idx`) 2-qismdagi YOZISH vositalari uchun zarur —
        `products/{idx}` manzilini bilmasak tahrirlab bo'lmaydi.
        """
        raw = await self.node("products")
        out = []
        for key, p in fb_items(raw):
            if isinstance(p, dict):
                item = dict(p)
                item["_idx"] = safe_int(key, None)
                out.append(item)
        return out

    async def users(self):
        raw = await self.node("users")
        return [(uid, u) for uid, u in fb_items(raw) if isinstance(u, dict)]


# =====================================================================
#  VOSITA REYESTRI
# =====================================================================
class ToolSpec:
    def __init__(self, name, description, parameters, handler,
                 mutating=False, owner_only=True):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.handler = handler
        self.mutating = mutating      # yozadimi? (2-qismda ishlatiladi)
        self.owner_only = owner_only  # faqat xo'jayinga


TOOLS = {}


def tool(name, description, parameters, mutating=False, owner_only=True):
    """Vositani reyestrga qo'shadigan dekorator."""
    def wrap(fn):
        TOOLS[name] = ToolSpec(name, description, parameters, fn,
                               mutating=mutating, owner_only=owner_only)
        return fn
    return wrap


def groq_tool_specs(include_mutating=False):
    """Reyestrni Groq/OpenAI formatidagi `tools` ro'yxatiga aylantiradi."""
    out = []
    for spec in TOOLS.values():
        if spec.mutating and not include_mutating:
            continue
        out.append({
            "type": "function",
            "function": {
                "name": spec.name,
                "description": spec.description,
                "parameters": spec.parameters,
            },
        })
    return out


# ——— Qayta ishlatiladigan JSON Schema bo'laklari ———
_NO_ARGS = {"type": "object", "properties": {}}


def _err(message, **extra):
    """Vositadan qaytadigan standart xato javobi."""
    out = {"ok": False, "error": str(message)}
    out.update(extra)
    return out


# =====================================================================
#  O'QISH VOSITALARI
# =====================================================================

def _product_brief(p, with_sizes=True):
    """Tovarning AI uchun ixcham ko'rinishi (kontekstni tejaydi)."""
    total = stock_of(p)
    out = {
        "id": p.get("id"),
        "nom": str(p.get("name") or "").strip(),
        "narx": price_of(p),
        "qoldiq": total,
        "holat": "tugagan" if total <= 0 else ("kam" if total <= 3 else "bor"),
    }
    code = str(p.get("code") or "").strip()
    if code:
        out["kod"] = code
    model = str(p.get("model") or "").strip()
    if model and not is_generic(model):
        out["mashina"] = model
    if p.get("is_draft"):
        out["qoralama"] = True
    old = safe_int(p.get("oldPrice"), 0) or 0
    if old > out["narx"] > 0:
        out["eski_narx"] = old
        out["chegirma_foiz"] = round((1 - out["narx"] / old) * 100)
    if with_sizes:
        sizes = sizes_of(p)
        if sizes:
            out["razmerlar"] = [{"razmer": s, "qoldiq": q} for s, q in sizes]
    return out


def _score_product(p, tokens, query):
    """So'rovga moslik bali. `_select_relevant_products` bilan bir xil mantiq."""
    name = norm(p.get("name"))
    desc = norm(p.get("desc"))
    brand = norm(p.get("brand"))
    model = norm(p.get("model"))
    code = norm(p.get("code"))
    cats = " ".join(norm(c) for _, c in fb_items(p.get("categories"))) + " " + norm(p.get("category"))
    s = 0.0
    for t in tokens:
        if t in name:
            s += 3
        if t in model:
            s += 2
        if t in code:
            s += 3          # kod bo'yicha aniq topilish — kuchli signal
        if t in desc:
            s += 1
        if t in brand:
            s += 1
        if t in cats:
            s += 1
    if query and query in name:
        s += 4
    return s


@tool(
    name="search_products",
    description=(
        "Katalogdan tovar qidiradi (nom, kod, mashina modeli, tavsif, kategoriya "
        "bo'yicha). Tovar nomi yoki qoldig'i haqidagi HAR QANDAY savolda avval "
        "shuni ishlat. Natijada har tovarning id, nomi, narxi va qoldig'i keladi."
    ),
    parameters={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Qidiruv matni, masalan 'gazel porshen' yoki '4133'"},
            "only_in_stock": {"type": "boolean", "description": "Faqat omborda bori (standart: false)"},
            "include_drafts": {"type": "boolean", "description": "Qoralamalarni ham qo'shish (standart: false)"},
            "limit": {"type": "integer", "description": "Maksimal natija (standart 15, eng ko'p 25)"},
        },
        "required": ["query"],
    },
)
async def _t_search_products(ctx, query="", only_in_stock=False, include_drafts=False, limit=15):
    limit = max(1, min(safe_int(limit, 15) or 15, _MAX_LIST))
    items = await ctx.products()
    if not include_drafts:
        items = [p for p in items if not p.get("is_draft")]
    if only_in_stock:
        items = [p for p in items if stock_of(p) > 0]

    q = norm(query)
    tokens = tokenize(query)
    if not tokens:
        return _err("qidiruv matni bo'sh — nima izlashni ayting")

    scored = [(_score_product(p, tokens, q), p) for p in items]
    scored = [(s, p) for s, p in scored if s > 0]
    scored.sort(key=lambda x: (-x[0], -stock_of(x[1])))

    found = [_product_brief(p) for _, p in scored[:limit]]
    return {
        "ok": True,
        "sorov": query,
        "topildi": len(scored),
        "korsatildi": len(found),
        "tovarlar": found,
        "izoh": ("Hech narsa topilmadi — boshqa nom bilan urinib ko'ring yoki "
                 "catalog_summary bilan umumiy holatni tekshiring.") if not found else "",
    }


@tool(
    name="get_product",
    description=(
        "Bitta tovarning TO'LIQ ma'lumotini oladi (tavsif, kategoriyalar, "
        "razmerlar, rasm soni, chegirma). `id` yoki `kod` bo'yicha."
    ),
    parameters={
        "type": "object",
        "properties": {
            "id": {"type": "integer", "description": "Tovar id raqami"},
            "code": {"type": "string", "description": "Tovar kodi (id noma'lum bo'lsa)"},
        },
    },
)
async def _t_get_product(ctx, id=None, code=None):
    pid = safe_int(id, None)
    code_n = norm(code)
    if pid is None and not code_n:
        return _err("`id` yoki `code` dan biri kerak")

    items = await ctx.products()
    match = None
    for p in items:
        if pid is not None and safe_int(p.get("id"), None) == pid:
            match = p
            break
        if code_n and norm(p.get("code")) == code_n:
            match = p
            break
    if match is None:
        return _err("bunday tovar topilmadi", qidirilgan={"id": id, "kod": code})

    out = _product_brief(match)
    out["tavsif"] = str(match.get("desc") or "").strip()[:400]
    out["birlik"] = match.get("unit") or "dona"
    out["turi"] = match.get("product_type") or "oddiy"
    out["kategoriyalar"] = [str(c) for _, c in fb_items(match.get("categories"))] or \
                           ([str(match["category"])] if match.get("category") else [])
    imgs = [u for _, u in fb_items(match.get("images")) if u]
    out["rasm_soni"] = len(imgs) or (1 if match.get("img") else 0)
    if match.get("brand"):
        out["marka"] = match.get("brand")
    return {"ok": True, "tovar": out}


@tool(
    name="low_stock",
    description=(
        "Qoldig'i kam yoki tugagan tovarlar ro'yxati (eng kritikdan boshlab). "
        "«Nima tugab qolgan?», «nima olib kelish kerak?» savollari uchun."
    ),
    parameters={
        "type": "object",
        "properties": {
            "threshold": {"type": "integer", "description": "Shu sondan kam qolganlar (standart 3)"},
            "include_out_of_stock": {"type": "boolean", "description": "Butunlay tugaganlarni ham (standart: true)"},
            "limit": {"type": "integer", "description": "Maksimal natija (standart 20)"},
        },
    },
)
async def _t_low_stock(ctx, threshold=3, include_out_of_stock=True, limit=20):
    th = max(0, safe_int(threshold, 3) or 3)
    limit = max(1, min(safe_int(limit, 20) or 20, _MAX_LIST))
    items = [p for p in await ctx.products() if not p.get("is_draft")]

    low, out_of = [], []
    for p in items:
        s = stock_of(p)
        if s <= 0:
            out_of.append(p)
        elif s <= th:
            low.append(p)
    low.sort(key=stock_of)

    result = {
        "ok": True,
        "chegara": th,
        "kam_qolgan_soni": len(low),
        "tugagan_soni": len(out_of),
        "kam_qolgan": [_product_brief(p, with_sizes=False) for p in low[:limit]],
    }
    if include_out_of_stock:
        result["tugagan"] = [_product_brief(p, with_sizes=False) for p in out_of[:limit]]
    return result


@tool(
    name="catalog_summary",
    description=(
        "Ombor umumiy holati: jami tovar turi, sotuvda bori, tugagani, "
        "qoralamalar soni, ombor puldagi qiymati va eng to'la kategoriyalar."
    ),
    parameters=_NO_ARGS,
)
async def _t_catalog_summary(ctx):
    items = await ctx.products()
    live = [p for p in items if not p.get("is_draft")]
    drafts = len(items) - len(live)

    in_stock = out_of = 0
    value = 0
    by_cat = {}
    for p in live:
        s = stock_of(p)
        value += max(0, s) * max(0, price_of(p))
        if s > 0:
            in_stock += 1
        else:
            out_of += 1
        for _, c in fb_items(p.get("categories")) or ([("0", p.get("category"))] if p.get("category") else []):
            c = str(c or "").strip()
            if c:
                by_cat[c] = by_cat.get(c, 0) + 1

    top_cats = sorted(by_cat.items(), key=lambda x: -x[1])[:10]
    return {
        "ok": True,
        "jami_tovar_turi": len(live),
        "sotuvda_bor": in_stock,
        "tugagan": out_of,
        "qoralama": drafts,
        "ombor_qiymati_som": value,
        "ombor_qiymati_matn": fmt_som(value) + " so'm",
        "eng_toa_kategoriyalar": [{"kategoriya": c, "tovar_soni": n} for c, n in top_cats],
    }


def _iter_orders(users):
    """Barcha foydalanuvchilarning buyurtmalarini (uid, mijoz_nomi, buyurtma) beradi."""
    for uid, u in users:
        prof = u.get("profile") if isinstance(u.get("profile"), dict) else {}
        cname = str(prof.get("name") or "").strip() or f"ID {uid}"
        for _, o in fb_items(u.get("orders")):
            if isinstance(o, dict):
                yield uid, cname, o


_PERIODS = {"1d": 1, "bugun": 1, "7d": 7, "hafta": 7, "30d": 30, "oy": 30, "90d": 90}


@tool(
    name="sales_report",
    description=(
        "Savdo hisoboti: buyurtma soni, tushum, o'rtacha buyurtma, holatlar "
        "kesimi va eng ko'p sotilgan tovarlar. Davrni tanlash mumkin."
    ),
    parameters={
        "type": "object",
        "properties": {
            "period": {
                "type": "string",
                "enum": ["1d", "7d", "30d", "90d", "all"],
                "description": "Davr: 1d (bugun), 7d, 30d, 90d yoki all (butun tarix)",
            },
            "top_limit": {"type": "integer", "description": "Eng ko'p sotilgan nechta tovar (standart 10)"},
        },
    },
)
async def _t_sales_report(ctx, period="30d", top_limit=10):
    top_limit = max(1, min(safe_int(top_limit, 10) or 10, _MAX_LIST))
    key = norm(period) or "30d"
    days = None if key in ("all", "hammasi", "butun") else _PERIODS.get(key, 30)

    now_ms = int(time.time() * 1000)
    window_ms = None if days is None else days * 86_400_000

    users = await ctx.users()
    products = await ctx.products()
    name_by_id = {str(p.get("id")): str(p.get("name") or "").strip()
                  for p in products if p.get("id") is not None}

    by_status = {}
    delivered_cnt = delivered_sum = 0
    in_window_cnt = in_window_sum = 0
    qty_by_pid, name_hint = {}, {}

    for _uid, _cname, o in _iter_orders(users):
        st = str(o.get("status") or "kutilmoqda")
        ts = order_ts(o)
        paid = order_paid(o)

        # Davr filtri: vaqti noma'lum buyurtma (ts=0) davriy hisobga KIRMAYDI,
        # aks holda u har bir davrda qayta sanalib, raqamni buzardi.
        in_window = True
        if window_ms is not None:
            in_window = bool(ts) and 0 <= (now_ms - ts) <= window_ms
        if not in_window:
            continue

        by_status[st] = by_status.get(st, 0) + 1
        if st != "bekor_qilingan":
            in_window_cnt += 1
            in_window_sum += paid
        if st == "yetkazildi":
            delivered_cnt += 1
            delivered_sum += paid
            for pid, qty, nm in order_items_pairs(o.get("items")):
                if qty > 0:
                    qty_by_pid[pid] = qty_by_pid.get(pid, 0) + qty
                    if nm and pid not in name_hint:
                        name_hint[pid] = nm

    top = sorted(qty_by_pid.items(), key=lambda x: -x[1])[:top_limit]
    return {
        "ok": True,
        "davr": "butun tarix" if days is None else f"oxirgi {days} kun",
        "buyurtma_soni": in_window_cnt,
        "aylanma_som": in_window_sum,
        "yetkazilgan_soni": delivered_cnt,
        "yetkazilgan_tushum_som": delivered_sum,
        "yetkazilgan_tushum_matn": fmt_som(delivered_sum) + " so'm",
        "ortacha_buyurtma_som": int(delivered_sum / delivered_cnt) if delivered_cnt else 0,
        "holatlar": by_status,
        "eng_kop_sotilgan": [
            {"id": pid, "nom": name_by_id.get(pid) or name_hint.get(pid) or f"ID {pid}", "sotilgan_dona": q}
            for pid, q in top
        ],
    }


# ⚠️ Bu qiymatlar Mini App bilan AYNAN bir xil bo'lishi SHART.
#    `index.html` dagi `getStatusHTML()` va `changeOrderStatus()` aynan
#    shu satrlarni tekshiradi. Diqqat: «yolda» APOSTROFSIZ (mijoz ko'radigan
#    matn «Yo'lga chiqdi» bo'lsa ham). Apostrof qo'yilsa mijozning buyurtma
#    ro'yxatida holat «Kutilmoqda» bo'lib ko'rinib qoladi.
_ORDER_STATUSES = ["kutilmoqda", "qabul", "yolda", "yetkazildi", "bekor_qilingan"]

# Mijozga yuboriladigan xabar kaliti (bot.py dagi TEXTS bilan bir xil).
_STATUS_MSG_KEY = {
    "qabul": "order_qabul",
    "yolda": "order_yolda",
    "yetkazildi": "order_yetkazildi",
    "bekor_qilingan": "order_bekor_qilingan",
}
# Tasdiq kartochkasida ko'rsatiladigan o'zbekcha nom.
_STATUS_LABEL = {
    "kutilmoqda": "Kutilmoqda",
    "qabul": "Qabul qilindi",
    "yolda": "Yo'lga chiqdi",
    "yetkazildi": "Yetkazib berildi",
    "bekor_qilingan": "Bekor qilingan",
}


@tool(
    name="list_orders",
    description=(
        "Oxirgi buyurtmalar ro'yxati (yangisidan boshlab). Holat bo'yicha "
        "filtrlash mumkin. Har buyurtmada mijoz nomi, summa, holat va "
        "`order_key` (tahrirlash uchun manzil) keladi."
    ),
    parameters={
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": _ORDER_STATUSES + ["all"],
                "description": "Faqat shu holatdagilar yoki 'all'",
            },
            "limit": {"type": "integer", "description": "Maksimal natija (standart 10)"},
        },
    },
)
async def _t_list_orders(ctx, status="all", limit=10):
    limit = max(1, min(safe_int(limit, 10) or 10, _MAX_LIST))
    want = norm(status)
    users = await ctx.users()

    rows = []
    for uid, cname, o in _iter_orders(users):
        st = str(o.get("status") or "kutilmoqda")
        if want and want not in ("all", "hammasi") and norm(st) != want:
            continue
        code = str(o.get("code") or "").strip()
        rows.append({
            "_ts": order_ts(o),
            "kod": code or f"#{o.get('id')}",
            # Kod bo'lmasa `id` ishlatiladi — aks holda kalit bo'sh bo'lib,
            # `set_order_status` o'sha buyurtmani o'zgartira olmasdi.
            "order_key": f"{uid}_{code or o.get('id')}",
            "mijoz": cname,
            "telefon": str(o.get("customerPhone") or "").strip(),
            "summa_som": order_paid(o),
            "holat": st,
            "sana": str(o.get("date") or "").strip(),
            "yetkazish": str(o.get("deliveryMethod") or "").strip(),
            "tovar_soni": sum(q for _, q, _ in order_items_pairs(o.get("items"))),
        })

    rows.sort(key=lambda r: -r["_ts"])
    shown = rows[:limit]
    for r in shown:
        r.pop("_ts", None)
    return {"ok": True, "jami_topildi": len(rows), "buyurtmalar": shown}


@tool(
    name="find_customer",
    description=(
        "Mijozni ismi, telefoni yoki Telegram id'si bo'yicha topadi va uning "
        "xarid tarixini, mashinasini, cashback balansini ko'rsatadi."
    ),
    parameters={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Ism, telefon raqami yoki uid"},
            "limit": {"type": "integer", "description": "Maksimal natija (standart 5)"},
        },
        "required": ["query"],
    },
)
async def _t_find_customer(ctx, query="", limit=5):
    limit = max(1, min(safe_int(limit, 5) or 5, _MAX_LIST))
    q = norm(query)
    if not q:
        return _err("kimni izlashni ayting (ism, telefon yoki id)")

    digits = "".join(ch for ch in q if ch.isdigit())
    users = await ctx.users()
    found = []

    for uid, u in users:
        prof = u.get("profile") if isinstance(u.get("profile"), dict) else {}
        name = str(prof.get("name") or "").strip()
        phone = str(prof.get("phone") or "").strip()
        phone_digits = "".join(ch for ch in phone if ch.isdigit())

        hit = (q in norm(name)) or (str(uid) == q)
        if not hit and digits and len(digits) >= 4 and digits in phone_digits:
            hit = True
        if not hit:
            continue

        orders = [o for _, o in fb_items(u.get("orders")) if isinstance(o, dict)]
        delivered = [o for o in orders if str(o.get("status")) == "yetkazildi"]
        spent = sum(order_paid(o) for o in delivered)

        ph2 = u.get("phase2") if isinstance(u.get("phase2"), dict) else {}
        balance = max(0, (safe_int(ph2.get("cashbackTotal"), 0) or 0)
                      + (safe_int(ph2.get("cashbackRefunded"), 0) or 0)
                      - (safe_int(ph2.get("cashbackSpent"), 0) or 0))

        found.append({
            "uid": uid,
            "ism": name or f"ID {uid}",
            "telefon": phone,
            "mashina": str(u.get("my_car") or "").strip(),
            "buyurtma_soni": len(orders),
            "yetkazilgan": len(delivered),
            "jami_xarid_som": spent,
            "jami_xarid_matn": fmt_som(spent) + " so'm",
            "cashback_balans": balance,
            "vip": bool(prof.get("vip")),
        })

    found.sort(key=lambda r: -r["jami_xarid_som"])
    return {"ok": True, "topildi": len(found), "mijozlar": found[:limit]}


@tool(
    name="list_drafts",
    description=(
        "Qoralama (mijozga ko'rinmaydigan, rasmi/ma'lumoti to'liq bo'lmagan) "
        "tovarlar ro'yxati. Partiya (batch) bo'yicha guruhlangan."
    ),
    parameters={
        "type": "object",
        "properties": {
            "limit": {"type": "integer", "description": "Maksimal natija (standart 20)"},
        },
    },
)
async def _t_list_drafts(ctx, limit=20):
    limit = max(1, min(safe_int(limit, 20) or 20, _MAX_LIST))
    drafts = [p for p in await ctx.products() if p.get("is_draft")]

    by_batch = {}
    for p in drafts:
        b = str(p.get("batch_id") or "(partiyasiz)").strip()
        by_batch[b] = by_batch.get(b, 0) + 1

    return {
        "ok": True,
        "jami_qoralama": len(drafts),
        "partiyalar": [{"partiya": b, "soni": n}
                       for b, n in sorted(by_batch.items(), key=lambda x: -x[1])],
        "tovarlar": [_product_brief(p, with_sizes=False) for p in drafts[:limit]],
    }


# =====================================================================
#  YOZISH VOSITALARI
#
#  ⚠️ HECH BIRI TO'G'RIDAN YOZMAYDI. Har biri faqat REJA tuzadi va
#     `create_pending()` bilan tasdiq navbatiga qo'yadi. Haqiqiy yozish
#     xo'jayin tugmani bosgandan keyin, `apply_plan()` da bo'ladi.
#
#  NEGA SHUNDAY:
#     Mijoz chatiga yoki tovar sharhiga «hamma narxni 1 so'm qil» deb
#     yozilsa, o'sha matn AI kontekstiga tushishi mumkin (prompt
#     injection). Tugma bo'lsa — AI aldangan taqdirda ham hech narsa
#     o'zgarmaydi, chunki oxirgi qaror INSONDA qoladi.
# =====================================================================

def _to_float(v, default=None):
    try:
        return float(str(v).strip().replace(",", "."))
    except (TypeError, ValueError, AttributeError):
        return default


async def _resolve_product(ctx, product_id):
    """`product_id` bo'yicha tovarni topadi. `(tovar, xato)` qaytaradi."""
    pid = safe_int(product_id, None)
    if pid is None:
        return None, _err("`product_id` butun son bo'lishi kerak "
                          "(search_products bilan toping)")
    for p in await ctx.products():
        if safe_int(p.get("id"), None) == pid:
            return p, None
    return None, _err(f"id={pid} bo'lgan tovar topilmadi")


_P_ID = {"product_id": {"type": "integer", "description": "Tovar id raqami (search_products bilan toping)"}}


@tool(
    name="set_price",
    mutating=True,
    description=(
        "Tovarning narxini o'zgartiradi. DARHOL bajarilmaydi — xo'jayinga "
        "tasdiq tugmasi yuboriladi."
    ),
    parameters={
        "type": "object",
        "properties": dict(_P_ID, **{
            "new_price": {"type": "integer", "description": "Yangi narx, so'mda (butun son)"},
        }),
        "required": ["product_id", "new_price"],
    },
)
async def _t_set_price(ctx, product_id=None, new_price=None):
    p, err = await _resolve_product(ctx, product_id)
    if err:
        return err
    price = safe_int(new_price, None)
    if price is None or price <= 0:
        return _err("narx 0 dan katta butun son bo'lishi kerak")
    if price > MAX_PRICE:
        return _err(f"narx juda katta (chegara {fmt_som(MAX_PRICE)} so'm) — "
                    "raqamni tekshiring")
    if _flash_active(p):
        return _err("bu tovarda FLASH chegirma aktiv. Avval `cancel_flash_sale` "
                    "bilan bekor qiling, keyin narxni o'zgartiring (aks holda "
                    "chegirma hisobi buziladi)")
    cur = price_of(p)
    if cur == price:
        return _err(f"narx allaqachon {fmt_som(price)} so'm — o'zgartirish shart emas")

    pct = _pct_change(cur, price)
    warning = ""
    if pct is not None and abs(pct) >= BIG_CHANGE_PCT:
        warning = (f"Narx {abs(pct)}% ga {'OSHADI' if pct > 0 else 'TUSHADI'} — "
                   "bu juda katta o'zgarish. Raqamni tekshirib tasdiqlang!")

    plan = [{
        "kind": "product", "id": p.get("id"), "label": product_label(p),
        "set": {"price": price}, "old": _snapshot(p, ["price"]),
    }]
    return await create_pending(ctx, "set_price",
                                {"product_id": p.get("id"), "new_price": price},
                                plan, warning)


@tool(
    name="set_stock",
    mutating=True,
    description=(
        "Tovarning ombordagi qoldig'ini o'zgartiradi. Razmerli tovarda "
        "`size` ni ham berish SHART. Tasdiq tugmasi yuboriladi."
    ),
    parameters={
        "type": "object",
        "properties": dict(_P_ID, **{
            "new_stock": {"type": "integer", "description": "Yangi qoldiq (0 yoki undan katta)"},
            "size": {"type": "string", "description": "Razmer nomi (faqat razmerli tovarda)"},
        }),
        "required": ["product_id", "new_stock"],
    },
)
async def _t_set_stock(ctx, product_id=None, new_stock=None, size=None):
    p, err = await _resolve_product(ctx, product_id)
    if err:
        return err
    st = safe_int(new_stock, None)
    if st is None or st < 0:
        return _err("qoldiq 0 yoki undan katta butun son bo'lishi kerak")
    if st > MAX_STOCK:
        return _err(f"qoldiq juda katta (chegara {MAX_STOCK}) — raqamni tekshiring")

    sizes = sizes_of(p)
    size_name = str(size or "").strip()

    if sizes and not size_name:
        return _err("bu RAZMERLI tovar — qaysi razmer ekanini `size` da bering",
                    mavjud_razmerlar=[{"razmer": s, "qoldiq": q} for s, q in sizes])
    if size_name and not sizes:
        return _err("bu tovarda razmer yo'q — `size` bermang")

    if sizes:
        found = [(s, q) for s, q in sizes if s == size_name]
        if not found:
            return _err(f"«{size_name}» razmeri yo'q",
                        mavjud_razmerlar=[s for s, _ in sizes])
        _s, old_q = found[0]
        if old_q == st:
            return _err(f"«{size_name}» razmerida allaqachon {st} dona")
        plan = [{
            "kind": "product_size", "id": p.get("id"), "label": product_label(p),
            "size": size_name, "set": st, "old": old_q,
        }]
    else:
        old_snap = _snapshot(p, ["stock"])
        if (safe_int(old_snap.get("stock"), None) or 0) == st and old_snap.get("stock") != DEL:
            return _err(f"qoldiq allaqachon {st} dona")
        plan = [{
            "kind": "product", "id": p.get("id"), "label": product_label(p),
            "set": {"stock": st}, "old": old_snap,
        }]

    return await create_pending(ctx, "set_stock",
                                {"product_id": p.get("id"), "new_stock": st,
                                 "size": size_name}, plan)


@tool(
    name="bulk_adjust_price",
    mutating=True,
    description=(
        "Bir necha tovarning narxini foizga oshiradi yoki tushiradi "
        "(masalan +8% yoki -15%). Avval `search_products` bilan id'larni "
        "toping. Yangi narx 1000 so'mga yaxlitlanadi. Tasdiq yuboriladi."
    ),
    parameters={
        "type": "object",
        "properties": {
            "product_ids": {
                "type": "array",
                "items": {"type": "integer"},
                "description": f"Tovar id'lari (eng ko'p {MAX_BULK_ITEMS} ta)",
            },
            "percent": {
                "type": "number",
                "description": "Foiz: 8 = +8% qimmatlashtirish, -15 = 15% arzonlashtirish",
            },
        },
        "required": ["product_ids", "percent"],
    },
)
async def _t_bulk_adjust_price(ctx, product_ids=None, percent=None):
    pct = _to_float(percent, None)
    if pct is None or pct == 0:
        return _err("`percent` noldan farqli son bo'lishi kerak (mas. 8 yoki -15)")
    if not (-90 <= pct <= 1000):
        return _err("foiz -90 dan +1000 gacha bo'lishi kerak")

    ids = [safe_int(x, None) for x in (product_ids or [])]
    ids = [i for i in ids if i is not None]
    if not ids:
        return _err("`product_ids` bo'sh — avval `search_products` bilan toping")
    if len(ids) > MAX_BULK_ITEMS:
        return _err(f"bir vaqtda eng ko'p {MAX_BULK_ITEMS} ta tovarga tegish mumkin "
                    f"(so'ralgan: {len(ids)}). Qismlarga bo'lib bajaring")

    by_id = {safe_int(p.get("id"), None): p for p in await ctx.products()}
    plan, skipped = [], []
    for pid in ids:
        p = by_id.get(pid)
        if p is None:
            skipped.append({"id": pid, "sabab": "topilmadi"})
            continue
        if _flash_active(p):
            skipped.append({"id": pid, "nom": product_label(p),
                            "sabab": "flash chegirma aktiv"})
            continue
        cur = price_of(p)
        if cur <= 0:
            skipped.append({"id": pid, "nom": product_label(p), "sabab": "narxi yo'q"})
            continue
        new = int(round(cur * (1 + pct / 100.0) / 1000.0)) * 1000
        if new <= 0:
            skipped.append({"id": pid, "nom": product_label(p),
                            "sabab": "natija 0 yoki manfiy"})
            continue
        if new == cur:
            skipped.append({"id": pid, "nom": product_label(p),
                            "sabab": "yaxlitlashdan keyin narx o'zgarmadi"})
            continue
        if new > MAX_PRICE:
            skipped.append({"id": pid, "nom": product_label(p), "sabab": "narx chegaradan oshdi"})
            continue
        plan.append({
            "kind": "product", "id": pid, "label": product_label(p),
            "set": {"price": new}, "old": _snapshot(p, ["price"]),
        })

    if not plan:
        return _err("hech bir tovar narxi o'zgartirilmadi", tashlab_ketilganlar=skipped)

    warning = ""
    if abs(pct) >= BIG_CHANGE_PCT:
        warning = f"{len(plan)} ta tovar narxi {abs(pct)}% ga o'zgaradi — katta o'zgarish!"
    elif len(plan) >= 10:
        warning = f"{len(plan)} ta tovarga bir yo'la ta'sir qiladi."

    res = await create_pending(ctx, "bulk_adjust_price",
                               {"product_ids": ids, "percent": pct}, plan, warning)
    if isinstance(res, dict) and res.get("ok") and skipped:
        res["tashlab_ketilganlar"] = skipped
    return res


_TEXT_FIELDS = {"name": "nom", "desc": "tavsif", "code": "kod"}


@tool(
    name="update_product_text",
    mutating=True,
    description=(
        "Tovarning NOMI, TAVSIFI yoki KODINI o'zgartiradi. Narx va qoldiq "
        "uchun `set_price` / `set_stock` ishlatiladi. Tasdiq yuboriladi."
    ),
    parameters={
        "type": "object",
        "properties": dict(_P_ID, **{
            "name": {"type": "string", "description": "Yangi nom"},
            "desc": {"type": "string", "description": "Yangi tavsif"},
            "code": {"type": "string", "description": "Yangi kod (artikul)"},
        }),
        "required": ["product_id"],
    },
)
async def _t_update_product_text(ctx, product_id=None, name=None, desc=None, code=None):
    p, err = await _resolve_product(ctx, product_id)
    if err:
        return err

    incoming = {"name": name, "desc": desc, "code": code}
    changes = {}
    for field, val in incoming.items():
        if val is None:
            continue
        val = str(val).strip()
        if field == "name" and not val:
            return _err("nomni bo'sh qoldirib bo'lmaydi")
        if len(val) > 500:
            return _err(f"{_TEXT_FIELDS[field]} juda uzun (500 belgidan kam bo'lsin)")
        if str(p.get(field) or "").strip() == val:
            continue
        changes[field] = val

    if not changes:
        return _err("o'zgartirish uchun yangi qiymat berilmadi (yoki bir xil)")

    plan = [{
        "kind": "product", "id": p.get("id"), "label": product_label(p),
        "set": changes, "old": _snapshot(p, list(changes)),
    }]
    return await create_pending(ctx, "update_product_text",
                                {"product_id": p.get("id"), **changes}, plan)


@tool(
    name="set_product_visibility",
    mutating=True,
    description=(
        "Tovarni mijozlarga KO'RSATADI (qoralamadan chiqaradi) yoki "
        "YASHIRADI (qoralamaga oladi). Tasdiq yuboriladi."
    ),
    parameters={
        "type": "object",
        "properties": dict(_P_ID, **{
            "visible": {"type": "boolean",
                        "description": "true = mijozlar ko'radi, false = yashiriladi"},
        }),
        "required": ["product_id", "visible"],
    },
)
async def _t_set_product_visibility(ctx, product_id=None, visible=None):
    p, err = await _resolve_product(ctx, product_id)
    if err:
        return err
    if visible is None:
        return _err("`visible` true yoki false bo'lishi kerak")
    want_visible = bool(visible)
    is_draft = bool(p.get("is_draft"))
    if want_visible == (not is_draft):
        return _err("tovar allaqachon shu holatda")

    if want_visible:
        # ⚠️ Mini App'dagi tekshiruv bilan AYNAN bir xil (`saveEditProduct`):
        #    nom + narx + kamida 1 rasm. Aks holda katalogda rasmsiz,
        #    narxsiz "buzuq" kartochka paydo bo'lardi.
        missing = []
        if not str(p.get("name") or "").strip():
            missing.append("nom")
        if price_of(p) <= 0:
            missing.append("narx")
        imgs = [u for _, u in fb_items(p.get("images")) if u] or \
               ([p.get("img")] if p.get("img") else [])
        if not imgs:
            missing.append("kamida 1 rasm")
        if p.get("product_type") == "razmerli" and not sizes_of(p):
            missing.append("kamida 1 razmer")
        if missing:
            return _err("tovarni mijozlarga chiqarish uchun quyidagilar yetishmaydi: "
                        + ", ".join(missing)
                        + ". Rasmni Mini App'dagi «Qoralamalar» bo'limidan yuklang.")
        changes = {"is_draft": DEL}
    else:
        changes = {"is_draft": True}

    plan = [{
        "kind": "product", "id": p.get("id"), "label": product_label(p),
        "set": changes, "old": _snapshot(p, ["is_draft"]),
    }]
    return await create_pending(ctx, "set_product_visibility",
                                {"product_id": p.get("id"), "visible": want_visible},
                                plan)


@tool(
    name="create_flash_sale",
    mutating=True,
    description=(
        "Tovarga vaqtincha FLASH chegirma qo'yadi: narx tushadi, eski narx "
        "chizilgan holda ko'rinadi va taymer ishlaydi. Tasdiq yuboriladi."
    ),
    parameters={
        "type": "object",
        "properties": dict(_P_ID, **{
            "flash_price": {"type": "integer", "description": "Chegirmali narx (joriy narxdan kichik)"},
            "hours": {"type": "number", "description": "Necha soat davom etadi (0.5 – 720)"},
        }),
        "required": ["product_id", "flash_price", "hours"],
    },
)
async def _t_create_flash_sale(ctx, product_id=None, flash_price=None, hours=None):
    p, err = await _resolve_product(ctx, product_id)
    if err:
        return err
    if _flash_active(p):
        return _err("bu tovarda flash chegirma allaqachon aktiv — avval "
                    "`cancel_flash_sale` bilan bekor qiling")
    fp = safe_int(flash_price, None)
    cur = price_of(p)
    if fp is None or fp <= 0:
        return _err("chegirmali narx 0 dan katta butun son bo'lishi kerak")
    if cur <= 0:
        return _err("tovarning joriy narxi yo'q — avval `set_price` bilan qo'ying")
    if fp >= cur:
        return _err(f"chegirmali narx joriy narxdan ({fmt_som(cur)} so'm) KICHIK bo'lishi kerak")
    h = _to_float(hours, None)
    if h is None or not (0.5 <= h <= 720):
        return _err("muddat 0.5 dan 720 soatgacha bo'lishi kerak")

    until = int(time.time() * 1000) + int(round(h * 3_600_000))
    plan = [{
        "kind": "product", "id": p.get("id"), "label": product_label(p),
        # Mini App bilan bir xil sxema: price = chegirmali, oldPrice = asl.
        "set": {"price": fp, "oldPrice": cur, "flashUntil": until},
        "old": _snapshot(p, ["price", "oldPrice", "flashUntil"]),
    }]
    disc = round((1 - fp / cur) * 100)
    return await create_pending(
        ctx, "create_flash_sale",
        {"product_id": p.get("id"), "flash_price": fp, "hours": h}, plan,
        f"Chegirma {disc}% bo'ladi." if disc >= BIG_CHANGE_PCT else "")


@tool(
    name="cancel_flash_sale",
    mutating=True,
    description="Flash chegirmani bekor qiladi va ASL narxni tiklaydi. Tasdiq yuboriladi.",
    parameters={"type": "object", "properties": dict(_P_ID),
                "required": ["product_id"]},
)
async def _t_cancel_flash_sale(ctx, product_id=None):
    p, err = await _resolve_product(ctx, product_id)
    if err:
        return err
    real = safe_int(p.get("oldPrice"), 0) or 0
    if not _flash_active(p) and real <= 0:
        return _err("bu tovarda flash chegirma yo'q")
    if real <= 0:
        return _err("asl narx (oldPrice) saqlanmagan — narxni `set_price` bilan qo'lda qo'ying")

    plan = [{
        "kind": "product", "id": p.get("id"), "label": product_label(p),
        "set": {"price": real, "oldPrice": DEL, "flashUntil": DEL},
        "old": _snapshot(p, ["price", "oldPrice", "flashUntil"]),
    }]
    return await create_pending(ctx, "cancel_flash_sale",
                                {"product_id": p.get("id")}, plan)


@tool(
    name="set_order_status",
    mutating=True,
    description=(
        "Buyurtma holatini o'zgartiradi va MIJOZGA avtomatik xabar yuboradi. "
        "`order_key` ni `list_orders` dan oling. Tasdiq yuboriladi."
    ),
    parameters={
        "type": "object",
        "properties": {
            "order_key": {"type": "string",
                          "description": "list_orders bergan kalit, masalan '111_A-1'"},
            "status": {"type": "string", "enum": _ORDER_STATUSES,
                       "description": "Yangi holat"},
        },
        "required": ["order_key", "status"],
    },
)
async def _t_set_order_status(ctx, order_key=None, status=None):
    key = str(order_key or "").strip()
    if "_" not in key:
        return _err("`order_key` '<uid>_<kod>' shaklida bo'lishi kerak "
                    "(list_orders dan oling)")
    new_status = str(status or "").strip()
    if new_status not in _ORDER_STATUSES:
        return _err(f"holat quyidagilardan biri bo'lishi kerak: {', '.join(_ORDER_STATUSES)}")

    uid, ident = key.split("_", 1)
    raw = await ctx.node(f"users/{uid}/orders")
    target = None
    for _k, o in fb_items(raw):
        if not isinstance(o, dict):
            continue
        if str(o.get("code") or "").strip() == ident or str(o.get("id")) == ident:
            target = o
            break
    if target is None:
        return _err(f"«{key}» buyurtmasi topilmadi")

    old_status = str(target.get("status") or "kutilmoqda")
    if old_status == new_status:
        return _err(f"holat allaqachon «{_STATUS_LABEL.get(new_status, new_status)}»")

    prof = await ctx.node(f"users/{uid}/profile")
    cname = ""
    if isinstance(prof, dict):
        cname = str(prof.get("name") or "").strip()

    warning = ""
    if new_status == "bekor_qilingan":
        warning = ("Buyurtma bekor qilinadi. Mijozga xabar boradi va berilgan "
                   "cashback qaytarib olinadi.")
    elif new_status == "yetkazildi":
        warning = "Yetkazildi belgilansa — mijozga cashback va kafolat beriladi."

    plan = [{
        "kind": "order_status", "uid": str(uid),
        "order_id": target.get("id"),
        "code": str(target.get("code") or target.get("id")),
        "label": cname or f"ID {uid}",
        "set": new_status, "old": old_status, "notify": True,
    }]
    return await create_pending(ctx, "set_order_status",
                                {"order_key": key, "status": new_status},
                                plan, warning)


# =====================================================================
#  AUDIT JURNALI
#  Har bir agent navbati va (2-qismda) har bir o'zgartirish yoziladi.
#  Bu ikki narsa uchun hayotiy:
#    • Nosozlikni izlash: "AI nega shunday javob berdi?" — qaysi vosita
#      qanday argument bilan chaqirilganini ko'rish mumkin.
#    • 2-qismdagi ORQAGA QAYTARISH (undo) — oldingi qiymat shu yerda
#      saqlanadi.
# =====================================================================
def _audit_key():
    """Vaqt bo'yicha tartiblanadigan, to'qnashmaydigan kalit.

    RTDB push-id ishlatmaymiz, chunki u POST talab qiladi; bizda esa
    faqat PATCH yordamchisi bor. Millisekund + tasodifiy qo'shimcha
    amalda to'qnashishni imkonsiz qiladi va kalitlar VAQT BO'YICHA
    o'sib boradi (RTDB'da tartiblash oson).
    """
    return f"{int(time.time() * 1000)}_{random.randint(1000, 9999)}"


async def audit(deps, user_id, kind, payload):
    """Audit yozuvi. Xato bo'lsa ham asosiy ishni BUZMAYDI.

    Yozilgan kalitni (yoki None) qaytaradi — «orqaga qaytarish» uchun
    o'sha yozuvni keyin belgilash kerak bo'ladi.
    """
    try:
        key = _audit_key()
        rec = {"ts": int(time.time() * 1000), "uid": safe_int(user_id, 0) or 0,
               "kind": str(kind)}
        rec.update(payload or {})
        ok = await deps.firebase_patch(f"audit_log/{key}", rec)
        return key if ok else None
    except Exception as e:
        logging.warning("Audit yozilmadi (%s): %s", kind, e)
        return None


async def last_undoable_mutation(deps, user_id, scan=25):
    """Oxirgi QAYTARISH mumkin bo'lgan o'zgartirishni topadi.

    Butun jurnalni o'qimaymiz — RTDB so'rovi bilan faqat oxirgi `scan`
    tasini olamiz. Audit kalitlari `<millisekund>_<tasodif>` shaklida,
    ya'ni leksikografik tartib = vaqt tartibi (13 xonali ms yaqin
    250 yil davomida bir xil uzunlikda qoladi).
    """
    if not deps.firebase_query:
        return None, None
    raw = await deps.firebase_query("audit_log",
                                    {"orderBy": '"$key"', "limitToLast": str(scan)})
    rows = [(k, v) for k, v in fb_items(raw) if isinstance(v, dict)]
    rows.sort(key=lambda kv: kv[0], reverse=True)
    uid = safe_int(user_id, 0) or 0
    for key, rec in rows:
        if rec.get("kind") != "mutation":
            continue
        if (safe_int(rec.get("uid"), 0) or 0) != uid:
            continue
        if rec.get("reverted") or rec.get("is_undo"):
            continue
        if not rec.get("plan"):
            continue
        return key, rec
    return None, None


# =====================================================================
#  ATOMIK YOZISH PRIMITIVI (optimistik qulflash)
#
#  NEGA SHUNCHA EHTIYOTKORLIK:
#    `products` va `users/{uid}/orders` — RTDB'da MASSIV. Indekslar
#    siljiydi:
#      • mini app tovar o'chirsa (`_rewriteProductsSafely`) keyingi
#        barcha tovar indeksi 1 ga kamayadi;
#      • yangi buyurtma `unshift` bilan qo'shiladi, ya'ni 0-indeksga —
#        BARCHA eski buyurtmalar suriladi.
#    Bundan tashqari tasdiq tugmasi bosilishi bilan ko'rish orasida
#    daqiqalar o'tishi mumkin. Ya'ni "oldin o'qib qo'yilgan indeks" ga
#    yozish — BOSHQA tovarni buzish demakdir.
#
#  YECHIM: yozish paytida indeks `id` bo'yicha QAYTA topiladi, slot
#  ETag bilan o'qiladi va `if-match` bilan yoziladi. Oradan boshqa
#  kimsa yozib qo'ysa 412 keladi va biz qaytadan urinamiz. Ya'ni
#  hech kimning ishi jimgina yo'qolmaydi.
# =====================================================================
_ATOMIC_RETRIES = 4


def _find_index_by_id(raw, match_id, id_field="id"):
    """Massiv/lug'atdan `id` bo'yicha RTDB kalitini topadi."""
    want = str(match_id)
    for key, item in fb_items(raw):
        if isinstance(item, dict) and str(item.get(id_field)) == want:
            return key
    return None


async def atomic_update_by_id(deps, base_path, match_id, mutate,
                              id_field="id"):
    """`base_path` massivida `id` bo'yicha yozuvni ATOMIK o'zgartiradi.

    mutate(joriy_dict) -> yangi_dict | None (None = o'zgarish shart emas)
    Qaytaradi: (muvaffaqiyatmi, xato_matni, oldingi_qiymat)
    """
    if not deps.can_write():
        return False, "yozish yordamchilari sozlanmagan", None

    for attempt in range(_ATOMIC_RETRIES):
        raw = await deps.firebase_get(base_path)
        key = _find_index_by_id(raw, match_id, id_field)
        if key is None:
            return False, f"yozuv topilmadi ({id_field}={match_id})", None

        path = f"{base_path}/{key}"
        etag, value = await deps.firebase_get_etag(path)
        if not isinstance(value, dict):
            # Slot bo'shab qolgan — indeks siljigan bo'lishi mumkin, qayta o'qiymiz.
            continue
        if str(value.get(id_field)) != str(match_id):
            # Indeks siljidi: bu slotda BOSHQA yozuv turibdi. Yozmaymiz!
            logging.info("atomic_update: indeks siljidi (%s), qayta izlanadi", path)
            continue

        try:
            new_value = mutate(dict(value))
        except Exception as e:
            return False, f"o'zgartirish hisoblanmadi: {e}", value
        if new_value is None:
            return False, "o'zgarish talab qilinmadi", value

        ok, status = await deps.firebase_put(path, new_value, etag=etag)
        if ok:
            return True, "", value
        if status == 412:
            # Poyga: oradan boshqasi yozdi. Yangi ma'lumot bilan qayta urinamiz.
            logging.info("atomic_update: 412 (poyga) — %s, qayta urinish %s",
                         path, attempt + 1)
            continue
        return False, f"bazaga yozilmadi (status={status})", value

    return False, "baza band — bir oz kutib qayta urinib ko'ring", None


# =====================================================================
#  REJA (PLAN) — o'zgarishning mashina o'qiy oladigan tavsifi
#
#  Bitta tuzilma TO'RT vazifani bajaradi:
#    1) tasdiq kartochkasini chizish (xo'jayin nimani tasdiqlayotganini
#       aynan ko'radi);
#    2) tasdiq paytida "ma'lumot o'zgarib ketmadimi" tekshiruvi
#       (`old` qiymatlar bilan solishtirish);
#    3) bajarish;
#    4) ORQAGA QAYTARISH — `set` va `old` ni almashtirish kifoya.
#  Shu sababli reja aniq, cheklangan shakllardan iborat.
# =====================================================================
# Maydonni O'CHIRISH belgisi.
# ⚠️ NEGA `None` EMAS: reja Firebase'ga saqlanadi, RTDB esa `null`
#    qiymatli kalitni butunlay TASHLAB ketadi. Ya'ni {"oldPrice": None}
#    saqlangach yo'qolardi va "bu maydonni o'chir" ko'rsatmasi jimgina
#    yo'qolib, flash chegirma bekor qilinmay qolardi.
DEL = "__del__"

MAX_PRICE = 500_000_000     # 500 mln so'm — real narxdan ancha yuqori chegara
MAX_STOCK = 100_000


def _esc(s):
    """Telegram HTML uchun xavfsizlashtirish."""
    return (str(s if s is not None else "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _apply_set(obj, changes):
    """`set` lug'atini obyektga qo'llaydi (DEL bo'lsa maydonni o'chiradi)."""
    for field, val in (changes or {}).items():
        if val == DEL:
            obj.pop(field, None)
        else:
            obj[field] = val
    return obj


def _snapshot(obj, fields):
    """`fields` bo'yicha joriy qiymatlarni oladi (yo'q maydon -> DEL)."""
    out = {}
    for f in fields:
        out[f] = obj[f] if f in obj else DEL
    return out


def _flash_active(p):
    """Tovarda flash chegirma HOZIR aktivmi (index.html `_flashActive` bilan bir xil)."""
    until = safe_int((p or {}).get("flashUntil"), 0) or 0
    old = safe_int((p or {}).get("oldPrice"), 0) or 0
    return bool(until > int(time.time() * 1000) and old > price_of(p) > 0)


def _pct_change(old, new):
    old = safe_int(old, 0) or 0
    if old <= 0:
        return None
    return round((safe_int(new, 0) or 0) / old * 100 - 100, 1)


def render_plan_preview(plan, warning=""):
    """Tasdiq kartochkasi matni (Telegram HTML)."""
    lines = ["⚠️ <b>Tasdiqlash kerak</b>", ""]
    for item in plan or []:
        kind = item.get("kind")
        label = _esc(item.get("label") or "")
        if kind == "product":
            lines.append(f"📦 <b>{label}</b>")
            for field, new in (item.get("set") or {}).items():
                old = (item.get("old") or {}).get(field, DEL)
                lines.append("   " + _field_line(field, old, new))
        elif kind == "product_size":
            lines.append(f"📦 <b>{label}</b>")
            lines.append(f"   Razmer <b>{_esc(item.get('size'))}</b> qoldiq: "
                         f"{_esc(item.get('old'))} → <b>{_esc(item.get('set'))}</b> dona")
        elif kind == "order_status":
            old_l = _STATUS_LABEL.get(item.get("old"), item.get("old"))
            new_l = _STATUS_LABEL.get(item.get("set"), item.get("set"))
            lines.append(f"🧾 <b>Buyurtma #{_esc(item.get('code'))}</b> — {label}")
            lines.append(f"   Holat: {_esc(old_l)} → <b>{_esc(new_l)}</b>")
            if item.get("notify"):
                lines.append("   <i>Mijozga xabar yuboriladi</i>")
        lines.append("")
    if warning:
        lines.append(f"🔴 <b>{_esc(warning)}</b>")
        lines.append("")
    lines.append(f"<i>Tugma {PENDING_TTL_SEC // 60} daqiqa amal qiladi.</i>")
    return "\n".join(lines).strip()


def _field_line(field, old, new):
    """Bitta maydon o'zgarishining o'qiladigan satri."""
    names = {"price": "Narx", "stock": "Qoldiq", "name": "Nom",
             "desc": "Tavsif", "code": "Kod", "oldPrice": "Eski narx",
             "flashUntil": "Flash tugashi", "is_draft": "Qoralama"}
    nm = names.get(field, field)
    if field in ("price", "oldPrice"):
        o = "yo'q" if old == DEL else f"{fmt_som(old)} so'm"
        n = "o'chiriladi" if new == DEL else f"{fmt_som(new)} so'm"
        pct = _pct_change(old, new) if (old != DEL and new != DEL) else None
        tail = f"  ({'+' if pct and pct > 0 else ''}{pct}%)" if pct else ""
        return f"{nm}: {o} → <b>{n}</b>{tail}"
    if field == "is_draft":
        return ("Holat: mijozlarga <b>KO'RINADI</b>" if new == DEL
                else "Holat: <b>qoralamaga</b> olinadi (mijozlar ko'rmaydi)")
    if field == "flashUntil":
        if new == DEL:
            return "Flash chegirma: <b>bekor qilinadi</b>"
        left = max(0, (safe_int(new, 0) or 0) - int(time.time() * 1000)) // 60000
        return f"Flash chegirma: <b>{left // 60} soat {left % 60} daqiqa</b>"
    o = "bo'sh" if old == DEL else str(old)
    n = "o'chiriladi" if new == DEL else str(new)
    if len(o) > 60:
        o = o[:60] + "…"
    if len(n) > 60:
        n = n[:60] + "…"
    return f"{nm}: {_esc(o)} → <b>{_esc(n)}</b>"


def _plan_plain(plan):
    """AI ga qaytariladigan qisqa, teg'siz tavsif."""
    out = []
    for item in plan or []:
        kind = item.get("kind")
        label = item.get("label") or ""
        if kind == "product":
            bits = []
            for field, new in (item.get("set") or {}).items():
                old = (item.get("old") or {}).get(field, DEL)
                bits.append(f"{field}: {old} -> {new}")
            out.append(f"{label} ({'; '.join(bits)})")
        elif kind == "product_size":
            out.append(f"{label} razmer {item.get('size')}: "
                       f"{item.get('old')} -> {item.get('set')}")
        elif kind == "order_status":
            out.append(f"buyurtma #{item.get('code')}: "
                       f"{item.get('old')} -> {item.get('set')}")
    return "; ".join(out)


# =====================================================================
#  TASDIQ KUTAYOTGAN AMALLAR (pending_actions)
#
#  Firebase'da saqlanadi, xotirada EMAS: bot Render'da har deployda
#  qayta ishga tushadi va bepul tarifda uxlab qolishi mumkin. Xotirada
#  saqlansa, xo'jayin tugmani bosganda «amal topilmadi» chiqardi.
# =====================================================================
_TOKEN_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"


def _pending_token():
    """Qisqa token. `callback_data` 64 baytdan oshmasligi kerak —
    `aia:<12 belgi>:1` = 18 bayt, ya'ni bemalol sig'adi."""
    return "".join(random.choice(_TOKEN_CHARS) for _ in range(12))


async def store_pending(deps, user_id, tool, args, plan, warning="", extra=None):
    """Tasdiq yozuvini Firebase'ga saqlaydi. `(token, yozuv)` yoki (None, None).

    `create_pending` (vosita ichidan) va `undo_last` (buyruq ichidan) —
    ikkisi ham shu funksiyani ishlatadi, shunda yozuv shakli bir xil
    bo'ladi va tasdiq/bajarish yo'li ikkiga ajralmaydi.
    """
    token = _pending_token()
    now = int(time.time() * 1000)
    rec = {
        "tool": str(tool),
        "args": args or {},
        "plan": plan,
        "warning": str(warning or ""),
        "uid": safe_int(user_id, 0) or 0,
        "created": now,
        "expires": now + PENDING_TTL_SEC * 1000,
        "status": "pending",
    }
    if extra:
        rec.update(extra)
    ok = await deps.firebase_patch(f"pending_actions/{token}", rec)
    return (token, rec) if ok else (None, None)


async def create_pending(ctx, tool, args, plan, warning=""):
    """Amalni tasdiq navbatiga qo'yadi. AI ga «tasdiq kutilmoqda» qaytaradi."""
    if not plan:
        return _err("o'zgartirish uchun hech narsa topilmadi")
    if not WRITE_ENABLED:
        return _err("yozish vaqtincha o'chirilgan (AI_AGENT_WRITE_ENABLED=0)")
    if not ctx.deps.can_write():
        return _err("yozish yordamchilari sozlanmagan — administratorga aytilsin")
    if len(ctx.pending) >= MAX_PENDING_PER_TURN:
        return _err(f"bitta savolda eng ko'p {MAX_PENDING_PER_TURN} ta o'zgartirish "
                    "taklif qilish mumkin — qolganini keyingi xabarda so'ra")

    token, rec = await store_pending(ctx.deps, ctx.user_id, tool, args, plan, warning)
    if token is None:
        return _err("tasdiq yozuvi saqlanmadi — qayta urinib ko'ring")

    ctx.pending.append({"token": token, "record": rec})
    return {
        "ok": True,
        "status": "TASDIQ_KUTILMOQDA",
        "ozgarish": _plan_plain(plan),
        "ogohlantirish": warning or "",
        "izoh": ("Amal HALI BAJARILMADI. Xo'jayinga tasdiq tugmasi alohida "
                 "yuboriladi. Sen javobda faqat nima qilinishini QISQA ayt va "
                 "«tasdiqlang» deb qo'sh. «Bajardim», «o'zgartirdim» deb "
                 "YOZMA — bu yolg'on bo'ladi."),
    }


async def claim_pending(deps, token, user_id):
    """Amalni ATOMIK «egallaydi» (ikki marta bajarilishining oldini oladi).

    Qaytaradi: (yozuv, xato_matni). Yozuv None bo'lsa — bajarilmaydi.

    Nega ETag: xo'jayin tugmani ikki marta tez bossa (yoki Telegram
    callback'ni qayta yuborsa) amal IKKI MARTA bajarilardi — narx ikki
    marta oshardi. `if-match` bilan faqat BIRINCHI urinish o'tadi.
    """
    if not deps.can_write():
        return None, "yozish yordamchilari sozlanmagan"
    path = f"pending_actions/{token}"
    etag, rec = await deps.firebase_get_etag(path)
    if not isinstance(rec, dict):
        return None, "Bu amal topilmadi — muddati o'tgan bo'lishi mumkin."
    if (safe_int(rec.get("uid"), 0) or 0) != (safe_int(user_id, 0) or 0):
        logging.warning("pending: begona uid urinishi token=%s uid=%s", token, user_id)
        return None, "Bu amal sizga tegishli emas."
    if rec.get("status") != "pending":
        return None, "Bu amal allaqachon bajarilgan yoki bekor qilingan."
    if int(time.time() * 1000) > (safe_int(rec.get("expires"), 0) or 0):
        await deps.firebase_delete(path)
        return None, (f"Tasdiq muddati ({PENDING_TTL_SEC // 60} daqiqa) o'tdi. "
                      "Iltimos, qaytadan so'rang.")

    claimed = dict(rec)
    claimed["status"] = "processing"
    ok, _status = await deps.firebase_put(path, claimed, etag=etag)
    if not ok:
        return None, "Bu amal ayni paytda bajarilyapti — bir oz kuting."
    return rec, ""


async def drop_pending(deps, token):
    """Yozuvni o'chiradi (bajarilgach yoki bekor qilingach)."""
    if deps.firebase_delete:
        await deps.firebase_delete(f"pending_actions/{token}")


async def pending_janitor(deps, every_sec=600):
    """Muddati o'tgan tasdiqlarni tozalab turadi (fon vazifasi).

    Bo'lmasa `pending_actions` tuguni tasdiqlanmagan amallar bilan
    asta-sekin to'lib borardi.
    """
    while True:
        try:
            await asyncio.sleep(every_sec)
            raw = await deps.firebase_get("pending_actions")
            now = int(time.time() * 1000)
            removed = 0
            for token, rec in fb_items(raw):
                if not isinstance(rec, dict):
                    continue
                # `processing` holatida qotib qolganlar ham tozalanadi
                # (bot yozish o'rtasida qayta ishga tushgan bo'lsa).
                if now > (safe_int(rec.get("expires"), 0) or 0) + 60_000:
                    await deps.firebase_delete(f"pending_actions/{token}")
                    removed += 1
            if removed:
                logging.info("pending_janitor: %d ta eskirgan tasdiq o'chirildi", removed)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logging.warning("pending_janitor xatosi: %s", e)


# =====================================================================
#  REJANI BAJARISH
# =====================================================================
async def apply_plan(deps, plan, notifier=None, verify=True):
    """Rejani bajaradi. `(muvaffaqiyatli_soni, xatolar, natijalar)` qaytaradi.

    verify=True bo'lsa — yozishdan OLDIN joriy qiymat rejadagi `old` bilan
    solishtiriladi. Mos kelmasa YOZILMAYDI. Sabab: tasdiq kartochkasi
    ko'rsatilishi va tugma bosilishi orasida daqiqalar o'tadi; oradan
    kimsa narxni o'zgartirgan bo'lsa, xo'jayin KO'RMAGAN natijaga
    kelishi mumkin edi.

    notifier — async (uid, status, code, order) — mijozga xabar yuborish.
    """
    done, errors, results = 0, [], []

    for item in plan or []:
        kind = item.get("kind")
        label = item.get("label") or ""
        try:
            if kind == "product":
                ok, err = await _apply_product(deps, item, verify)
            elif kind == "product_size":
                ok, err = await _apply_product_size(deps, item, verify)
            elif kind == "order_status":
                ok, err = await _apply_order_status(deps, item, verify, notifier)
            else:
                ok, err = False, f"noma'lum reja turi: {kind}"
        except Exception as e:
            logging.error("apply_plan xatosi (%s): %s", kind, e)
            ok, err = False, str(e)

        results.append({"label": label, "ok": ok, "error": err})
        if ok:
            done += 1
        else:
            errors.append(f"{label}: {err}" if label else err)

    return done, errors, results


def _same_value(a, b):
    """Ikki qiymat AMALDA bir xilmi.

    ⚠️ NEGA shunchaki `str(a) != str(b)` YARAMAYDI:
       Firebase JSON'da son `1000000` ham, `1000000.0` ham bo'lishi mumkin
       (mini app `parseInt` bilan yozadi, import esa hisob-kitobdan keyin
       float berishi mumkin). Matn sifatida solishtirsak «1000000.0» va
       «1000000» FARQLI chiqadi va tasdiqlangan o'zgarish
       «qiymat o'zgargan» degan yolg'on xato bilan RAD ETILARDI —
       xo'jayin tugmani bosardi, lekin narx o'zgarmasdi.
    """
    if isinstance(a, bool) or isinstance(b, bool):
        return bool(a) == bool(b)
    fa, fb_ = _to_float(a, None), _to_float(b, None)
    if fa is not None and fb_ is not None:
        return abs(fa - fb_) < 1e-9
    return str(a) == str(b)


def _mismatch(current, expected, field):
    """Joriy qiymat kutilganidan farq qiladimi (DEL = maydon yo'q)."""
    has = field in current
    if expected == DEL:
        return has
    if not has:
        return True
    return not _same_value(current.get(field), expected)


async def _apply_product(deps, item, verify):
    pid = item.get("id")
    changes = item.get("set") or {}
    old = item.get("old") or {}

    def mutate(cur):
        if verify:
            for field, expected in old.items():
                if _mismatch(cur, expected, field):
                    raise ValueError(
                        f"«{field}» qiymati o'zgargan (kutilgan: {expected}, "
                        f"hozir: {cur.get(field, 'yo`q')}). Yozilmadi — qaytadan so'rang.")
        return _apply_set(cur, changes)

    ok, err, _prev = await atomic_update_by_id(deps, "products", pid, mutate)
    return ok, err


async def _apply_product_size(deps, item, verify):
    pid = item.get("id")
    size_name = str(item.get("size") or "")
    new_stock = safe_int(item.get("set"), 0) or 0
    old_stock = safe_int(item.get("old"), None)

    def mutate(cur):
        sizes = cur.get("sizes")
        pairs = fb_items(sizes)
        target_key = None
        for key, s in pairs:
            if isinstance(s, dict) and str(s.get("size") or "").strip() == size_name:
                target_key = key
                if verify and old_stock is not None:
                    have = safe_int(s.get("stock"), 0) or 0
                    if have != old_stock:
                        raise ValueError(
                            f"razmer «{size_name}» qoldig'i o'zgargan "
                            f"(kutilgan {old_stock}, hozir {have}). Yozilmadi.")
                break
        if target_key is None:
            raise ValueError(f"«{size_name}» razmeri topilmadi")

        # Razmerlar dict yoki list bo'lishi mumkin — shaklini saqlab yozamiz.
        if isinstance(sizes, dict):
            sizes[target_key]["stock"] = new_stock
        else:
            sizes[int(target_key)]["stock"] = new_stock

        # 🔗 Denormallashgan `stock` maydonini QAYTA HISOBLAYMIZ.
        #    Mini App aynan shunday qiladi (`sizes.reduce`). Yangilamasak,
        #    katalogda tovar "bor/yo'q" belgisi yolg'on ko'rsatardi.
        cur["stock"] = sum(safe_int(s.get("stock"), 0) or 0
                           for _, s in fb_items(sizes) if isinstance(s, dict))
        return cur

    ok, err, _prev = await atomic_update_by_id(deps, "products", pid, mutate)
    return ok, err


async def _apply_order_status(deps, item, verify, notifier):
    uid = str(item.get("uid") or "")
    order_id = item.get("order_id")
    new_status = str(item.get("set") or "")
    old_status = item.get("old")
    saved = {}

    def mutate(cur):
        if verify:
            have = str(cur.get("status") or "kutilmoqda")
            if old_status is not None and have != str(old_status):
                raise ValueError(f"holat allaqachon «{have}» ga o'zgargan. Yozilmadi.")
        cur["status"] = new_status
        saved.update(cur)
        return cur

    ok, err, _prev = await atomic_update_by_id(
        deps, f"users/{uid}/orders", order_id, mutate)
    if not ok:
        return False, err

    # 🔄 Markaziy arxivni ham yangilaymiz. Mini App aynan shunday qiladi
    #    (`orders/<uid>_<kod>/status`). Ikkisi ajralib ketmasligi kerak.
    #    Bu ikkilamchi yozuv: muvaffaqiyatsiz bo'lsa asosiy o'zgarishni
    #    bekor qilmaymiz (mini app ham `.catch()` bilan shunday qiladi).
    code = str(item.get("code") or order_id)
    try:
        await deps.firebase_patch(f"orders/{uid}_{code}", {"status": new_status})
    except Exception as e:
        logging.warning("Markaziy buyurtma holati yangilanmadi: %s", e)

    # 📩 Mijozga xabar (undo'da yuborilmaydi — item['notify'] False bo'ladi)
    if notifier and item.get("notify") and _STATUS_MSG_KEY.get(new_status):
        try:
            await notifier(uid, new_status, code, saved)
        except Exception as e:
            logging.warning("Mijozga xabar yuborilmadi: %s", e)

    return True, ""


def build_undo_plan(plan):
    """Rejani teskarisiga aylantiradi (`set` <-> `old`).

    Buyurtma holati qaytarilganda mijozga xabar YUBORILMAYDI: u
    «yo'lga chiqdi» dan keyin «qabul qilindi» xabarini olsa
    chalkashadi. Xo'jayin xohlasa o'zi yozadi.
    """
    out = []
    for item in plan or []:
        kind = item.get("kind")
        rev = dict(item)
        if kind == "product":
            rev["set"] = dict(item.get("old") or {})
            rev["old"] = dict(item.get("set") or {})
        elif kind in ("product_size", "order_status"):
            rev["set"] = item.get("old")
            rev["old"] = item.get("set")
        else:
            continue
        if kind == "order_status":
            rev["notify"] = False
        # Qaytarishda `old` tekshiruvi ham teskari bo'ladi va aynan shu
        # bizga kerak: agar oradan kimsa qiymatni yana o'zgartirgan bo'lsa,
        # qaytarish BAJARILMAYDI (jimgina ustidan yozib ketmaydi).
        out.append(rev)
    return out


# =====================================================================
#  VOSITANI BAJARISH
# =====================================================================
async def execute_tool(ctx, name, raw_arguments):
    """Bitta vositani xavfsiz bajaradi. HAR QANDAY holatda dict qaytaradi.

    Model ba'zan yo'q vosita nomini yoki buzuq JSON argumentni qaytaradi —
    bunda dastur yiqilmasligi, balki AI ga tushunarli xato qaytishi kerak,
    shunda u o'zini tuzatib qayta uradi.
    """
    spec = TOOLS.get(name)
    if spec is None:
        return _err(f"'{name}' degan vosita yo'q. Mavjudlari: {', '.join(sorted(TOOLS))}")

    # 🔒 RUXSAT — KODDA. Promptga tayanmaymiz.
    if spec.owner_only and not ctx.deps.is_owner(ctx.user_id):
        logging.warning("Agent: ruxsatsiz vosita urinishi uid=%s tool=%s", ctx.user_id, name)
        return _err("bu ma'lumot faqat do'kon egasi uchun")

    # Argumentlarni parse qilish
    args = {}
    if raw_arguments:
        try:
            parsed = json.loads(raw_arguments) if isinstance(raw_arguments, str) else raw_arguments
            if isinstance(parsed, dict):
                args = parsed
        except (json.JSONDecodeError, TypeError) as e:
            return _err(f"argumentlar JSON emas: {e}")

    # Sxemada e'lon qilinmagan argumentlarni TASHLAB ketamiz — aks holda
    # model o'ylab topgan qo'shimcha kalit TypeError berardi.
    allowed = set((spec.parameters or {}).get("properties", {}).keys())
    clean = {k: v for k, v in args.items() if k in allowed}

    try:
        result = await spec.handler(ctx, **clean)
    except TypeError as e:
        return _err(f"argumentlar mos kelmadi: {e}")
    except Exception as e:
        logging.error("Vosita '%s' xatosi: %s", name, e)
        return _err(f"vosita ichki xatosi: {e}")

    ctx.calls.append((name, clean, not (isinstance(result, dict) and result.get("ok"))))
    return result if isinstance(result, dict) else {"ok": True, "natija": result}


def _tool_result_text(result):
    """Vosita natijasini AI ga uzatiladigan matnga aylantiradi (cheklangan)."""
    try:
        txt = json.dumps(result, ensure_ascii=False)
    except (TypeError, ValueError):
        txt = str(result)
    if len(txt) > TOOL_RESULT_LIMIT:
        txt = txt[:TOOL_RESULT_LIMIT] + '... (natija uzun, qisqartirildi)"}'
    return txt


# =====================================================================
#  AGENT HALQASI
# =====================================================================
async def run_agent(messages, user_id, temperature=0.3):
    """Tool calling halqasi. `AgentResult` qaytaradi.

    ⚠️ MUHIM: `messages` NUSXA olinadi. Vosita (`tool`) xabarlari asosiy
       suhbat tarixiga (ai_sessions) TUSHMASLIGI SHART. Sabab: bot tarixni
       "system + oxirgi 16 xabar" bo'yicha qirqadi. Agar qirqish `assistant`
       (tool_calls bilan) xabarini kesib, unga tegishli `tool` xabarini
       qoldirsa — Groq keyingi navbatda 400 xato beradi va AI butunlay
       ishlamay qoladi. Nusxa bilan bu xavf butunlay yo'qoladi.

    Muvaffaqiyatsizlikda `text=None` qaytadi — chaqiruvchi eski yo'lga
    qaytishi mumkin.
    """
    if _deps is None:
        return AgentResult()

    ctx = TurnContext(_deps, user_id)
    work = list(messages)
    # Yozish vositalari FAQAT egasiga va faqat yozish yoqilganda ko'rsatiladi.
    # Model ko'rmagan vositani chaqirmaydi — bu birinchi to'siq;
    # ikkinchisi `execute_tool` dagi kod tekshiruvi.
    allow_write = bool(WRITE_ENABLED and _deps.can_write() and _deps.is_owner(user_id))
    specs = groq_tool_specs(include_mutating=allow_write)

    for round_i in range(MAX_TOOL_ROUNDS):
        msg = await _deps.groq_raw(work, tools=specs, tool_choice="auto",
                                   temperature=temperature)
        if msg is None:
            logging.error("Agent: Groq javob bermadi (aylanish %s)", round_i + 1)
            return AgentResult(None, ctx.calls, ctx.pending)

        tool_calls = list(getattr(msg, "tool_calls", None) or [])
        if not tool_calls:
            return AgentResult((msg.content or "").strip(), ctx.calls, ctx.pending)

        # Assistant xabarini API kutgan AYNAN shaklda qaytaramiz.
        work.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [{
                "id": tc.id,
                "type": "function",
                "function": {"name": tc.function.name,
                             "arguments": tc.function.arguments or "{}"},
            } for tc in tool_calls],
        })

        # ⚠️ HAR BIR tool_call_id uchun javob QAYTARISH SHART. Chegaradan
        #    oshganlarini BAJARMAYMIZ, lekin ularga ham xato javobi
        #    yozamiz — aks holda API "javobsiz tool_call" deb 400 beradi.
        for i, tc in enumerate(tool_calls):
            if i < MAX_CALLS_PER_ROUND:
                result = await execute_tool(ctx, tc.function.name, tc.function.arguments)
            else:
                result = _err(f"bir vaqtda {MAX_CALLS_PER_ROUND} tadan ko'p vosita "
                              "chaqirib bo'lmaydi — muhimlarini tanlab qayta so'ra")
            work.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": _tool_result_text(result),
            })

    # Aylanishlar tugadi — vositasiz YAKUNIY javob so'raymiz, shunda
    # foydalanuvchi bo'sh javob olmaydi.
    logging.warning("Agent: %s aylanish tugadi, yakuniy javob so'ralyapti (uid=%s)",
                    MAX_TOOL_ROUNDS, user_id)
    work.append({
        "role": "system",
        "content": ("Vosita chaqirish chegarasi tugadi. Endi BOSHQA vosita "
                    "chaqirmasdan, yuqorida olingan ma'lumot asosida qisqa "
                    "yakuniy javob yoz."),
    })
    final = await _deps.groq_raw(work, temperature=temperature)
    if final is None:
        return AgentResult(None, ctx.calls, ctx.pending)
    return AgentResult((final.content or "").strip(), ctx.calls, ctx.pending)


async def run_owner_agent(messages, user_id, temperature=0.3):
    """Xo'jayin uchun agent navbati + audit yozuvi."""
    res = await run_agent(messages, user_id, temperature=temperature)
    calls = res.calls
    # Audit: har bir o'qishni yozish shovqin bo'ladi, shuning uchun faqat
    # (a) xato bo'lganda, (b) o'zgartirish TAKLIF qilinganda, (c) ataylab
    # yoqilganda (AI_AUDIT_READS=1) yoziladi.
    should = bool(res.pending) or AUDIT_READS or any(f for _, _, f in calls)
    if calls and should:
        await audit(_deps, user_id, "agent_turn", {
            "tools": [{"name": n, "args": a, "failed": f} for n, a, f in calls][:10],
            "answered": res.text is not None,
            "proposed": len(res.pending),
        })
    return res


# =====================================================================
#  TASDIQNI BAJARISH / BEKOR QILISH / ORQAGA QAYTARISH
#  (bot.py shu uchtasini chaqiradi — qolgan hammasi ichki tafsilot)
# =====================================================================
# Tasdiq tugmasining `callback_data` prefiksi. bot.py handleri aynan
# shuni kuzatadi — ikki joyda qo'lda yozilmasin.
CONFIRM_PREFIX = "aia"


def confirm_callback_data(token, approve):
    """`aia:<token>:1|0` — 64 baytlik Telegram chegarasidan ancha kichik."""
    return f"{CONFIRM_PREFIX}:{token}:{'1' if approve else '0'}"


def parse_callback_data(data):
    """`(token, tasdiqlandimi)` yoki (None, False)."""
    parts = str(data or "").split(":")
    if len(parts) != 3 or parts[0] != CONFIRM_PREFIX:
        return None, False
    return parts[1], parts[2] == "1"


async def apply_confirmed(token, user_id, notifier=None):
    """✅ tugmasi bosilganda chaqiriladi. `(muvaffaqiyatmi, xabar)` qaytaradi.

    Butun xavfsizlik zanjiri shu yerda tugaydi:
      1) `claim_pending` — amal shu odamga tegishlimi, muddati o'tmaganmi,
         va ATOMIK egallash (ikki marta bosish ikki marta bajarmaydi);
      2) `apply_plan(verify=True)` — tasdiq ko'rsatilgandan keyin qiymat
         o'zgargan bo'lsa YOZMAYDI;
      3) audit — oldingi qiymat bilan (orqaga qaytarish uchun).
    """
    deps = _deps
    if deps is None:
        return False, "AI agenti ishga tushmagan."

    rec, err = await claim_pending(deps, token, user_id)
    if rec is None:
        return False, err

    plan = [v for _, v in fb_items(rec.get("plan")) if isinstance(v, dict)]
    if not plan:
        await drop_pending(deps, token)
        return False, "Amal tafsiloti o'qilmadi — qaytadan so'rang."

    done, errors, _results = await apply_plan(deps, plan, notifier=notifier, verify=True)

    # 📝 Audit — oldingi qiymatlar bilan. `/orqaga` aynan shundan o'qiydi.
    if done:
        await audit(deps, user_id, "mutation", {
            "tool": rec.get("tool"),
            "args": rec.get("args"),
            "plan": plan,
            "done": done,
            "errors": errors[:5],
            "is_undo": bool(rec.get("is_undo")),
        })
        # Qaytarish bajarilgan bo'lsa — asl yozuvni «qaytarilgan» deb belgilaymiz,
        # aks holda `/orqaga` o'sha o'zgarishni qayta-qayta taklif qilardi.
        undo_of = rec.get("undo_of")
        if undo_of:
            await deps.firebase_patch(f"audit_log/{undo_of}", {"reverted": True})

    await drop_pending(deps, token)

    total = len(plan)
    if done == total and not errors:
        return True, f"✅ Bajarildi ({done} ta o'zgarish)."
    if done:
        return True, ("⚠️ Qisman bajarildi: "
                      f"{done}/{total}.\n\nBajarilmadi:\n• " + "\n• ".join(errors[:5]))
    return False, "❌ Bajarilmadi:\n• " + "\n• ".join(errors[:5] or ["noma'lum xato"])


async def cancel_confirmed(token, user_id):
    """❌ tugmasi. `(ok, xabar)`."""
    deps = _deps
    if deps is None:
        return False, "AI agenti ishga tushmagan."
    etag, rec = await deps.firebase_get_etag(f"pending_actions/{token}")
    if not isinstance(rec, dict):
        return False, "Bu amal topilmadi — muddati o'tgan bo'lishi mumkin."
    if (safe_int(rec.get("uid"), 0) or 0) != (safe_int(user_id, 0) or 0):
        return False, "Bu amal sizga tegishli emas."
    if rec.get("status") != "pending":
        return False, "Bu amal allaqachon bajarilgan."
    await drop_pending(deps, token)
    return True, "❌ Bekor qilindi — hech narsa o'zgarmadi."


async def undo_last(user_id):
    """`/orqaga` buyrug'i: oxirgi o'zgarishni qaytarish uchun TASDIQ tayyorlaydi.

    Qaytarishning o'zi ham tasdiqdan o'tadi — bu ataylab: xato bilan
    yozilgan `/orqaga` mijozga ketgan buyurtma holatini jimgina
    o'zgartirib qo'ymasligi kerak.
    Qaytaradi: (token, preview_html, xato_matni)
    """
    deps = _deps
    if deps is None:
        return None, "", "AI agenti ishga tushmagan."
    if not WRITE_ENABLED or not deps.can_write():
        return None, "", "Yozish o'chirilgan — qaytarish ham mumkin emas."

    key, rec = await last_undoable_mutation(deps, user_id)
    if rec is None:
        return None, "", ("Qaytarish uchun o'zgarish topilmadi.\n\n"
                          "<i>Faqat AI orqali qilingan oxirgi o'zgarishlar "
                          "qaytariladi. Mini App'dagi tahrirlar bu yerga "
                          "kirmaydi.</i>")

    plan = [v for _, v in fb_items(rec.get("plan")) if isinstance(v, dict)]
    undo = build_undo_plan(plan)
    if not undo:
        return None, "", "Bu o'zgarishni avtomatik qaytarib bo'lmaydi."

    token, prec = await store_pending(
        deps, user_id, "undo", {"audit_key": key}, undo,
        warning="Bu — ORQAGA QAYTARISH. Qiymatlar avvalgi holatiga tiklanadi.",
        extra={"is_undo": True, "undo_of": key},
    )
    if token is None:
        return None, "", "Qaytarish yozuvi saqlanmadi — qayta urinib ko'ring."

    header = (f"↩️ <b>Orqaga qaytarish</b>\n"
              f"<i>Amal: {_esc(rec.get('tool'))}</i>\n\n")
    return token, header + render_plan_preview(undo, prec.get("warning")), ""


# =====================================================================
#  PROMPT BLOKI
# =====================================================================
def owner_tools_prompt_block():
    """Xo'jayin promptiga qo'shiladigan "senda vositalar bor" ko'rsatmasi.

    Qisqa ushlaymiz: uzun ko'rsatma modelning vosita tanlashiga xalaqit
    beradi. Vositalarning o'z tavsiflari (`description`) allaqachon
    batafsil va ular sxema orqali modelga yetkaziladi.
    """
    write_on = bool(WRITE_ENABLED and _deps is not None and _deps.can_write())
    lines = [
        "\n\n=== JONLI BAZAGA ULANISH (faqat xo'jayin uchun) ===",
        "Senda do'kon bazasi bilan ishlaydigan vositalar bor: ombor, tovar, "
        "narx, qoldiq, buyurtma, mijoz, savdo hisoboti.",
        "QOIDALAR:",
        "- Raqam yoki tovar haqidagi savolda TAXMIN QILMA — mos vositani chaqir.",
        "- Vosita bergan raqamdan boshqa raqamni O'ZINGDAN TO'QIMA.",
        "- Bir savolga bitta-ikkita maqsadli chaqiruv kifoya; hamma vositani "
        "ketma-ket chaqirmа.",
        "- Vosita bo'sh natija bersa — buni to'g'ridan ayt («bunday tovar yo'q»), "
        "o'ylab topma.",
        "- Javob QISQA: kerakli raqam va 1-2 gaplik xulosa. Uzun ro'yxatni "
        "so'ralmasa keltirmа.",
    ]
    if write_on:
        lines += [
            "",
            "O'ZGARTIRISH (narx, qoldiq, holat, chegirma):",
            "- Avval kerakli tovarni `search_products` bilan topib `id` sini ol. "
            "Id'ni O'YLAB TOPMA.",
            "- O'zgartirish vositasi natijasi «TASDIQ_KUTILMOQDA» bo'ladi. Bu "
            "degani amal HALI BAJARILMADI: xo'jayinga tugma yuboriladi va u "
            "bosgandagina bajariladi.",
            "- Shu sababli «bajardim», «o'zgartirdim», «narx yangilandi» deb "
            "HECH QACHON yozma. To'g'ri javob: «Narxni 1 200 000 ga "
            "o'zgartirishni tayyorladim — pastdagi tugma bilan tasdiqlang».",
            "- Xo'jayin nimani xohlayotgani ANIQ bo'lmasa (qaysi tovar, qaysi "
            "razmer, qancha) — avval SO'RA, taxmin bilan o'zgartirish "
            "tayyorlama.",
            "- Bir necha tovarga bir xil foiz qo'shish kerak bo'lsa "
            "`bulk_adjust_price` ishlat (bittalab emas).",
        ]
    else:
        lines += [
            "- Hozir faqat O'QIY olasan. Xo'jayin narx/qoldiq o'zgartirishni "
            "so'rasa — buni Mini App'dagi «Ombor» bo'limidan qilishini ayt.",
        ]
    lines.append("=== TUGADI ===\n")
    return "\n".join(lines)
