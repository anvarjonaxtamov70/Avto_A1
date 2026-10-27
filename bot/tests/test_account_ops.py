# =====================================================================
#  test_account_ops.py — raqam bo'yicha kirish (raqamni tanlash), kontakt
#  tasdig'i va storis javobi (bot -> Worker imzosi).
#
#  ISHGA TUSHIRISH:  cd bot && python3 tests/test_account_ops.py
# =====================================================================
import asyncio
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
ROOT = os.path.dirname(os.path.dirname(HERE))

import account_ops  # noqa: E402
import order_ops  # noqa: E402

NONCE = "0123456789abcdef0123456789abcdef"


def run(coro):
    return asyncio.run(coro)


def test_raqam_normallash_worker_bilan_bir_xil():
    d = account_ops.phone_digits
    assert d("+998 90 111-22-33") == "998901112233"
    assert d("901112233") == "998901112233"
    assert d("998901112233") == "998901112233"
    assert d("+7 912 345 67 89") == "79123456789"
    assert d("12345") == ""
    assert d(None) == ""
    # Worker'dagi funksiya ham shu qoidada (9 -> 998..., 10-15 -> o'zi)
    src = open(os.path.join(ROOT, "cloudflare-worker.js"), encoding="utf-8").read()
    body = re.search(r"function phoneDigits\(value\) \{(.*?)\n\}", src, re.S).group(1)
    assert 'd.length === 9) return "998" + d' in body
    assert "d.length >= 10 && d.length <= 15" in body


def test_faqat_oz_kontakti_tasdiqlanadi():
    assert account_ops.contact_is_own(5105291033, 5105291033)
    assert account_ops.contact_is_own("777", 777)
    assert not account_ops.contact_is_own(None, 777)       # qo'lda yozilgan kontakt kartochkasi
    assert not account_ops.contact_is_own(778, 777)        # boshqa odamning kontakti
    assert not account_ops.contact_is_own("x", 777)


def test_tasdiqlangan_raqam_yollari():
    u = account_ops.verified_phone_updates(777000111, "998901112233", 1700000000000)
    assert u == {
        "phone_index/998901112233": {"uid": "777000111", "at": 1700000000000, "src": "bot"},
        "users/777000111/verify": {"phone": "+998901112233", "at": 1700000000000, "src": "bot"},
    }


def test_kirish_tugmalari_tahlili():
    p = account_ops.parse_login_callback
    assert p(f"tgl:p:{NONCE}:42") == ("pick", NONCE, "42")
    assert p(f"tgl:ok:{NONCE}") == ("ok", NONCE, None)
    assert p(f"tgl:no:{NONCE}") == ("no", NONCE, None)
    assert p(f"tgl:p:{NONCE}:05") == (None, None, None)    # 2 xonali 10-99
    assert p(f"tgl:p:{NONCE}:100") == (None, None, None)
    assert p("tgl:p:xyz:42") == (None, None, None)
    assert p("tgl:ok:" + NONCE.upper()) == (None, None, None)
    assert p("ord:q:abc") == (None, None, None)
    # Worker yasaydigan callback_data 64 baytdan oshmaydi
    assert len(f"tgl:p:{NONCE}:99".encode()) <= 64


def test_raqam_tanlash_qarori():
    now = 1_700_000_000_000
    req = {"uid": "777", "code": "42", "state": "sent", "at": now - 1000}
    q = account_ops.login_pick_decision
    assert q(req, 777, "42", now) == ("ok", "ok")
    assert q(req, 777, "17", now) == ("bad", "bad")              # noto'g'ri — so'rov yopiladi
    assert q(req, 778, "42", now) == ("foreign", None)           # begona odam bosdi
    assert q(dict(req, state="bad"), 777, "42", now) == ("done", None)   # qayta tanlab bo'lmaydi
    assert q(dict(req, state="ok"), 777, "42", now) == ("done", None)
    assert q(dict(req, at=now - 11 * 60 * 1000), 777, "42", now) == ("expired", "expired")
    assert q(None, 777, "42", now) == ("missing", None)


def test_men_emasman_qarori():
    d = account_ops.deny_decision
    assert d({"uid": "777", "state": "sent"}, 777) == "no"
    assert d({"uid": "777", "state": "ok"}, 777) == "done"
    assert d({"uid": "778", "state": "sent"}, 777) == "foreign"
    assert d(None, 777) == "missing"
    for k in ("ok", "bad", "expired", "done", "missing", "no"):
        assert account_ops.LOGIN_RESULT_TEXTS[k]


def test_storis_tugmasi_tahlili():
    assert account_ops.parse_story_callback("sra:0123456789abcdef0123") == "0123456789abcdef0123"
    assert account_ops.parse_story_callback("sra:XYZ") is None
    assert account_ops.parse_story_callback("ord:q:0123456789abcdef0123") is None


def test_storis_javobi_imzolanadi():
    calls = []

    async def fake_post(url, route, body):
        calls.append((route, body))
        return 200, {"ok": True, "telegram": "sent"}

    ok, code, data = run(account_ops.worker_story_answer(
        "https://w.test", "123:TEST_TOKEN_FOR_ORDER_FLOW", 5105291033,
        "0123456789abcdef0123", "Narxi 120 000 so'm", post=fake_post))
    assert ok and code == 200
    route, body = calls[0]
    assert route == "/story-answer"
    assert body["short"] == "0123456789abcdef0123" and body["text"] == "Narxi 120 000 so'm"
    expected = order_ops.bot_auth("123:TEST_TOKEN_FOR_ORDER_FLOW", "story-answer", 5105291033,
                                  ["0123456789abcdef0123", "Narxi 120 000 so'm"], ts=body["botAuth"]["ts"])
    assert body["botAuth"] == expected


def test_storis_xatosi_tushunarli():
    t = account_ops.story_answer_error_text
    assert "eski versiyada" in t(404, {"error": "topilmadi"})
    assert "topilmadi" in t(404, {"error": "javob topilmadi"}) and "eski" not in t(404, {"error": "javob topilmadi"})
    assert "Imzo" in t(401, {"error": "botAuth eskirgan"})
    assert "ulanib" in t(0, {"error": "timeout"})


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    bad = 0
    for name, fn in tests:
        try:
            fn()
            print("  ✅", name)
        except Exception as e:  # noqa: BLE001
            bad += 1
            print("  ❌", name, "::", repr(e))
    print(f"\n{len(tests) - bad} ta o'tdi, {bad} ta xato")
    sys.exit(1 if bad else 0)
