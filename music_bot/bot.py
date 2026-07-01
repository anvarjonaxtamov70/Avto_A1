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
import html
import asyncio
import logging
import platform
import tempfile
import shutil
from pathlib import Path

from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode, ChatAction
from aiogram.filters import CommandStart, Command, CommandObject
from aiogram.types import (
    Message,
    FSInputFile,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    CallbackQuery,
    BotCommand,
)

import yt_dlp

from diag_utils import (
    safe_name,
    is_bot_block,
    split_chunks,
    check_cmd,
    check_pot_plugin,
    check_pot_server,
)

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
# cookies. Ikki usulda berish mumkin (pastdagi DEPLOY qo'llanmasiga qarang):
#   1) YT_COOKIES_CONTENT env  -> bot startda cookies faylga yozadi (eng oson)
#   2) cookies.txt fayli       -> COOKIES_FILE env yoki Render Secret File
COOKIES_FILE = os.getenv("COOKIES_FILE", "cookies.txt")
YT_COOKIES_CONTENT = os.getenv("YT_COOKIES_CONTENT", "")

# yt-dlp tomonidan ishlatiladigan yakuniy cookies fayl yo'li (startda aniqlanadi)
_RESOLVED_COOKIES: str | None = None

# YouTube bot-deteksiyasini kamaytirish uchun realistik User-Agent
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# PO Token (Proof-of-Origin) provider HTTP serverining manzili.
# bgutil POT server bot bilan bir konteynerda 127.0.0.1:4416 da ishlaydi.
POT_PROVIDER_URL = os.getenv("POT_PROVIDER_URL", "http://127.0.0.1:4416")

# (Ixtiyoriy) Proxy — YouTube blokini chetlab o'tishning eng kuchli usuli.
# DIQQAT: datacenter (bepul) proxy YouTube'da deyarli ishlamaydi; RESIDENTIAL
# proxy kerak. Format: http://user:pass@host:port  yoki  socks5://host:port
PROXY_URL = (
    os.getenv("PROXY_URL")
    or os.getenv("HTTPS_PROXY")
    or os.getenv("HTTP_PROXY")
    or ""
).strip()

# Yuklashda ketma-ket sinaladigan player_client'lar. Biri bloklansa,
# keyingisiga o'tiladi. None = yt-dlp'ning o'z default tartibi (POT bilan).
# Env orqali o'zgartirish mumkin: YT_PLAYER_CLIENTS="web,mweb,tv,android"
_clients_env = os.getenv("YT_PLAYER_CLIENTS", "").strip()
_CLIENTS_FROM_ENV = bool(_clients_env)
if _clients_env:
    PLAYER_CLIENTS: list[str | None] = [c.strip() for c in _clients_env.split(",") if c.strip()]
else:
    # MUHIM tartib: tajriba shuni ko'rsatdiki, "android" va default klientlar
    # audio formatni ishonchli beradi; web/mweb/tv/ios ko'pincha "Requested
    # format is not available" beradi. Shuning uchun ishlaydiganlari OLDINDA.
    PLAYER_CLIENTS = ["android", None, "tv", "web", "mweb", "ios"]


def _client_order() -> list:
    """Joriy holatga qarab sinaladigan client tartibini qaytaradi.

    - Env orqali aniq berilgan bo'lsa — o'shani ishlatamiz.
    - Cookies BOR bo'lsa — autentifikatsiya bilan web/android eng ishonchli,
      shuning uchun ularni oldinga qo'yamiz (login talab qiluvchi videolar uchun).
    - Aks holda — android birinchi (PO Token bilan eng barqaror).
    """
    if _CLIENTS_FROM_ENV:
        return PLAYER_CLIENTS
    if _RESOLVED_COOKIES and os.path.exists(_RESOLVED_COOKIES):
        return ["android", "web", None, "mweb", "tv", "ios"]
    return PLAYER_CLIENTS

# /diag buyrug'i uchun sinov videosi (barqaror, ommabop). Env orqali o'zgartirsa bo'ladi.
DIAG_TEST_URL = os.getenv("DIAG_TEST_URL", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")

# /diag'ni faqat shu Telegram ID egasi ishlata oladi (ixtiyoriy).
# Bo'sh bo'lsa — hamma ishlata oladi.
ADMIN_ID = os.getenv("ADMIN_ID", "").strip()


def setup_cookies() -> str | None:
    """Cookies manbasini aniqlaydi va yt-dlp uchun fayl yo'lini qaytaradi.

    Tekshirish tartibi:
      1) YT_COOKIES_CONTENT env (matn) -> faylga yoziladi
      2) COOKIES_FILE env / cookies.txt (lokal)
      3) /etc/secrets/cookies.txt (Render Secret File)
    """
    global _RESOLVED_COOKIES

    # 1) Env orqali berilgan cookies matnini faylga yozamiz
    if YT_COOKIES_CONTENT.strip():
        target = os.path.join(tempfile.gettempdir(), "yt_cookies.txt")
        try:
            with open(target, "w", encoding="utf-8") as f:
                content = YT_COOKIES_CONTENT
                if not content.startswith("# Netscape"):
                    # yt-dlp Netscape formatdagi sarlavhani kutadi
                    content = "# Netscape HTTP Cookie File\n" + content
                f.write(content)
            _RESOLVED_COOKIES = target
            logging.info("Cookies YT_COOKIES_CONTENT env'idan yuklandi ✅")
            return target
        except Exception as e:
            logging.error(f"Cookies env'ini yozishda xato: {e}")

    # 2) & 3) Mavjud cookies fayllarini qidiramiz
    for path in (COOKIES_FILE, "/etc/secrets/cookies.txt"):
        if path and os.path.exists(path):
            _RESOLVED_COOKIES = path
            logging.info(f"Cookies fayldan topildi: {path} ✅")
            return path

    logging.warning(
        "Cookies topilmadi. YouTube ba'zan 'Sign in to confirm you're not a bot' "
        "xatosini berishi mumkin. DEPLOY_RENDER.md'dagi cookies bo'limiga qarang."
    )
    return None

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
    "/help — yordam\n"
    "/diag — diagnostika (muammoni aniqlash)\n"
    "/diag &lt;link&gt; — aniq videoni sinab ko'rish\n\n"
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


@dp.message(Command("diag"))
async def cmd_diag(message: Message, command: CommandObject):
    """Diagnostika: har bir bosqichni sinab, qaysi birida xato borligini ko'rsatadi.

    Ixtiyoriy: /diag <youtube-url> — aniq videoni sinab ko'rish uchun.
    """
    if ADMIN_ID and str(message.from_user.id) != ADMIN_ID:
        await message.answer("⛔ Bu buyruq faqat admin uchun.")
        return
    # /diag dan keyin URL berilgan bo'lsa — o'shani sinaymiz
    test_url = (command.args or "").strip() or DIAG_TEST_URL
    note = await message.answer(
        "🩺 Diagnostika boshlandi...\nBu 30-90 soniya davom etishi mumkin, kuting ⏳"
    )
    try:
        report = await asyncio.to_thread(_run_diagnostics_blocking, test_url)
    except Exception as e:  # noqa: BLE001
        logging.exception("Diagnostika xatosi")
        await note.edit_text(f"❌ Diagnostika xatosi: {e}")
        return
    await note.delete()
    # Telegram 4096 belgidan oshmasligi uchun bo'laklab yuboramiz (HTML'siz)
    for chunk in _split_chunks(report):
        await message.answer(chunk, parse_mode=None)


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
        msg = str(e)
        logging.warning(f"DownloadError: {msg}")
        low = msg.lower()
        tech = html.escape(msg.strip().replace("\n", " ")[:600])
        if "sign in to confirm" in low or "not a bot" in low or "cookies" in low:
            # YouTube anti-bot bloki — bu video uchun LOGIN (cookies) kerak
            await status_msg.edit_text(
                "🤖 <b>Bu video uchun YouTube login (cookies) talab qilyapti.</b>\n\n"
                "PO Token o'rnatilgan, lekin shu video datacenter IP'dan faqat "
                "cookies bilan ochiladi.\n\n"
                "✅ <b>Yechim:</b> Render env'iga <code>YT_COOKIES_CONTENT</code> qo'shing "
                "(DEPLOY_RENDER.md → cookies bo'limi).\n"
                "Tekshirish: <code>/diag " + html.escape(url if url.startswith("http") else "") + "</code>\n\n"
                f"🔧 <b>Texnik xato:</b>\n<code>{tech}</code>"
            )
        else:
            await status_msg.edit_text(
                "❌ <b>Yuklashda xatolik.</b>\n"
                "Sabablari: link noto'g'ri, video o'chirilgan yoki cheklangan.\n"
                "Tekshirish uchun <b>/diag</b> yuboring.\n\n"
                f"🔧 <b>Texnik xato:</b>\n<code>{tech}</code>"
            )
    except Exception as e:
        logging.exception("Kutilmagan xato")
        tech = html.escape(str(e)[:600])
        await status_msg.edit_text(f"❌ Xatolik yuz berdi:\n<code>{tech}</code>")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _is_bot_block(err: Exception) -> bool:
    """Xato YouTube anti-bot / login bloki ekanini aniqlaydi."""
    return is_bot_block(str(err))


def _build_opts(quality: str, tmpdir: str, client: str | None, use_cookies: bool = True):
    """Berilgan player_client uchun yt-dlp sozlamalarini quradi.

    use_cookies=False bo'lsa, cookies ishlatilmaydi (odatiy videolar uchun
    ko'pincha cookies'SIZ ko'proq format mavjud bo'ladi).
    """
    youtube_args: dict = {}
    if client:
        youtube_args["player_client"] = [client]
    # PO-token yetishmagan formatlarni ham qamrab olamiz — bu "Requested format
    # is not available" xatosini ko'p holatda davolaydi.
    youtube_args["formats"] = ["missing_pot"]

    extractor_args: dict = {"youtube": youtube_args}
    # PO Token provider (bgutil) HTTP serverining manzili — plagin shu yerdan
    # token oladi. Default 127.0.0.1:4416 (bot bilan bir konteynerda ishlaydi).
    extractor_args["youtubepot-bgutilhttp"] = {"base_url": [POT_PROVIDER_URL]}

    opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(tmpdir, "%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "writethumbnail": True,
        "retries": 3,
        "fragment_retries": 3,
        "http_headers": {"User-Agent": USER_AGENT},
        "extractor_args": extractor_args,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": quality,
            },
            {"key": "FFmpegMetadata"},
            {"key": "EmbedThumbnail"},
        ],
    }
    cookie_path = _RESOLVED_COOKIES
    if use_cookies and cookie_path and os.path.exists(cookie_path):
        opts["cookiefile"] = cookie_path
    if PROXY_URL:
        opts["proxy"] = PROXY_URL
    return opts


def _download_blocking(url: str, quality: str, tmpdir: str):
    """yt-dlp bilan eng yaxshi audioni yuklab, MP3 ga aylantiradi (bloklovchi).

    Bir nechta player_client bo'yicha ketma-ket urinadi: biri YouTube anti-bot
    blokiga tushsa, keyingisiga o'tadi. PO Token provider ishlab tursa, "web"/
    "mweb"/"tv" klientlar ham muvaffaqiyatli ishlaydi.
    """
    last_err: Exception | None = None
    cookies_available = bool(_RESOLVED_COOKIES and os.path.exists(_RESOLVED_COOKIES))
    # Urinish rejasi: AVVAL cookies'SIZ (odatiy videolar uchun ko'proq format
    # mavjud), KEYIN cookies BILAN (login/yosh cheklovi bo'lgan videolar uchun).
    cookie_modes = [False, True] if cookies_available else [False]

    for use_cookies in cookie_modes:
        tag = "cookies bilan" if use_cookies else "cookies'siz"
        for client in _client_order():
            # Har urinishda papkani tozalab, chala fayllar qolmasin
            for f in Path(tmpdir).glob("*"):
                try:
                    f.unlink()
                except OSError:
                    pass

            opts = _build_opts(quality, tmpdir, client, use_cookies=use_cookies)
            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    if "entries" in info:
                        info = info["entries"][0]
                    vid = info.get("id", "")
                    mp3 = os.path.join(tmpdir, f"{vid}.mp3")
                    if not os.path.exists(mp3):
                        mp3_files = list(Path(tmpdir).glob("*.mp3"))
                        mp3 = str(mp3_files[0]) if mp3_files else ""
                    if mp3:
                        logging.info(
                            f"Yuklash muvaffaqiyatli (client={client or 'default'}, {tag})."
                        )
                        return info, mp3
            except yt_dlp.utils.DownloadError as e:
                last_err = e
                logging.warning(
                    f"client={client or 'default'} ({tag}) ishlamadi, keyingisi: {e}"
                )
                continue
            except Exception as e:  # noqa: BLE001
                last_err = e
                logging.warning(f"client={client or 'default'} ({tag}) xatosi: {e}")
                continue

    # Hamma kombinatsiya ham ishlamadi
    if last_err:
        raise last_err
    raise RuntimeError("Yuklab bo'lmadi (noma'lum sabab).")


def _safe_name(name: str) -> str:
    """Fayl nomini xavfsiz qiladi (diag_utils.safe_name)."""
    return safe_name(name)


# =====================================================================
# DIAGNOSTIKA — /diag buyrug'i har bir bosqichni sinab, qaysi birida
# xato borligini aniq ko'rsatadi. Natija foydalanuvchiga yuboriladi.
# Toza tekshiruvlar diag_utils'dan olinadi (mustaqil test qilinadi).
# =====================================================================
_check_cmd = check_cmd
_check_pot_plugin = check_pot_plugin
_split_chunks = split_chunks


def _check_pot_server() -> str:
    """PO Token serverini joriy POT_PROVIDER_URL bilan tekshiradi."""
    return check_pot_server(POT_PROVIDER_URL)


def _diag_extract(client: str | None, url: str, use_cookies: bool = True) -> tuple[bool, str]:
    """Bitta player_client bilan FAQAT ma'lumot oladi (yuklamaydi)."""
    youtube_args: dict = {"formats": ["missing_pot"]}
    if client:
        youtube_args["player_client"] = [client]
    extractor_args: dict = {
        "youtube": youtube_args,
        "youtubepot-bgutilhttp": {"base_url": [POT_PROVIDER_URL]},
    }

    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 30,
        # Haqiqiy yuklashdagi kabi audio formatni so'raymiz — shunda diagnostika
        # qaysi client haqiqatan audio bera olishini aniq ko'rsatadi.
        "format": "bestaudio/best",
        "http_headers": {"User-Agent": USER_AGENT},
        "extractor_args": extractor_args,
    }
    cookie_path = _RESOLVED_COOKIES
    if use_cookies and cookie_path and os.path.exists(cookie_path):
        opts["cookiefile"] = cookie_path
    if PROXY_URL:
        opts["proxy"] = PROXY_URL

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if "entries" in info:
                info = (info.get("entries") or [{}])[0] or {}
            title = info.get("title", "?")
            return True, f"OK — «{title[:45]}»"
    except Exception as e:  # noqa: BLE001
        first = str(e).strip().replace("\n", " ")
        return False, first[:160]


def _run_diagnostics_blocking(test_url: str = DIAG_TEST_URL) -> str:
    """Barcha tekshiruvlarni bajaradi va matnli hisobot qaytaradi."""
    lines: list[str] = []
    lines.append("🩺 MUSIC BOT DIAGNOSTIKA")
    lines.append("=" * 32)

    # 1) Muhit
    lines.append(f"Python: {platform.python_version()}")
    try:
        lines.append(f"yt-dlp: {yt_dlp.version.__version__}")
    except Exception as e:  # noqa: BLE001
        lines.append(f"yt-dlp versiya: ? ({e})")
    lines.append(_check_cmd("ffmpeg", ["ffmpeg", "-version"]))
    lines.append(_check_cmd("node", ["node", "--version"]))
    lines.append(_check_pot_plugin())
    lines.append(_check_pot_server())
    if _RESOLVED_COOKIES and os.path.exists(_RESOLVED_COOKIES):
        lines.append(f"✅ Cookies: BOR ({_RESOLVED_COOKIES})")
    else:
        lines.append("➖ Cookies: yo'q (ba'zi videolar uchun KERAK bo'lishi mumkin)")
    if PROXY_URL:
        # Maxfiylik uchun proxy parolini ko'rsatmaymiz
        safe = re.sub(r"//[^@]+@", "//***@", PROXY_URL)
        lines.append(f"✅ Proxy: BOR ({safe})")
    else:
        lines.append("➖ Proxy: yo'q (datacenter IP'da bloklov ehtimoli yuqori)")

    # 2) Har bir player_client bo'yicha sinov (cookies'SIZ va cookies BILAN)
    lines.append("-" * 32)
    lines.append(f"Sinov videosi: {test_url}")
    have_cookies = bool(_RESOLVED_COOKIES and os.path.exists(_RESOLVED_COOKIES))
    lines.append("Client sinovi (audio format):")
    any_ok = False
    bot_block = False
    for client in PLAYER_CLIENTS:
        name = client or "default"
        # Avval cookies'SIZ
        ok, detail = _diag_extract(client, test_url, use_cookies=False)
        if ok:
            any_ok = True
            lines.append(f"  ✅ {name} (cookies'siz): {detail}")
            continue
        if is_bot_block(detail):
            bot_block = True
        # cookies bo'lsa — cookies BILAN ham sinaymiz
        if have_cookies:
            ok2, detail2 = _diag_extract(client, test_url, use_cookies=True)
            if ok2:
                any_ok = True
                lines.append(f"  ✅ {name} (cookies bilan): {detail2}")
                continue
            lines.append(f"  ❌ {name}: cookies'siz→{detail[:60]} | cookies→{detail2[:60]}")
        else:
            lines.append(f"  ❌ {name}: {detail}")

    # 3) Xulosa
    lines.append("=" * 32)
    if any_ok:
        lines.append("XULOSA ✅ Kamida bitta kombinatsiya ishladi — yuklash imkoni bor.")
    elif bot_block:
        lines.append("XULOSA 🤖 YouTube LOGIN (cookies) talab qilyapti.")
        lines.append("Render env'iga YT_COOKIES_CONTENT qo'shing (DEPLOY_RENDER.md).")
    else:
        lines.append("XULOSA ❌ Hamma kombinatsiya 'format yo'q' berdi.")
        lines.append("Sabab: Render datacenter IP + YouTube SABR cheklovi.")
        lines.append("Eng ishonchli yechim: botni UY IP'sida ishlatish yoki")
        lines.append("residential PROXY_URL qo'shish (README → blokni hal qilish).")
    return "\n".join(lines)


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
    setup_cookies()  # cookies manbasini aniqlaymiz (env yoki fayl)
    # PO Token serverini startda bir marta tekshiramiz (logga yozamiz)
    logging.info(_check_pot_server())
    if PROXY_URL:
        logging.info("Proxy yoqilgan (YouTube so'rovlari proxy orqali ketadi).")
    await start_health_server()
    asyncio.create_task(keep_awake())
    # Buyruqlar menyusi
    try:
        await bot.set_my_commands([
            BotCommand(command="start", description="Boshlash"),
            BotCommand(command="help", description="Yordam"),
            BotCommand(command="diag", description="Diagnostika (muammoni aniqlash)"),
        ])
    except Exception as e:  # noqa: BLE001
        logging.warning(f"set_my_commands xatosi: {e}")
    # 409 Conflict oldini olish uchun webhookni tozalaymiz
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot, drop_pending_updates=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Bot to'xtatildi.")
