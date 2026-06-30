# =====================================================================
#  🎵 Music Downloader Bot
#  YouTube (yoki nom bo'yicha qidirib) musiqani YUQORI SIFATLI MP3 qilib
#  yuklab beradi. yt-dlp + ffmpeg ishlatadi.
#
#  - Foydalanuvchi YouTube linkini yuboradi  -> bot audioni ajratib MP3 beradi
#  - Yoki qo'shiq nomini yozadi              -> bot YouTube'dan qidirib topadi
#  - Sifatni tanlash mumkin (128 / 192 / 320 kbps), default = 320 kbps
#
#  Render.com bepul tarifda 24/7 ishlashi uchun kichik health-server va
#  o'zini-o'zi uyg'oq tutuvchi (self-ping) mexanizm bor (xuddi Avto_A1 bot kabi).
# =====================================================================
import os
import re
import asyncio
import logging
import tempfile
import shutil
from pathlib import Path

from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode, ChatAction
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    Message,
    FSInputFile,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    CallbackQuery,
)

import yt_dlp

# ---------------------------------------------------------------------
# Sozlamalar
# ---------------------------------------------------------------------
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise SystemExit("BOT_TOKEN topilmadi! .env faylga yoki Render env'ga qo'shing.")

# YouTube "bot emasligingizni tasdiqlang" muammosini chetlab o'tish uchun
# (ixtiyoriy) cookies fayli. Pastdagi DEPLOY qo'llanmasiga qarang.
COOKIES_FILE = os.getenv("COOKIES_FILE", "cookies.txt")

# Telegram bot orqali yuborish mumkin bo'lgan fayl chegarasi ~50 MB.
MAX_TG_SIZE = 49 * 1024 * 1024

# Default audio sifati (kbps)
DEFAULT_QUALITY = os.getenv("DEFAULT_QUALITY", "320")

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# Foydalanuvchi yuborgan linkni vaqtincha saqlash (sifat tanlanguncha)
# {user_id: youtube_url}
PENDING: dict[int, str] = {}

YOUTUBE_RE = re.compile(
    r"(https?://)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)/\S+",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------
# Matnlar
# ---------------------------------------------------------------------
WELCOME = (
    "🎵 <b>Salom! Men musiqa yuklovchi botman.</b>\n\n"
    "Menga quyidagilardan birini yuboring:\n"
    "• 🔗 <b>YouTube linki</b> — videoni yuqori sifatli MP3 qilib beraman\n"
    "• 🔎 <b>Qo'shiq nomi</b> (masalan: <i>Imagine Dragons Believer</i>) — "
    "YouTube'dan o'zim topib beraman\n\n"
    "So'ng sifatni tanlaysiz (128 / 192 / 320 kbps).\n\n"
    "⚠️ <i>Diqqat: mualliflik huquqi himoyalangan kontentni faqat shaxsiy "
    "maqsadda yuklab oling.</i>"
)

HELP = (
    "ℹ️ <b>Qanday ishlataman:</b>\n\n"
    "1️⃣ YouTube linkini yoki qo'shiq nomini yuboring.\n"
    "2️⃣ Sifatni tanlang (yuqori sifat = kattaroq fayl).\n"
    "3️⃣ Bot MP3 faylni yuboradi.\n\n"
    "Buyruqlar:\n"
    "/start — boshlash\n"
    "/help — yordam\n\n"
    "💡 320 kbps = eng yuqori sifat (tavsiya etiladi)."
)


def quality_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🔉 128 kbps", callback_data="q:128"),
                InlineKeyboardButton(text="🔊 192 kbps", callback_data="q:192"),
                InlineKeyboardButton(text="🎧 320 kbps", callback_data="q:320"),
            ]
        ]
    )


# ---------------------------------------------------------------------
# Handlerlar
# ---------------------------------------------------------------------
@dp.message(CommandStart())
async def cmd_start(message: Message):
    await message.answer(WELCOME)


@dp.message(Command("help"))
async def cmd_help(message: Message):
    await message.answer(HELP)


@dp.message(F.text)
async def on_text(message: Message):
    text = (message.text or "").strip()
    if not text:
        return

    if YOUTUBE_RE.search(text):
        # To'g'ridan-to'g'ri YouTube linki
        url = YOUTUBE_RE.search(text).group(0)
        if not url.startswith("http"):
            url = "https://" + url
        PENDING[message.from_user.id] = url
        await message.answer(
            "✅ Link qabul qilindi.\n🎚 <b>Sifatni tanlang:</b>",
            reply_markup=quality_keyboard(),
        )
    else:
        # Qo'shiq nomi — YouTube'dan qidiramiz (ytsearch)
        PENDING[message.from_user.id] = f"ytsearch1:{text}"
        await message.answer(
            f"🔎 <b>«{text}»</b> bo'yicha qidiraman.\n🎚 <b>Sifatni tanlang:</b>",
            reply_markup=quality_keyboard(),
        )


@dp.callback_query(F.data.startswith("q:"))
async def on_quality(call: CallbackQuery):
    quality = call.data.split(":", 1)[1]
    url = PENDING.pop(call.from_user.id, None)
    if not url:
        await call.answer("Avval link yoki qo'shiq nomini yuboring.", show_alert=True)
        return

    await call.message.edit_text(f"⏬ Yuklab olinmoqda... ({quality} kbps)\nBiroz kuting ⏳")
    await download_and_send(call.message, url, quality)
    await call.answer()


# ---------------------------------------------------------------------
# Yuklab olish va yuborish
# ---------------------------------------------------------------------
async def download_and_send(status_msg: Message, url: str, quality: str):
    chat_id = status_msg.chat.id
    tmpdir = tempfile.mkdtemp(prefix="music_")
    try:
        await bot.send_chat_action(chat_id, ChatAction.RECORD_VOICE)

        # Bloklovchi yt-dlp ishini alohida threadda bajaramiz
        info, filepath = await asyncio.to_thread(
            _download_blocking, url, quality, tmpdir
        )

        if not filepath or not os.path.exists(filepath):
            await status_msg.edit_text("❌ Faylni yuklab bo'lmadi. Boshqa link bilan urinib ko'ring.")
            return

        size = os.path.getsize(filepath)
        if size > MAX_TG_SIZE:
            await status_msg.edit_text(
                "⚠️ Fayl juda katta (Telegram chegarasi ~50 MB).\n"
                "Pastroq sifat (128 yoki 192 kbps) bilan urinib ko'ring."
            )
            return

        title = info.get("title", "audio")
        performer = info.get("uploader") or info.get("artist") or ""
        duration = int(info.get("duration") or 0)

        await status_msg.edit_text("📤 Telegram'ga yuborilmoqda...")
        await bot.send_chat_action(chat_id, ChatAction.UPLOAD_DOCUMENT)

        audio = FSInputFile(filepath, filename=f"{_safe_name(title)}.mp3")
        await bot.send_audio(
            chat_id,
            audio=audio,
            title=title[:60],
            performer=performer[:60] if performer else None,
            duration=duration or None,
            caption=f"🎵 <b>{title}</b>\n🎧 {quality} kbps",
        )
        await status_msg.delete()

    except yt_dlp.utils.DownloadError as e:
        logging.warning(f"DownloadError: {e}")
        await status_msg.edit_text(
            "❌ Yuklashda xatolik. Sabablari:\n"
            "• Link noto'g'ri yoki video o'chirilgan\n"
            "• Video yoshга cheklangan / maxfiy\n"
            "Boshqa link bilan urinib ko'ring."
        )
    except Exception as e:
        logging.exception("Kutilmagan xato")
        await status_msg.edit_text(f"❌ Xatolik yuz berdi: {e}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _download_blocking(url: str, quality: str, tmpdir: str):
    """yt-dlp bilan eng yaxshi audioni yuklab, MP3 ga aylantiradi (bloklovchi)."""
    outtmpl = os.path.join(tmpdir, "%(id)s.%(ext)s")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "writethumbnail": True,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": quality,  # masalan "320"
            },
            {"key": "FFmpegMetadata"},   # nom/ijrochi metadata
            {"key": "EmbedThumbnail"},   # muqova rasm (mavjud bo'lsa)
        ],
    }
    # YouTube anti-bot uchun cookies (mavjud bo'lsa)
    if os.path.exists(COOKIES_FILE):
        ydl_opts["cookiefile"] = COOKIES_FILE

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        # ytsearch holatida natija "entries" ichida bo'ladi
        if "entries" in info:
            info = info["entries"][0]
        # Yakuniy MP3 fayl yo'lini topamiz
        vid = info.get("id", "")
        mp3 = os.path.join(tmpdir, f"{vid}.mp3")
        if not os.path.exists(mp3):
            # Ehtiyot uchun papkadagi har qanday mp3 ni qidiramiz
            mp3_files = list(Path(tmpdir).glob("*.mp3"))
            mp3 = str(mp3_files[0]) if mp3_files else ""
        return info, mp3


def _safe_name(name: str) -> str:
    """Fayl nomini xavfsiz qiladi."""
    name = re.sub(r"[^\w\s\-\.\(\)]", "", name, flags=re.UNICODE).strip()
    return (name or "audio")[:80]


# =====================================================================
# HEALTH SERVER — Render bepul "web service" uxlab qolmasligi uchun
#   FAQAT PORT env o'rnatilgan bo'lsa ishga tushadi (Render uni beradi).
# =====================================================================
async def start_health_server():
    port = os.getenv("PORT")
    if not port:
        return  # lokal ishga tushirish — kerak emas
    try:
        from aiohttp import web
    except Exception as e:
        logging.error(f"Health server uchun aiohttp.web yuklanmadi: {e}")
        return

    async def _ok(_request):
        return web.Response(text="Music bot ishlayapti ✅")

    app = web.Application()
    app.router.add_get("/", _ok)
    app.router.add_get("/health", _ok)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", int(port))
    await site.start()
    logging.info(f"Health server {port}-portda ishga tushdi.")


# =====================================================================
# SELF-PING — Render bepul tarifda 15 daqiqadan keyin uxlab qolmaslik uchun
#   Bot o'zining manziliga har ~10 daqiqada GET yuboradi.
#   Render `RENDER_EXTERNAL_URL` ni avtomatik beradi.
# =====================================================================
async def keep_awake():
    import aiohttp

    base = os.getenv("KEEP_ALIVE_URL") or os.getenv("RENDER_EXTERNAL_URL")
    if not base:
        return
    ping_url = base.rstrip("/") + "/health"
    interval = int(os.getenv("KEEP_ALIVE_INTERVAL", "600"))
    await asyncio.sleep(60)
    logging.info(f"Self-ping yoqildi: {ping_url} (har {interval}s).")
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                async with session.get(ping_url, timeout=30) as r:
                    logging.info(f"Self-ping: {r.status}")
            except Exception as e:
                logging.warning(f"Self-ping xatosi: {e}")
            await asyncio.sleep(interval)


# =====================================================================
# ISHGA TUSHIRISH
# =====================================================================
async def main():
    logging.info("🎵 Music bot ishga tushdi!")
    await start_health_server()
    asyncio.create_task(keep_awake())
    # 409 Conflict oldini olish uchun webhookni tozalaymiz
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot, drop_pending_updates=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Bot to'xtatildi.")
