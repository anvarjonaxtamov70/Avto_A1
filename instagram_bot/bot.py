# =====================================================================
#  📸 Instagram Downloader Bot
#  Instagram Reels / Post / video linkini YUQORI SIFATDA yuklab beradi.
#  yt-dlp asosida ishlaydi (ffmpeg ixtiyoriy — birlashtirish uchun).
#
#  - Foydalanuvchi Instagram linkini yuboradi -> bot HD videoni beradi
#  - Video caption'siz (toza) yuboriladi
#  - 90s timeout + progress indikator (hech qachon qotib qolmaydi)
#  - Cookies qo'llab-quvvatlash (login talab qiladigan videolar uchun)
#
#  Render.com bepul tarifda 24/7 ishlashi uchun health-server va
#  self-ping (o'zini uyg'oq tutuvchi) mexanizm bor.
# =====================================================================
import os
import re
import html
import asyncio
import logging
import subprocess
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
    BotCommand,
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
log = logging.getLogger("instagram-bot")

BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise SystemExit("BOT_TOKEN topilmadi! .env faylga yoki Render env'ga qo'shing.")

# /admin buyruqlarini faqat shu ID egasi ishlata oladi (ixtiyoriy)
ADMIN_ID = os.getenv("ADMIN_ID", "").strip()

# Instagram cookies (login talab qiladigan videolar uchun)
IG_COOKIES_FILE = os.getenv("IG_COOKIES_FILE", "cookies.txt")
IG_COOKIES_CONTENT = os.getenv("IG_COOKIES_CONTENT", "")
_RESOLVED_COOKIES: str | None = None

# (Ixtiyoriy) Proxy — Instagram bulut IP'larni bloklaydi
PROXY_URL = (
    os.getenv("PROXY_URL")
    or os.getenv("HTTPS_PROXY")
    or os.getenv("HTTP_PROXY")
    or ""
).strip()

# Realistik User-Agent (Instagram bot-deteksiyasini kamaytirish)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# Telegram fayl chegarasi ~50 MB
MAX_TG_SIZE = 49 * 1024 * 1024

# Yuklash + qayta kodlash uchun umumiy timeout (soniya)
DOWNLOAD_TIMEOUT = int(os.getenv("DOWNLOAD_TIMEOUT", "180"))

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# Instagram link tanish uchun regex (reel / p / tv / stories)
INSTAGRAM_RE = re.compile(
    r"(https?://)?(www\.)?(instagram\.com|instagr\.am)/(reel|reels|p|tv|stories)/[\w\-./?=&%]+",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------
# Matnlar
# ---------------------------------------------------------------------
WELCOME = (
    "📸 <b>Salom! Men Instagram video yuklovchi botman.</b>\n\n"
    "Menga Instagram <b>Reels</b>, <b>post</b> yoki <b>video</b> linkini yuboring — "
    "men uni <b>mavjud eng yuqori sifatda</b> yuklab beraman "
    "(agar video 4K/2K bo'lsa — o'shani, aks holda Full HD 1080p).\n\n"
    "Shunchaki linkni tashlang 👇\n"
    "<i>masalan: https://www.instagram.com/reel/xxxxx/</i>\n\n"
    "⚠️ <i>Diqqat: mualliflik huquqi himoyalangan kontentni faqat shaxsiy "
    "maqsadda yuklab oling.</i>"
)

HELP = (
    "ℹ️ <b>Qanday ishlataman:</b>\n\n"
    "1️⃣ Instagram Reels / post / video linkini yuboring.\n"
    "2️⃣ Bot avtomatik yuqori sifatda yuklab beradi.\n\n"
    "Buyruqlar:\n"
    "/start — boshlash\n"
    "/help — yordam\n\n"
    "💡 Ba'zi videolar (login talab qiladiganlari) uchun cookies kerak bo'lishi mumkin."
)


def setup_cookies() -> str | None:
    """Cookies manbasini aniqlaydi va yt-dlp uchun fayl yo'lini qaytaradi."""
    global _RESOLVED_COOKIES

    # 1) Env orqali berilgan cookies matnini faylga yozamiz
    if IG_COOKIES_CONTENT.strip():
        target = os.path.join(tempfile.gettempdir(), "ig_cookies.txt")
        try:
            with open(target, "w", encoding="utf-8") as f:
                content = IG_COOKIES_CONTENT
                if not content.startswith("# Netscape"):
                    content = "# Netscape HTTP Cookie File\n" + content
                f.write(content)
            _RESOLVED_COOKIES = target
            log.info("Cookies IG_COOKIES_CONTENT env'idan yuklandi ✅")
            return target
        except Exception as e:
            log.error(f"Cookies env'ini yozishda xato: {e}")

    # 2) & 3) Mavjud cookies fayllarini qidiramiz
    for path in (IG_COOKIES_FILE, "/etc/secrets/cookies.txt"):
        if path and os.path.exists(path):
            _RESOLVED_COOKIES = path
            log.info(f"Cookies fayldan topildi: {path} ✅")
            return path

    log.warning(
        "Cookies topilmadi. Instagram ba'zan login talab qilishi mumkin. "
        "IG_COOKIES_CONTENT env'ini qo'shing (DEPLOY_RENDER.md)."
    )
    return None


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

    match = INSTAGRAM_RE.search(text)
    if not match:
        await message.answer(
            "🔗 Iltimos, to'g'ri <b>Instagram</b> linkini yuboring.\n"
            "<i>masalan: https://www.instagram.com/reel/xxxxx/</i>"
        )
        return

    url = match.group(0)
    if not url.startswith("http"):
        url = "https://" + url

    status_msg = await message.answer("⏬ Yuklanmoqda, biroz kuting…")
    ok = await download_and_send(status_msg, url)

    # Music bot kabi TOZALASH: video muvaffaqiyatli yuborilgach, chatда faqat
    # toza video qolishi uchun ortiqcha xabarlarni o'chiramiz:
    #   - foydalanuvchi yuborgan link xabari (message)
    #   - "Yuklanmoqda..." status xabari (status_msg) allaqachon
    #     download_and_send ichida muvaffaqiyatда o'chiriladi.
    if ok:
        try:
            await message.delete()
        except Exception as e:
            log.warning(f"Foydalanuvchi xabarini o'chirib bo'lmadi: {e}")


# ---------------------------------------------------------------------
# Yuklab olish va yuborish
# ---------------------------------------------------------------------
async def download_and_send(status_msg: Message, url: str) -> bool:
    """Instagram videoni yuklab, yuboradi. Muvaffaqiyatda True qaytaradi."""
    chat_id = status_msg.chat.id
    tmpdir = tempfile.mkdtemp(prefix="ig_")
    try:
        await bot.send_chat_action(chat_id, ChatAction.UPLOAD_VIDEO)

        # Bloklovchi yt-dlp ishini alohida threadda bajaramiz.
        # 90s umumiy timeout — agar yt-dlp osilib qolsa, bekor qilinadi.
        download_task = asyncio.ensure_future(
            asyncio.to_thread(_download_blocking, url, tmpdir)
        )

        # Progress indikator — har 10s xabar yangilanadi
        progress_dots = [
            "⏬ Yuklanmoqda",
            "⏬ Yuklanmoqda.",
            "⏬ Yuklanmoqda..",
            "⏬ Yuklanmoqda...",
        ]
        elapsed = 0
        while not download_task.done():
            try:
                await asyncio.wait_for(asyncio.shield(download_task), timeout=10)
            except asyncio.TimeoutError:
                elapsed += 10
                if elapsed >= DOWNLOAD_TIMEOUT:
                    download_task.cancel()
                    await status_msg.edit_text(
                        f"⏱ <b>Vaqt tugadi ({DOWNLOAD_TIMEOUT}s).</b>\n\n"
                        "Instagram javob bermayapti yoki video juda katta.\n"
                        "💡 Boshqa link bilan urinib ko'ring yoki keyinroq qaytadan yuboring."
                    )
                    return False
                dot_idx = (elapsed // 10) % len(progress_dots)
                try:
                    await status_msg.edit_text(f"{progress_dots[dot_idx]} ({elapsed}s)")
                except Exception:
                    pass
                try:
                    await bot.send_chat_action(chat_id, ChatAction.UPLOAD_VIDEO)
                except Exception:
                    pass

        try:
            info, filepath = download_task.result()
        except asyncio.CancelledError:
            await status_msg.edit_text(
                "⏱ <b>Yuklash bekor qilindi.</b>\nQaytadan urinib ko'ring."
            )
            return False

        if not filepath or not os.path.exists(filepath):
            await status_msg.edit_text(
                "❌ Videoni yuklab bo'lmadi. Link to'g'riligini tekshiring."
            )
            return False

        size = os.path.getsize(filepath)

        title = (info.get("title") or info.get("description") or "video")[:60]
        duration = int(info.get("duration") or 0)
        width = info.get("width") or None
        height = info.get("height") or None
        res_label = f"{height}p" if height else "eng yuqori"

        await status_msg.edit_text(f"📤 Yuborilmoqda... ({res_label})")
        await bot.send_chat_action(chat_id, ChatAction.UPLOAD_VIDEO)

        fname = f"{_safe_name(title)}.mp4"

        # Telegram bot chegarasi ~50MB. Katta bo'lsa — video sifatida yubora
        # olmaymiz. Bunday holda DOCUMENT sifatida yuboramiz (sifat YO'QOLMAYDI,
        # foydalanuvchi to'liq 4K/HD faylni oladi, faqat player'da emas).
        if size > MAX_TG_SIZE:
            log.info(f"Fayl {size/1024/1024:.1f}MB > 50MB — document sifatida yuboriladi.")
            document = FSInputFile(filepath, filename=fname)
            await bot.send_document(
                chat_id,
                document=document,
                disable_content_type_detection=True,
            )
        else:
            video = FSInputFile(filepath, filename=fname)
            # Caption'siz (toza video) yuboriladi
            await bot.send_video(
                chat_id,
                video=video,
                duration=duration or None,
                width=width,
                height=height,
                supports_streaming=True,
            )
        await status_msg.delete()
        return True

    except yt_dlp.utils.DownloadError as e:
        msg = str(e)
        log.warning(f"DownloadError: {msg}")
        low = msg.lower()
        tech = html.escape(msg.strip().replace("\n", " ")[:500])
        if "login" in low or "sign in" in low or "cookies" in low or "empty" in low:
            await status_msg.edit_text(
                "🔒 <b>Bu video login (cookies) talab qilyapti.</b>\n\n"
                "Bu video shaxsiy akkauntda yoki cheklangan bo'lishi mumkin.\n"
                "✅ <b>Yechim:</b> Render env'iga <code>IG_COOKIES_CONTENT</code> qo'shing.\n\n"
                f"🔧 <b>Texnik xato:</b>\n<code>{tech}</code>"
            )
        elif "rate" in low or "429" in low or "too many" in low:
            await status_msg.edit_text(
                "⏳ <b>Instagram vaqtincha bloklayapti (rate limit).</b>\n\n"
                "Ko'p so'rov yuborildi. Iltimos, 15-30 daqiqadan keyin qaytadan urinib ko'ring.\n\n"
                f"🔧 <b>Texnik xato:</b>\n<code>{tech}</code>"
            )
        else:
            await status_msg.edit_text(
                "❌ <b>Yuklashda xatolik.</b>\n"
                "Sabablari: link noto'g'ri, post o'chirilgan yoki shaxsiy.\n\n"
                f"🔧 <b>Texnik xato:</b>\n<code>{tech}</code>"
            )
    except Exception as e:
        log.exception("Kutilmagan xato")
        tech = html.escape(str(e)[:500])
        await status_msg.edit_text(f"❌ Xatolik yuz berdi:\n<code>{tech}</code>")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
    return False


def _build_opts(tmpdir: str) -> dict:
    """yt-dlp sozlamalarini quradi — MAVJUD ENG YUQORI sifatli video.

    Format tanlash: iPhone (iOS) FAQAT H.264 (avc1) kodekni to'liq
    qo'llab-quvvatlaydi. Shuning uchun avval H.264'ni tanlaymiz (eng yuqori
    sifatda), keyingina zaxira variantlarga o'tamiz. Bu "video qimirlamaydi,
    faqat ovoz" muammosini hal qiladi (VP9/AV1 kodek iPhone'da ishlamaydi).
    """
    opts = {
        # 1) Eng yuqori H.264 (avc1) video + AAC audio — iPhone'da 100% ishlaydi
        # 2) Zaxira: har qanday mp4
        # 3) Oxirgi zaxira: umuman eng yaxshisi (kodek muhim bo'lmaganda)
        "format": (
            "bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/"
            "bestvideo[ext=mp4]+bestaudio[ext=m4a]/"
            "best[ext=mp4]/best"
        ),
        # H.264 birinchi o'rinda, keyin eng katta o'lcham/fps — iPhone mosligi
        # sifatdan ustun (baribir Instagram odatda 1080p H.264 beradi).
        "format_sort": ["vcodec:h264", "res", "fps", "br"],
        "outtmpl": os.path.join(tmpdir, "%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        # Tezlik: kam retry, tez timeout, ko'p parallel
        "retries": 1,
        "fragment_retries": 1,
        "socket_timeout": 20,
        "concurrent_fragment_downloads": 8,
        "merge_output_format": "mp4",
        # faststart: moov atom faylning boshiga ko'chiriladi — iOS/Telegram
        # videoni tez va to'g'ri o'qiydi (oqim/streaming uchun)
        "postprocessor_args": {"merger": ["-movflags", "+faststart"]},
        "http_headers": {"User-Agent": USER_AGENT},
    }
    cookie_path = _RESOLVED_COOKIES
    if cookie_path and os.path.exists(cookie_path):
        opts["cookiefile"] = cookie_path
    if PROXY_URL:
        opts["proxy"] = PROXY_URL
    return opts


def _download_blocking(url: str, tmpdir: str):
    """yt-dlp bilan Instagram videoni yuklaydi (bloklovchi funksiya)."""
    opts = _build_opts(tmpdir)
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if "entries" in info:
            # Playlist/karusel bo'lsa — birinchi elementni olamiz
            entries = info.get("entries") or []
            info = entries[0] if entries else info

        vid = info.get("id", "")
        # Yuklangan faylni topamiz (mp4 afzal)
        candidates = list(Path(tmpdir).glob(f"{vid}.*")) or list(Path(tmpdir).glob("*"))
        # mp4 ni birinchi qo'yamiz
        candidates.sort(key=lambda p: 0 if p.suffix == ".mp4" else 1)
        filepath = str(candidates[0]) if candidates else ""

        # iPhone (iOS) 100% mosligi uchun qayta kodlaymiz (H.264 8-bit yuv420p).
        # Bu "video qimirlamaydi, faqat ovoz" muammosini butunlay hal qiladi —
        # manba 10-bit/HDR/VP9/AV1 bo'lsa ham.
        if filepath:
            filepath = _reencode_ios(filepath, tmpdir)
        return info, filepath


def _video_meta(path: str) -> tuple[str, str]:
    """ffprobe bilan video kodek va pixel formatini qaytaradi (codec, pix_fmt).
    ffprobe yo'q yoki xato bo'lsa ('', '') qaytaradi."""
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return "", ""
    try:
        out = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=codec_name,pix_fmt",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=20,
        ).stdout.lower().split()
        codec = out[0] if len(out) > 0 else ""
        pix_fmt = out[1] if len(out) > 1 else ""
        return codec, pix_fmt
    except Exception as e:  # noqa: BLE001
        logging.warning(f"ffprobe xatosi: {e}")
        return "", ""


def _reencode_ios(src_path: str, tmpdir: str) -> str:
    """Videoni iPhone (iOS/Telegram) 100% o'qiydigan formatga qayta kodlaydi.

    - Video: H.264 (libx264), High profile, 8-bit yuv420p
    - Audio: AAC 128k
    - +faststart (moov atom boshda — tez oqim)
    - Sifat: CRF 20 (yuqori sifat, ko'zga bilinmas kamayish)

    ffmpeg yo'q bo'lsa yoki xato bo'lsa — asl faylni qaytaradi (buzilmaydi).
    """
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        logging.warning("ffmpeg topilmadi — qayta kodlash o'tkazib yuborildi.")
        return src_path

    base = os.path.splitext(os.path.basename(src_path))[0]
    out_path = os.path.join(tmpdir, f"{base}_ios.mp4")
    # Asl fayl bilan to'qnashmasin
    if os.path.abspath(out_path) == os.path.abspath(src_path):
        out_path = os.path.join(tmpdir, f"{base}_ios2.mp4")

    # TEZLIK: video allaqachon H.264 8-bit yuv420p bo'lsa — qayta KODLAMAYMIZ,
    # faqat tez faststart remux (stream copy, deyarli bir zumda, CPU deyarli yo'q).
    # Faqat mos bo'lmagan (VP9/AV1/10-bit/HDR) videolar to'liq re-encode qilinadi.
    codec, pix_fmt = _video_meta(src_path)
    already_ok = ("h264" in codec) and pix_fmt.startswith("yuv420p") and ("10" not in pix_fmt)
    if already_ok:
        cmd = [ffmpeg, "-y", "-i", src_path, "-c", "copy",
               "-movflags", "+faststart", out_path]
        tag, timeout = "tez remux (qayta kodlashsiz)", 60
    else:
        cmd = [
            ffmpeg, "-y", "-i", src_path,
            "-c:v", "libx264", "-profile:v", "high", "-level", "4.1",
            "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "veryfast",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            out_path,
        ]
        tag, timeout = f"to'liq re-encode ({codec or '?'}/{pix_fmt or '?'})", 150
    try:
        subprocess.run(
            cmd, check=True,
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            timeout=timeout,
        )
        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            logging.info(f"iOS mosligi: {tag} ✅")
            return out_path
    except subprocess.TimeoutExpired:
        logging.warning("Qayta kodlash vaqt tugadi — asl fayl yuboriladi.")
    except subprocess.CalledProcessError as e:
        err = (e.stderr or b"").decode("utf-8", "ignore")[:300]
        logging.warning(f"Qayta kodlash xatosi: {err}")
    except Exception as e:  # noqa: BLE001
        logging.warning(f"Qayta kodlash kutilmagan xato: {e}")
    return src_path


def _safe_name(name: str) -> str:
    """Fayl nomini xavfsiz qiladi."""
    name = re.sub(r"[^\w\s.-]", "", name or "video").strip()
    name = re.sub(r"\s+", "_", name)
    return (name or "video")[:60]


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
        log.error(f"Health server uchun aiohttp.web yuklanmadi: {e}")
        return

    async def _ok(_request):
        return web.Response(text="Instagram bot ishlayapti ✅")

    app = web.Application()
    app.router.add_get("/", _ok)
    app.router.add_get("/health", _ok)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", int(port))
    await site.start()
    log.info(f"Health server {port}-portda ishga tushdi.")


# =====================================================================
# SELF-PING — Render bepul tarifda uxlab qolmaslik uchun (har 5 daqiqa)
# =====================================================================
async def keep_awake():
    import aiohttp

    base = os.getenv("KEEP_ALIVE_URL") or os.getenv("RENDER_EXTERNAL_URL")
    if not base:
        return
    ping_url = base.rstrip("/") + "/health"
    # 240s (4 min) — Render 15 min da uxlaydi. Tezroq ping = kamroq uxlash.
    interval = int(os.getenv("KEEP_ALIVE_INTERVAL", "240"))
    await asyncio.sleep(10)
    log.info(f"Self-ping yoqildi: {ping_url} (har {interval}s).")
    while True:
        try:
            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=15)
            ) as session:
                while True:
                    try:
                        async with session.get(ping_url) as r:
                            log.info(f"Self-ping: {r.status}")
                    except Exception as e:
                        log.warning(f"Self-ping xatosi: {e}")
                    await asyncio.sleep(interval)
        except Exception as e:
            log.warning(f"Self-ping session xatosi, qayta uriniladi: {e}")
            await asyncio.sleep(10)


# =====================================================================
# ISHGA TUSHIRISH
# =====================================================================
async def main():
    log.info("📸 Instagram bot ishga tushdi!")
    setup_cookies()
    if PROXY_URL:
        log.info("Proxy yoqilgan (Instagram so'rovlari proxy orqali ketadi).")
    await start_health_server()
    asyncio.create_task(keep_awake())
    try:
        await bot.set_my_commands([
            BotCommand(command="start", description="Boshlash"),
            BotCommand(command="help", description="Yordam"),
        ])
    except Exception as e:
        log.warning(f"set_my_commands xatosi: {e}")
    # 409 Conflict oldini olish uchun webhookni tozalaymiz
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot, drop_pending_updates=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Bot to'xtatildi.")
