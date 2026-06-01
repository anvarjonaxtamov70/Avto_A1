// =============================================================
//  IVY — Jewelry & Cosmetics — Cloudflare Worker  (paste-safe)
//  ENDPOINTLAR:
//   1) "/webhook" — Telegram BOT webhook: /start ga chiroyli javob,
//                   boshqa matnga AI/iliq javob + "Butikni ochish" tugma.
//                   (Bot 24/7 ishlaydi — kompyuter kerak emas!)
//   2) "/auth"    — Telegram initData HMAC bilan tekshirib,
//                   Firebase CUSTOM TOKEN qaytaradi (uid = Telegram id)
//   3) "/"        — Telegram sendMessage PROXY (Mini App ishlatadi)
//  Secret'lar: BOT_TOKEN, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//              (ixtiyoriy: GROQ_API_KEY, GROQ_MODEL, WEBHOOK_SECRET)
// =============================================================

// Do'kon (Mini App) manzili — GitHub Pages
const MINI_APP_URL = "https://anvarjonaxtamov70.github.io/Avto_A1/ivy_jewelry_cosmetics/";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Ivy Worker ishlayapti. Faqat POST.", { status: 200, headers: cors });
    }

    const path = new URL(request.url).pathname;

    // ---------- 1) TELEGRAM WEBHOOK ----------
    if (path === "/webhook") {
      return handleWebhook(request, env);
    }

    // ---------- 2) FIREBASE AUTH ----------
    if (path === "/auth") {
      try {
        const { initData } = await request.json();
        if (!initData || typeof initData !== "string") {
          return json({ ok: false, error: "initData yoq" }, 400);
        }
        const verified = await verifyTelegramInitData(initData, env.BOT_TOKEN);
        if (!verified.ok) {
          return json({ ok: false, error: verified.error }, 401);
        }
        const uid = String(verified.user.id);
        const token = await createFirebaseCustomToken(uid, env);
        return json({ ok: true, token, uid });
      } catch (e) {
        return json({ ok: false, error: String(e) }, 500);
      }
    }

    // ---------- 3) sendMessage PROXY (Mini App) ----------
    try {
      const body = await request.json();
      const tgRes = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await tgRes.json();
      return json(data, 200);
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500);
    }
  },
};

// =============================================================
//  TELEGRAM BOT (WEBHOOK) — suhbat qatlami
// =============================================================
const AI_SYSTEM =
  "Sen 'Ivy — Jewelry & Cosmetics' nafis go'zallik va zargarlik butigining xushmuomala, " +
  "iliq maslahatchisisan. Kosmetika, parvarish, taqinchoq va soch aksessuarlari bo'yicha " +
  "qisqa, samimiy, ayollarga yoqadigan ohangda javob ber, 1-2 nozik emoji ishlat. " +
  "Aniq mahsulot/narx so'ralsa 'Pastdagi tugma orqali butigimizga kiring' de. " +
  "HECH QACHON ochiq havola yozma. Narxni o'zingdan to'qima.";

function kbWebApp() {
  return { inline_keyboard: [[{ text: "💎 Butikni ochish", web_app: { url: MINI_APP_URL } }]] };
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function greeting(name) {
  const hi = name ? (", <b>" + escapeHtml(name) + "</b>") : "";
  return (
    "Assalomu alaykum" + hi + " va <b>Ivy — Jewelry & Cosmetics</b> butigiga xush kelibsiz! 💄💎\n\n" +
    "Bu yerda premium kosmetika, nozik parvarish vositalari va nafis taqinchoqlar sizni kutmoqda. " +
    "Birinchi xaridingiz uchun maxsus sovg'a ham bor 🎁\n\n" +
    "Pastdagi tugma orqali butigimizga kiring 👇"
  );
}

async function tgSend(env, chatId, text, replyMarkup) {
  const body = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  try {
    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) { /* indamaymiz */ }
}

async function groqReply(env, userText) {
  if (!env.GROQ_API_KEY) return null;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.GROQ_API_KEY },
      body: JSON.stringify({
        model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.6,
        messages: [
          { role: "system", content: AI_SYSTEM },
          { role: "user", content: String(userText).slice(0, 800) },
        ],
      }),
    });
    const d = await r.json();
    if (d && d.choices && d.choices[0] && d.choices[0].message) {
      return d.choices[0].message.content;
    }
  } catch (e) { /* fallback */ }
  return null;
}

async function handleWebhook(request, env) {
  // ixtiyoriy himoya: setWebhook'da secret_token bergan bo'lsangiz
  if (env.WEBHOOK_SECRET) {
    const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (got !== env.WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403, headers: cors });
    }
  }

  let update;
  try { update = await request.json(); } catch (e) { return new Response("ok"); }

  const msg = update && (update.message || update.edited_message);
  if (msg && msg.chat) {
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();
    const first = (msg.from && msg.from.first_name) ? msg.from.first_name : "";

    if (text === "/start" || text.indexOf("/start ") === 0) {
      await tgSend(env, chatId, greeting(first), kbWebApp());
    } else if (text === "/help" || text === "/menu") {
      await tgSend(env, chatId, "💎 Butigimizdan kosmetika, parvarish va taqinchoqlarni tanlang 👇", kbWebApp());
    } else if (text === "/contact") {
      await tgSend(env, chatId, "📞 <b>Ivy bilan aloqa</b>\n🕐 Har kuni 09:00–21:00\n🛡 14 kun kafolat · 100% original 💕", kbWebApp());
    } else if (text) {
      let reply = await groqReply(env, text);
      if (!reply) reply = "Rahmat! 💕 Quyidagi tugma orqali butigimizga kiring 👇";
      await tgSend(env, chatId, reply, kbWebApp());
    } else {
      await tgSend(env, chatId, "💕 Butigimizga marhamat 👇", kbWebApp());
    }
  }

  return new Response("ok", { headers: cors });
}

// =============================================================
//  FIREBASE CUSTOM TOKEN + initData HMAC
// =============================================================
async function verifyTelegramInitData(initData, botToken) {
  if (!botToken) return { ok: false, error: "BOT_TOKEN sozlanmagan" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "hash yoq" };
  params.delete("hash");

  const NL = String.fromCharCode(10);
  const pairs = [];
  for (const [k, v] of params) pairs.push(`${k}=${v}`);
  pairs.sort();
  const dataCheckString = pairs.join(NL);

  const enc = new TextEncoder();
  const secretKey = await hmacSha256(enc.encode("WebAppData"), enc.encode(botToken));
  const computed = await hmacSha256(secretKey, enc.encode(dataCheckString));
  const computedHex = toHex(computed);

  if (computedHex !== hash) return { ok: false, error: "imzo mos kelmadi" };

  const authDate = parseInt(params.get("auth_date") || "0", 10);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > 86400) {
    return { ok: false, error: "initData eskirgan" };
  }

  let user;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    user = null;
  }
  if (!user || !user.id) return { ok: false, error: "user yoq" };

  return { ok: true, user };
}

async function hmacSha256(keyBytes, messageBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, messageBytes);
}

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createFirebaseCustomToken(uid, env) {
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKeyPem = env.FIREBASE_PRIVATE_KEY;
  if (!clientEmail || !privateKeyPem) {
    throw new Error("FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY sozlanmagan");
  }

  const now = Math.floor(Date.now() / 1000);
  const aud =
    "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud,
    iat: now,
    exp: now + 3600,
    uid,
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    enc.encode(signingInput)
  );
  const sigB64 = base64url(new Uint8Array(sig));

  return `${signingInput}.${sigB64}`;
}

async function importPrivateKey(pem) {
  const NL = String.fromCharCode(10);
  const BSL_N = String.fromCharCode(92) + "n";
  let clean = pem.split(BSL_N).join(NL);
  clean = clean.split("-----BEGIN PRIVATE KEY-----").join("");
  clean = clean.split("-----END PRIVATE KEY-----").join("");
  clean = clean.replace(/\s+/g, "");
  const der = base64ToBytes(clean);
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function base64url(bytes) {
  let bin = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
