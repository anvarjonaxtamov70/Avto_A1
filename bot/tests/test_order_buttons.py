# =====================================================================
#  test_order_buttons.py — buyurtma kartochkasi tugmalari, bot -> Worker
#  imzosi va yetkazilmagan bildirishnomalar watchdog'i.
#
#  NEGA BU SINOV BOR:
#    Tugmalar ikki joyda yasaladi: Worker (yangi kartochka) va bot
#    ("⬅️ Orqaga" / xatodan keyin tiklash). Ular ajralib qolsa admin
#    noto'g'ri tugmani ko'radi. Imzo ham ikki tilda (JS va Python) — bitta
#    belgi farqi bo'lsa hamma tugma 401 beradi. Ikkalasi ham shu yerda va
#    `.github/test-order-flow.js` da BITTA kutilgan natija bilan tekshiriladi.
#
#  ISHGA TUSHIRISH:  cd bot && python3 tests/test_order_buttons.py
# =====================================================================
import asyncio
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
ROOT = os.path.dirname(os.path.dirname(HERE))

import order_ops  # noqa: E402


def run(coro):
    return asyncio.run(coro)


def test_tugmalar_worker_bilan_bir_xil():
    with open(os.path.join(ROOT, ".github", "order-keyboards.json"), encoding="utf-8") as f:
        expected = json.load(f)
    for status, kb in expected.items():
        assert order_ops.order_admin_keyboard(status, "abc123") == kb, status


def test_otishlar_worker_bilan_bir_xil():
    """ORDER_TRANSITIONS — Worker'dagi jadval bilan aynan bir xil."""
    src = open(os.path.join(ROOT, "cloudflare-worker.js"), encoding="utf-8").read()
    block = re.search(r"const ORDER_TRANSITIONS = \{(.*?)\};", src, re.S).group(1)
    js = {}
    for m in re.finditer(r"(\w+):\s*\[([^\]]*)\]", block):
        js[m.group(1)] = re.findall(r'"(\w+)"', m.group(2))
    assert js == order_ops.ORDER_TRANSITIONS, (js, order_ops.ORDER_TRANSITIONS)


def test_imzo_vektori_js_bilan_bir_xil():
    auth = order_ops.bot_auth("123:TEST_TOKEN_FOR_ORDER_FLOW", "order-status", 5105291033,
                              ["111", "ord-1", "qabul", ""], ts=1700000000)
    assert auth == {
        "ts": 1700000000, "actor": "5105291033",
        "sig": "389a5039a4c7236130d95c78ba2adcc001d48f2b0e990f0a84ac3b907f552678",
    }, auth


def test_callback_tahlili():
    p = order_ops.parse_order_callback
    assert p("ord:q:0123456789abcdef0123") == ("set", "q", "0123456789abcdef0123")
    assert p("ordc:x:0123456789abcdef0123") == ("confirm", "x", "0123456789abcdef0123")
    assert p("ordb:0123456789abcdef0123") == ("back", None, "0123456789abcdef0123")
    for bad in ("ord:z:0123456789abcdef0123", "ord:q:../../etc", "ord:q:", "aia:x:1",
                "ord:q:0123456789ABCDEF0123", "ordb:", None, "ord:q:abc:def"):
        assert p(bad) == (None, None, None), bad


def test_callback_data_64_baytdan_oshmaydi():
    short = "f" * 20
    for status in order_ops.ORDER_STATUSES:
        for row in order_ops.order_admin_keyboard(status, short)["inline_keyboard"]:
            for b in row:
                assert len(b["callback_data"].encode()) <= 64
    for row in order_ops.order_confirm_keyboard("x", short)["inline_keyboard"]:
        for b in row:
            assert len(b["callback_data"].encode()) <= 64


def test_tasdiq_tugmasi_qaytarishni_aytadi():
    kb = order_ops.order_confirm_keyboard("x", "abc12345", "yetkazildi")
    assert "qaytarildi" in kb["inline_keyboard"][0][0]["text"]
    assert kb["inline_keyboard"][0][0]["callback_data"] == "ord:x:abc12345"
    assert kb["inline_keyboard"][1][0]["callback_data"] == "ordb:abc12345"


def test_worker_status_sorovi_imzolanadi():
    seen = []

    async def post(url, route, body):
        seen.append((route, body))
        return 200, {"ok": True, "status": body["status"]}

    ok, code, data = run(order_ops.worker_order_status(
        "https://w.test", "123:TEST_TOKEN_FOR_ORDER_FLOW", 5105291033, 111, "ord-1", "qabul",
        expected_from="kutilmoqda", post=post))
    assert ok and code == 200
    route, body = seen[0]
    assert route == "/order-status"
    assert body["uid"] == "111" and body["orderId"] == "ord-1" and body["expectedFrom"] == "kutilmoqda"
    exp = order_ops.bot_auth("123:TEST_TOKEN_FOR_ORDER_FLOW", "order-status", 5105291033,
                             ["111", "ord-1", "qabul", "kutilmoqda"], ts=body["botAuth"]["ts"])
    assert body["botAuth"] == exp


def test_worker_xatosi_tushunarli_matn():
    t = order_ops.status_error_text
    assert "qayta joylang" in t(401, {"error": "initData yoki idToken kerak"})
    assert "qayta joylang" in t(404, {})
    assert "allaqachon" in t(409, {"error": "status o'tishi mumkin emas", "from": "yolda"})
    assert "Yo'lda" in t(409, {"error": "status o'tishi mumkin emas", "from": "yolda"})
    assert "qayta bosing" in t(409, {"error": "status o'zgarishi bajarilmoqda", "retryable": True})
    assert "ulanib bo'lmadi" in t(0, {"error": "timeout"})


def test_watchdog_faqat_kerakli_hodisalarni_oladi():
    now = order_ops.WATCHDOG_EPOCH_MS + 10 * 3600 * 1000
    m = 60 * 1000
    raw = {
        "fresh": {"type": "order_created", "delivered": False, "createdAt": now - 10 * 1000},
        "retry": {"type": "order_created", "delivered": False, "createdAt": now - 5 * m, "attempts": 1},
        "never": {"type": "order_status", "delivered": False, "createdAt": now - 3 * m},
        "done": {"type": "order_created", "delivered": True, "createdAt": now - 5 * m},
        "leased": {"type": "order_created", "delivered": False, "createdAt": now - 5 * m,
                   "attempts": 1, "leaseUntil": now + 30 * 1000},
        "gave_up": {"type": "order_created", "delivered": False, "createdAt": now - 5 * m, "attempts": 8},
        "too_old": {"type": "order_created", "delivered": False, "createdAt": now - 30 * 3600 * 1000, "attempts": 1},
        "pre_epoch": {"type": "order_created", "delivered": False,
                      "createdAt": order_ops.WATCHDOG_EPOCH_MS - 3600 * 1000},
        "customer": {"type": "new_customer", "delivered": False, "createdAt": now - 5 * m},
        "junk": "x",
    }
    assert order_ops.outbox_keys_to_retry(raw, now) == ["retry", "never"]
    assert order_ops.outbox_keys_to_retry(None, now) == []


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  ✅ {name}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  ❌ {name}: {e!r}")
    print(f"\n{len(tests) - failed}/{len(tests)} sinov o'tdi")
    sys.exit(1 if failed else 0)
