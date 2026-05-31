// =============================================================
//  AVTO A1 — Cloudflare Worker
//  Ikki vazifa:
//   1) "/"  (yoki boshqa yo'l) — Telegram xabar yuboruvchi PROXY
//      Brauzer xabarni beradi, Worker MAXFIY tokenni qo'shib
//      Telegram'ga uzatadi. Token mijozga hech qachon ko'rinmaydi.
//   2) "/auth" — Telegram initData'ni HMAC bilan TEKSHIRIB,
//      Firebase CUSTOM TOKEN qaytaradi (uid = Telegram user id).
//      Shu token bilan mijoz Firebase'ga xavfsiz "login" qiladi.
//
//  Kerakli Cloudflare Secret'lar (Settings > Variables > Secrets):
//   - BOT_TOKEN              : Telegram bot tokeni (allaqachon bor)
//   - FIREBASE_CLIENT_EMAIL  : service-account email (...@...iam.gserviceaccount.com)
//   - FIREBASE_PRIVATE_KEY   : service-account private_key (PEM, BEGIN/END qatorlari bilan)
// =============================================================

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
    // Brauzer "ruxsatmi?" (preflight) so'rasa — ha
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Faqat POST", { status: 405, headers: cors });
    }

    const path = new URL(request.url).pathname;

    // ---------- 2) FIREBASE AUTH: initData -> custom token ----------
    if (path === "/auth") {
      try {
        const { initData } = await request.json();
        if (!initData || typeof initData !== "string") {
          return json({ ok: false, error: "initData yo'q" }, 400);
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

    // ---------- 1) TELEGRAM PROXY (sendMessage) ----------
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
//  Telegram initData'ni tekshirish (rasmiy HMAC algoritmi)
//  https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// =============================================================
async function verifyTelegramInitData(initData, botToken) {
  if (!botToken) return { ok: false, error: "BOT_TOKEN sozlanmagan" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "hash yo'q" };
  params.delete("hash");

  // data_check_string: kalitlar alifbo tartibida, "key=value" \n bilan
  const pairs = [];
  for (const [k, v] of params) pairs.push(`${k}=${v}`);
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const enc = new TextEncoder();

  // secret_key = HMAC_SHA256(key="WebAppData", message=botToken)
  const secretKey = await hmacSha256(enc.encode("WebAppData"), enc.encode(botToken));

  // computed = HMAC_SHA256(key=secret_key, message=dataCheckString) -> hex
  const computed = await hmacSha256(secretKey, enc.encode(dataCheckString));
  const computedHex = toHex(computed);

  if (computedHex !== hash) return { ok: false, error: "imzo mos kelmadi" };

  // auth_date eskirganini tekshirish (24 soat)
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
  if (!user || !user.id) return { ok: false, error: "user yo'q" };

  return { ok: true, user };
}

// HMAC-SHA256: keyBytes bilan messageBytes'ni imzolaydi -> ArrayBuffer
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

// =============================================================
//  Firebase custom token yaratish (RS256 JWT, service-account bilan)
//  Mijoz buni signInWithCustomToken() ga beradi.
// =============================================================
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
    exp: now + 3600, // 1 soat
    uid, // <-- Firebase auth.uid shu bo'ladi
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

// PEM (PKCS#8) private key -> CryptoKey
async function importPrivateKey(pem) {
  const clean = pem
    .replace(/\\n/g, "\n") // Secret'da \n literal bo'lsa, haqiqiy newline'ga aylantiramiz
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const der = base64ToBytes(clean);
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

// ---- base64 yordamchilar ----
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
