# =====================================================================
#  🧪 diag_utils — botning TOZA (stdlib) yordamchi funksiyalari.
#  Bu yerda aiogram/yt-dlp kabi tashqi kutubxonalar ishlatilmaydi, shuning
#  uchun ularni mustaqil test qilish (pytest) oson. bot.py shu funksiyalardan
#  foydalanadi.
# =====================================================================
import re
import socket
import subprocess
from urllib.parse import urlparse

# YouTube anti-bot / login bloki belgilари
_BOT_BLOCK_NEEDLES = (
    "sign in to confirm",
    "not a bot",
    "confirm you're not a bot",
    "http error 403",
    "this video is unavailable",
    "please sign in",
    "cookies",
)


def safe_name(name: str) -> str:
    """Fayl nomini xavfsiz qiladi (maxsus belgilarsiz, <=80 belgi)."""
    name = re.sub(r"[^\w\s\-\.\(\)]", "", name or "", flags=re.UNICODE).strip()
    return (name or "audio")[:80]


def is_bot_block(text: str) -> bool:
    """Matn YouTube anti-bot / login bloki xatosi ekanini aniqlaydi."""
    low = (text or "").lower()
    return any(n in low for n in _BOT_BLOCK_NEEDLES)


def split_chunks(text: str, size: int = 3500):
    """Uzun matnni Telegram chegarasiga (4096) moslab bo'laklarga ajratadi."""
    if size <= 0:
        raise ValueError("size musbat bo'lishi kerak")
    for i in range(0, len(text), size):
        yield text[i : i + size]


def check_cmd(name: str, cmd: list) -> str:
    """Tashqi dasturning (ffmpeg/node) mavjudligini tekshiradi."""
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        text = (out.stdout or out.stderr or "").strip()
        first = text.splitlines()[0] if text else "(versiya aniqlanmadi)"
        return f"✅ {name}: BOR — {first}"
    except FileNotFoundError:
        return f"❌ {name}: O'RNATILMAGAN (topilmadi)"
    except Exception as e:  # noqa: BLE001
        return f"❌ {name}: xato — {e}"


def check_pot_plugin() -> str:
    """yt-dlp PO Token plagini (pip) o'rnatilganini tekshiradi."""
    try:
        from importlib import metadata
        v = metadata.version("bgutil-ytdlp-pot-provider")
        return f"✅ PO Token plagini (pip): BOR — v{v}"
    except Exception:
        return "❌ PO Token plagini (pip): TOPILMADI (requirements.txt tekshiring)"


def check_pot_server(url: str) -> str:
    """PO Token HTTP serveriga ulanib bo'lishini tekshiradi."""
    try:
        u = urlparse(url)
        host = u.hostname or "127.0.0.1"
        port = u.port or 4416
        with socket.create_connection((host, port), timeout=5):
            return f"✅ PO Token server ({host}:{port}): ISHLAYAPTI"
    except Exception as e:  # noqa: BLE001
        return (
            f"❌ PO Token server ({url}): ISHLAMAYAPTI — {e}\n"
            "   (start.sh / Dockerfile'dagi POT serverni tekshiring)"
        )
