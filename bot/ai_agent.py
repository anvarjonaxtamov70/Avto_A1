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
    global TOOL_RESULT_LIMIT, AUDIT_READS
    AGENT_ENABLED = _flag("AI_AGENT_ENABLED", True)
    AUDIT_READS = _flag("AI_AUDIT_READS", False)
    # Chegaralar: aqldan ozgan qiymat (0 yoki 500) kiritilsa ham bot
    # ishlashda davom etsin.
    MAX_TOOL_ROUNDS = max(1, min(safe_int(os.getenv("AI_AGENT_MAX_ROUNDS"), 4) or 4, 8))
    MAX_CALLS_PER_ROUND = max(1, min(safe_int(os.getenv("AI_AGENT_MAX_CALLS"), 5) or 5, 10))
    TOOL_RESULT_LIMIT = max(1000, min(safe_int(os.getenv("AI_AGENT_RESULT_LIMIT"), 6000) or 6000, 20000))


# =====================================================================
#  BOG'LIQLIKLAR (dependency injection)
#  bot.py ishga tushganda bir marta to'ldiradi. Shu yondashuv
#  `bulk_import_fixed.py` dagi naqsh bilan bir xil va aylanma import
#  muammosini butunlay yo'q qiladi (ai_agent -> bot importi YO'Q).
# =====================================================================
class AgentDeps:
    """Agent ishlashi uchun kerak bo'lgan tashqi funksiyalar."""

    def __init__(self, firebase_get, firebase_patch, groq_raw, is_owner):
        self.firebase_get = firebase_get      # async (path) -> dict|list|None
        self.firebase_patch = firebase_patch  # async (path, data) -> bool
        self.groq_raw = groq_raw              # async (messages, tools=..., ...) -> message|None
        self.is_owner = is_owner              # (user_id) -> bool


_deps = None


def init(firebase_get, firebase_patch, groq_raw, is_owner):
    """bot.py `main()` ichidan bir marta chaqiriladi."""
    global _deps
    _load_config()   # .env allaqachon yuklangan — endi sozlamalarni o'qish xavfsiz
    _deps = AgentDeps(firebase_get, firebase_patch, groq_raw, is_owner)
    logging.info(
        "AI agent: %s (vositalar: %d, maks. aylanish: %d)",
        "YOQILGAN" if AGENT_ENABLED else "O'CHIRILGAN",
        len(TOOLS), MAX_TOOL_ROUNDS,
    )
    return _deps


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


_ORDER_STATUSES = ["kutilmoqda", "qabul", "yo'lda", "yetkazildi", "bekor_qilingan"]


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
            "order_key": f"{uid}_{code}" if code else "",
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
    """Audit yozuvi. Xato bo'lsa ham asosiy ishni BUZMAYDI."""
    try:
        rec = {"ts": int(time.time() * 1000), "uid": safe_int(user_id, 0) or 0,
               "kind": str(kind)}
        rec.update(payload or {})
        await deps.firebase_patch(f"audit_log/{_audit_key()}", rec)
    except Exception as e:
        logging.warning("Audit yozilmadi (%s): %s", kind, e)


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
    """Tool calling halqasi. `(javob_matni, chaqirilgan_vositalar)` qaytaradi.

    ⚠️ MUHIM: `messages` NUSXA olinadi. Vosita (`tool`) xabarlari asosiy
       suhbat tarixiga (ai_sessions) TUSHMASLIGI SHART. Sabab: bot tarixni
       "system + oxirgi 16 xabar" bo'yicha qirqadi. Agar qirqish `assistant`
       (tool_calls bilan) xabarini kesib, unga tegishli `tool` xabarini
       qoldirsa — Groq keyingi navbatda 400 xato beradi va AI butunlay
       ishlamay qoladi. Nusxa bilan bu xavf butunlay yo'qoladi.

    Muvaffaqiyatsizlikda (None, []) qaytadi — chaqiruvchi eski yo'lga
    qaytishi mumkin.
    """
    if _deps is None:
        return None, []

    ctx = TurnContext(_deps, user_id)
    work = list(messages)
    specs = groq_tool_specs()

    for round_i in range(MAX_TOOL_ROUNDS):
        msg = await _deps.groq_raw(work, tools=specs, tool_choice="auto",
                                   temperature=temperature)
        if msg is None:
            logging.error("Agent: Groq javob bermadi (aylanish %s)", round_i + 1)
            return None, ctx.calls

        tool_calls = list(getattr(msg, "tool_calls", None) or [])
        if not tool_calls:
            return (msg.content or "").strip(), ctx.calls

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
        return None, ctx.calls
    return (final.content or "").strip(), ctx.calls


async def run_owner_agent(messages, user_id, temperature=0.3):
    """Xo'jayin uchun agent navbati + audit yozuvi."""
    reply, calls = await run_agent(messages, user_id, temperature=temperature)
    if calls and (AUDIT_READS or any(failed for _, _, failed in calls)):
        await audit(_deps, user_id, "agent_turn", {
            "tools": [{"name": n, "args": a, "failed": f} for n, a, f in calls][:10],
            "answered": reply is not None,
        })
    return reply, calls


# =====================================================================
#  PROMPT BLOKI
# =====================================================================
def owner_tools_prompt_block():
    """Xo'jayin promptiga qo'shiladigan "senda vositalar bor" ko'rsatmasi.

    Qisqa ushlaymiz: uzun ko'rsatma modelning vosita tanlashiga xalaqit
    beradi. Vositalarning o'z tavsiflari (`description`) allaqachon
    batafsil va ular sxema orqali modelga yetkaziladi.
    """
    return (
        "\n\n=== JONLI BAZAGA ULANISH (faqat xo'jayin uchun) ===\n"
        "Senda do'kon bazasini O'QIY oladigan vositalar bor: ombor, tovar, "
        "narx, qoldiq, buyurtma, mijoz, savdo hisoboti.\n"
        "QOIDALAR:\n"
        "- Raqam yoki tovar haqidagi savolda TAXMIN QILMA — mos vositani chaqir.\n"
        "- Vosita bergan raqamdan boshqa raqamni O'ZINGDAN TO'QIMA.\n"
        "- Bir savolga bitta-ikkita maqsadli chaqiruv kifoya; hamma vositani "
        "ketma-ket chaqirmа.\n"
        "- Vosita bo'sh natija bersa — buni to'g'ridan ayt («bunday tovar yo'q»), "
        "o'ylab topma.\n"
        "- Javob QISQA: kerakli raqam va 1-2 gaplik xulosa. Uzun ro'yxatni "
        "so'ralmasa keltirmа.\n"
        "- Hozircha faqat O'QIY olasan. Xo'jayin narx/qoldiq o'zgartirishni "
        "so'rasa — buni Mini App'dagi «Ombor» bo'limidan qilishini ayt.\n"
        "=== TUGADI ===\n"
    )
