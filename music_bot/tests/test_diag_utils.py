# =====================================================================
#  diag_utils uchun testlar (pytest).
#  Ishga tushirish:  cd music_bot && pytest -v
#  Bu testlar tashqi kutubxonalarsiz (faqat stdlib) ishlaydi.
# =====================================================================
import sys
import socket
import os

# music_bot papkasini import yo'liga qo'shamiz
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from diag_utils import (  # noqa: E402
    safe_name,
    is_bot_block,
    split_chunks,
    check_cmd,
    check_pot_plugin,
    check_ejs,
    check_pot_server,
)


# ---------- safe_name ----------
def test_safe_name_removes_special_chars():
    assert safe_name("Hello/World:*?") == "HelloWorld"


def test_safe_name_empty_defaults_to_audio():
    assert safe_name("") == "audio"
    assert safe_name("///") == "audio"


def test_safe_name_truncates_to_80():
    assert len(safe_name("a" * 200)) == 80


def test_safe_name_keeps_unicode_letters():
    # O'zbekcha harflar saqlanishi kerak
    assert "Sevgi" in safe_name("Sevgi (qo'shiq)")


# ---------- is_bot_block ----------
def test_is_bot_block_detects_signin():
    assert is_bot_block("ERROR: [youtube] Sign in to confirm you're not a bot") is True


def test_is_bot_block_detects_403():
    assert is_bot_block("HTTP Error 403: Forbidden") is True


def test_is_bot_block_false_for_unrelated():
    assert is_bot_block("Video unavailable: deleted by user xyz") is False
    assert is_bot_block("") is False


# ---------- split_chunks ----------
def test_split_chunks_roundtrip():
    text = "x" * 8000
    chunks = list(split_chunks(text, 3500))
    assert len(chunks) == 3
    assert "".join(chunks) == text
    assert all(len(c) <= 3500 for c in chunks)


def test_split_chunks_short_text():
    assert list(split_chunks("salom", 3500)) == ["salom"]


def test_split_chunks_invalid_size():
    import pytest
    with pytest.raises(ValueError):
        list(split_chunks("abc", 0))


# ---------- check_cmd ----------
def test_check_cmd_present():
    res = check_cmd("python", [sys.executable, "--version"])
    assert res.startswith("✅")


def test_check_cmd_missing():
    res = check_cmd("nope", ["this_binary_truly_does_not_exist_42"])
    assert "O'RNATILMAGAN" in res


# ---------- check_pot_server ----------
def test_check_pot_server_down():
    # Bo'sh portni topamiz va darhol yopamiz -> ulanish bo'lmasligi kerak
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    res = check_pot_server(f"http://127.0.0.1:{port}")
    assert "ISHLAMAYAPTI" in res


def test_check_pot_server_up():
    # Vaqtinchalik TCP server ochamiz -> ulanish muvaffaqiyatli bo'lishi kerak
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    port = srv.getsockname()[1]
    try:
        res = check_pot_server(f"http://127.0.0.1:{port}")
        assert "ISHLAYAPTI" in res
    finally:
        srv.close()


# ---------- check_pot_plugin ----------
def test_check_pot_plugin_returns_status():
    res = check_pot_plugin()
    assert "PO Token plagini" in res


# ---------- check_ejs ----------
def test_check_ejs_returns_status():
    res = check_ejs()
    assert "yt-dlp-ejs" in res
