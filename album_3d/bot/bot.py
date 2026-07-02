"""
=====================================================================
 📖 3D FOTO ALBOM — Telegram bot
---------------------------------------------------------------------
 Vazifasi:
  - Admin rasm(lar) tashlaydi  -> bot ularni Firebase'ga qo'shadi
    (faqat rasm file_id saqlanadi; Mini App Cloudflare Worker orqali
     ko'rsatadi, shuning uchun BOT_TOKEN hech qayerga sirqib chiqmaydi).
  - Har kim "📖 Albomni ochish" tugmasi bilan 3D albomni ochadi.
  - /clear (admin) — albomni tozalaydi.

 ⚠️ XAVFSIZLIK: token/kalit kodda saqlanmaydi — hammasi .env dan.
 Render 24/7 uchun health-server + self-ping (Avto_A1 kabi).
=====================================================================
"""
import os
import asyncio
import logging

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import (InlineKeyboardMarkup, InlineKeyboardButton,
                           ReplyKeyboardMarkup, KeyboardButton, WebAppInfo)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("album-bot")

# =====================================================================
# SOZLAMALAR (.env dan)
# =====================================================================
BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
MINI_APP_URL = os.getenv(
    "MINI_APP_URL",
    "https://anvarjonaxtamov70.github.io/Avto_A1/album_3d/"
).strip()
ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").replace(" ", "").split(",")
             if x.strip().lstrip("-").isdigit()]
FIREBASE_DB_URL = os.getenv("FIREBASE_DB_URL", "").strip()
SERVICE_ACCOUNT_FILE = os.getenv("SERVICE_ACCOUNT_FILE", "serviceAccount.json").strip()

if not BOT_TOKEN:
    raise SystemExit("❌ BOT_TOKEN kerak! .env faylga qo'ying (.env.example ga qarang).")

# =====================================================================
# FIREBASE ADMIN (rasm ro'yxatini yozish uchun)
# =====================================================================
fb_db = None
try:
    if os.path.exists(SERVICE_ACCOUNT_FILE) and FIREBASE_DB_URL:
        import firebase_admin
        from firebase_admin import credentials, db as _fb_rtdb
        cred = credentials.Certificate(SERVICE_ACCOUNT_FILE)
        firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_DB_URL})
        fb_db = _fb_rtdb
        log.info("✅ Firebase Admin ulandi.")
    else:
        log.warning("⚠️ Firebase sozlanmagan — rasm qo'shish o'chiq (albomni ochish ishlaydi).")
except Exception as e:
    log.error("Firebase init xato: %s", e)
    fb_db = None


async def fb_set(path, data):
    if not fb_db:
        return False
    def _s():
        fb_db.reference(path).set(data)
        return True
    try:
        return await asyncio.to_thread(_s)
    except Exception as e:
        log.error("fb_set %s: %s", path, e)
        return False


async def fb_delete(path):
    if not fb_db:
        return False
    def _d():
        fb_db.reference(path).delete()
        return True
    try:
        return await asyncio.to_thread(_d)
    except Exception as e:
        log.error("fb_delete %s: %s", path, e)
        return False


# =====================================================================
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


def is_admin(uid: int) -> bool:
    # ADMIN_IDS bo'sh bo'lsa — hamma rasm qo'sha oladi (shaxsiy albom uchun)
    return (not ADMIN_IDS) or (uid in ADMIN_IDS)


def open_button() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="📖 Albomni ochish", web_app=WebAppInfo(url=MINI_APP_URL))
    ]])


menu = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text="📖 Albomni ochish", web_app=WebAppInfo(url=MINI_APP_URL))]],
    resize_keyboard=True,
)


# =====================================================================
# /start
# =====================================================================
@dp.message(Command("start"))
async def start_cmd(message: types.Message):
    txt = (
        "📖 <b>3D Foto Albom</b>ga xush kelibsiz!\n\n"
        "Pastdagi tugma orqali albomni oching — sahifalar xuddi haqiqiy "
        "kitobdek varaqlanadi 📸✨"
    )
    if is_admin(message.from_user.id):
        txt += (
            "\n\n👑 <b>Admin</b>: menga rasm(lar) tashlang — ular albomga "
            "qo'shiladi. Bir nechta rasmni birdan tashlashingiz mumkin.\n"
            "🧹 /clear — albomni tozalash."
        )
    await message.answer(txt, reply_markup=menu, parse_mode="HTML")


# =====================================================================
# /clear — albomni tozalash (admin)
# =====================================================================
@dp.message(Command("clear"))
async def clear_cmd(message: types.Message):
    if not is_admin(message.from_user.id):
        return
    ok = await fb_delete("album/pages")
    await message.answer("🧹 Albom tozalandi." if ok else
                         "❌ Tozalab bo'lmadi (Firebase sozlanganmi?).")


# =====================================================================
# RASM QABUL QILISH (admin) — album/pages ga file_id yoziladi
# =====================================================================
@dp.message(F.photo)
async def handle_photo(message: types.Message):
    if not is_admin(message.from_user.id):
        await message.answer("Albomni ko'rish uchun 📖 tugmasini bosing.", reply_markup=menu)
        return

    # Eng katta o'lchamli rasmni olamiz
    file_id = message.photo[-1].file_id
    page_id = str(message.message_id)
    # ts — tartib uchun (yuborilgan vaqt, millisekund)
    ts = int(message.date.timestamp() * 1000)

    ok = await fb_set(f"album/pages/{page_id}", {"id": file_id, "ts": ts})
    if ok:
        await message.reply("✅ Rasm albomga qo'shildi 📸", reply_markup=open_button())
    else:
        await message.reply(
            "❌ Rasmni saqlab bo'lmadi.\n"
            "Firebase (SERVICE_ACCOUNT_FILE + FIREBASE_DB_URL) sozlanganmi?"
        )


# Rasm document sifatida yuborilsa ham qo'llab-quvvatlaymiz
@dp.message(F.document)
async def handle_doc(message: types.Message):
    if not is_admin(message.from_user.id):
        return
    mime = (message.document.mime_type or "").lower()
    if not mime.startswith("image/"):
        return
    file_id = message.document.file_id
    page_id = str(message.message_id)
    ts = int(message.date.timestamp() * 1000)
    ok = await fb_set(f"album/pages/{page_id}", {"id": file_id, "ts": ts})
    await message.reply("✅ Rasm albomga qo'shildi 📸" if ok else
                        "❌ Saqlab bo'lmadi (Firebase sozlanganmi?).",
                        reply_markup=open_button() if ok else None)


# =====================================================================
# HEALTH SERVER + SELF-PING (Render 24/7)
# =====================================================================
async def start_health_server():
    port = os.getenv("PORT")
    if not port:
        return
    try:
        from aiohttp import web
    except Exception as e:
        log.error("aiohttp.web yo'q: %s", e)
        return

    async def _ok(_r):
        return web.Response(text="Album bot ishlayapti ✅")

    app = web.Application()
    app.router.add_get("/", _ok)
    app.router.add_get("/health", _ok)
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", int(port)).start()
    log.info("Health server %s-portda ishga tushdi.", port)


async def keep_awake():
    import aiohttp
    base = os.getenv("KEEP_ALIVE_URL") or os.getenv("RENDER_EXTERNAL_URL")
    if not base:
        return
    ping_url = base.rstrip("/") + "/health"
    interval = int(os.getenv("KEEP_ALIVE_INTERVAL", "240"))
    await asyncio.sleep(10)
    log.info("Self-ping yoqildi: %s (har %ss).", ping_url, interval)
    while True:
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as s:
                while True:
                    try:
                        async with s.get(ping_url) as r:
                            log.info("Self-ping: %s", r.status)
                    except Exception as e:
                        log.warning("Self-ping xatosi: %s", e)
                    await asyncio.sleep(interval)
        except Exception as e:
            log.warning("Self-ping session xatosi: %s", e)
            await asyncio.sleep(10)


# =====================================================================
async def main():
    log.info("📖 Album bot ishga tushdi! Admin(lar): %s", ADMIN_IDS or "hamma")
    await start_health_server()
    asyncio.create_task(keep_awake())
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot, drop_pending_updates=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        log.info("Bot to'xtatildi.")
