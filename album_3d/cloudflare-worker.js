// =============================================================
//  📖 ALBUM — Cloudflare Worker (rasm PROXY)
//  Vazifasi: Telegram file_id ni token'SIZ rasmga aylantiradi.
//  Mini App: <WORKER_URL>/media?id=<file_id>  ->  rasm.
//  BOT_TOKEN faqat shu Worker'da (Settings > Variables) qoladi,
//  hech qayerga (Firebase/saytga) sirqib chiqmaydi.
//
//  Secret (Worker > Settings > Variables):
//     BOT_TOKEN   — album botining tokeni (@BotFather)
// =============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
};

function guessMime(p) {
  const ext = (p.split(".").pop() || "").toLowerCase();
  const map = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", gif: "image/gif", heic: "image/heic",
  };
  return map[ext] || "image/jpeg";
}

async function handleMedia(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Faqat GET", { status: 405, headers: CORS });
  }
  if (!env.BOT_TOKEN) {
    return new Response("BOT_TOKEN sozlanmagan", { status: 500, headers: CORS });
  }
  const fileId = new URL(request.url).searchParams.get("id");
  if (!fileId) {
    return new Response("file_id yo'q (?id=...)", { status: 400, headers: CORS });
  }
  try {
    // file_id -> file_path (har safar yangilanadi => link eskirmaydi)
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
    const path = new URL(request.url).pathname;
    if (path === "/media" || path === "/file") {
      return handleMedia(request, env);
    }
    return new Response("Album media worker ✅  ( /media?id=<file_id> )", {
      status: 200, headers: CORS,
    });
  },
};
