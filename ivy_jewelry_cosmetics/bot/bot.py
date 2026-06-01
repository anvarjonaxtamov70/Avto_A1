"""
=====================================================================
 IVY — Jewelry & Cosmetics  ·  Telegram bot (suhbat qatlami)
---------------------------------------------------------------------
 Vazifasi: /start dan keyin nafis salom + ro'yxatdan o'tkazish
 (ism, telefon, viloyat), mijoz bilan AI suhbat, do'kon (Mini App)
 tugmasi, aktual storis qo'shish (#kategoriya), aloqa.

 ⚠️ XAVFSIZLIK: hech qanday token/kalit kodda saqlanmaydi.
 Hammasi environment (.env) orqali o'qiladi. .env.example ga qarang.

 Bu bot — Mini App'ning O'RNINI BOSMAYDI, balki uni TO'LDIRADI:
 - Buyurtma xabarlari allaqachon Mini App + Cloudflare Worker orqali
   keladi, shuning uchun bot ularni TAKRORLAMAYDI.
 - Bot faqat suhbat / ro'yxat / do'konni ochish bilan shug'ullanadi.
=====================================================================
"""
import os
import asyncio
import logging
import urllib.parse

# .env faylni avtomatik yuklash (ixtiyoriy)
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (InlineKeyboardMarkup, InlineKeyboardButton,
                           ReplyKeyboardMarkup, KeyboardButton,
                           ReplyKeyboardRemove, WebAppInfo)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ivy-bot")

# =====================================================================
# SOZLAMALAR — barchasi environment (.env) dan
# =====================================================================
BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
MINI_APP_URL = os.getenv(
    "MINI_APP_URL",
    "https://anvarjonaxtamov70.github.io/Avto_A1/ivy_jewelry_cosmetics/"
).strip()
ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "1209673004,5105291033").replace(" ", "").split(",") if x.strip().lstrip("-").isdigit()]
ADMIN_ID = ADMIN_IDS[0] if ADMIN_IDS else 0
FIREBASE_DB_URL = os.getenv(
    "FIREBASE_DB_URL",
    "https://ivyj-6d8e4-default-rtdb.asia-southeast1.firebasedatabase.app"
).strip()
SERVICE_ACCOUNT_FILE = os.getenv("SERVICE_ACCOUNT_FILE", "serviceAccount.json").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()

if not BOT_TOKEN:
    raise SystemExit("❌ BOT_TOKEN environment o'zgaruvchisi kerak! .env faylga qo'ying (.env.example ga qarang).")

# =====================================================================
# FIREBASE ADMIN (ixtiyoriy — bo'lmasa suhbat baribir ishlaydi)
# Admin SDK qoidalarni chetlab o'tadi, shuning uchun profil yozish ishlaydi.
# =====================================================================
fb_db = None
try:
    if os.path.exists(SERVICE_ACCOUNT_FILE):
        import firebase_admin
        from firebase_admin import credentials, db as _fb_rtdb
        cred = credentials.Certificate(SERVICE_ACCOUNT_FILE)
        firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_DB_URL})
        fb_db = _fb_rtdb
        log.info("✅ Firebase Admin ulandi.")
    else:
        log.warning("⚠️ %s topilmadi — Firebase yozuvlari o'chiq (suhbat baribir ishlaydi).", SERVICE_ACCOUNT_FILE)
except Exception as e:
    log.error("Firebase init xato: %s", e)
    fb_db = None

async def fb_get(path):
    if not fb_db:
        return None
    def _g():
        return fb_db.reference(path).get()
    try:
        return await asyncio.to_thread(_g)
    except Exception as e:
        log.error("fb_get %s: %s", path, e)
        return None

async def fb_update(path, data):
    if not fb_db:
        return False
    def _u():
        fb_db.reference(path).update(data)
        return True
    try:
        return await asyncio.to_thread(_u)
    except Exception as e:
        log.error("fb_update %s: %s", path, e)
        return False

# =====================================================================
# GROQ AI (ixtiyoriy — bo'lmasa oddiy chiroyli javob + do'kon tugmasi)
# =====================================================================
groq_client = None
if GROQ_API_KEY:
    try:
        from groq import AsyncGroq
        groq_client = AsyncGroq(api_key=GROQ_API_KEY)
        log.info("✅ Groq AI ulandi.")
    except Exception as e:
        log.error("Groq init xato: %s", e)
        groq_client = None
else:
    log.warning("⚠️ GROQ_API_KEY yo'q — AI suhbat soddalashtirilgan rejimda.")

AI_SYSTEM_PROMPT = (
    "Sen 'Ivy — Jewelry & Cosmetics' nafis go'zallik va zargarlik butigining "
    "xushmuomala, iliq va nazokatli maslahatchisisan. Mijozlarga kosmetika (makiyaj), "
    "yuz va tana parvarishi, nafis taqinchoqlar va soch aksessuarlari bo'yicha do'stona "
    "maslahat berasan. Qisqa, samimiy va ayollarga yoqadigan ohangda yoz, o'rinli joyda "
    "1-2 ta nozik emoji ishlat (💄💎🌸✨). "
    "Aniq mahsulot, narx yoki katalog so'ralsa: 'Pastdagi tugma orqali butigimizga kiring' deb taklif qil. "
    "HECH QACHON ochiq havola (http...) yozma. "
    "Narx yoki bor/yo'qligini o'zingdan to'qima — bilmasang, do'konga taklif qil. "
    "Aloqa: @ivy_jewelry_cosmetics_bot · Har kuni 09:00–21:00."
)
ai_sessions = {}

# =====================================================================
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())

# Xotirada tezkor mijozlar keshi
users_db = {}

# =====================================================================
# MENYULAR
# =====================================================================
asosiy_menyu = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="💎 Butikka kirish")],
        [KeyboardButton(text="📞 Biz bilan bog'lanish")],
    ],
    resize_keyboard=True,
)

phone_btn = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text="📞 Raqamni yuborish", request_contact=True)]],
    resize_keyboard=True,
    one_time_keyboard=True,
)

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
    resize_keyboard=True,
    one_time_keyboard=True,
)

def shop_button(url=None):
    """Mini App'ni ochuvchi inline tugma."""
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💎 Butikni ochish", web_app=WebAppInfo(url=url or MINI_APP_URL))
    ]])

def build_dynamic_url(user_id):
    """Mini App'ga ism/telefon/viloyatni URL orqali uzatadi."""
    u = users_db.get(user_id) or {}
    name = urllib.parse.quote(str(u.get("name", "")))
    phone = urllib.parse.quote(str(u.get("phone", "")))
    region = urllib.parse.quote(str(u.get("address", "")))
    if name or phone:
        return f"{MINI_APP_URL}?name={name}&phone={phone}&region={region}"
    return MINI_APP_URL

# =====================================================================
# FSM — ro'yxatdan o'tkazish
# =====================================================================
class Register(StatesGroup):
    name = State()
    phone = State()
    region = State()

# =====================================================================
# /start
# =====================================================================
@dp.message(Command("start"))
async def start_command(message: types.Message, state: FSMContext):
    await state.clear()
    user_id = message.from_user.id
    existing = await fb_get(f"users/{user_id}/profile")

    if existing and existing.get("phone"):
        users_db[user_id] = {
            "name": existing.get("name", message.from_user.first_name),
            "phone": existing.get("phone", ""),
            "address": existing.get("address", ""),
        }
        name = users_db[user_id]["name"]
        await message.answer(
            f"Xush kelibsiz yana bir bor, <b>{name}</b>! 💕\n\n"
            "Ivy — nafislik va go'zallik makoni. Yangi kolleksiyalar sizni kutmoqda 💎\n\n"
            "Pastdagi <b>💎 Butikka kirish</b> tugmasini bosing 👇",
            reply_markup=asosiy_menyu, parse_mode="HTML",
        )
    else:
        await message.answer(
            "Assalomu alaykum va <b>Ivy — Jewelry & Cosmetics</b> butigiga xush kelibsiz! 💄💎\n\n"
            "Bu yerda premium kosmetika, nozik parvarish vositalari va nafis taqinchoqlar sizni kutmoqda. "
            "Sizga eng yaxshi xizmatni ko'rsatishimiz uchun, iltimos, tanishaylik 🌸\n\n"
            "✍️ <b>Ismingizni kiriting:</b>",
            reply_markup=ReplyKeyboardRemove(), parse_mode="HTML",
        )
        await state.set_state(Register.name)

@dp.message(Register.name)
async def get_name(message: types.Message, state: FSMContext):
    name = (message.text or "").strip()
    if not name:
        await message.answer("Iltimos, ismingizni yozing 💕")
        return
    await state.update_data(name=name)
    await message.answer(
        f"Juda chiroyli ism, <b>{name}</b> 🌸\n\n"
        "📞 Endi telefon raqamingizni yuboring (tugma orqali yoki qo'lda):",
        reply_markup=phone_btn, parse_mode="HTML",
    )
    await state.set_state(Register.phone)

@dp.message(Register.phone)
async def get_phone(message: types.Message, state: FSMContext):
    if message.contact:
        phone = message.contact.phone_number
        if not phone.startswith("+"):
            phone = "+" + phone
    else:
        phone = (message.text or "").strip()
    if len(''.join(ch for ch in phone if ch.isdigit())) < 9:
        await message.answer("Iltimos, to'g'ri telefon raqam yuboring 📞")
        return
    await state.update_data(phone=phone)
    await message.answer(
        "🗺 <b>Viloyatingizni tanlang:</b>",
        reply_markup=viloyatlar_menyu, parse_mode="HTML",
    )
    await state.set_state(Register.region)

@dp.message(Register.region)
async def get_region(message: types.Message, state: FSMContext):
    region = (message.text or "").strip()
    data = await state.get_data()
    name = data.get("name")
    phone = data.get("phone")
    user_id = message.from_user.id
    username = message.from_user.username

    users_db[user_id] = {"name": name, "phone": phone, "address": region}

    # Profilni Firebase'ga yozamiz (Mini App ham shu joydan o'qiydi)
    await fb_update(f"users/{user_id}/profile", {
        "uid": user_id, "name": name, "phone": phone, "address": region,
        "username": f"@{username}" if username else "Yo'q",
        "firstName": message.from_user.first_name or "",
        "lastName": message.from_user.last_name or "",
    })

    # Adminga xabar
    uname = f"@{username}" if username else "Yo'q"
    admin_text = (
        "🆕 <b>YANGI MIJOZ RO'YXATDAN O'TDI</b>\n\n"
        f"👤 Ism: <b>{name}</b>\n"
        f"📞 Tel: <code>{phone}</code>\n"
        f"📍 Viloyat: {region}\n"
        f"💬 Username: {uname}\n"
        f"🆔 ID: <code>{user_id}</code>"
    )
    for aid in ADMIN_IDS:
        try:
            await bot.send_message(chat_id=aid, text=admin_text, parse_mode="HTML")
        except Exception as e:
            log.error("Adminga (%s) xabar xatosi: %s", aid, e)

    await message.answer(
        "✅ <b>Ro'yxatdan muvaffaqiyatli o'tdingiz!</b> 💕\n\n"
        "Endi butigimizdagi barcha go'zalliklarni ko'rishingiz mumkin.\n"
        "Pastdagi <b>💎 Butikka kirish</b> tugmasini bosing 👇",
        reply_markup=asosiy_menyu, parse_mode="HTML",
    )
    await state.clear()

# =====================================================================
# Asosiy menyu tugmalari
# =====================================================================
@dp.message(F.text == "💎 Butikka kirish")
async def open_shop(message: types.Message):
    user_id = message.from_user.id
    if user_id not in users_db:
        existing = await fb_get(f"users/{user_id}/profile")
        if existing and existing.get("phone"):
            users_db[user_id] = {
                "name": existing.get("name", message.from_user.first_name),
                "phone": existing.get("phone", ""),
                "address": existing.get("address", ""),
            }
        else:
            users_db[user_id] = {"name": message.from_user.first_name, "phone": "", "address": ""}
    url = build_dynamic_url(user_id)
    await message.answer(
        "💄 Butigimiz tayyor! Quyidagi tugma orqali kiring va o'zingizga sovg'a tanlang 💕",
        reply_markup=shop_button(url),
    )

@dp.message(F.text == "📞 Biz bilan bog'lanish")
async def contact_handler(message: types.Message):
    await message.answer(
        "📞 <b>Ivy bilan bog'lanish</b>\n\n"
        "💬 Telegram: @ivy_jewelry_cosmetics_bot\n"
        "🕐 Ish vaqti: har kuni 09:00–21:00\n"
        "🛡 14 kun kafolat · 100% original mahsulot\n\n"
        "Savollaringiz bo'lsa, shu yerga yozavering — yordam beramiz 💕",
        parse_mode="HTML", reply_markup=asosiy_menyu,
    )

# =====================================================================
# Mini App'dan kelgan ma'lumot (buyurtma holatini o'zgartirish va h.k.)
# =====================================================================
@dp.message(F.web_app_data)
async def handle_webapp_data(message: types.Message):
    import json
    try:
        data = json.loads(message.web_app_data.data)
    except Exception:
        return
    if data.get("action") == "edit_status":
        uid = data.get("user_id")
        order_id = data.get("order_id")
        new_status = data.get("new_status", "")
        labels = {
            "qabul": "✅ Qabul qilindi", "yolda": "🚚 Yo'lga chiqdi",
            "yetkazildi": "🏁 Yetkazib berildi", "bekor_qilingan": "❌ Bekor qilindi",
        }
        await message.answer(f"🔄 <b>#{order_id}</b> holati: {labels.get(new_status, new_status)}", parse_mode="HTML")
        if uid and str(uid).isdigit():
            try:
                await bot.send_message(chat_id=int(uid), text=f"💎 Buyurtmangiz #{order_id} holati: {labels.get(new_status, new_status)}")
            except Exception as e:
                log.error("Mijozga holat xabari xatosi: %s", e)

# =====================================================================
# 📸 Aktual storis qo'shish (admin): rasm/video + #kategoriya
# =====================================================================
@dp.message((F.photo | F.video) & F.caption.startswith("#"))
async def handle_stories(message: types.Message):
    if message.from_user.id not in ADMIN_IDS:
        return
    category = message.caption.strip().replace("#", "").strip().lower()
    if message.photo:
        file_id = message.photo[-1].file_id
        media_type = "image"
    else:
        file_id = message.video.file_id
        media_type = "video"
    msg = await message.reply("⏳ Storis tayyorlanmoqda...")
    try:
        file_info = await bot.get_file(file_id)
        direct_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_info.file_path}"
        story_id = str(message.message_id)
        story_data = {
            "id": story_id, "type": media_type, "src": direct_url,
            "timestamp": int(message.date.timestamp() * 1000),
        }
        ok = await fb_update(f"stories/{category}/{story_id}", story_data)
        if ok:
            await msg.edit_text(f"✅ Storis <b>#{category}</b> bo'limiga qo'shildi!", parse_mode="HTML")
        else:
            await msg.edit_text("❌ Firebase'ga yozib bo'lmadi (serviceAccount.json bormi?).")
    except Exception as e:
        log.error("Storis xatosi: %s", e)
        await msg.edit_text(f"❌ Xatolik: {e}\n(Eslatma: fayl 20MB gacha bo'lsin.)")

# =====================================================================
# 🤖 AI SUHBAT (oddiy matn) — eng oxirgi, qolgan barcha matnni tutadi
# =====================================================================
@dp.message(F.text)
async def handle_ai_chat(message: types.Message, state: FSMContext):
    # Ro'yxatdan o'tish jarayonida bo'lsa — aralashmaymiz
    if await state.get_state() is not None:
        return

    user_id = message.from_user.id
    try:
        await bot.send_chat_action(chat_id=message.chat.id, action="typing")
    except Exception:
        pass

    # Groq yo'q bo'lsa — soddalashtirilgan iliq javob
    if not groq_client:
        await message.reply(
            "Rahmat! 💕 Kosmetika, parvarish va taqinchoqlarni butigimizdan ko'rishingiz mumkin 👇",
            reply_markup=shop_button(build_dynamic_url(user_id)),
        )
        return

    try:
        if user_id not in ai_sessions:
            ai_sessions[user_id] = [{"role": "system", "content": AI_SYSTEM_PROMPT}]
        ai_sessions[user_id].append({"role": "user", "content": message.text})

        resp = await groq_client.chat.completions.create(
            messages=ai_sessions[user_id], model=GROQ_MODEL, temperature=0.6,
        )
        reply = resp.choices[0].message.content
        ai_sessions[user_id].append({"role": "assistant", "content": reply})
        # Sessiyani qisqartirib turamiz
        if len(ai_sessions[user_id]) > 11:
            ai_sessions[user_id] = [ai_sessions[user_id][0]] + ai_sessions[user_id][-10:]

        await message.reply(reply, reply_markup=shop_button(build_dynamic_url(user_id)))
    except Exception as e:
        log.error("Groq xatosi: %s", e)
        await message.reply(
            "Kechirasiz, bir oz bandman 💕 Butigimizni ko'rib turing 👇",
            reply_markup=shop_button(build_dynamic_url(user_id)),
        )

# Rasm yuborilsa (caption'siz) — do'konga yo'naltiramiz
@dp.message(F.photo)
async def handle_photo_redirect(message: types.Message):
    await message.reply(
        "📸 Rasm uchun rahmat! Go'zallik buyumlarini butigimizdan ko'ring 👇",
        reply_markup=shop_button(build_dynamic_url(message.from_user.id)),
    )

# =====================================================================
# ISHGA TUSHIRISH
# =====================================================================
async def main():
    log.info("✅ Ivy bot ishga tushdi! Admin(lar): %s", ADMIN_IDS)
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        log.info("Bot to'xtatildi.")
