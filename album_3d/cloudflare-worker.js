// =============================================================
//  📖 ALBUM — Cloudflare Worker (rasm PROXY + albom ro'yxati)
//  Firebase KERAK EMAS — hamma narsa shu Worker + Cloudflare KV'da.
//
//  Endpointlar:
//    GET  /list                 -> albom rasmlari ro'yxati (JSON)
//    GET  /media?id=<file_id>    -> rasmni token'siz uzatadi
//    POST /add?token=<SECRET>    -> {id} rasm qo'shadi (bot ishlatadi)
//    POST /clear?token=<SECRET>  -> albomni tozalaydi (bot ishlatadi)
//
//  Bindings (Worker > Settings):
//    KV Namespace binding:  ALBUM_KV
//  Secrets (Worker > Settings > Variables and Secrets):
//    BOT_TOKEN      — album botining tokeni (@BotFather)
//    WORKER_SECRET  — o'zingiz o'ylab topgan maxfiy parol (bot yozishi uchun)
// =============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const KEY = "album_pages";

function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function guessMime(p) {
  const ext = (p.split(".").pop() || "").toLowerCase();
  const map = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", gif: "image/gif", heic: "image/heic",
  };
  return map[ext] || "image/jpeg";
}

async function getList(env) {
  if (!env.ALBUM_KV) return [];
  try {
    const raw = await env.ALBUM_KV.get(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
async function putList(env, list) {
  if (!env.ALBUM_KV) throw new Error("ALBUM_KV binding yo'q");
  await env.ALBUM_KV.put(KEY, JSON.stringify(list));
}
function authOk(url, env) {
  return env.WORKER_SECRET && url.searchParams.get("token") === env.WORKER_SECRET;
}

async function handleMedia(request, env) {
  if (!env.BOT_TOKEN) {
    return new Response("BOT_TOKEN sozlanmagan", { status: 500, headers: CORS });
  }
  const fileId = new URL(request.url).searchParams.get("id");
  if (!fileId) {
    return new Response("file_id yo'q (?id=...)", { status: 400, headers: CORS });
  }
  try {
    const gfRes = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
    );
    const gf = await gfRes.json();
    if (!gf || !gf.ok || !gf.result || !gf.result.file_path) {
      return new Response("Rasm topilmadi", { status: 404, headers: CORS });
    }
    const filePath = gf.result.file_path;
    const upstream = await fetch(
      `https://api.telegram.org/file/bot${env.BOT_TOKEN}/${filePath}`
    );
    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "public, max-age=86400");
    const ct = upstream.headers.get("Content-Type");
    headers.set("Content-Type", ct && ct !== "application/octet-stream" ? ct : guessMime(filePath));
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    return new Response("Xato: " + String(e), { status: 500, headers: CORS });
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    const url = new URL(request.url);
    const path = url.pathname;

    // Rasmni uzatish
    if (path === "/media" || path === "/file") {
      return handleMedia(request, env);
    }

    // Albom ro'yxati (Mini App shuni o'qiydi)
    if (path === "/list") {
      const list = await getList(env);
      return jsonResp(list);
    }

    // Rasm qo'shish (bot POST qiladi)
    if (path === "/add") {
      if (request.method !== "POST") return jsonResp({ ok: false, error: "POST kerak" }, 405);
      if (!authOk(url, env)) return jsonResp({ ok: false, error: "token xato" }, 403);
      let body = {};
      try { body = await request.json(); } catch (e) {}
      const id = body && body.id;
      if (!id) return jsonResp({ ok: false, error: "id yo'q" }, 400);
      const list = await getList(env);
      list.push({ id: String(id), ts: Date.now() });
      await putList(env, list);
      return jsonResp({ ok: true, count: list.length });
    }

    // Albomni tozalash (bot POST qiladi)
    if (path === "/clear") {
      if (request.method !== "POST") return jsonResp({ ok: false, error: "POST kerak" }, 405);
      if (!authOk(url, env)) return jsonResp({ ok: false, error: "token xato" }, 403);
      await putList(env, []);
      return jsonResp({ ok: true });
    }

    return new Response(
      "Album worker \u2705  ( GET /list \u00b7 GET /media?id= \u00b7 POST /add \u00b7 POST /clear )",
      { status: 200, headers: CORS }
    );
  },
};
