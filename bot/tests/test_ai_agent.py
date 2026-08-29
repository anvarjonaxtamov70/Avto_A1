# =====================================================================
#  test_ai_agent.py — AI agent halqasi va o'qish vositalari sinovi
#
#  NEGA BU SINOV BOR:
#    Tool calling halqasi tashqaridan sodda ko'rinadi, lekin unda ko'zga
#    ko'rinmaydigan, ISHLAB TURGANDA portlaydigan tuzoqlar bor:
#      • har bir `tool_call_id` ga javob qaytarilmasa — API 400 beradi;
#      • model o'ylab topgan vosita nomi dasturni yiqitishi mumkin;
#      • suhbat tarixiga `tool` xabari tushsa, keyingi qirqish uni
#        `tool_calls` juftidan ajratib, AI ni butunlay o'ldiradi.
#    Bularni qo'lda sinash uchun har safar Groq va Firebase kerak bo'ladi.
#    Shu sababli ikkisi ham SOXTA (fake) qilib almashtiriladi.
#
#  ISHGA TUSHIRISH (ikki usul ham ishlaydi):
#    cd bot && python3 tests/test_ai_agent.py
#    cd bot && python3 -m pytest tests/test_ai_agent.py -q
# =====================================================================

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import ai_agent
from fb_utils import order_paid, stock_of

OWNER = 5105291033
STRANGER = 999

# =====================================================================
#  SOXTA MA'LUMOT (fixtures)
#  Ataylab "achchiq" holatlar kiritilgan: RTDB massiv shakli, qoralama,
#  eskirgan `stock`, ikki xil `items` formati, bo'sh element.
# =====================================================================
PRODUCTS = [
    None,  # RTDB'da o'chirilgan slot — kod buni tashlab ketishi kerak
    {"id": 1, "name": "Porshen To'plami · Gazel Biznes", "code": "4133",
     "price": 1060000, "stock": 4, "desc": "100% original",
     "categories": ["gazel-biznes"], "model": "gazel-biznes",
     "images": ["a.jpg", "b.jpg"], "product_type": "oddiy"},
    {"id": 2, "name": "Kalotka Old · Cobalt", "code": "K-77",
     "price": 240000, "stock": 0, "categories": ["chevy-cobalt"],
     "product_type": "oddiy"},
    # ⚠️ MUHIM HOLAT: `stock` maydoni 25 deb turadi (eskirgan), lekin
    #    razmerlar yig'indisi 3. Haqiqiy qoldiq — 3. Agar kod `stock` ga
    #    ishonsa, AI mijozga yo'q tovarni "ko'p bor" deb aytadi.
    {"id": 3, "name": "Klapan · GAZ", "code": "KL-9", "price": 85000,
     "stock": 25, "product_type": "razmerli", "brand": "gaz",
     "sizes": [{"size": "92.5", "stock": 3}, {"size": "93.0", "stock": 0}],
     "categories": ["gazel-next", "sobol"]},
    {"id": 4, "name": "Rasmsiz qoralama", "price": 50000, "stock": 10,
     "is_draft": True, "batch_id": "Partiya_2026-08-01"},
    {"id": 5, "name": "Amortizator · Nexia", "code": "AM-2", "price": 320000,
     "stock": 12, "oldPrice": 400000, "categories": ["daewoo-nexia2"]},
]

USERS = {
    "111": {
        "profile": {"name": "Ali Valiyev", "phone": "+998901112233", "vip": True},
        "my_car": "Gazel Biznes",
        # mini app formati: {"<id>||<razmer>": soni}
        "orders": [
            {"id": 1_800_000_000_000, "code": "A-1", "status": "yetkazildi",
             "total": 1300000, "cashbackUsed": 50000,
             "items": {"1||Universal": 1, "5||Universal": 1},
             "customerPhone": "+998901112233", "date": "01.08.2026"},
            {"id": 1_800_000_100_000, "code": "A-2", "status": "kutilmoqda",
             "total": 240000, "items": {"2||Universal": 1}},
        ],
        "phase2": {"cashbackTotal": 13000, "cashbackSpent": 50000,
                   "cashbackRefunded": 50000},
    },
    "222": {
        "profile": {"name": "Bobur Karimov", "phone": "+998935556677"},
        # eski/bot formati: [{"name":..., "quantity":...}]
        "orders": {"o1": {"id": 1_800_000_200_000, "code": "B-1",
                          "status": "yetkazildi", "payable": 85000,
                          "items": [{"name": "Klapan", "quantity": 2}]}},
    },
    "333": {"profile": {"name": "Buyurtmasiz mijoz"}},
}

DB = {"products": PRODUCTS, "users": USERS}
WRITES = []      # firebase_patch chaqiruvlari shu yerga yig'iladi


async def fake_get(path):
    return DB.get(path)


async def fake_patch(path, data):
    WRITES.append((path, data))
    return True


# =====================================================================
#  SOXTA GROQ JAVOBI
# =====================================================================
class FakeFn:
    def __init__(self, name, arguments):
        self.name = name
        self.arguments = arguments


class FakeCall:
    def __init__(self, cid, name, arguments):
        self.id = cid
        self.function = FakeFn(name, arguments)


class FakeMsg:
    def __init__(self, content="", tool_calls=None):
        self.content = content
        self.tool_calls = tool_calls


class FakeGroq:
    """Oldindan yozilgan javoblar ketma-ketligini qaytaradi va
    unga BERILGAN xabarlarni tekshirish uchun saqlaydi."""

    def __init__(self, script):
        self.script = list(script)
        self.seen = []          # har chaqiruvdagi messages nusxasi
        self.tool_flags = []    # har chaqiruvda tools berilganmi

    async def __call__(self, messages, tools=None, tool_choice=None,
                       temperature=0.5, model=None, max_retries=3):
        self.seen.append(list(messages))
        self.tool_flags.append(bool(tools))
        if not self.script:
            return FakeMsg("(skript tugadi)")
        return self.script.pop(0)


def setup(script):
    """Agentni soxta bog'liqliklar bilan tayyorlaydi."""
    del WRITES[:]
    groq = FakeGroq(script)
    ai_agent.init(firebase_get=fake_get, firebase_patch=fake_patch,
                  groq_raw=groq, is_owner=lambda uid: int(uid) == OWNER)
    return groq


def run(coro):
    return asyncio.run(coro)


# =====================================================================
#  1) SOF YORDAMCHILAR
# =====================================================================
def test_stock_of_razmerli_eskirgan_stockka_ishonmaydi():
    p = PRODUCTS[3]
    assert p["stock"] == 25, "fixture buzilgan"
    assert stock_of(p) == 3, "razmerlar yig'indisi (3) olinishi kerak, 25 emas"


def test_stock_of_oddiy_tovar():
    assert stock_of(PRODUCTS[1]) == 4
    assert stock_of(PRODUCTS[2]) == 0
    assert stock_of({}) == 0
    assert stock_of(None) == 0


def test_order_paid_cashbackni_hisobga_oladi():
    # total 1 300 000 − cashback 50 000 = 1 250 000
    assert order_paid(USERS["111"]["orders"][0]) == 1250000
    # payable to'g'ridan berilgan
    assert order_paid(USERS["222"]["orders"]["o1"]) == 85000


# =====================================================================
#  2) VOSITA SXEMALARI
# =====================================================================
def test_sxemalar_groq_formatiga_mos():
    # Yozish vositalari ham tekshiriladi: sxemadagi xato Groq'dan 400
    # qaytaradi va AI BUTUNLAY ishlamay qoladi.
    specs = ai_agent.groq_tool_specs(include_mutating=True)
    assert specs, "vositalar ro'yxati bo'sh"
    # Standart holatda yozish vositalari KO'RSATILMAYDI
    default_names = {s["function"]["name"] for s in ai_agent.groq_tool_specs()}
    mutating_names = {n for n, sp in ai_agent.TOOLS.items() if sp.mutating}
    assert not (default_names & mutating_names), \
        "yozish vositalari standart holatda ko'rinmasligi kerak"
    for s in specs:
        assert s["type"] == "function"
        fn = s["function"]
        assert fn["name"] and isinstance(fn["description"], str) and fn["description"]
        params = fn["parameters"]
        assert params["type"] == "object"
        assert isinstance(params.get("properties"), dict)
        # `required` sanab o'tilgan maydon `properties` da bo'lishi SHART,
        # aks holda Groq sxemani rad etadi.
        for req in params.get("required", []):
            assert req in params["properties"], f"{fn['name']}: '{req}' e'lon qilinmagan"
        # Butun sxema JSON'ga aylanishi kerak (API JSON bilan ishlaydi).
        json.dumps(s)


def test_hech_bir_vosita_togridan_yozmaydi():
    """ENG MUHIM INVARIANT.

    Har bir YOZISH vositasi FAQAT `create_pending()` orqali o'tishi shart —
    ya'ni tasdiq tugmasini chetlab o'tib bazaga tegmasligi kerak. Bu sinov
    kelajakda "tezroq bo'lsin" deb to'g'ridan yozadigan vosita qo'shib
    yuborilishining oldini oladi.

    O'QISH vositalari esa umuman yozmasligi kerak.
    """
    import inspect
    banned = ("firebase_put", "firebase_patch", "firebase_delete",
              "atomic_update_by_id", "apply_plan")
    for name, spec in sorted(ai_agent.TOOLS.items()):
        src = inspect.getsource(spec.handler)
        for bad in banned:
            assert bad not in src, (
                f"«{name}» vositasi bazaga TO'G'RIDAN tegadi ({bad}). "
                "Yozish faqat create_pending -> tasdiq -> apply_plan yo'li "
                "bilan bo'lishi kerak.")
        if spec.mutating:
            assert "create_pending" in src, (
                f"«{name}» yozish vositasi tasdiqdan O'TMAYDI — "
                "create_pending chaqirilmagan!")
        else:
            assert "create_pending" not in src, (
                f"«{name}» o'qish vositasi deb belgilangan, lekin o'zgartirish "
                "taklif qiladi. `mutating=True` qo'yish kerak.")


# =====================================================================
#  3) HAR BIR O'QISH VOSITASI
# =====================================================================
async def _call(name, **args):
    ctx = ai_agent.TurnContext(ai_agent._deps, OWNER)
    return await ai_agent.execute_tool(ctx, name, json.dumps(args))


def test_search_products():
    setup([])
    r = run(_call("search_products", query="porshen"))
    assert r["ok"] and r["korsatildi"] == 1
    assert r["tovarlar"][0]["id"] == 1
    assert r["tovarlar"][0]["qoldiq"] == 4

    # Kod bo'yicha qidiruv
    r = run(_call("search_products", query="4133"))
    assert r["tovarlar"][0]["kod"] == "4133"

    # Qoralama standart holatda CHIQMAYDI
    r = run(_call("search_products", query="qoralama"))
    assert r["korsatildi"] == 0, "qoralama mijoz kontekstiga chiqmasligi kerak"
    r = run(_call("search_products", query="qoralama", include_drafts=True))
    assert r["korsatildi"] == 1 and r["tovarlar"][0]["qoralama"] is True

    # only_in_stock tugaganini kesadi
    r = run(_call("search_products", query="kalotka"))
    assert r["korsatildi"] == 1 and r["tovarlar"][0]["holat"] == "tugagan"
    r = run(_call("search_products", query="kalotka", only_in_stock=True))
    assert r["korsatildi"] == 0

    # Bo'sh so'rov — xato, yiqilish emas
    assert run(_call("search_products", query="  "))["ok"] is False


def test_search_razmerli_haqiqiy_qoldiq():
    setup([])
    r = run(_call("search_products", query="klapan"))
    t = r["tovarlar"][0]
    assert t["qoldiq"] == 3, "eskirgan stock=25 emas, razmerlar yig'indisi kerak"
    assert t["holat"] == "kam"
    assert {"razmer": "92.5", "qoldiq": 3} in t["razmerlar"]


def test_get_product_id_va_kod_boyicha():
    setup([])
    r = run(_call("get_product", id=5))
    assert r["ok"] and r["tovar"]["chegirma_foiz"] == 20   # 400k -> 320k
    assert r["tovar"]["rasm_soni"] == 0

    r = run(_call("get_product", code="4133"))
    assert r["tovar"]["id"] == 1 and r["tovar"]["rasm_soni"] == 2

    assert run(_call("get_product", id=9999))["ok"] is False
    assert run(_call("get_product"))["ok"] is False        # argumentsiz


def test_low_stock():
    setup([])
    r = run(_call("low_stock"))
    assert r["ok"]
    ids = [x["id"] for x in r["kam_qolgan"]]
    assert 3 in ids, "Klapan (3 dona) kam qolganlar ichida bo'lishi kerak"
    assert 2 in [x["id"] for x in r["tugagan"]]
    assert 4 not in ids, "qoralama hisobga olinmasligi kerak"


def test_catalog_summary():
    setup([])
    r = run(_call("catalog_summary"))
    assert r["jami_tovar_turi"] == 4      # 5 ta yozuv − 1 qoralama
    assert r["qoralama"] == 1
    assert r["tugagan"] == 1
    # Ombor qiymati razmerlardan hisoblanadi: 1:4*1.06M + 3:3*85k + 5:12*320k
    assert r["ombor_qiymati_som"] == 4 * 1060000 + 3 * 85000 + 12 * 320000


def test_sales_report():
    setup([])
    r = run(_call("sales_report", period="all"))
    assert r["ok"] and r["yetkazilgan_soni"] == 2
    assert r["yetkazilgan_tushum_som"] == 1250000 + 85000
    assert r["holatlar"]["kutilmoqda"] == 1

    # Ikki xil `items` formati ham hisoblanadi. Xo'jayin uchun muhimi —
    # NOM va SONI to'g'ri bo'lishi (id ichki tafsilot).
    sold = {x["nom"]: x["sotilgan_dona"] for x in r["eng_kop_sotilgan"]}
    assert sold.get("Porshen To'plami · Gazel Biznes") == 1, sold
    assert sold.get("Amortizator · Nexia") == 1, sold
    # Eski format (id'siz, faqat nom bilan) ham alohida hisoblanadi
    assert sold.get("Klapan") == 2, sold

    # Vaqti eski buyurtmalar 1 kunlik davrga TUSHMAYDI
    r = run(_call("sales_report", period="1d"))
    assert r["buyurtma_soni"] == 0


def test_eski_format_tovarlari_bir_biriga_qoshilmaydi():
    """REGRESSIYA: ilgari id'siz buyurtma tovarlari MASSIV INDEKSI bo'yicha
    yig'ilardi, ya'ni har xil tovar "0" kaliti ostida birlashib ketardi."""
    from fb_utils import order_items_pairs
    a = order_items_pairs([{"name": "Klapan", "quantity": 2}])
    b = order_items_pairs([{"name": "Porshen", "quantity": 5}])
    assert a[0][0] != b[0][0], "har xil tovar bir xil kalit olmasligi kerak"
    # `id` berilgan bo'lsa — aynan u ishlatiladi
    c = order_items_pairs([{"id": 7, "name": "Klapan", "quantity": 1}])
    assert c[0][0] == "7"
    # Mini app formati o'zgarmagan
    d = order_items_pairs({"12||Universal": 3})
    assert d == [("12", 3, "")]


def test_list_orders():
    setup([])
    r = run(_call("list_orders"))
    assert r["jami_topildi"] == 3
    # Yangisidan boshlab tartiblangan
    assert r["buyurtmalar"][0]["kod"] == "B-1"
    assert r["buyurtmalar"][0]["order_key"] == "222_B-1"

    r = run(_call("list_orders", status="yetkazildi"))
    assert r["jami_topildi"] == 2
    assert all(o["holat"] == "yetkazildi" for o in r["buyurtmalar"])


def test_find_customer():
    setup([])
    r = run(_call("find_customer", query="ali"))
    assert r["topildi"] == 1
    c = r["mijozlar"][0]
    assert c["mashina"] == "Gazel Biznes" and c["vip"] is True
    assert c["jami_xarid_som"] == 1250000
    # cashback = total 13000 + refunded 50000 − spent 50000 = 13000
    assert c["cashback_balans"] == 13000

    # Telefon bo'yicha (qismi ham yetarli)
    assert run(_call("find_customer", query="5556677"))["mijozlar"][0]["ism"] == "Bobur Karimov"
    assert run(_call("find_customer", query="  "))["ok"] is False


def test_list_drafts():
    setup([])
    r = run(_call("list_drafts"))
    assert r["jami_qoralama"] == 1
    assert r["partiyalar"][0]["partiya"] == "Partiya_2026-08-01"


# =====================================================================
#  4) XAVFSIZLIK VA BUZUQ KIRISH
# =====================================================================
def test_begona_odam_vositaga_kira_olmaydi():
    setup([])
    ctx = ai_agent.TurnContext(ai_agent._deps, STRANGER)
    r = run(ai_agent.execute_tool(ctx, "sales_report", "{}"))
    assert r["ok"] is False and "egasi" in r["error"]


def test_yoq_vosita_nomi_yiqitmaydi():
    setup([])
    ctx = ai_agent.TurnContext(ai_agent._deps, OWNER)
    r = run(ai_agent.execute_tool(ctx, "delete_everything", "{}"))
    assert r["ok"] is False and "vosita yo'q" in r["error"]


def test_buzuq_json_argument_yiqitmaydi():
    setup([])
    ctx = ai_agent.TurnContext(ai_agent._deps, OWNER)
    r = run(ai_agent.execute_tool(ctx, "search_products", "{buzuq json"))
    assert r["ok"] is False and "JSON" in r["error"]


def test_notogri_argument_tashlab_ketiladi():
    """Model sxemada yo'q argument qo'shsa — TypeError bo'lmasligi kerak."""
    setup([])
    ctx = ai_agent.TurnContext(ai_agent._deps, OWNER)
    r = run(ai_agent.execute_tool(
        ctx, "search_products",
        '{"query": "porshen", "oylab_topilgan_maydon": 42}'))
    assert r["ok"] is True, "e'lon qilinmagan argument tashlanishi kerak edi"


def test_kesh_bitta_navbatda_bir_marta_oqiydi():
    setup([])
    calls = {"n": 0}

    async def counting_get(path):
        calls["n"] += 1
        return DB.get(path)

    ai_agent._deps.firebase_get = counting_get
    ctx = ai_agent.TurnContext(ai_agent._deps, OWNER)
    run(ai_agent.execute_tool(ctx, "search_products", '{"query":"porshen"}'))
    run(ai_agent.execute_tool(ctx, "low_stock", "{}"))
    run(ai_agent.execute_tool(ctx, "catalog_summary", "{}"))
    assert calls["n"] == 1, f"`products` bir marta o'qilishi kerak, {calls['n']} marta o'qildi"


# =====================================================================
#  5) AGENT HALQASI — eng nozik qism
# =====================================================================
BASE = [{"role": "system", "content": "sen yordamchisan"},
        {"role": "user", "content": "porshen qancha qoldi?"}]


def test_vositasiz_javob_togridan_qaytadi():
    setup([FakeMsg("Salom, Xo'jayin.")])
    reply, calls = run(ai_agent.run_agent(BASE, OWNER))
    assert reply == "Salom, Xo'jayin." and calls == []


def test_vosita_chaqirilib_javob_qaytadi():
    groq = setup([
        FakeMsg("", [FakeCall("c1", "search_products", '{"query":"porshen"}')]),
        FakeMsg("Xo'jayin, 4 dona qoldi."),
    ])
    reply, calls = run(ai_agent.run_agent(BASE, OWNER))
    assert reply == "Xo'jayin, 4 dona qoldi."
    assert [c[0] for c in calls] == ["search_products"]

    # Ikkinchi so'rovda API kutgan tuzilma yuborilgani tekshiriladi
    second = groq.seen[1]
    assert second[-2]["role"] == "assistant" and second[-2]["tool_calls"]
    assert second[-1]["role"] == "tool" and second[-1]["tool_call_id"] == "c1"
    assert "Porshen" in second[-1]["content"]


def test_har_bir_tool_call_id_ga_javob_qaytadi():
    """API talabi: javobsiz qolgan `tool_call_id` bo'lsa 400 xato.
    Chegaradan oshgan chaqiruvlar BAJARILMAYDI, lekin javob OLADI."""
    limit = ai_agent.MAX_CALLS_PER_ROUND
    many = [FakeCall(f"c{i}", "catalog_summary", "{}") for i in range(limit + 3)]
    groq = setup([FakeMsg("", many), FakeMsg("tayyor")])
    reply, calls = run(ai_agent.run_agent(BASE, OWNER))

    assert reply == "tayyor"
    tool_msgs = [m for m in groq.seen[1] if m.get("role") == "tool"]
    assert len(tool_msgs) == len(many), "har bir chaqiruvga javob bo'lishi SHART"
    assert {m["tool_call_id"] for m in tool_msgs} == {c.id for c in many}
    # Faqat chegaragacha HAQIQATDA bajarilgan
    assert len(calls) == limit
    # Oshganlarga xato javobi ketgan
    assert any("ko'p vosita" in m["content"] for m in tool_msgs)


def test_suhbat_tarixi_ifloslanmaydi():
    """Agent NUSXA bilan ishlashi kerak. Aks holda `tool` xabarlari
    tarixga tushib, keyingi qirqishda AI ni butunlay buzadi."""
    history = list(BASE)
    setup([FakeMsg("", [FakeCall("c1", "catalog_summary", "{}")]),
           FakeMsg("tayyor")])
    run(ai_agent.run_agent(history, OWNER))
    assert history == BASE, "asl suhbat tarixi o'zgarmasligi kerak"
    assert not any(m.get("role") == "tool" for m in history)


def test_aylanish_chegarasi_tugasa_yakuniy_javob_beriladi():
    """Model to'xtovsiz vosita chaqirsa — cheksiz halqa BO'LMASLIGI va
    foydalanuvchi bo'sh javob OLMASLIGI kerak."""
    endless = [FakeMsg("", [FakeCall(f"c{i}", "catalog_summary", "{}")])
               for i in range(ai_agent.MAX_TOOL_ROUNDS)]
    groq = setup(endless + [FakeMsg("Yakuniy xulosa.")])
    reply, _ = run(ai_agent.run_agent(BASE, OWNER))

    assert reply == "Yakuniy xulosa."
    assert len(groq.seen) == ai_agent.MAX_TOOL_ROUNDS + 1
    # Oxirgi (yakuniy) chaqiruvda vosita BERILMAYDI — aks holda halqa
    # cheksiz davom etardi.
    assert groq.tool_flags[-1] is False


def test_groq_yiqilsa_none_qaytadi():
    """None -> chaqiruvchi eski (snapshot) yo'liga qaytishi mumkin."""
    setup([None])
    reply, _ = run(ai_agent.run_agent(BASE, OWNER))
    assert reply is None


def test_bosh_argument_satri_yiqitmaydi():
    """Argumentsiz vositada model ba'zan arguments="" qaytaradi."""
    setup([FakeMsg("", [FakeCall("c1", "catalog_summary", "")]),
           FakeMsg("ok")])
    reply, calls = run(ai_agent.run_agent(BASE, OWNER))
    assert reply == "ok" and calls[0][0] == "catalog_summary"


def test_natija_uzunligi_cheklanadi():
    setup([])
    huge = {"ok": True, "data": "x" * (ai_agent.TOOL_RESULT_LIMIT + 5000)}
    txt = ai_agent._tool_result_text(huge)
    assert len(txt) <= ai_agent.TOOL_RESULT_LIMIT + 60
    assert "qisqartirildi" in txt


def test_audit_faqat_kerak_bolganda_yoziladi():
    # Muvaffaqiyatli o'qish — audit YOZILMAYDI (shovqin bo'lmasin)
    setup([FakeMsg("", [FakeCall("c1", "catalog_summary", "{}")]), FakeMsg("ok")])
    run(ai_agent.run_owner_agent(BASE, OWNER))
    assert WRITES == [], "muvaffaqiyatli o'qish audit shovqini yaratmasligi kerak"

    # Xato bo'lgan vosita — YOZILADI
    setup([FakeMsg("", [FakeCall("c1", "get_product", '{"id":9999}')]), FakeMsg("ok")])
    run(ai_agent.run_owner_agent(BASE, OWNER))
    assert len(WRITES) == 1
    path, rec = WRITES[0]
    assert path.startswith("audit_log/") and rec["kind"] == "agent_turn"
    assert rec["uid"] == OWNER and rec["tools"][0]["failed"] is True


def test_prompt_bloki_yozish_yoqligini_aytadi():
    txt = ai_agent.owner_tools_prompt_block()
    assert "O'QIY" in txt and "TO'QIMA" in txt


# =====================================================================
#  ISHGA TUSHIRUVCHI (pytest bo'lmasa ham ishlaydi)
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
