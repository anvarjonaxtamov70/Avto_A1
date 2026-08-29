# =====================================================================
#  test_ai_write.py — YOZISH vositalari, tasdiq mexanizmi va orqaga
#  qaytarish sinovi.
#
#  NEGA BU SINOV BOR:
#    Yozish yo'lidagi xato pul yo'qotadi: noto'g'ri tovarga narx qo'yilishi,
#    ikki marta bajarilish, mijozga yolg'on xabar. Bularning HAMMASI
#    "ba'zan" sodir bo'ladigan poyga holatlari — qo'lda sinab topilmaydi.
#    Shu sababli soxta Firebase ATAYLAB "yomon" xatti-harakat qiladi:
#    indekslarni siljitadi, ETag'ni o'zgartiradi, 412 qaytaradi.
#
#  ISHGA TUSHIRISH:
#    cd bot && python3 tests/test_ai_write.py
#    cd bot && python3 -m pytest tests/test_ai_write.py -q
# =====================================================================

import asyncio
import copy
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import ai_agent
from ai_agent import DEL

OWNER = 5105291033
STRANGER = 999


# =====================================================================
#  SOXTA FIREBASE — ETag va 412 ni HAQIQIY simulyatsiya qiladi
# =====================================================================
class FakeFB:
    def __init__(self, data):
        self.data = copy.deepcopy(data)
        self._rev = {}            # path -> ETag hisoblagichi
        self.puts = []            # (path, data, etag)
        self.patches = []
        self.deletes = []
        self.fail_put_once = {}   # path -> qolgan 412 soni
        self.on_before_put = None  # yozishdan oldin chaqiriladigan ilmoq

    # ——— yo'l bo'yicha kirish ———
    def _walk(self, path, create=False):
        parts = [p for p in str(path).split("/") if p != ""]
        node, parent, key = self.data, None, None
        for p in parts:
            parent, key = node, p
            if isinstance(node, list):
                i = int(p)
                node = node[i] if 0 <= i < len(node) else None
            elif isinstance(node, dict):
                if p not in node and create:
                    node[p] = {}
                node = node.get(p)
            else:
                node = None
        return parent, key, node

    def _etag(self, path):
        return f'"{self._rev.get(path, 0)}"'

    def _bump(self, path):
        self._rev[path] = self._rev.get(path, 0) + 1

    # ——— bot.py dagi yordamchilar bilan bir xil imzo ———
    async def get(self, path):
        _p, _k, node = self._walk(path)
        return copy.deepcopy(node)

    async def get_etag(self, path):
        _p, _k, node = self._walk(path)
        if node is None:
            return None, None
        return self._etag(path), copy.deepcopy(node)

    async def put(self, path, data, etag=None):
        if self.on_before_put:
            self.on_before_put(path)
        left = self.fail_put_once.get(path, 0)
        if left > 0:
            self.fail_put_once[path] = left - 1
            return False, 412
        if etag is not None and etag != self._etag(path):
            return False, 412          # poyga: oradan kimsa yozdi
        parent, key, _node = self._walk(path, create=True)
        if isinstance(parent, list):
            parent[int(key)] = copy.deepcopy(data)
        else:
            parent[key] = copy.deepcopy(data)
        self._bump(path)
        self.puts.append((path, copy.deepcopy(data), etag))
        return True, 200

    async def patch(self, path, data):
        parent, key, node = self._walk(path, create=True)
        if not isinstance(node, dict):
            node = {}
            if isinstance(parent, list):
                parent[int(key)] = node
            else:
                parent[key] = node
        node.update(copy.deepcopy(data))
        self._bump(path)
        self.patches.append((path, copy.deepcopy(data)))
        return True

    async def delete(self, path):
        parent, key, _node = self._walk(path)
        if isinstance(parent, dict):
            parent.pop(key, None)
        self._bump(path)
        self.deletes.append(path)
        return True

    async def query(self, path, params):
        node = await self.get(path)
        if not isinstance(node, dict):
            return node
        keys = sorted(node)
        limit = int(str(params.get("limitToLast", "100")))
        return {k: node[k] for k in keys[-limit:]}


BASE_DATA = {
    "products": [
        {"id": 1, "name": "Porshen", "code": "4133", "price": 1000000, "stock": 4,
         "img": "a.jpg", "images": ["a.jpg"], "categories": ["gazel-biznes"]},
        {"id": 2, "name": "Kalotka", "code": "K-77", "price": 200000, "stock": 0,
         "img": "b.jpg"},
        {"id": 3, "name": "Klapan", "code": "KL-9", "price": 80000, "stock": 25,
         "product_type": "razmerli", "img": "c.jpg",
         "sizes": [{"size": "92.5", "stock": 3}, {"size": "93.0", "stock": 0}]},
        # Flash chegirma AKTIV tovar
        {"id": 4, "name": "Aksiya tovar", "price": 90000, "oldPrice": 120000,
         "flashUntil": 9_999_999_999_999, "stock": 5, "img": "d.jpg"},
        # Qoralama — rasmi yo'q, chiqarib bo'lmaydi
        {"id": 5, "name": "Rasmsiz qoralama", "price": 50000, "stock": 1,
         "is_draft": True},
        # Qoralama — hammasi to'liq, chiqarish MUMKIN
        {"id": 6, "name": "To'liq qoralama", "price": 60000, "stock": 2,
         "is_draft": True, "img": "e.jpg", "images": ["e.jpg"]},
    ],
    "users": {
        "111": {
            "profile": {"name": "Ali Valiyev", "phone": "+998901112233"},
            "orders": [
                {"id": 1700000000000, "code": "A-1", "status": "kutilmoqda",
                 "total": 500000, "items": {"1||Universal": 1}},
            ],
        },
    },
}


def setup(script=None, data=None):
    fb = FakeFB(data if data is not None else BASE_DATA)
    groq = FakeGroq(script or [])
    ai_agent.init(
        firebase_get=fb.get, firebase_patch=fb.patch, groq_raw=groq,
        is_owner=lambda uid: int(uid) == OWNER,
        firebase_get_etag=fb.get_etag, firebase_put=fb.put,
        firebase_delete=fb.delete, firebase_query=fb.query,
    )
    return fb, groq


class FakeFn:
    def __init__(self, name, arguments):
        self.name, self.arguments = name, arguments


class FakeCall:
    def __init__(self, cid, name, arguments):
        self.id, self.function = cid, FakeFn(name, arguments)


class FakeMsg:
    def __init__(self, content="", tool_calls=None):
        self.content, self.tool_calls = content, tool_calls


class FakeGroq:
    def __init__(self, script):
        self.script = list(script)
        self.seen = []
        self.tool_names = []

    async def __call__(self, messages, tools=None, tool_choice=None,
                       temperature=0.5, model=None, max_retries=3):
        self.seen.append(list(messages))
        self.tool_names.append([t["function"]["name"] for t in (tools or [])])
        return self.script.pop(0) if self.script else FakeMsg("(tugadi)")


def run(coro):
    return asyncio.run(coro)


async def _tool(_name, _uid=OWNER, **args):
    ctx = ai_agent.TurnContext(ai_agent._deps, _uid)
    res = await ai_agent.execute_tool(ctx, _name, json.dumps(args))
    return res, ctx


def call_tool(_name, _uid=OWNER, **args):
    """Vositani chaqiradi.

    ⚠️ Parametrlar `_` bilan boshlanadi, chunki vosita argumentlari orasida
    `name` ham bor (`update_product_text`) va oddiy `name=` bo'lsa
    "multiple values for argument" xatosi chiqardi.
    """
    return run(_tool(_name, _uid=_uid, **args))


def token_of(ctx):
    assert ctx.pending, "tasdiq yozuvi yaratilmadi"
    return ctx.pending[0]["token"]


def _raise(m="qiymat kutilganidek emas"):
    raise AssertionError(m)


# =====================================================================
#  1) VOSITA HECH NARSA YOZMAYDI — faqat tasdiq tayyorlaydi
# =====================================================================
def test_set_price_darhol_yozmaydi():
    fb, _ = setup()
    res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    assert res["ok"] and res["status"] == "TASDIQ_KUTILMOQDA", res
    # Tovar TEGILMAGAN
    assert fb.data["products"][0]["price"] == 1000000
    # Faqat pending_actions yozilgan
    assert all(p.startswith("pending_actions/") for p, _ in fb.patches), fb.patches
    assert ctx.pending and ctx.pending[0]["record"]["tool"] == "set_price"


def test_ai_ga_bajardim_deb_yozmaslik_aytiladi():
    setup()
    res, _ = call_tool("set_price", product_id=1, new_price=1200000)
    assert "BAJARILMADI" in res["izoh"]
    assert "YOZMA" in res["izoh"]


# Har bir yozish vositasi uchun ISHLAYDIGAN argumentlar to'plami.
# Yangi vosita qo'shilsa shu yerga ham qo'shish kerak — aks holda
# pastdagi sinov «qamrab olinmagan vosita» deb ogohlantiradi.
WRITE_TOOL_ARGS = {
    "set_price": {"product_id": 1, "new_price": 1234000},
    "set_stock": {"product_id": 1, "new_stock": 9},
    "bulk_adjust_price": {"product_ids": [1, 2], "percent": 5},
    "update_product_text": {"product_id": 1, "name": "Boshqa nom"},
    "set_product_visibility": {"product_id": 6, "visible": True},
    "create_flash_sale": {"product_id": 1, "flash_price": 700000, "hours": 3},
    "cancel_flash_sale": {"product_id": 4},
    "set_order_status": {"order_key": "111_A-1", "status": "qabul"},
}


def test_hamma_yozish_vositasi_faqat_pending_yozadi():
    """ISH VAQTIDAGI QO'RIQ: har bir yozish vositasi chaqirilganda
    `pending_actions` dan BOSHQA joyga bir bayt ham yozmasligi kerak."""
    mutating = sorted(n for n, s in ai_agent.TOOLS.items() if s.mutating)
    qamrovsiz = [n for n in mutating if n not in WRITE_TOOL_ARGS]
    assert not qamrovsiz, f"sinovga qo'shilmagan yozish vositasi: {qamrovsiz}"

    for name in mutating:
        fb, _ = setup()
        before = copy.deepcopy(fb.data)
        res, ctx = call_tool(name, **WRITE_TOOL_ARGS[name])
        assert res.get("ok"), f"{name}: {res}"
        assert res.get("status") == "TASDIQ_KUTILMOQDA", f"{name}: {res}"
        assert ctx.pending, f"{name}: tasdiq yozuvi yaratilmadi"

        # PUT umuman bo'lmasligi kerak, PATCH faqat pending_actions ga
        assert fb.puts == [], f"{name} to'g'ridan PUT qildi: {fb.puts}"
        bad = [p for p, _ in fb.patches if not p.startswith("pending_actions/")]
        assert not bad, f"{name} begona joyga yozdi: {bad}"
        # Tovarlar va buyurtmalar TEGILMAGAN
        assert fb.data["products"] == before["products"], f"{name} katalogni o'zgartirdi"
        assert fb.data["users"] == before["users"], f"{name} mijoz ma'lumotini o'zgartirdi"


# =====================================================================
#  2) QO'RIQ QOIDALARI (guard rails)
# =====================================================================
def test_narx_qoriqlari():
    setup()
    assert call_tool("set_price", product_id=1, new_price=0)[0]["ok"] is False
    assert call_tool("set_price", product_id=1, new_price=-5)[0]["ok"] is False
    assert call_tool("set_price", product_id=1, new_price=999_999_999_999)[0]["ok"] is False
    # Bir xil narx — bekorga tasdiq so'ramaymiz
    assert call_tool("set_price", product_id=1, new_price=1000000)[0]["ok"] is False
    # Yo'q tovar
    assert call_tool("set_price", product_id=999, new_price=1)[0]["ok"] is False


def test_flash_aktiv_bolsa_narx_ozgartirilmaydi():
    """Flash paytida `price` — chegirmali narx. Uni o'zgartirish chegirma
    hisobini buzadi, shuning uchun ataylab rad etiladi."""
    setup()
    res, _ = call_tool("set_price", product_id=4, new_price=100000)
    assert res["ok"] is False and "FLASH" in res["error"]


def test_katta_ozgarishda_ogohlantirish():
    setup()
    res, ctx = call_tool("set_price", product_id=1, new_price=3000000)  # +200%
    assert res["ok"]
    w = ctx.pending[0]["record"]["warning"]
    assert "OSHADI" in w and "200" in w, w


def test_razmerli_tovarda_size_shart():
    setup()
    res, _ = call_tool("set_stock", product_id=3, new_stock=10)
    assert res["ok"] is False
    assert res["mavjud_razmerlar"] == [{"razmer": "92.5", "qoldiq": 3},
                                       {"razmer": "93.0", "qoldiq": 0}]
    # Noto'g'ri razmer
    res, _ = call_tool("set_stock", product_id=3, new_stock=10, size="99")
    assert res["ok"] is False and res["mavjud_razmerlar"] == ["92.5", "93.0"]
    # Oddiy tovarga razmer berilsa
    res, _ = call_tool("set_stock", product_id=1, new_stock=5, size="92.5")
    assert res["ok"] is False and "razmer yo'q" in res["error"]


def test_qoldiq_qoriqlari():
    setup()
    assert call_tool("set_stock", product_id=1, new_stock=-1)[0]["ok"] is False
    assert call_tool("set_stock", product_id=1, new_stock=999999)[0]["ok"] is False
    assert call_tool("set_stock", product_id=1, new_stock=4)[0]["ok"] is False  # bir xil


def test_bulk_qoriqlari():
    setup()
    assert call_tool("bulk_adjust_price", product_ids=[1], percent=0)[0]["ok"] is False
    assert call_tool("bulk_adjust_price", product_ids=[1], percent=-95)[0]["ok"] is False
    assert call_tool("bulk_adjust_price", product_ids=[], percent=10)[0]["ok"] is False
    many = list(range(1, ai_agent.MAX_BULK_ITEMS + 5))
    assert call_tool("bulk_adjust_price", product_ids=many, percent=10)[0]["ok"] is False


def test_bulk_flash_tovarni_tashlab_ketadi():
    setup()
    res, ctx = call_tool("bulk_adjust_price", product_ids=[1, 2, 4, 999], percent=10)
    assert res["ok"]
    plan = ctx.pending[0]["record"]["plan"]
    assert [i["id"] for i in plan] == [1, 2], plan
    sabab = {s.get("id"): s["sabab"] for s in res["tashlab_ketilganlar"]}
    assert "flash" in sabab[4] and sabab[999] == "topilmadi"
    # 1000 so'mga yaxlitlash: 1 000 000 * 1.1 = 1 100 000
    assert plan[0]["set"]["price"] == 1100000
    assert plan[1]["set"]["price"] == 220000


def test_rasmsiz_qoralamani_chiqarib_bolmaydi():
    """Mini App ham aynan shu tekshiruvni qiladi — katalogda rasmsiz,
    'buzuq' kartochka paydo bo'lmasligi kerak."""
    setup()
    res, _ = call_tool("set_product_visibility", product_id=5, visible=True)
    assert res["ok"] is False and "rasm" in res["error"]
    # To'liq qoralama — chiqariladi
    res, ctx = call_tool("set_product_visibility", product_id=6, visible=True)
    assert res["ok"]
    assert ctx.pending[0]["record"]["plan"][0]["set"] == {"is_draft": DEL}


def test_flash_sale_qoriqlari():
    setup()
    # Chegirma joriy narxdan kichik bo'lishi kerak
    assert call_tool("create_flash_sale", product_id=1, flash_price=1000000, hours=5)[0]["ok"] is False
    assert call_tool("create_flash_sale", product_id=1, flash_price=900000, hours=0.1)[0]["ok"] is False
    assert call_tool("create_flash_sale", product_id=1, flash_price=900000, hours=9999)[0]["ok"] is False
    # Allaqachon aktiv
    assert call_tool("create_flash_sale", product_id=4, flash_price=50000, hours=5)[0]["ok"] is False
    # To'g'ri holat
    res, ctx = call_tool("create_flash_sale", product_id=1, flash_price=800000, hours=6)
    assert res["ok"]
    s = ctx.pending[0]["record"]["plan"][0]["set"]
    assert s["price"] == 800000 and s["oldPrice"] == 1000000 and s["flashUntil"] > 0


def test_flash_bekor_qilinganda_asl_narx_tiklanadi():
    setup()
    res, ctx = call_tool("cancel_flash_sale", product_id=4)
    assert res["ok"]
    item = ctx.pending[0]["record"]["plan"][0]
    assert item["set"] == {"price": 120000, "oldPrice": DEL, "flashUntil": DEL}
    # Flashsiz tovarda xato
    assert call_tool("cancel_flash_sale", product_id=1)[0]["ok"] is False


def test_matn_qoriqlari():
    setup()
    assert call_tool("update_product_text", product_id=1, name="")[0]["ok"] is False
    assert call_tool("update_product_text", product_id=1, desc="x" * 600)[0]["ok"] is False
    assert call_tool("update_product_text", product_id=1)[0]["ok"] is False
    assert call_tool("update_product_text", product_id=1, name="Porshen")[0]["ok"] is False
    res, ctx = call_tool("update_product_text", product_id=1, name="Yangi nom", code="X-1")
    assert res["ok"]
    assert ctx.pending[0]["record"]["plan"][0]["set"] == {"name": "Yangi nom", "code": "X-1"}


def test_order_status_qoriqlari():
    setup()
    assert call_tool("set_order_status", order_key="yaroqsiz", status="qabul")[0]["ok"] is False
    assert call_tool("set_order_status", order_key="111_A-1", status="xato")[0]["ok"] is False
    assert call_tool("set_order_status", order_key="111_YOQ", status="qabul")[0]["ok"] is False
    # Bir xil holat
    assert call_tool("set_order_status", order_key="111_A-1", status="kutilmoqda")[0]["ok"] is False


def test_status_qiymati_mini_app_bilan_bir_xil():
    """REGRESSIYA: `yolda` APOSTROFSIZ. index.html `getStatusHTML()` aynan
    shu satrni tekshiradi; apostrof qo'yilsa mijozda holat «Kutilmoqda»
    bo'lib ko'rinib qolardi."""
    assert "yolda" in ai_agent._ORDER_STATUSES
    assert "yo'lda" not in ai_agent._ORDER_STATUSES
    setup()
    res, ctx = call_tool("set_order_status", order_key="111_A-1", status="yolda")
    assert res["ok"]
    assert ctx.pending[0]["record"]["plan"][0]["set"] == "yolda"


# =====================================================================
#  3) TASDIQ VA BAJARISH
# =====================================================================
def test_tasdiqlangach_yoziladi():
    fb, _ = setup()
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    tok = token_of(ctx)

    ok, msg = run(ai_agent.apply_confirmed(tok, OWNER))
    assert ok, msg
    assert fb.data["products"][0]["price"] == 1200000
    # Tasdiq yozuvi tozalangan
    assert f"pending_actions/{tok}" in fb.deletes
    # Audit yozilgan (orqaga qaytarish uchun)
    audits = [d for p, d in fb.patches if p.startswith("audit_log/")]
    mut = [a for a in audits if a.get("kind") == "mutation"]
    assert len(mut) == 1 and mut[0]["plan"][0]["old"]["price"] == 1000000


def test_ikki_marta_bosish_ikki_marta_bajarmaydi():
    """Xo'jayin tugmani tez ikki marta bossa, narx IKKI marta oshmasligi kerak."""
    fb, _ = setup()
    _res, ctx = call_tool("bulk_adjust_price", product_ids=[1], percent=10)
    tok = token_of(ctx)

    ok1, _ = run(ai_agent.apply_confirmed(tok, OWNER))
    ok2, msg2 = run(ai_agent.apply_confirmed(tok, OWNER))
    assert ok1 is True and ok2 is False, msg2
    assert fb.data["products"][0]["price"] == 1100000, "narx ikki marta oshdi!"


def test_begona_odam_tasdiqlay_olmaydi():
    fb, _ = setup()
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    tok = token_of(ctx)
    ok, msg = run(ai_agent.apply_confirmed(tok, STRANGER))
    assert ok is False and "tegishli emas" in msg
    assert fb.data["products"][0]["price"] == 1000000


def test_muddati_otgan_tasdiq_bajarilmaydi():
    fb, _ = setup()
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    tok = token_of(ctx)
    # Muddatni o'tkazamiz
    fb.data["pending_actions"][tok]["expires"] = 1
    ok, msg = run(ai_agent.apply_confirmed(tok, OWNER))
    assert ok is False and "muddati" in msg.lower()
    assert fb.data["products"][0]["price"] == 1000000


def test_bekor_qilish_hech_narsani_ozgartirmaydi():
    fb, _ = setup()
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    tok = token_of(ctx)
    ok, msg = run(ai_agent.cancel_confirmed(tok, OWNER))
    assert ok and "Bekor" in msg
    assert fb.data["products"][0]["price"] == 1000000
    # Bekor qilingandan keyin tasdiqlab bo'lmaydi
    assert run(ai_agent.apply_confirmed(tok, OWNER))[0] is False


def test_oradan_ozgargan_qiymat_ustidan_yozilmaydi():
    """Tasdiq ko'rsatilishi va tugma bosilishi orasida narx o'zgargan
    bo'lsa — YOZMASLIK kerak, aks holda xo'jayin KO'RMAGAN natija chiqadi."""
    fb, _ = setup()
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    tok = token_of(ctx)

    fb.data["products"][0]["price"] = 1050000     # boshqa kimsa o'zgartirdi
    ok, msg = run(ai_agent.apply_confirmed(tok, OWNER))
    assert ok is False and "o'zgargan" in msg
    assert fb.data["products"][0]["price"] == 1050000, "begona o'zgarish ustidan yozildi!"


def test_float_va_int_bir_xil_deb_hisoblanadi():
    """Firebase narxni `1000000.0` qilib qaytarishi mumkin. Matn sifatida
    solishtirsak «o'zgargan» degan YOLG'ON xato chiqib, tasdiqlangan
    o'zgarish bajarilmasdi."""
    assert ai_agent._same_value(1000000, 1000000.0) is True
    assert ai_agent._same_value("1000000", 1000000.0) is True
    assert ai_agent._same_value(1000000, 1000001) is False
    assert ai_agent._same_value(True, True) is True
    assert ai_agent._same_value("Porshen", "Porshen") is True
    assert ai_agent._same_value("Porshen", "Kalotka") is False

    fb, _ = setup()
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    tok = token_of(ctx)
    # Baza narxni float qilib qaytardi (qiymat AYNI o'zi)
    fb.data["products"][0]["price"] = 1000000.0
    ok, msg = run(ai_agent.apply_confirmed(tok, OWNER))
    assert ok, f"float/int farqi tufayli rad etildi: {msg}"
    assert fb.data["products"][0]["price"] == 1200000


def test_indeks_siljisa_notogri_tovarga_yozilmaydi():
    """`products` — MASSIV. Mini App tovar o'chirsa indekslar suriladi.
    Eski indeksga yozish BOSHQA tovarni buzardi."""
    fb, _ = setup()
    _res, ctx = call_tool("set_price", product_id=3, new_price=95000)
    tok = token_of(ctx)

    # Mini App 1-tovarni o'chirdi -> Klapan 2-indeksdan 1-indeksga suriladi
    fb.data["products"].pop(0)
    ok, msg = run(ai_agent.apply_confirmed(tok, OWNER))
    assert ok, msg
    by_id = {p["id"]: p for p in fb.data["products"] if p}
    assert by_id[3]["price"] == 95000, "Klapan narxi yozilmadi"
    assert by_id[2]["price"] == 200000, "BOSHQA tovar narxi buzildi!"


def test_412_poygasida_qayta_uriniladi():
    """Firebase 412 (boshqa kimsa yozdi) qaytarsa — qayta o'qib urinish."""
    fb, _ = setup()
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    tok = token_of(ctx)
    fb.fail_put_once["products/0"] = 2          # ikki marta 412
    ok, msg = run(ai_agent.apply_confirmed(tok, OWNER))
    assert ok, msg
    assert fb.data["products"][0]["price"] == 1200000


def test_412_tinmasa_xato_qaytadi():
    fb, _ = setup()
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    tok = token_of(ctx)
    fb.fail_put_once["products/0"] = 99
    ok, msg = run(ai_agent.apply_confirmed(tok, OWNER))
    assert ok is False and "band" in msg
    assert fb.data["products"][0]["price"] == 1000000


def test_razmer_qoldigi_va_jami_stock_birga_yangilanadi():
    """Razmer o'zgarganda denormallashgan `stock` ham qayta hisoblanishi
    SHART — aks holda katalogda 'bor/yo'q' belgisi yolg'on ko'rsatadi."""
    fb, _ = setup()
    _res, ctx = call_tool("set_stock", product_id=3, new_stock=7, size="92.5")
    tok = token_of(ctx)
    ok, msg = run(ai_agent.apply_confirmed(tok, OWNER))
    assert ok, msg
    p = fb.data["products"][2]
    assert p["sizes"][0]["stock"] == 7
    assert p["sizes"][1]["stock"] == 0
    assert p["stock"] == 7, f"jami stock qayta hisoblanmadi: {p['stock']}"


def test_flash_bekor_qilinganda_maydonlar_ochiriladi():
    """DEL belgisi Firebase'da `null` bo'lib yo'qolmasligi kerak."""
    fb, _ = setup()
    _res, ctx = call_tool("cancel_flash_sale", product_id=4)
    tok = token_of(ctx)
    # Firebase'ga saqlangan rejada DEL matn sifatida saqlanganini tekshiramiz
    saved = fb.data["pending_actions"][tok]["plan"][0]["set"]
    assert saved["oldPrice"] == DEL, "o'chirish belgisi saqlanmadi"

    ok, msg = run(ai_agent.apply_confirmed(tok, OWNER))
    assert ok, msg
    p = fb.data["products"][3]
    assert p["price"] == 120000
    assert "oldPrice" not in p and "flashUntil" not in p, p


def test_order_status_ikki_joyga_yoziladi_va_mijozga_xabar():
    fb, _ = setup()
    _res, ctx = call_tool("set_order_status", order_key="111_A-1", status="qabul")
    tok = token_of(ctx)

    sent = []

    async def notifier(uid, status, code, order):
        sent.append((uid, status, code, (order or {}).get("total")))

    ok, msg = run(ai_agent.apply_confirmed(tok, OWNER, notifier=notifier))
    assert ok, msg
    # 1) mijozning ro'yxati (mijoz shuni ko'radi)
    assert fb.data["users"]["111"]["orders"][0]["status"] == "qabul"
    # 2) markaziy arxiv (Mini App ham shunga yozadi)
    assert fb.data["orders"]["111_A-1"]["status"] == "qabul"
    # 3) mijozga xabar
    assert sent == [("111", "qabul", "A-1", 500000)], sent


def test_yangi_buyurtma_qoshilsa_togri_buyurtma_ozgaradi():
    """Buyurtmalar `unshift` bilan qo'shiladi — BARCHA indekslar suriladi."""
    fb, _ = setup()
    _res, ctx = call_tool("set_order_status", order_key="111_A-1", status="qabul")
    tok = token_of(ctx)
    # Mijoz yangi buyurtma berdi -> 0-indeksga tushdi, A-1 esa 1-indeksga
    fb.data["users"]["111"]["orders"].insert(
        0, {"id": 1700000999999, "code": "A-2", "status": "kutilmoqda", "total": 1})
    ok, msg = run(ai_agent.apply_confirmed(tok, OWNER))
    assert ok, msg
    orders = {o["code"]: o["status"] for o in fb.data["users"]["111"]["orders"]}
    assert orders["A-1"] == "qabul"
    assert orders["A-2"] == "kutilmoqda", "yangi buyurtma holati buzildi!"


# =====================================================================
#  4) ORQAGA QAYTARISH
# =====================================================================
def test_orqaga_qaytarish():
    fb, _ = setup()
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    run(ai_agent.apply_confirmed(token_of(ctx), OWNER))
    assert fb.data["products"][0]["price"] == 1200000

    tok, preview, err = run(ai_agent.undo_last(OWNER))
    assert tok and not err, err
    assert "1 000 000" in preview, preview

    ok, msg = run(ai_agent.apply_confirmed(tok, OWNER))
    assert ok, msg
    assert fb.data["products"][0]["price"] == 1000000, "asl narx tiklanmadi"


def test_orqaga_ikki_marta_ishlamaydi():
    """Qaytarilgan o'zgarish yana qaytarilmasligi kerak (ping-pong)."""
    fb, _ = setup()
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    run(ai_agent.apply_confirmed(token_of(ctx), OWNER))
    tok, _p, _e = run(ai_agent.undo_last(OWNER))
    run(ai_agent.apply_confirmed(tok, OWNER))

    tok2, _p2, err2 = run(ai_agent.undo_last(OWNER))
    assert tok2 is None and "topilmadi" in err2
    assert fb.data["products"][0]["price"] == 1000000


def test_orqaga_ozgarish_yoq_bolsa():
    setup()
    tok, _p, err = run(ai_agent.undo_last(OWNER))
    assert tok is None and "topilmadi" in err


def test_orqaga_mijozga_xabar_yubormaydi():
    """Holat qaytarilganda mijoz «yo'lga chiqdi» dan keyin «qabul qilindi»
    xabarini olsa chalkashadi."""
    fb, _ = setup()
    _res, ctx = call_tool("set_order_status", order_key="111_A-1", status="yolda")
    sent = []

    async def notifier(*a):
        sent.append(a)

    run(ai_agent.apply_confirmed(token_of(ctx), OWNER, notifier=notifier))
    assert len(sent) == 1

    tok, _p, _e = run(ai_agent.undo_last(OWNER))
    run(ai_agent.apply_confirmed(tok, OWNER, notifier=notifier))
    assert len(sent) == 1, "qaytarishda ham xabar yuborildi"
    assert fb.data["users"]["111"]["orders"][0]["status"] == "kutilmoqda"


def test_undo_plan_teskarisi():
    plan = [{"kind": "product", "id": 1, "set": {"price": 200}, "old": {"price": 100}}]
    undo = ai_agent.build_undo_plan(plan)
    assert undo[0]["set"] == {"price": 100} and undo[0]["old"] == {"price": 200}
    st = [{"kind": "order_status", "set": "yolda", "old": "qabul", "notify": True}]
    u2 = ai_agent.build_undo_plan(st)
    assert u2[0]["set"] == "qabul" and u2[0]["notify"] is False


# =====================================================================
#  5) BAYROQLAR VA RUXSAT
# =====================================================================
def test_yozish_ochirilsa_vosita_ishlamaydi():
    setup()
    ai_agent.WRITE_ENABLED = False
    try:
        res, _ = call_tool("set_price", product_id=1, new_price=1200000)
        assert res["ok"] is False and "o'chirilgan" in res["error"]
    finally:
        ai_agent.WRITE_ENABLED = True


def test_yozish_yordamchilari_berilmasa():
    """PR1 holati: faqat o'qish yordamchilari berilgan."""
    fb = FakeFB(BASE_DATA)
    ai_agent.init(firebase_get=fb.get, firebase_patch=fb.patch,
                  groq_raw=FakeGroq([]), is_owner=lambda u: int(u) == OWNER)
    assert ai_agent._deps.can_write() is False
    res, _ = call_tool("set_price", product_id=1, new_price=1200000)
    assert res["ok"] is False and "sozlanmagan" in res["error"]


def test_begona_odam_yozish_vositasiga_kira_olmaydi():
    fb, _ = setup()
    res, _ = call_tool("set_price", _uid=STRANGER, product_id=1, new_price=1)
    assert res["ok"] is False and "egasi" in res["error"]
    assert fb.data["products"][0]["price"] == 1000000


def test_yozish_vositalari_faqat_egasiga_korsatiladi():
    """Model ko'rmagan vositani chaqirmaydi — bu birinchi to'siq."""
    _fb, groq = setup([FakeMsg("ok")])
    run(ai_agent.run_agent([{"role": "user", "content": "salom"}], OWNER))
    assert "set_price" in groq.tool_names[0]

    _fb, groq = setup([FakeMsg("ok")])
    run(ai_agent.run_agent([{"role": "user", "content": "salom"}], STRANGER))
    assert "set_price" not in groq.tool_names[0]
    assert "search_products" in groq.tool_names[0]


def test_bir_navbatda_pending_chegarasi():
    setup()
    ctx = ai_agent.TurnContext(ai_agent._deps, OWNER)
    ok_count = 0
    for i in range(ai_agent.MAX_PENDING_PER_TURN + 2):
        res = run(ai_agent.execute_tool(
            ctx, "set_price",
            json.dumps({"product_id": 1, "new_price": 1100000 + i * 1000})))
        if res.get("ok"):
            ok_count += 1
    assert ok_count == ai_agent.MAX_PENDING_PER_TURN, ok_count


def test_agent_natijasi_pendingni_qaytaradi():
    setup([FakeMsg("", [FakeCall("c1", "set_price",
                                 '{"product_id":1,"new_price":1200000}')]),
           FakeMsg("Tayyorladim, tasdiqlang.")])
    res = run(ai_agent.run_owner_agent([{"role": "user", "content": "narxni oshir"}],
                                       OWNER))
    assert res.text == "Tayyorladim, tasdiqlang."
    assert len(res.pending) == 1
    assert res.pending[0]["record"]["tool"] == "set_price"


# =====================================================================
#  6) KO'RINISH (tasdiq kartochkasi)
# =====================================================================
def test_kartochka_matni():
    setup()
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    rec = ctx.pending[0]["record"]
    txt = ai_agent.render_plan_preview(rec["plan"], rec["warning"])
    assert "Tasdiqlash kerak" in txt
    assert "Porshen [4133]" in txt
    assert "1 000 000 so'm" in txt and "1 200 000 so'm" in txt
    assert "+20.0%" in txt, txt


def test_kartochka_html_xavfsiz():
    """Tovar nomida <b> bo'lsa Telegram xabarini buzmasligi kerak."""
    data = copy.deepcopy(BASE_DATA)
    data["products"][0]["name"] = "<b>Hack</b> & Co"
    setup(data=data)
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    rec = ctx.pending[0]["record"]
    txt = ai_agent.render_plan_preview(rec["plan"], rec["warning"])
    assert "&lt;b&gt;Hack&lt;/b&gt; &amp; Co" in txt, txt


def test_callback_data_chegarasi():
    """Telegram `callback_data` 64 baytdan oshmasligi kerak."""
    for approve in (True, False):
        d = ai_agent.confirm_callback_data("abcdefghijkl", approve)
        assert len(d.encode()) <= 64, d
        tok, ok = ai_agent.parse_callback_data(d)
        assert tok == "abcdefghijkl" and ok is approve
    assert ai_agent.parse_callback_data("boshqa:narsa")[0] is None
    assert ai_agent.parse_callback_data("")[0] is None


def test_janitor_eskirganlarni_ochiradi():
    fb, _ = setup()
    _res, ctx = call_tool("set_price", product_id=1, new_price=1200000)
    tok = token_of(ctx)
    fb.data["pending_actions"][tok]["expires"] = 1

    async def once():
        task = asyncio.ensure_future(
            ai_agent.pending_janitor(ai_agent._deps, every_sec=0))
        await asyncio.sleep(0.05)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    run(once())
    assert tok not in fb.data.get("pending_actions", {}), "eskirgan tasdiq o'chirilmadi"


# =====================================================================
def _main():
    tests = [(n, f) for n, f in sorted(globals().items())
             if n.startswith("test_") and callable(f)]
    failed = []
    for name, fn in tests:
        try:
            fn()
            print(f"  ✅ {name}")
        except Exception as e:
            failed.append((name, e))
            print(f"  ❌ {name}\n       {type(e).__name__}: {e}")
    print(f"\n{len(tests) - len(failed)}/{len(tests)} sinov o'tdi")
    if failed:
        print("\nYIQILGANLAR:")
        for name, e in failed:
            print(f"  • {name}: {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(_main())
