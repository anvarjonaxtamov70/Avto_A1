# =====================================================================
#  test_owner_mode.py — XO'JAYIN REJIMI sinovi
#
#  NEGA BU SINOV BOR:
#    Xo'jayin uchun bot mijoz boti kabi ishlardi: har javobda «Do'konga
#    marhamat» tugmasi, har xabarda sotuvchi kabi salomlashish va o'z
#    do'koniga yo'naltirish. Bu xatti-harakat PROMPT MATNI va handler
#    TARTIBI bilan boshqariladi — ikkalasi ham "jimgina" buziladigan
#    narsalar: matnga bitta qator qo'shilsa yoki handler boshqa joyga
#    ko'chsa, xo'jayin yana mijoz oqimiga tushib qoladi va buni faqat
#    u shikoyat qilganda bilamiz.
#
#    Shuning uchun bu yerda AYNAN o'sha uchta shikoyat tekshiriladi:
#      1. Har safar salom bermasin  -> kunda bir marta.
#      2. Do'konga yo'naltirmasin   -> tugma ham, matn ham yo'q.
#      3. Mijoz oqimiga tushmasin   -> handler tartibi to'g'ri.
#
#  MUHIM: sandbox'da aiohttp/aiogram o'rnatilmagan, shuning uchun ular
#  MINIMAL soxta modullar bilan almashtiriladi. Sinaladigan kod esa
#  bot.py dagi HAQIQIY funksiyalar — nusxa emas.
#
#  ISHGA TUSHIRISH:
#    cd bot && python3 tests/test_owner_mode.py
#    cd bot && python3 -m pytest tests/test_owner_mode.py -q
# =====================================================================

import asyncio
import os
import sys
import types as pytypes

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# =====================================================================
#  SOXTA UCHINCHI-TOMON MODULLAR (faqat import o'tishi uchun)
# =====================================================================
class _Magic:
    """aiogram `F` (magic filter) o'rnini bosadi: har qanday zanjirni yutadi."""

    def __getattr__(self, name):
        return _Magic()

    def __call__(self, *a, **k):
        return _Magic()

    def __or__(self, o):
        return _Magic()

    def __ror__(self, o):
        return _Magic()

    def __and__(self, o):
        return _Magic()

    def __rand__(self, o):
        return _Magic()

    def __invert__(self):
        return _Magic()

    def __eq__(self, o):
        return _Magic()

    def __ne__(self, o):
        return _Magic()

    def __hash__(self):
        return id(self)

    def in_(self, *a, **k):
        return _Magic()

    def startswith(self, *a, **k):
        return _Magic()

    def endswith(self, *a, **k):
        return _Magic()

    def contains(self, *a, **k):
        return _Magic()


class _Observer:
    """`dp.message(...)` — filtrlarni e'tiborsiz qoldirib, funksiyani qaytaradi."""

    def __call__(self, *a, **k):
        def deco(fn):
            return fn
        return deco

    def register(self, *a, **k):
        return None


class _Dispatcher:
    def __init__(self, *a, **k):
        pass

    def __getattr__(self, name):
        return _Observer()


class _Bot:
    def __init__(self, *a, **k):
        pass

    def __getattr__(self, name):
        async def _noop(*a, **k):
            return None
        return _noop


class _Named:
    """Nomi bilan tanib olinadigan oddiy qiymat sinfi (klaviaturalar uchun)."""

    def __init__(self, *a, **k):
        self.args = a
        self.kwargs = k


def _install_stubs():
    def mod(name, **attrs):
        m = pytypes.ModuleType(name)
        for k, v in attrs.items():
            setattr(m, k, v)
        sys.modules[name] = m
        return m

    # ——— aiohttp ———
    mod("aiohttp", ClientSession=_Named, ClientTimeout=_Named)

    # ——— dotenv ———
    mod("dotenv", load_dotenv=lambda *a, **k: None)

    # ——— google.auth / google.oauth2 ———
    g = mod("google")
    ga = mod("google.auth")
    gat = mod("google.auth.transport")
    mod("google.auth.transport.requests", Request=_Named)
    mod("google.oauth2")
    mod("google.oauth2.service_account", Credentials=_Named)
    g.auth = ga
    ga.transport = gat

    # ——— groq ———
    mod("groq", AsyncGroq=_Named)

    # ——— aiogram ———
    aio = mod("aiogram", Bot=_Bot, Dispatcher=_Dispatcher,
              types=_Magic(), F=_Magic())
    mod("aiogram.filters", Command=_Named, StateFilter=_Named)
    mod("aiogram.fsm")
    mod("aiogram.fsm.context", FSMContext=_Named)

    class _State:
        def __init__(self, *a, **k):
            pass

    class _StatesGroup:
        pass

    mod("aiogram.fsm.state", State=_State, StatesGroup=_StatesGroup)
    mod("aiogram.fsm.storage")
    mod("aiogram.fsm.storage.memory", MemoryStorage=_Named)

    class ReplyKeyboardRemove(_Named):
        pass

    class InlineKeyboardMarkup(_Named):
        pass

    mod("aiogram.types",
        InlineKeyboardMarkup=InlineKeyboardMarkup,
        InlineKeyboardButton=_Named,
        ReplyKeyboardMarkup=_Named,
        KeyboardButton=_Named,
        ReplyKeyboardRemove=ReplyKeyboardRemove,
        WebAppInfo=_Named,
        BotCommand=_Named,
        BotCommandScopeAllPrivateChats=_Named,
        BotCommandScopeChat=_Named)
    aio.filters = sys.modules["aiogram.filters"]

    # ——— bot.py yonidagi og'ir mahalliy modul (pandas talab qiladi) ———
    async def _noop_bulk(*a, **k):
        return None

    mod("bulk_import_fixed", process_ai_bulk_requests_v2=_noop_bulk)


_install_stubs()

os.environ.setdefault("BOT_TOKEN", "123456:TEST-TOKEN-FOR-UNIT-TESTS-ONLY")
os.environ.setdefault("OWNER_TG_ID", "5105291033")

import bot as B   # noqa: E402  (stub'lardan KEYIN import bo'lishi shart)

OWNER = B.OWNER_TG_ID
STRANGER = 999999


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# =====================================================================
#  1. SALOM — KUNDA BIR MARTA
# =====================================================================
def test_salom_kunda_bir_marta():
    """Birinchi murojaatda salom kerak, ikkinchisida — YO'Q."""
    B._greeted_day.clear()
    reads, writes = [], []

    async def fake_get(path):
        reads.append(path)
        return {}

    async def fake_patch(path, data):
        writes.append((path, data))
        return True

    old_g, old_p = B.firebase_get, B.firebase_patch
    B.firebase_get, B.firebase_patch = fake_get, fake_patch
    try:
        assert _run(B._owner_needs_greeting(OWNER)) is True, "birinchi marta salom kerak"
        _run(B._mark_owner_greeted(OWNER))
        assert _run(B._owner_needs_greeting(OWNER)) is False, "ikkinchi marta salom YO'Q"
    finally:
        B.firebase_get, B.firebase_patch = old_g, old_p

    # Firebase'ga bugungi kun yozilgan bo'lishi kerak (bot restart bo'lsa ham eslaydi)
    assert writes, "lastGreetedDay Firebase'ga yozilmadi"
    path, data = writes[0]
    assert path == f"users/{OWNER}/profile"
    assert data["lastGreetedDay"] == B._today_local()


def test_salom_bot_restartdan_keyin_ham_takrorlanmaydi():
    """Xotira tozalansa ham (Render restart) Firebase'dagi belgi ushlab turadi."""
    B._greeted_day.clear()
    today = B._today_local()

    async def fake_get(path):
        return {"lastGreetedDay": today}

    old_g = B.firebase_get
    B.firebase_get = fake_get
    try:
        assert _run(B._owner_needs_greeting(OWNER)) is False
    finally:
        B.firebase_get = old_g


def test_yangi_kun_boshlanganda_salom_qaytadi():
    B._greeted_day.clear()

    async def fake_get(path):
        return {"lastGreetedDay": "2020-01-01"}   # eski kun

    old_g = B.firebase_get
    B.firebase_get = fake_get
    try:
        assert _run(B._owner_needs_greeting(OWNER)) is True
    finally:
        B.firebase_get = old_g


def test_firebase_ishlamasa_salom_bloklanmaydi():
    """Baza xatosi xo'jayinni javobsiz qoldirmasligi kerak."""
    B._greeted_day.clear()

    async def boom(path):
        raise RuntimeError("baza yo'q")

    old_g = B.firebase_get
    B.firebase_get = boom
    try:
        assert _run(B._owner_needs_greeting(OWNER)) is True
    finally:
        B.firebase_get = old_g


def test_mahalliy_vaqt_utc5():
    """«Kun boshi» server UTC'si emas, xo'jayinning kuni bo'yicha."""
    from datetime import datetime, timezone, timedelta
    kutilgan = datetime.now(timezone(timedelta(hours=5))).strftime("%Y-%m-%d")
    assert B._today_local() == kutilgan


# =====================================================================
#  2. XO'JAYINNI DO'KONGA YO'NALTIRMASLIK
# =====================================================================
def test_xojayin_promptida_dokonga_yonaltirish_YOQ():
    p = B._ai_system_prompt("uz", OWNER, "Anvar")
    assert "Pastdagi tugma" not in p, "xo'jayin o'z do'koniga yo'naltirilyapti!"
    assert "do'konimizdan" not in p
    assert "YO'NALTIRMANG" in p, "yo'naltirish taqiqi promptda yo'q"


def test_mijoz_prompti_ozgarmagan():
    """REGRESSIYA: mijoz uchun do'konga yo'naltirish SAQLANISHI kerak."""
    p = B._ai_system_prompt("uz", STRANGER, "Ali")
    assert "Pastdagi tugma orqali" in p, "mijoz yo'naltirishi buzildi"
    assert "sotuvchi" in p


def test_xojayin_prompti_yordamchi_roli():
    p = B._ai_system_prompt("uz", OWNER, "Anvar")
    assert "yordamchi" in p
    assert "o'ng qo'l" in p
    # Mijoz sotuvchisi rolida BO'LMASLIGI kerak
    assert "sotuvchi-maslahatchisiz" not in p


def test_xojayinga_xojayin_deb_murojaat():
    p = B._ai_system_prompt("uz", OWNER, "Anvar")
    assert "Xo'jayin" in p
    assert "MUROJAAT SHAKLI" in p


def test_salom_korsatmasi_promptga_tushadi():
    bor = B._ai_system_prompt("uz", OWNER, "Anvar", owner_greet=True)
    yoq = B._ai_system_prompt("uz", OWNER, "Anvar", owner_greet=False)
    assert "BIRINCHI" in bor, "birinchi muloqotda salomlashish ko'rsatmasi yo'q"
    assert "QAYTA SALOMLASHMANG" in yoq, "takroriy salom taqiqi yo'q"
    assert bor != yoq


# =====================================================================
#  3. DO'KON TUGMASI XO'JAYINGA KO'RSATILMAYDI
# =====================================================================
def test_dokon_tugmasi_xojayinga_yoq():
    assert B.shop_kb_for(OWNER, "uz") is None, "xo'jayinga do'kon tugmasi chiqyapti!"


def test_dokon_tugmasi_mijozga_bor():
    """REGRESSIYA: mijoz tugmani YO'QOTMASLIGI kerak."""
    kb = B.shop_kb_for(STRANGER, "uz")
    assert kb is not None, "mijoz do'kon tugmasini yo'qotdi"


def test_mijoz_menyusi_bir_marta_olib_tashlanadi():
    """Osilib qolgan doimiy klaviatura bir marta o'chiriladi, keyin bezovta qilmaydi."""
    B._owner_kb_cleared.discard(OWNER)
    birinchi = B._owner_reply_markup(OWNER)
    ikkinchi = B._owner_reply_markup(OWNER)
    assert type(birinchi).__name__ == "ReplyKeyboardRemove", \
        "birinchi javobda klaviatura olib tashlanmadi"
    assert ikkinchi is None, "klaviatura qayta-qayta yuborilyapti"


# =====================================================================
#  4. XO'JAYIN MIJOZ OQIMIGA TUSHMASLIGI (handler TARTIBI)
# =====================================================================
def _handler_qatorlari():
    """bot.py manbasidan handler ta'riflari tartibini o'qiydi."""
    src = open(os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), "bot.py"), encoding="utf-8").read().splitlines()
    pos = {}
    for i, line in enumerate(src, 1):
        s = line.strip()
        if s.startswith("async def "):
            nom = s[len("async def "):].split("(")[0]
            pos.setdefault(nom, i)
    return pos


def test_xojayin_handleri_mijoz_handlerlaridan_OLDIN():
    """aiogram BIRINCHI mos handlerni tanlaydi — tartib xatti-harakatni belgilaydi."""
    p = _handler_qatorlari()
    assert "owner_free_chat" in p, "owner_free_chat handleri yo'q"
    for keyingi in ("register_lang_fallback", "interaktiv_menyu_handler",
                    "get_name", "get_phone", "get_region"):
        assert p["owner_free_chat"] < p[keyingi], (
            f"owner_free_chat '{keyingi}' dan KEYIN turibdi — "
            "xo'jayin yana mijoz oqimiga tushadi")


def test_excel_import_ustunligini_saqlaydi():
    """Import oqimida xo'jayin RAQAM kiritadi — u AI ga ketmasligi kerak."""
    p = _handler_qatorlari()
    assert p["process_rate"] < p["owner_free_chat"]
    assert p["process_markup_pandas"] < p["owner_free_chat"]


def test_xojayin_handleri_ImportState_ni_ushlamaydi():
    """Filtr ataylab faqat None + Register.* holatlarini qamraydi."""
    src = open(os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), "bot.py"), encoding="utf-8").read()
    boshi = src.index("async def owner_free_chat")
    blok = src[max(0, boshi - 400):boshi]
    assert "StateFilter(None, Register." in blok, "holat filtri kutilganidek emas"
    assert "ImportState" not in blok, "ImportState filtrga kirib qolgan"


def test_start_buyrugi_xojayinni_royxatga_solmaydi():
    """/start xo'jayinni til tanlash / ro'yxatdan o'tishga majburlamasligi kerak."""
    src = open(os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), "bot.py"), encoding="utf-8").read()
    boshi = src.index("async def start_command")
    keyingi = src.index("async def ", boshi + 10)
    tana = src[boshi:keyingi]
    assert "_is_owner(user_id)" in tana, "/start da xo'jayin shoxi yo'q"
    xoj = tana.index("_is_owner(user_id)")
    assert "return" in tana[xoj:], "xo'jayin shoxi return bilan tugamaydi"
    # Xo'jayin shoxi mijoz menyusini yubormasligi kerak
    assert "main_menu" not in tana[xoj:tana.index("return", xoj)], \
        "xo'jayinga mijoz menyusi yuborilyapti"


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
