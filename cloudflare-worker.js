// =============================================================
//  AVTO A1 — Cloudflare Worker  (paste-safe versiya)
//  1) "/"         — Telegram xabar yuboruvchi PROXY (sendMessage)
//                   ⛔ ENDI OCHIQ EMAS: initData HMAC bilan tekshiriladi,
//                      chat_id cheklanadi (oddiy mijoz faqat o'ziga yoki
//                      adminga; admin esa har kimga yubora oladi).
//  2) "/auth"     — Telegram initData HMAC bilan tekshiriladi,
//                   Firebase CUSTOM TOKEN qaytaradi (uid = Telegram id)
//  3) "/referral" — Taklif (referral) bonusi: taklif qilgan odamga
//                   (inviter) bonusni SERVER (admin huquqi) bilan yozadi.
//                   Mijoz xavfsiz qoidalarda boshqa user tuguniga yoza
//                   olmagani uchun shu endpoint kerak. Idempotent.
//
//  Secret'lar (Worker > Settings > Variables):
//     BOT_TOKEN, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//  Ixtiyoriy:
//     ADMIN_IDS        (vergul bilan, mas: "5105291033,483425630")
//     FIREBASE_DB_URL  (mas: "https://avtoa1shop-default-rtdb.firebaseio.com")
//     REFERRAL_BONUS   (mas: "20000")
//
//  ESLATMA: bu faylda atayin backslash-n belgisi ishlatilmagan
//  (ba'zi nusxalash vositalari uni buzadi). Newline kerak joyda
//  String.fromCharCode(10) ishlatilgan.
// =============================================================

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
};

const DEFAULT_ADMIN_IDS = ["5105291033", "483425630"];
const DEFAULT_DB_URL = "https://avtoa1shop-default-rtdb.firebaseio.com";
const DEFAULT_REFERRAL_BONUS = 20000;
// Taklif qilingan do'stning BIRINCHI buyurtmasi shu summadan OSHIQ bo'lishi shart.
// Aks holda taklif qilgan odamga bonus berilmaydi.
const DEFAULT_REFERRAL_MIN_ORDER = 100000;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function getAdminIds(env) {
  if (env && env.ADMIN_IDS) {
    return String(env.ADMIN_IDS)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_ADMIN_IDS;
}

// ===================== /media : Telegram fayl PROXY =====================
// file_id -> getFile -> file_path -> faylni stream qiladi.
// Har so'rovda file_path qaytadan olinadi => link eskirmaydi (DOIMIY).
// BOT_TOKEN faqat shu serverda qoladi (Firebase'ga yozilmaydi => sirqib chiqmaydi).
// Range (qisman yuklash) qo'llab-quvvatlanadi => video oldinga/orqaga suriladi.
async function handleMedia(request, env) {
  const mediaCors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Faqat GET", { status: 405, headers: mediaCors });
  }
  if (!env.BOT_TOKEN) {
    return new Response("BOT_TOKEN sozlanmagan", { status: 500, headers: mediaCors });
  }

  const fileId = new URL(request.url).searchParams.get("id");
  if (!fileId) {
    return new Response("file_id yo'q (?id=...)", { status: 400, headers: mediaCors });
  }

  try {
    // 1) file_id -> file_path (har safar yangilanadi, shuning uchun link eskirmaydi)
    const gfRes = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
    );
    const gf = await gfRes.json();
    if (!gf || !gf.ok || !gf.result || !gf.result.file_path) {
      return new Response("Fayl topilmadi (file_id noto'g'ri yoki >20MB)", {
        status: 404,
        headers: mediaCors,
      });
    }
    const filePath = gf.result.file_path;

    // 2) haqiqiy faylni Telegram CDN'dan olamiz (Range bo'lsa uzatamiz)
    const range = request.headers.get("Range");
    const upstream = await fetch(
      `https://api.telegram.org/file/bot${env.BOT_TOKEN}/${filePath}`,
      { method: request.method, headers: range ? { Range: range } : {} }
    );

    // 3) javobni mijozga uzatamiz (to'g'ri Content-Type + kesh + Range)
    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=86400");
    const ct = upstream.headers.get("Content-Type");
    headers.set(
      "Content-Type",
      ct && ct !== "application/octet-stream" ? ct : guessMime(filePath)
    );
    const cl = upstream.headers.get("Content-Length");
    if (cl) headers.set("Content-Length", cl);
    const cr = upstream.headers.get("Content-Range");
    if (cr) headers.set("Content-Range", cr);

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    return new Response("Media xatosi: " + String(e), { status: 500, headers: mediaCors });
  }
}

// Fayl kengaytmasidan MIME turini taxminlaymiz (video to'g'ri o'ynashi uchun muhim)
function guessMime(p) {
  const ext = (p.split(".").pop() || "").toLowerCase();
  const map = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    m4v: "video/x-m4v",
    "3gp": "video/3gpp",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] || "application/octet-stream";
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const path = new URL(request.url).pathname;

    // ---------- /media : Telegram fayl PROXY (DOIMIY, token yashirin) ----------
    // Storis rasm/videolari shu yerdan o'qiladi. file_id har safar yangidan
    // file_path'ga aylantirilgani uchun link HECH QACHON eskirmaydi (eski
    // "1 soatdan keyin video o'chib ketardi" muammosi shu bilan hal bo'ladi).
    if (path === "/media" || path === "/file") {
      return handleMedia(request, env);
    }

    if (request.method !== "POST") {
      return new Response("Faqat POST", { status: 405, headers: cors });
    }

    // ---------- /auth : initData -> Firebase custom token ----------
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

    // ---------- /referral : inviter'ga bonus (server, idempotent) ----------
    if (path === "/referral") {
      try {
        const { initData, code } = await request.json();
        if (!initData || typeof initData !== "string") {
          return json({ ok: false, error: "initData yoq" }, 400);
        }
        const verified = await verifyTelegramInitData(initData, env.BOT_TOKEN);
        if (!verified.ok) {
          return json({ ok: false, error: verified.error }, 401);
        }
        const redeemer = String(verified.user.id);
        const codeUp = String(code || "").trim().toUpperCase();
        if (!codeUp) return json({ ok: false, error: "kod yoq" }, 400);

        const dbUrl = (env.FIREBASE_DB_URL || DEFAULT_DB_URL).replace(/\/$/, "");
        const accessToken = await getAccessToken(env);

        // 1) kod -> taklif qilgan odam (inviter) uid
        const refUidRaw = await rtdbGet(dbUrl, "refcodes/" + codeUp, accessToken);
        if (!refUidRaw) return json({ ok: false, error: "kod topilmadi" }, 404);
        const refUid = String(refUidRaw);
        if (refUid === redeemer) {
          return json({ ok: false, error: "oz kodi" }, 400);
        }

        // 2) takror ishlatishni bloklash (idempotent guard)
        const already = await rtdbGet(dbUrl, "referralRedeemed/" + redeemer, accessToken);
        if (already) return json({ ok: false, error: "allaqachon ishlatilgan" }, 409);

        const now = Date.now();

        // ⚠️ MUHIM O'ZGARISH: BU YERDA PUL BERILMAYDI.
        //    Ilgari kod kiritilishi bilanoq inviter'ga bonus yozilardi — hech kim
        //    hech narsa sotib olmasa ham. Bu soxta akkauntlar bilan cheksiz "pul"
        //    yasash imkonini berardi. Endi faqat BOG'LANISH qayd etiladi;
        //    bonus /referral-qualify da, do'stning haqiqiy xaridi tekshirilgach beriladi.
        await rtdbPut(
          dbUrl,
          "referralRedeemed/" + redeemer,
          { code: codeUp, refUid: refUid, date: now, paid: false },
          accessToken
        );

        // "Kim orqasidan kim kirgan" — tekshirib bo'ladigan indeks (admin uchun ham)
        await rtdbPut(
          dbUrl,
          "referrals/" + refUid + "/" + redeemer,
          { uid: redeemer, date: now, paid: false },
          accessToken
        );

        // Inviter ro'yxatida ko'rinishi uchun (hali "kutilmoqda" holatida)
        await rtdbPut(
          dbUrl,
          "users/" + refUid + "/phase2/referrals/" + redeemer,
          { uid: redeemer, date: now, paid: false },
          accessToken
        );

        return json({ ok: true, pending: true, refUid });
      } catch (e) {
        return json({ ok: false, error: String(e) }, 500);
      }
    }

    // ---------- /referral-qualify : do'st haqiqatda xarid qilgach bonus berish ----------
    // Shartlar (HAMMASI server tomonda bazadan tekshiriladi — mijoz so'ziga ishonilmaydi):
    //   1. Bu foydalanuvchi kimningdir kodini kiritgan bo'lishi kerak (referralRedeemed);
    //   2. bonus hali to'lanmagan bo'lishi kerak (paid !== true);
    //   3. uning BIRINCHI (eng eski) YETKAZIB BERILGAN buyurtmasi bo'lishi kerak;
    //   4. o'sha buyurtma summasi REFERRAL_MIN_ORDER dan OSHIQ bo'lishi kerak.
    if (path === "/referral-qualify") {
      try {
        const { initData } = await request.json();
        if (!initData || typeof initData !== "string") {
          return json({ ok: false, error: "initData yoq" }, 400);
        }
        const verified = await verifyTelegramInitData(initData, env.BOT_TOKEN);
        if (!verified.ok) return json({ ok: false, error: verified.error }, 401);

        const redeemer = String(verified.user.id);
        const dbUrl = (env.FIREBASE_DB_URL || DEFAULT_DB_URL).replace(/\/$/, "");
        const accessToken = await getAccessToken(env);

        // 1) bog'lanish bormi?
        const link = await rtdbGet(dbUrl, "referralRedeemed/" + redeemer, accessToken);
        if (!link || !link.refUid) return json({ ok: false, error: "referral yoq" }, 404);
        if (link.paid === true) return json({ ok: false, error: "allaqachon tolangan" }, 409);
        const refUid = String(link.refUid);
        if (refUid === redeemer) return json({ ok: false, error: "oz kodi" }, 400);

        // 2) buyurtmalarni SERVERDA o'qiymiz
        const ordersRaw = await rtdbGet(dbUrl, "users/" + redeemer + "/orders", accessToken);
        const orders = !ordersRaw
          ? []
          : (Array.isArray(ordersRaw) ? ordersRaw : Object.keys(ordersRaw).map((k) => ordersRaw[k])).filter(Boolean);

        const delivered = orders.filter((o) => o && o.status === "yetkazildi");
        if (!delivered.length) return json({ ok: false, error: "yetkazilgan buyurtma yoq" }, 412);

        // 3) BIRINCHI yetkazilgan buyurtma (eng eski)
        delivered.sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
        const first = delivered[0];

        // 4) haqiqatda to'langan summa (cashback chegirmasidan keyin)
        const gross = parseInt(first.total, 10) || 0;
        const used = parseInt(first.cashbackUsed, 10) || 0;
        const paidAmount = first.payable != null ? (parseInt(first.payable, 10) || 0) : Math.max(0, gross - used);

        const minOrder =
          parseInt(env.REFERRAL_MIN_ORDER || String(DEFAULT_REFERRAL_MIN_ORDER), 10) || DEFAULT_REFERRAL_MIN_ORDER;
        if (paidAmount <= minOrder) {
          return json({ ok: false, error: "summa yetarli emas", need: minOrder, got: paidAmount }, 412);
        }

        const bonus = parseInt(env.REFERRAL_BONUS || String(DEFAULT_REFERRAL_BONUS), 10) || DEFAULT_REFERRAL_BONUS;
        const now = Date.now();

        // 5) guardni AVVAL yopamiz (ikki marta to'lanmasligi uchun)
        await rtdbPatch(
          dbUrl,
          "referralRedeemed/" + redeemer,
          { paid: true, paidAt: now, bonus: bonus, orderCode: String(first.code || first.id || ""), orderAmount: paidAmount },
          accessToken
        );

        // 6) inviter cashback — ATOMIK increment.
        //    Mijoz tomonida balans = cashbackTotal − cashbackSpent bo'lgani uchun
        //    faqat "yig'ilgan" hisoblagichni oshiramiz, balans o'zi hisoblanadi.
        await rtdbPatch(
          dbUrl,
          "users/" + refUid + "/phase2",
          { cashbackTotal: { ".sv": { increment: bonus } } },
          accessToken
        );

        // 7) holatni belgilaymiz + bildirishnoma
        await rtdbPatch(dbUrl, "referrals/" + refUid + "/" + redeemer, { paid: true, paidAt: now, bonus: bonus }, accessToken);
        await rtdbPatch(
          dbUrl,
          "users/" + refUid + "/phase2/referrals/" + redeemer,
          { paid: true, paidAt: now, bonus: bonus },
          accessToken
        );
        await rtdbPost(
          dbUrl,
          "users/" + refUid + "/phase2/notifications",
          {
            id: "n" + now,
            icon: "\uD83E\uDD1D",
            title: "Referral bonus!",
            text: "Do'stingiz birinchi xaridini qildi. +" + bonus + " so'm cashback qo'shildi!",
            date: now,
            read: false,
          },
          accessToken
        );

        // 8) inviter'ga Telegram xabari (bo'lmasa ham jarayon buzilmaydi)
        try {
          if (env.BOT_TOKEN) {
            await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: refUid,
                parse_mode: "HTML",
                text:
                  "\uD83E\uDD1D <b>Referral bonus!</b>\n\nSiz taklif qilgan do'stingiz birinchi xaridini qildi.\n" +
                  "\uD83C\uDF81 <b>+" +
                  bonus.toLocaleString("ru-RU").replace(/,/g, " ") +
                  " so'm</b> cashback hisobingizga qo'shildi.\n\nRahmat!",
              }),
            });
          }
        } catch (_) {}

        return json({ ok: true, bonus, refUid, orderAmount: paidAmount });
      } catch (e) {
        return json({ ok: false, error: String(e) }, 500);
      }
    }

    // ---------- / : sendMessage proxy (himoyalangan) ----------
    try {
      const body = await request.json();
      const adminIds = getAdminIds(env);
      const chatId = String(body && body.chat_id != null ? body.chat_id : "");
      const initData = body && typeof body.initData === "string" ? body.initData : "";

      let allowed = false;
      if (initData) {
        const v = await verifyTelegramInitData(initData, env.BOT_TOKEN);
        if (v.ok) {
          const sender = String(v.user.id);
          if (adminIds.includes(sender)) {
            allowed = true; // admin -> istalgan chat_id (mijozlarga javob, broadcast)
          } else if (chatId === sender || adminIds.includes(chatId)) {
            allowed = true; // oddiy mijoz -> faqat o'ziga yoki adminga
          }
        }
      } else {
        // initData yo'q (APK/brauzer fallback): faqat ADMIN ga yuborishga ruxsat.
        // Bu mijozlarni "soxta tasdiq" xabarlari bilan aldash vektorini yopadi.
        if (adminIds.includes(chatId)) allowed = true;
      }

      if (!allowed) {
        return json({ ok: false, error: "ruxsat berilmadi (chat_id cheklangan)" }, 403);
      }

      if ("initData" in body) delete body.initData;

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

// ===================== Telegram initData tekshiruvi =====================
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

  // ⏱ Constant-time taqqoslash (timing-attack'ni kamaytirish uchun)
  if (!constantTimeEqual(computedHex, hash)) {
    return { ok: false, error: "imzo mos kelmadi" };
  }

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

function constantTimeEqual(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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

// ===================== Firebase custom token (/auth uchun) =====================
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

// ===================== Google OAuth access token (/referral uchun) =====================
// Service account JWT -> OAuth2 access_token (firebase.database scope).
// Bu token bilan RTDB REST API'ga ADMIN huquqi bilan yoziladi.
async function getAccessToken(env) {
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKeyPem = env.FIREBASE_PRIVATE_KEY;
  if (!clientEmail || !privateKeyPem) {
    throw new Error("FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY sozlanmagan");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope:
      "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const claimsB64 = base64url(enc.encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;

  const key = await importPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    enc.encode(signingInput)
  );
  const jwt = `${signingInput}.${base64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" +
      encodeURIComponent(jwt),
  });
  const j = await res.json();
  if (!j || !j.access_token) {
    throw new Error("access_token olinmadi: " + JSON.stringify(j));
  }
  return j.access_token;
}

// ===================== RTDB REST yordamchilari =====================
async function rtdbGet(dbUrl, path, token) {
  const r = await fetch(`${dbUrl}/${path}.json?access_token=${token}`);
  if (!r.ok) return null;
  return await r.json();
}
function rtdbPut(dbUrl, path, val, token) {
  return fetch(`${dbUrl}/${path}.json?access_token=${token}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(val),
  });
}
function rtdbPatch(dbUrl, path, val, token) {
  return fetch(`${dbUrl}/${path}.json?access_token=${token}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(val),
  });
}
function rtdbPost(dbUrl, path, val, token) {
  return fetch(`${dbUrl}/${path}.json?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(val),
  });
}

// ===================== RSA private key import =====================
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
