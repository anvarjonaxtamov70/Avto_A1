# =====================================================================
#  fb_utils.py — Firebase / mahsulot ma'lumoti bilan ishlashning
#  UMUMIY, SOF (pure) yordamchilari.
#
#  NEGA ALOHIDA MODUL:
#    Bu funksiyalar ilgari faqat `bot.py` ichida edi. `ai_agent.py` ham
#    aynan shu mantiqqa muhtoj (mahsulot qoldig'ini hisoblash, RTDB
#    massiv/lug'at farqini yumshatish). Ikki joyda alohida yozilsa —
#    vaqt o'tib ular BIR-BIRIDAN AJRALADI (drift) va natijada bot bir
#    xil savolga ikki xil raqam qaytaradi. Shuning uchun bitta manba.
#
#  QOIDA: bu modulda tarmoq so'rovi, global holat va aiogram/aiohttp
#  importi BO'LMASIN — faqat sof funksiyalar. Shunda test qilish oson
#  va aylanma import (circular import) xavfi yo'q.
# =====================================================================

import re

# Mashina modeli / kategoriya uchun "ma'nosiz" (bo'sh) qiymatlar.
# Kross-sell va tavsiflarda shu qiymatlar bo'yicha guruhlash mumkin emas.
GENERIC_VALUES = {
    "", "umumiy", "ko'rsatilmagan", "korsatilmagan", "nan",
    "noma'lum", "namalum", "none", "null",
}


def norm(s):
    """Matnni qidiruv uchun normallashtiradi (kichik harf + chetlarni kesish)."""
    return str(s if s is not None else "").lower().strip()


def safe_int(v, default=None):
    """Har qanday qiymatni butun songa aylantiradi (bo'lmasa — default).

    Muhim: `float` orqali o'tkazamiz, chunki RTDB narxni ba'zan "12000.0"
    yoki 12000.0 ko'rinishida qaytaradi va to'g'ridan `int("12000.0")`
    ValueError beradi.
    """
    if v is None:
        return default
    if isinstance(v, bool):        # True/1 chalkashligini oldini olamiz
        return default
    try:
        return int(float(str(v).strip().replace(" ", "")))
    except (TypeError, ValueError, AttributeError):
        return default


def fb_items(node):
    """RTDB tugunini (dict YOKI list) (kalit, qiymat) juftliklariga aylantiradi.

    RTDB ketma-ket raqamli kalitlarni MASSIV (list) qilib qaytaradi. Kod
    `.items()` ni to'g'ridan chaqirsa, list kelganda AttributeError beradi.
    Bu yordamchi ikki holatni ham xavfsiz qo'llaydi.
    `None` elementlar (o'chirilgan yozuvlar) tashlab ketiladi.
    """
    if not node:
        return []
    if isinstance(node, dict):
        return [(k, v) for k, v in node.items() if v is not None]
    if isinstance(node, list):
        return [(str(i), v) for i, v in enumerate(node) if v is not None]
    return []


def fmt_som(n):
    """1234567 -> '1 234 567' (pul ko'rinishi)."""
    try:
        return f"{int(round(float(n))):,}".replace(",", " ")
    except (TypeError, ValueError):
        return "0"


def is_generic(value):
    """Model/kategoriya qiymati "ma'noga ega"masmi?"""
    return norm(value) in GENERIC_VALUES


def sizes_of(p):
    """Razmerli tovarning razmerlarini [(razmer, qoldiq)] ko'rinishida qaytaradi."""
    out = []
    for _, s in fb_items((p or {}).get("sizes")):
        if not isinstance(s, dict):
            continue
        out.append((str(s.get("size") or "").strip(), safe_int(s.get("stock"), 0) or 0))
    return out


def stock_of(p):
    """Tovarning HAQIQIY umumiy qoldig'i.

    ⚠️ Razmerli tovarda `stock` maydoni — razmerlar yig'indisining
    DENORMALLASHGAN nusxasi (mini app `saveNewProduct` da yozadi). U
    eskirgan bo'lishi mumkin, shuning uchun razmerlar bo'lsa HAR DOIM
    ulardan qayta hisoblaymiz — aks holda AI mijozga yo'q tovarni
    "bor" deb aytishi mumkin.
    """
    p = p or {}
    sizes = sizes_of(p)
    if sizes:
        return sum(qty for _, qty in sizes)
    return safe_int(p.get("stock"), 0) or 0


def price_of(p):
    """Tovarning joriy narxi (flash chegirma bo'lsa — chegirmali narx)."""
    return safe_int((p or {}).get("price"), 0) or 0


def is_live(p):
    """Tovar mijozga ko'rinadimi (qoralama emasmi)?"""
    return isinstance(p, dict) and not p.get("is_draft")


def product_label(p):
    """Log/xabar uchun qisqa, o'qiladigan tovar nomi."""
    p = p or {}
    nm = str(p.get("name") or "").strip() or "(nomsiz)"
    code = str(p.get("code") or "").strip()
    return f"{nm} [{code}]" if code else nm


def order_items_pairs(items):
    """Buyurtma tarkibini (kalit, soni, nomi) uchligiga aylantiradi.

    Ikki xil format uchraydi:
      • mini app:  {"12||Universal": 2}            -> qiymat SON, kalitda id bor
      • eski/bot:  [{"name": ..., "quantity": 2}]  -> qiymat LUG'AT, id YO'Q

    ⚠️ TUZATILDI (jimgina hisob buzilishi):
        Eski formatda kalit sifatida MASSIV INDEKSI ishlatilardi. Ya'ni
        har bir eski buyurtmaning birinchi tovari "0" kaliti ostida
        yig'ilardi. Natijada «eng ko'p sotilgan» ro'yxatida butunlay
        boshqa tovarlar bir-biriga QO'SHILIB ketardi va ro'yxat birinchi
        uchragan nom bilan ko'rinardi — xo'jayin noto'g'ri raqamga qarab
        tovar buyurtma qilardi.
        Endi: dict ichida `id` bo'lsa — u ishlatiladi; bo'lmasa nom
        bo'yicha barqaror kalit (`name:<nom>`) yasaladi. Shunda har xil
        tovar hech qachon birlashmaydi.
    """
    out = []
    for key, val in fb_items(items):
        if isinstance(val, dict):
            qty = safe_int(val.get("quantity"), 0) or 0
            name = str(val.get("name") or "").strip()
            pid = safe_int(val.get("id"), None)
            if pid is not None:
                ident = str(pid)
            elif name:
                ident = "name:" + norm(name)
            else:
                # Na id, na nom — indeksga qaytamiz (boshqa chora yo'q).
                ident = str(key).split("||")[0]
            out.append((ident, qty, name))
        else:
            # Mini app formati: kalit "<id>||<razmer>" — id qismini olamiz.
            out.append((str(key).split("||")[0], safe_int(val, 0) or 0, ""))
    return out


def order_paid(o):
    """Buyurtmada HAQIQATDA to'langan summa (cashback chegirmasidan keyin)."""
    o = o or {}
    paid = safe_int(o.get("payable"), None)
    if paid is None:
        paid = max(0, (safe_int(o.get("total"), 0) or 0)
                   - (safe_int(o.get("cashbackUsed"), 0) or 0))
    return paid


def order_ts(o):
    """Buyurtma vaqti (ms). Topilmasa 0."""
    o = o or {}
    return safe_int(o.get("id"), 0) or safe_int(o.get("createdAt"), 0) or 0


def tokenize(query):
    """So'rovni qidiruv bo'laklariga ajratadi (2 belgidan qisqasi tashlanadi)."""
    return [t for t in re.split(r"\W+", norm(query)) if len(t) >= 2]
