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
//  4) "/stock-commit" — Ombor zaxirasini SERVERDA kamaytiradi: mahsulot
//                   `id` bo'yicha topiladi (indeks bo'yicha emas), `stock >= qty`
//                   tekshiriladi va atomik `increment` bilan yoziladi.
//                   Bu oversell (yo'q tovarni sotish) va "noto'g'ri tovar
//                   stoki kamaydi" muammolarini yopadi.
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
  // X-Init-Data — /upload stream rejimida auth shu header orqali keladi
  // (body'ga tegmasdan tekshirish uchun). Preflight ruxsati SHART.
  "Access-Control-Allow-Headers": "Content-Type, Range, X-Init-Data",
  "Access-Control-Max-Age": "86400",
};

// ⚠️ Mini app'dagi ADMIN_IDS bilan BIR XIL bo'lishi shart (index.html).
//    Ilgari 5302078 yo'q edi — o'sha admin video yuklaganda 403 olardi.
const DEFAULT_ADMIN_IDS = ["5105291033", "483425630", "5302078"];
const DEFAULT_DB_URL = "https://avtoa1shop-default-rtdb.firebaseio.com";
const DEFAULT_REFERRAL_BONUS = 20000;
// Taklif qilingan do'stning BIRINCHI buyurtmasi shu summadan OSHIQ bo'lishi shart.
// Aks holda taklif qilgan odamga bonus berilmaydi.
const DEFAULT_REFERRAL_MIN_ORDER = 100000;
const DEFAULT_FIREBASE_PROJECT_ID = "avtoa1shop";
const TELEGRAM_INIT_MAX_AGE = 60 * 60;
const CLOCK_SKEW_SECONDS = 300;
const MAX_JSON_BYTES = 64 * 1024;
const ORDER_STATUSES = ["kutilmoqda", "qabul", "yolda", "yetkazildi", "bekor_qilingan"];
const ORDER_TRANSITIONS = {
  kutilmoqda: ["qabul", "bekor_qilingan"],
  qabul: ["yolda", "bekor_qilingan"],
  yolda: ["yetkazildi", "bekor_qilingan"],
  yetkazildi: [],
  bekor_qilingan: [],
};
const ATTEMPT_LEASE_MS = 45 * 1000;
const STATUS_LEASE_MS = 45 * 1000;
const JWKS_REFRESH_COOLDOWN_MS = 5 * 1000;
const JWKS_NEGATIVE_TTL_MS = 60 * 1000;
const firebaseCertCache = {
  keys: null,
  expiresAt: 0,
  refreshPromise: null,
  nextForcedRefreshAt: 0,
  negativeKids: new Map(),
};
const googleTokenCache = { token: "", expiresAt: 0 };
const messageRateLimits = new Map();

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

// ===================== file_path KESHI (video qotishiga qarshi) =====================
// ⚠️ MUAMMO (video o'ynaganda tutilib qolardi):
//    Video <video> elementi faylni BIR BUTUN olmaydi — u ko'plab "Range"
//    so'rovlari yuboradi (har bir bo'lak uchun bittasi; 20 MB video = o'nlab
//    so'rov). Ilgari HAR BIR so'rovda Telegram'ga `getFile` chaqirilardi:
//        so'rov -> getFile (~200-500ms) -> CDN'dan bo'lak (~200-500ms)
//    Ya'ni har bo'lakka QO'SHIMCHA yarim sekund. Natijada video har necha
//    sekundda tutilib turardi, orqaga/oldinga surish esa deyarli ishlamasdi.
//
// ENDI: file_id -> file_path juftligi xotirada saqlanadi. Telegram file_path
//    ~1 soat yashaydi, shuning uchun 45 daqiqa keshlaymiz — xavfsiz zapas bor.
//    Kesh eskirsa yoki CDN 404 qaytarsa, avtomat qayta so'raladi (pastda).
//    Natija: birinchi bo'lakdan keyin getFile UMUMAN chaqirilmaydi -> silliq.
const FILE_PATH_TTL = 45 * 60 * 1000;   // 45 daqiqa
const FILE_PATH_MAX = 400;              // xotira cheklovi
const filePathCache = new Map();        // file_id -> { path, exp }

function cacheGetPath(fileId) {
  const hit = filePathCache.get(fileId);
  if (!hit) return null;
  if (Date.now() > hit.exp) { filePathCache.delete(fileId); return null; }
  return hit.path;
}

function cacheSetPath(fileId, filePath) {
  // Eng eski yozuvlarni tashlaymiz (Map kiritish tartibini saqlaydi)
  if (filePathCache.size >= FILE_PATH_MAX) {
    const oldest = filePathCache.keys().next();
    if (!oldest.done) filePathCache.delete(oldest.value);
  }
  filePathCache.set(fileId, { path: filePath, exp: Date.now() + FILE_PATH_TTL });
}

// file_id -> file_path (keshdan yoki Telegram'dan). `force` bilan kesh chetlanadi.
async function resolveFilePath(fileId, env, force) {
  if (!force) {
    const cached = cacheGetPath(fileId);
    if (cached) return cached;
  }
  const gfRes = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  const gf = await gfRes.json();
  if (!gf || !gf.ok || !gf.result || !gf.result.file_path) return null;
  cacheSetPath(fileId, gf.result.file_path);
  return gf.result.file_path;
}

// ===================== /media : Telegram fayl PROXY =====================
// file_id -> getFile -> file_path -> faylni stream qiladi.
// file_path keshlanadi (yuqoriga qara), eskirsa avtomat yangilanadi =>
// link HECH QACHON eskirmaydi, lekin har bo'lakka ortiqcha kutish YO'Q.
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
    // 1) file_id -> file_path (keshdan; yo'q bo'lsa Telegram'dan)
    let filePath = await resolveFilePath(fileId, env, false);
    if (!filePath) {
      return new Response("Fayl topilmadi (file_id noto'g'ri yoki >20MB)", {
        status: 404,
        headers: mediaCors,
      });
    }

    // 2) haqiqiy faylni Telegram CDN'dan olamiz (Range bo'lsa uzatamiz)
    const range = request.headers.get("Range");
    const fetchPart = (p) =>
      fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${p}`, {
        method: request.method,
        headers: range ? { Range: range } : {},
      });

    let upstream = await fetchPart(filePath);

    // 🔁 Keshdagi file_path eskirgan bo'lsa (Telegram 401/404 qaytaradi) —
    //    bir marta MAJBURAN yangilab qayta urinamiz. Shuning uchun keshlash
    //    "link eskirmaydi" kafolatini BUZMAYDI.
    if (upstream.status === 404 || upstream.status === 401 || upstream.status === 403) {
      filePathCache.delete(fileId);
      const fresh = await resolveFilePath(fileId, env, true);
      if (fresh) upstream = await fetchPart(fresh);
    }

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

// ===================== /upload uchun umumiy yordamchilar =====================

// Telegram javobidan (sendVideo/sendPhoto natijasi) mijozga kerakli
// maydonlarni ajratib oladi. Stream rejimi ham, legacy rejimi ham shu
// funksiyani ishlatadi — javob SHAKLI bir xil bo'lishi uchun.
function buildUploadResult(tg, isVideo, origin, size) {
  const r = tg.result;
  let fileId = "";
  let thumbId = "";
  let duration = 0;
  let width = 0;
  let height = 0;

  if (isVideo && r.video) {
    fileId = r.video.file_id;
    duration = r.video.duration || 0;
    width = r.video.width || 0;
    height = r.video.height || 0;
    const th = r.video.thumbnail || r.video.thumb;
    if (th) thumbId = th.file_id;
  } else if (r.photo && r.photo.length) {
    const best = r.photo[r.photo.length - 1];
    fileId = best.file_id;
    width = best.width || 0;
    height = best.height || 0;
  } else if (r.document) {
    // Telegram ba'zan videoni "document" deb qabul qiladi (masalan .mov)
    fileId = r.document.file_id;
    const th = r.document.thumbnail || r.document.thumb;
    if (th) thumbId = th.file_id;
  } else if (r.animation) {
    fileId = r.animation.file_id;
    duration = r.animation.duration || 0;
    const th = r.animation.thumbnail || r.animation.thumb;
    if (th) thumbId = th.file_id;
  }

  if (!fileId) return null;

  const mediaUrl = (id) => `${origin}/media?id=${encodeURIComponent(id)}`;
  return {
    ok: true,
    file_id: fileId,
    url: mediaUrl(fileId),
    thumb_id: thumbId || null,
    thumb_url: thumbId ? mediaUrl(thumbId) : null,
    type: isVideo ? "video" : "image",
    duration,
    width,
    height,
    size: size || 0,
  };
}

/* ===========================================================================
 * /upload — STREAM REJIMI (asosiy yo'l)
 * ---------------------------------------------------------------------------
 * ⚠️ NEGA KERAK BO'LDI (video yuklash "qotib qolardi"):
 *    Legacy yo'lda Worker `await request.formData()` chaqirardi — bu 20 MB
 *    multipart'ni BUTUNLAY xotiraga o'qib, parse qilib, so'ng Telegram uchun
 *    YANGI FormData yasab qayta serializatsiya qilardi. Cloudflare Worker'da
 *    bepul rejada CPU vaqti QATTIQ cheklangan (~10ms). 20 MB parse + qayta
 *    yasash bu chegaradan oshib ketadi -> Worker "resource limits" bilan
 *    o'ldiriladi. Mijozda esa hech qanday aniq xato ko'rinmasdi: progress
 *    95% da turib qolardi va 3 daqiqa timeout kutilardi. Aynan shu
 *    "video tanlayapman va o'sha joyda qotib qolyapti" holati.
 *
 * ENDI: body'ga UMUMAN tegmaymiz — uni to'g'ridan-to'g'ri Telegram'ga
 *    STREAM qilamiz (bayt-baytga o'zgarmasdan o'tadi).
 *      • auth  -> `X-Init-Data` HEADER'idan (body o'qilmaydi)
 *      • chat_id / caption / supports_streaming -> Telegram URL'ining
 *        query qismida (ya'ni MIJOZ chat_id ni boshqara olmaydi — spam yo'q)
 *      • multipart'ni Telegram o'zi parse qiladi
 *    CPU deyarli nolga tushadi, yuklash esa tezlashadi: baytlar mijozdan
 *    kelishi bilan darhol Telegram'ga ketadi (avval to'liq kutilardi).
 * =========================================================================== */
async function handleUploadStream(request, env, initData) {
  try {
    if (!env.BOT_TOKEN) return json({ ok: false, error: "BOT_TOKEN sozlanmagan" }, 500);

    const verified = await verifyTelegramInitData(initData, env.BOT_TOKEN);
    if (!verified.ok) return json({ ok: false, error: verified.error }, 401);

    const uid = requireSafeUid(verified.user.id, 401);
    if (getAdminIds(env).indexOf(uid) === -1) {
      return json({ ok: false, error: "ruxsat yoq" }, 403);
    }

    const url = new URL(request.url);
    const isVideo = url.searchParams.get("kind") !== "photo";

    // Body multipart bo'lishi shart (Telegram faqat multipart qabul qiladi)
    const ctype = request.headers.get("Content-Type") || "";
    if (ctype.toLowerCase().indexOf("multipart/form-data") !== 0) {
      return json({ ok: false, error: "multipart kerak" }, 400);
    }

    // Hajmni Content-Length bo'yicha tekshiramiz (body o'qilmaydi).
    // +64KB — multipart sarlavhalari uchun zapas.
    const MAX = 20 * 1024 * 1024;
    const clen = parseInt(request.headers.get("Content-Length") || "0", 10) || 0;
    if (clen > MAX + 65536) {
      return json({ ok: false, error: "juda katta", size: clen, max: MAX }, 413);
    }

    const chatId = env.MEDIA_CHAT_ID || uid;
    const method = isVideo ? "sendVideo" : "sendPhoto";

    // Barcha parametrlar QUERY'da — shuning uchun body'ni ochish kerak emas
    // va mijoz chat_id ni o'zgartira olmaydi.
    const qs = new URLSearchParams();
    qs.set("chat_id", String(chatId));
    qs.set("disable_notification", "true");
    qs.set("caption", isVideo ? "🎬 Mini app: storis videosi" : "🖼 Mini app: storis rasmi");
    if (isVideo) qs.set("supports_streaming", "true");

    const tgRes = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}?${qs.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": ctype },   // boundary AYNAN saqlanadi
        body: request.body,                   // 🚀 stream — nusxa olinmaydi
      }
    );

    const tg = await tgRes.json();
    if (!tg || !tg.ok || !tg.result) {
      return json({ ok: false, error: (tg && tg.description) || "Telegram rad etdi" }, 502);
    }

    const out = buildUploadResult(tg, isVideo, url.origin, clen);
    if (!out) return json({ ok: false, error: "file_id qaytmadi" }, 502);
    return json(out);
  } catch (_) {
    return json({ ok: false, error: "upload xatosi" }, 500);
  }
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
        const body = await readJsonBody(request);
        const initData = body.initData;
        if (!initData || typeof initData !== "string") {
          return json({ ok: false, error: "initData yoq" }, 400);
        }
        const verified = await verifyTelegramInitData(initData, env.BOT_TOKEN);
        if (!verified.ok) {
          return json({ ok: false, error: verified.error }, 401);
        }
        const uid = requireSafeUid(verified.user.id, 401);
        const token = await createFirebaseCustomToken(uid, env);
        return json({ ok: true, token, uid });
      } catch (e) {
        return errorResponse(e);
      }
    }

    // ---------- /upload : galereyadan VIDEO/RASM yuklash (faqat admin) ----------
    // NEGA BU KERAK: ilgari mini app'dan storisga video QO'SHIB BO'LMASDI —
    // admin faqat tashqi havola yozishi mumkin edi (ImgBB video qabul qilmaydi,
    // bot tokeni esa mijozda yo'q, ataylab). Endi fayl shu endpoint orqali
    // Telegram'ga yuklanadi va MUDDATSIZ `file_id` qaytadi; /media proxy uni
    // Range (qism-qism) bilan uzatadi -> video darhol o'ynay boshlaydi.
    //
    // ⚠️ TELEGRAM CHEGARASI: bot `getFile` bilan faqat 20 MB gacha faylni
    //    o'qiy oladi. Ya'ni 20 MB dan katta video YUKLANSA HAM keyin
    //    ko'rsatib bo'lmaydi. Shuning uchun chegara aynan shu yerda qo'yiladi
    //    (mijoz keyin "video ishlamaydi" muammosiga tushmasligi uchun).
    if (path === "/upload") {
      // 🚀 ASOSIY YO'L: auth header'da bo'lsa — body'ni Telegram'ga stream qilamiz
      //    (CPU cheklovi muammosi shu bilan hal bo'ladi, yuqoridagi izohga qara).
      const hdrInit = request.headers.get("X-Init-Data");
      if (hdrInit) return handleUploadStream(request, env, hdrInit);

      // 🛟 ZAXIRA YO'L (legacy): eski mijoz initData'ni body ichida yuboradi.
      //    Bu yo'l 20 MB ni xotirada parse qiladi va CPU cheklovига urilishi
      //    mumkin — shuning uchun faqat moslik uchun saqlanadi.
      try {
        const form = await request.formData();
        const initData = String(form.get("initData") || "");
        const file = form.get("file");

        if (!initData) return json({ ok: false, error: "initData yoq" }, 400);
        const verified = await verifyTelegramInitData(initData, env.BOT_TOKEN);
        if (!verified.ok) return json({ ok: false, error: verified.error }, 401);

        // Faqat admin yuklashi mumkin
        const uid = requireSafeUid(verified.user.id, 401);
        const admins = (env.ADMIN_IDS ? String(env.ADMIN_IDS).split(",") : DEFAULT_ADMIN_IDS)
          .map((x) => String(x).trim());
        if (admins.indexOf(uid) === -1) {
          return json({ ok: false, error: "ruxsat yoq" }, 403);
        }

        if (!file || typeof file === "string") return json({ ok: false, error: "fayl yoq" }, 400);

        const MAX = 20 * 1024 * 1024; // Telegram getFile chegarasi
        if (file.size > MAX) {
          return json({
            ok: false,
            error: "juda katta",
            size: file.size,
            max: MAX,
          }, 413);
        }

        const mime = String(file.type || "");
        const isVideo = mime.indexOf("video") === 0;
        const method = isVideo ? "sendVideo" : "sendPhoto";
        const field = isVideo ? "video" : "photo";

        // Fayl saqlanadigan chat: alohida MEDIA_CHAT_ID bo'lmasa — yuklovchining o'zi
        const chatId = env.MEDIA_CHAT_ID || uid;

        const tgForm = new FormData();
        tgForm.append("chat_id", String(chatId));
        tgForm.append("disable_notification", "true");
        tgForm.append("caption", isVideo ? "🎬 Mini app: storis videosi" : "🖼 Mini app: storis rasmi");
        tgForm.append(field, file, file.name || (isVideo ? "story.mp4" : "story.jpg"));
        if (isVideo) tgForm.append("supports_streaming", "true");

        const tgRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
          method: "POST",
          body: tgForm,
        });
        const tg = await tgRes.json();
        if (!tg || !tg.ok || !tg.result) {
          return json({ ok: false, error: (tg && tg.description) || "Telegram rad etdi" }, 502);
        }

        const out = buildUploadResult(tg, isVideo, new URL(request.url).origin, file.size);
        if (!out) return json({ ok: false, error: "file_id qaytmadi" }, 502);
        return json(out);
      } catch (_) {
        return json({ ok: false, error: "upload xatosi" }, 500);
      }
    }

    // All protected JSON APIs use the same verified identity. Named routes are
    // dispatched explicitly so an unknown path can never fall through to Telegram.
    if (path === "/order-commit") return handleOrderCommit(request, env);
    if (path === "/order-status") return handleOrderStatus(request, env);
    if (path === "/referral") return handleReferralSecure(request, env);
    if (path === "/referral-qualify") return handleReferralQualifySecure(request, env);
    if (path === "/stock-commit") return handleDeprecatedStockCommit(request, env);
    if (path === "/") return handleSendMessageSecure(request, env);
    return json({ ok: false, error: "topilmadi" }, 404);

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
  if (!authDate) return { ok: false, error: "auth_date yoq" };
  if (authDate > now + CLOCK_SKEW_SECONDS) {
    return { ok: false, error: "initData kelajakdan" };
  }
  if (now - authDate > TELEGRAM_INIT_MAX_AGE) {
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

function httpError(status, message, extra) {
  const err = new Error(message);
  err.status = status;
  err.extra = extra || null;
  return err;
}

function errorResponse(err) {
  const status = err && Number.isInteger(err.status) ? err.status : 500;
  const body = { ok: false, error: status === 500 ? "server xatosi" : String(err.message || "xato") };
  if (err && err.extra && typeof err.extra === "object") Object.assign(body, err.extra);
  return json(body, status);
}

async function readJsonBody(request) {
  const rawType = request.headers.get("Content-Type") || "";
  const mediaType = rawType.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw httpError(415, "application/json kerak");

  const rawLength = request.headers.get("Content-Length");
  if (rawLength != null) {
    if (!/^\d+$/.test(rawLength.trim())) throw httpError(400, "Content-Length noto'g'ri");
    const declared = Number(rawLength);
    if (!Number.isSafeInteger(declared) || declared > MAX_JSON_BYTES) {
      throw httpError(413, "so'rov juda katta");
    }
  }

  const reader = request.body && request.body.getReader ? request.body.getReader() : null;
  const chunks = [];
  let total = 0;
  if (reader) {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_JSON_BYTES) {
        try { await reader.cancel(); } catch (_) {}
        throw httpError(413, "so'rov juda katta");
      }
      chunks.push(part.value);
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let body;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (_) {
    throw httpError(400, "JSON noto'g'ri");
  }
  if (!body || Array.isArray(body) || typeof body !== "object") throw httpError(400, "JSON obyekt kerak");
  return body;
}

function requireSafeUid(value, status) {
  const uid = String(value == null ? "" : value);
  if (!uid || uid.length > 128 || /[.#$\[\]/\u0000-\u001F\u007F]/.test(uid)) {
    throw httpError(status || 400, "uid noto'g'ri");
  }
  return uid;
}

function randomOwnerToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function authenticateBody(body, env) {
  if (typeof body.initData === "string" && body.initData) {
    const verified = await verifyTelegramInitData(body.initData, env.BOT_TOKEN);
    if (!verified.ok) throw httpError(401, verified.error);
    return { uid: requireSafeUid(verified.user.id, 401), source: "telegram", claims: verified.user };
  }
  if (typeof body.idToken === "string" && body.idToken) {
    const claims = await verifyFirebaseIdToken(body.idToken, env);
    return { uid: requireSafeUid(claims.sub, 401), source: "firebase", claims };
  }
  throw httpError(401, "initData yoki idToken kerak");
}

function decodeJwtPart(part) {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
  } catch (_) {
    throw httpError(401, "ID token formati noto'g'ri");
  }
}

function parseMaxAge(value) {
  const match = String(value || "").match(/(?:^|,)\s*max-age=(\d+)/i);
  return match ? Math.max(60, parseInt(match[1], 10) || 300) : 300;
}

async function getFirebasePublicKeys(force) {
  const now = Date.now();
  if (!force && firebaseCertCache.keys && now < firebaseCertCache.expiresAt) {
    return firebaseCertCache.keys;
  }
  if (force && firebaseCertCache.keys && now < firebaseCertCache.nextForcedRefreshAt) {
    return firebaseCertCache.keys;
  }
  if (firebaseCertCache.refreshPromise) return await firebaseCertCache.refreshPromise;

  firebaseCertCache.refreshPromise = (async () => {
    const response = await fetch(
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) throw httpError(503, "Firebase sertifikatlari olinmadi");
    let jwks;
    try { jwks = await response.json(); } catch (_) { throw httpError(503, "Firebase sertifikatlari noto'g'ri"); }
    const imported = new Map();
    for (const jwk of (jwks && Array.isArray(jwks.keys) ? jwks.keys : [])) {
      if (!jwk || !jwk.kid || jwk.kty !== "RSA" || (jwk.alg && jwk.alg !== "RS256")) continue;
      const key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
      );
      imported.set(String(jwk.kid), key);
    }
    if (!imported.size) throw httpError(503, "Firebase sertifikatlari bo'sh");
    firebaseCertCache.keys = imported;
    firebaseCertCache.expiresAt = Date.now() + parseMaxAge(response.headers.get("Cache-Control")) * 1000;
    firebaseCertCache.nextForcedRefreshAt = Date.now() + JWKS_REFRESH_COOLDOWN_MS;
    for (const kid of imported.keys()) firebaseCertCache.negativeKids.delete(kid);
    return imported;
  })();
  try {
    return await firebaseCertCache.refreshPromise;
  } finally {
    firebaseCertCache.refreshPromise = null;
  }
}

async function verifyFirebaseIdToken(token, env) {
  const parts = String(token).split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw httpError(401, "ID token formati noto'g'ri");
  }
  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid || header.kid.length > 200) {
    throw httpError(401, "ID token algoritmi noto'g'ri");
  }

  const negativeNow = Date.now();
  for (const [kid, expiresAt] of firebaseCertCache.negativeKids) {
    if (expiresAt <= negativeNow) firebaseCertCache.negativeKids.delete(kid);
  }
  let keys = await getFirebasePublicKeys(false);
  let key = keys.get(header.kid);
  if (!key) {
    const negativeUntil = firebaseCertCache.negativeKids.get(header.kid) || 0;
    if (negativeUntil > Date.now()) throw httpError(401, "ID token kaliti topilmadi");
    const cooldownUntil = firebaseCertCache.nextForcedRefreshAt;
    const refreshWasCoolingDown = !!firebaseCertCache.keys && Date.now() < cooldownUntil;
    keys = await getFirebasePublicKeys(true);
    key = keys.get(header.kid);
    if (!key) {
      if (firebaseCertCache.negativeKids.size >= 64) {
        const oldest = firebaseCertCache.negativeKids.keys().next();
        if (!oldest.done) firebaseCertCache.negativeKids.delete(oldest.value);
      }
      const expiresAt = refreshWasCoolingDown
        ? Math.max(Date.now() + 1000, cooldownUntil)
        : Date.now() + JWKS_NEGATIVE_TTL_MS;
      firebaseCertCache.negativeKids.set(header.kid, expiresAt);
    }
  }
  if (!key) throw httpError(401, "ID token kaliti topilmadi");

  const signed = new TextEncoder().encode(parts[0] + "." + parts[1]);
  const signature = base64UrlToBytes(parts[2]);
  const valid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    signature,
    signed
  );
  if (!valid) throw httpError(401, "ID token imzosi noto'g'ri");

  const projectId = String(env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID);
  const now = Math.floor(Date.now() / 1000);
  const iat = Number(claims.iat);
  const exp = Number(claims.exp);
  if (claims.aud !== projectId || claims.iss !== "https://securetoken.google.com/" + projectId) {
    throw httpError(401, "ID token loyiha ma'lumoti noto'g'ri");
  }
  if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128) {
    throw httpError(401, "ID token sub noto'g'ri");
  }
  if (!Number.isFinite(iat) || !Number.isFinite(exp) || exp <= iat) {
    throw httpError(401, "ID token vaqti noto'g'ri");
  }
  if (iat > now + CLOCK_SKEW_SECONDS || exp < now - CLOCK_SKEW_SECONDS) {
    throw httpError(401, "ID token eskirgan yoki kelajakdan");
  }
  if (claims.nbf != null && Number(claims.nbf) > now + CLOCK_SKEW_SECONDS) {
    throw httpError(401, "ID token hali amal qilmaydi");
  }
  if (claims.auth_time != null) {
    const authTime = Number(claims.auth_time);
    if (!Number.isFinite(authTime) || authTime > now + CLOCK_SKEW_SECONDS) {
      throw httpError(401, "ID token auth_time noto'g'ri");
    }
  }
  requireSafeUid(claims.sub, 401);
  return claims;
}

function base64UrlToBytes(value) {
  let b64 = String(value).replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  let bin;
  try {
    bin = atob(b64);
  } catch (_) {
    throw httpError(401, "base64url noto'g'ri");
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
  if (googleTokenCache.token && Date.now() < googleTokenCache.expiresAt) {
    return googleTokenCache.token;
  }
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
  if (!res.ok || !j || !j.access_token) {
    throw new Error("access_token olinmadi: " + JSON.stringify(j));
  }
  const ttl = Math.max(60, parseInt(j.expires_in || "3600", 10) - 60);
  googleTokenCache.token = String(j.access_token);
  googleTokenCache.expiresAt = Date.now() + ttl * 1000;
  return googleTokenCache.token;
}

// ===================== RTDB REST yordamchilari =====================
// RTDB ketma-ket raqamli kalitlarni MASSIV, "teshikli" bo'lsa OBYEKT qilib
// qaytaradi. Ikki shaklni bitta {key, val} ro'yxatiga keltiramiz — shunda
// yozish manzili (`products/<key>/stock`) har ikki holatda ham to'g'ri bo'ladi.
function toEntries(raw) {
  const out = [];
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] && typeof raw[i] === "object") out.push({ key: String(i), val: raw[i] });
    }
    return out;
  }
  if (typeof raw === "object") {
    for (const k of Object.keys(raw)) {
      if (raw[k] && typeof raw[k] === "object") out.push({ key: k, val: raw[k] });
    }
  }
  return out;
}

function rtdbUrl(dbUrl, path) {
  const cleanPath = String(path || "").replace(/^\/+|\/+$/g, "");
  return dbUrl.replace(/\/$/, "") + "/" + (cleanPath ? cleanPath : "") + ".json";
}

async function rtdbRequest(dbUrl, path, token, options) {
  const opts = options || {};
  const headers = new Headers(opts.headers || {});
  headers.set("Authorization", "Bearer " + token);
  if (opts.body != null && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  try {
    return await fetch(rtdbUrl(dbUrl, path), { ...opts, headers });
  } catch (_) {
    const method = String(opts.method || "GET").toUpperCase();
    const ambiguous = method !== "GET" && method !== "HEAD";
    throw httpError(503, ambiguous ? "RTDB yozuvi noaniq" : "RTDB tarmoq xatosi", {
      retryable: true,
      ambiguous,
    });
  }
}

async function rtdbGet(dbUrl, path, token) {
  const response = await rtdbRequest(dbUrl, path, token, { method: "GET" });
  if (!response.ok) throw httpError(502, "RTDB o'qish xatosi", { dbStatus: response.status });
  return await response.json();
}

async function rtdbGetEtag(dbUrl, path, token) {
  const response = await rtdbRequest(dbUrl, path, token, {
    method: "GET",
    headers: { "X-Firebase-ETag": "true" },
  });
  if (!response.ok) throw httpError(502, "RTDB ETag o'qish xatosi", { dbStatus: response.status });
  const etag = response.headers.get("ETag");
  if (!etag) throw httpError(502, "RTDB ETag qaytarmadi");
  return { value: await response.json(), etag };
}

async function rtdbPut(dbUrl, path, val, token, etag) {
  const headers = {};
  if (etag) headers["If-Match"] = etag;
  return await rtdbRequest(dbUrl, path, token, {
    method: "PUT",
    headers,
    body: JSON.stringify(val),
  });
}

async function rtdbPatch(dbUrl, path, val, token) {
  const response = await rtdbRequest(dbUrl, path, token, {
    method: "PATCH",
    body: JSON.stringify(val),
  });
  if (!response.ok) throw httpError(502, "RTDB yozish xatosi", { dbStatus: response.status });
  return response;
}

async function rtdbPost(dbUrl, path, val, token) {
  const response = await rtdbRequest(dbUrl, path, token, {
    method: "POST",
    body: JSON.stringify(val),
  });
  if (!response.ok) throw httpError(502, "RTDB yozish xatosi", { dbStatus: response.status });
  return response;
}

async function rtdbCreateIfNull(dbUrl, path, val, token, matches) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await rtdbGetEtag(dbUrl, path, token);
    if (current.value != null) {
      if (matches && !matches(current.value)) throw httpError(409, "mavjud yozuv mos emas");
      return { created: false, value: current.value };
    }
    let response;
    try {
      response = await rtdbPut(dbUrl, path, val, token, current.etag);
    } catch (err) {
      const after = await rtdbGet(dbUrl, path, token);
      if (after != null && (!matches || matches(after))) return { created: false, value: after };
      throw err;
    }
    if (response.status === 412) continue;
    if (!response.ok) throw httpError(502, "RTDB shartli yaratish xatosi", { dbStatus: response.status });
    return { created: true, value: val };
  }
  throw httpError(409, "parallel o'zgarish, qayta urinib ko'ring");
}

async function rtdbEtagMutate(dbUrl, path, token, mutate, maxRetries) {
  const tries = maxRetries || 8;
  for (let attempt = 0; attempt < tries; attempt++) {
    const current = await rtdbGetEtag(dbUrl, path, token);
    const decision = await mutate(current.value);
    if (decision && decision.abort) return { committed: false, value: current.value, result: decision.result };
    const nextValue = decision && Object.prototype.hasOwnProperty.call(decision, "value")
      ? decision.value
      : decision;
    const response = await rtdbPut(dbUrl, path, nextValue, token, current.etag);
    if (response.status === 412) continue;
    if (!response.ok) throw httpError(502, "RTDB shartli yozish xatosi", { dbStatus: response.status });
    return { committed: true, value: nextValue, result: decision && decision.result };
  }
  throw httpError(409, "parallel o'zgarish, qayta urinib ko'ring");
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


// ===================== Secure JSON API helpers =====================
function getDbContext(env) {
  return {
    dbUrl: String(env.FIREBASE_DB_URL || DEFAULT_DB_URL).replace(/\/$/, ""),
    env,
  };
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function cleanText(value, maxLength, required) {
  let text = value == null ? "" : String(value);
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (required && !text) throw httpError(400, "majburiy matn maydoni bo'sh");
  if (text.length > maxLength) throw httpError(400, "matn maydoni juda uzun");
  return text;
}

function safeInteger(value, name, min, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw httpError(400, name + " noto'g'ri");
  }
  return number;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return toHex(digest);
}

function normalizeOrderIntent(body) {
  const attemptId = cleanText(body.attemptId, 128, true);
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(attemptId)) {
    throw httpError(400, "attemptId 8-128 ta harf, raqam, _ yoki - bo'lishi kerak");
  }
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 60) {
    throw httpError(400, "items 1-60 qator bo'lishi kerak");
  }

  const aggregated = new Map();
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw httpError(400, "item noto'g'ri");
    const id = cleanText(raw.id, 80, true);
    if (/[.#$\[\]/]/.test(id)) throw httpError(400, "mahsulot id noto'g'ri");
    const size = cleanText(raw.size == null ? "" : raw.size, 40, false);
    const qty = safeInteger(raw.qty, "qty", 1, 100);
    const key = id + "\u0000" + size;
    const previous = aggregated.get(key);
    const totalQty = (previous ? previous.qty : 0) + qty;
    if (totalQty > 100) throw httpError(400, "bir mahsulot miqdori juda ko'p");
    aggregated.set(key, { id, size, qty: totalQty });
  }
  const items = Array.from(aggregated.values()).sort((a, b) =>
    (a.id + "\u0000" + a.size).localeCompare(b.id + "\u0000" + b.size)
  );

  const customerRaw = body.customer && typeof body.customer === "object" ? body.customer : {};
  const deliveryRaw = body.delivery && typeof body.delivery === "object" ? body.delivery : {};
  const paymentRaw = body.payment && typeof body.payment === "object" ? body.payment : {};
  const customer = {
    name: cleanText(customerRaw.name, 100, false),
    phone: cleanText(customerRaw.phone, 40, false),
    address: cleanText(customerRaw.address, 300, false),
    username: cleanText(customerRaw.username, 64, false).replace(/^@+/, ""),
  };
  if (customer.phone && !/^[+0-9()\-\s]{5,40}$/.test(customer.phone)) {
    throw httpError(400, "telefon formati noto'g'ri");
  }
  const delivery = {
    method: cleanText(deliveryRaw.method || body.deliveryMethod || "delivery", 40, true),
    address: cleanText(deliveryRaw.address || customer.address, 300, false),
    mapLink: cleanText(deliveryRaw.mapLink || body.deliveryMapLink, 500, false),
    note: cleanText(deliveryRaw.note, 500, false),
  };
  if (delivery.mapLink) {
    let parsed;
    try { parsed = new URL(delivery.mapLink); } catch (_) { throw httpError(400, "mapLink noto'g'ri"); }
    if (parsed.protocol !== "https:") throw httpError(400, "mapLink faqat https bo'lishi kerak");
  }
  const payment = {
    method: cleanText(paymentRaw.method || body.paymentMethod || "cash", 32, true),
    note: cleanText(paymentRaw.note, 200, false),
  };
  // payment.method — inson o'qiydigan yorliq bo'lishi mumkin (masalan
  //  "Karta orqali o'tkazma", "Payme/Click ilova", "Naqd pul (yetkazilganda)").
  //  U faqat SAQLANADI/KO'RSATILADI, RTDB yo'lida ISHLATILMAYDI. cleanText
  //  boshqaruv belgilarini olib tashlagan va uzunlikni cheklagan (<=32);
  //  qo'shimcha qat'iy regex buyurtmani BLOKLAB qo'yardi — shuning uchun
  //  faqat bo'sh emasligini talab qilamiz.
  if (!payment.method) throw httpError(400, "payment.method bo'sh");
  // delivery.method — mashina kodi (delivery/courier/bts). Yo'lda ishlatilmaydi.
  if (!/^[A-Za-z0-9_ .-]{1,40}$/.test(delivery.method)) throw httpError(400, "delivery.method noto'g'ri");

  const cashbackRequested = body.cashbackRequested == null
    ? 0
    : safeInteger(body.cashbackRequested, "cashbackRequested", 0, 1000000000);
  return { attemptId, items, cashbackRequested, customer, delivery, payment };
}

function loyaltyAvailable(account) {
  return Math.max(0,
    (Number(account.earned) || 0) +
    (Number(account.refunded) || 0) -
    (Number(account.spent) || 0) -
    (Number(account.reversed) || 0)
  );
}

async function ensureLoyaltyAccount(ctx, token, uid) {
  uid = requireSafeUid(uid, 400);
  const path = "loyalty_accounts/" + uid;
  const phase2 = await rtdbGet(ctx.dbUrl, "users/" + uid + "/phase2", token);
  const bootstrap = phase2 && typeof phase2 === "object" ? phase2 : {};
  const result = await rtdbEtagMutate(ctx.dbUrl, path, token, (current) => {
    if (current && typeof current === "object") return { abort: true, result: current };
    const value = {
      version: 0,
      earned: Math.max(0, Number(bootstrap.cashbackTotal) || 0),
      spent: Math.max(0, Number(bootstrap.cashbackSpent) || 0),
      refunded: Math.max(0, Number(bootstrap.cashbackRefunded) || 0),
      reversed: 0,
      ops: {},
      bootstrappedAt: Date.now(),
    };
    return { value, result: value };
  });
  return result.result || result.value;
}

function loyaltyProjection(account) {
  const earned = Math.max(0, Math.round(Number(account.earned) || 0));
  const refunded = Math.max(0, Math.round(Number(account.refunded) || 0));
  const reversed = Math.max(0, Math.round(Number(account.reversed) || 0));
  // ⚠️ Proyeksiya mijoz (index.html Phase2) balans formulasiga AYNAN mos:
  //    balans = cashbackTotal + cashbackRefunded - cashbackSpent.
  //    Shuning uchun cashbackTotal = "umr bo'yi yig'ilgan" (earned) minus
  //    reversed; refunded ALOHIDA cashbackRefunded'da beriladi (ikki marta
  //    hisoblanmasligi uchun cashbackTotal'ga QO'SHILMAYDI).
  return {
    version: Math.max(0, Math.round(Number(account.version) || 0)),
    cashbackTotal: Math.max(0, earned - reversed),
    cashbackSpent: Math.max(0, Math.round(Number(account.spent) || 0)),
    cashbackRefunded: refunded,
    balanceFormula: "cashbackTotal+cashbackRefunded-cashbackSpent",
  };
}

async function writeLoyaltyProjection(ctx, token, uid, account) {
  const projection = loyaltyProjection(account);
  await rtdbEtagMutate(ctx.dbUrl, "users/" + requireSafeUid(uid, 400) + "/phase2", token, (current) => {
    const phase2 = current && typeof current === "object" ? cloneJson(current) : {};
    const existing = phase2.loyaltyProjection && typeof phase2.loyaltyProjection === "object"
      ? phase2.loyaltyProjection
      : null;
    if (existing && Number(existing.version) > projection.version) {
      return { abort: true, result: existing };
    }
    phase2.loyaltyProjection = projection;
    phase2.cashbackTotal = projection.cashbackTotal;
    phase2.cashbackSpent = projection.cashbackSpent;
    phase2.cashbackRefunded = projection.cashbackRefunded;
    return { value: phase2, result: projection };
  });
  return projection;
}

async function mutateLoyalty(ctx, token, uid, operationKey, apply) {
  uid = requireSafeUid(uid, 400);
  await ensureLoyaltyAccount(ctx, token, uid);
  const result = await rtdbEtagMutate(ctx.dbUrl, "loyalty_accounts/" + uid, token, (current) => {
    const account = current && typeof current === "object" ? cloneJson(current) : null;
    if (!account) throw httpError(500, "cashback hisobi topilmadi");
    // These operation claims intentionally remain on the account: balance mutation and
    // idempotency must share one ETag write. Removing a claim before an equally atomic,
    // durable replacement exists could double-credit an old retry.
    account.ops = account.ops && typeof account.ops === "object" ? account.ops : {};
    if (account.ops[operationKey]) {
      return { abort: true, result: { account, operation: account.ops[operationKey], duplicate: true } };
    }
    const operation = apply(account);
    account.version = Math.max(0, Number(account.version) || 0) + 1;
    account.ops[operationKey] = { ...operation, version: account.version, at: Date.now() };
    account.updatedAt = Date.now();
    return { value: account, result: { account, operation: account.ops[operationKey], duplicate: false } };
  });
  return result.result;
}

async function buildOrderQuote(ctx, token, uid, intent, payloadHash) {
  const [productsRaw, ordersRaw, profileRaw, manualVip] = await Promise.all([
    rtdbGet(ctx.dbUrl, "products", token),
    rtdbGet(ctx.dbUrl, "users/" + uid + "/orders", token),
    rtdbGet(ctx.dbUrl, "users/" + uid + "/profile", token),
    rtdbGet(ctx.dbUrl, "users/" + uid + "/profile/vip/manual", token),
  ]);
  const products = toEntries(productsRaw);
  if (!products.length) throw httpError(503, "mahsulotlar mavjud emas");
  const quotedItems = [];
  let total = 0;

  for (let index = 0; index < intent.items.length; index++) {
    const requested = intent.items[index];
    const hit = products.find((entry) => String(entry.val.id) === requested.id);
    if (!hit || hit.val.is_draft === true) {
      throw httpError(409, "mahsulot mavjud emas", {
        shortages: [{ id: requested.id, name: requested.id, size: requested.size || undefined, available: 0, requested: requested.qty }],
      });
    }
    const product = hit.val;
    const price = Number(product.price);
    if (!Number.isSafeInteger(price) || price < 0 || price > 1000000000) {
      throw httpError(409, "mahsulot narxi noto'g'ri", { productId: requested.id });
    }
    const sizeEntries = toEntries(product.sizes);
    const isSized = product.product_type === "razmerli" || sizeEntries.length > 0;
    let size = "Universal";
    let sizeKey = null;
    let available = Number(product.stock) || 0;
    if (isSized) {
      if (!requested.size || requested.size === "Universal") {
        throw httpError(400, "razmer tanlanmagan", { productId: requested.id });
      }
      const sizeHit = sizeEntries.find((entry) => String(entry.val.size) === requested.size);
      if (!sizeHit) throw httpError(400, "razmer topilmadi", { productId: requested.id, size: requested.size });
      size = requested.size;
      sizeKey = sizeHit.key;
      available = Math.max(0, Number(sizeHit.val.stock) || 0);
    } else if (requested.size && requested.size !== "Universal") {
      throw httpError(400, "bu mahsulotda razmer yo'q", { productId: requested.id });
    }
    const lineTotal = price * requested.qty;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total + lineTotal)) {
      throw httpError(400, "buyurtma summasi juda katta");
    }
    total += lineTotal;
    quotedItems.push({
      lineKey: "i" + index,
      id: requested.id,
      name: cleanText(product.name || requested.id, 160, true),
      size,
      qty: requested.qty,
      unitPrice: price,
      lineTotal,
      productKey: hit.key,
      sizeKey,
      available,
    });
  }

  const deliveredSpend = toEntries(ordersRaw)
    .map((entry) => entry.val)
    .filter((order) => order && order.status === "yetkazildi")
    .reduce((sum, order) => sum + Math.max(0, Number(order.total) || 0), 0);
  const cbRate = deliveredSpend >= 3000000 || manualVip === "vip" ? 0.01 : 0.008;
  const now = Date.now();
  const profile = profileRaw && typeof profileRaw === "object" ? profileRaw : {};
  const customer = {
    name: intent.customer.name || cleanText(profile.name || profile.firstName, 100, false),
    phone: intent.customer.phone || cleanText(profile.phone, 40, false),
    address: intent.customer.address || cleanText(profile.address, 300, false),
    username: intent.customer.username || cleanText(profile.username, 64, false).replace(/^@+/, ""),
  };
  // Ism SHART. Telefon esa ixtiyoriy: eski oqimda ham telefonsiz buyurtma
  // o'tardi ("Raqam yozilmagan"). Telefonni majburiy qilish checkoutni butunlay
  // bloklab qo'yardi — shuning uchun faqat ismni talab qilamiz.
  if (!customer.name) throw httpError(400, "customer.name kerak");
  const orderId = String(now) + "-" + payloadHash.slice(0, 12);
  return {
    payloadHash,
    orderId,
    orderKey: uid + "_" + orderId,
    code: "A1-" + payloadHash.slice(0, 8).toUpperCase(),
    createdAt: now,
    items: quotedItems,
    total,
    cbRate,
    deliveredSpend,
    customer,
    delivery: intent.delivery,
    payment: intent.payment,
    cashbackRequested: intent.cashbackRequested,
  };
}

async function renewAttemptLease(ctx, token, attemptPath, owner, ownerGeneration) {
  const result = await rtdbEtagMutate(ctx.dbUrl, attemptPath, token, (current) => {
    if (!current || current.state !== "processing" || current.owner !== owner ||
        Number(current.ownerGeneration) !== Number(ownerGeneration)) {
      throw httpError(409, "attempt lease egasi o'zgargan", { retryable: true });
    }
    const next = { ...current, leaseUntil: Date.now() + ATTEMPT_LEASE_MS, updatedAt: Date.now() };
    return { value: next, result: next };
  });
  return result.result || result.value;
}

async function reservationMarkerKey(quote) {
  return "r_" + (await sha256Hex("reservation|" + quote.orderKey + "|" + quote.payloadHash)).slice(0, 40);
}

async function reserveQuoteItems(ctx, token, uid, attemptId, quote, attemptPath, owner, ownerGeneration) {
  const markerKey = await reservationMarkerKey(quote);
  const reserved = [];
  for (const item of quote.items) {
    await renewAttemptLease(ctx, token, attemptPath, owner, ownerGeneration);
    const result = await rtdbEtagMutate(ctx.dbUrl, "products/" + item.productKey, token, (current) => {
      if (!current || String(current.id) !== item.id) {
        return { abort: true, result: { shortage: { id: item.id, name: item.name, size: item.size, available: 0, requested: item.qty } } };
      }
      const product = cloneJson(current);
      product._orderReservations = product._orderReservations && typeof product._orderReservations === "object"
        ? product._orderReservations
        : {};
      const bucket = product._orderReservations[markerKey] && typeof product._orderReservations[markerKey] === "object"
        ? product._orderReservations[markerKey]
        : { items: {} };
      bucket.items = bucket.items && typeof bucket.items === "object" ? bucket.items : {};
      const existing = bucket.items[item.lineKey];
      if (existing && existing.state === "reserved") return { abort: true, result: { reserved: true, duplicate: true } };
      if (existing && existing.state === "released") {
        return { abort: true, result: { shortage: { id: item.id, name: item.name, size: item.size, available: 0, requested: item.qty } } };
      }

      let available;
      if (item.sizeKey !== null) {
        if (!product.sizes || !product.sizes[item.sizeKey] || String(product.sizes[item.sizeKey].size) !== item.size) {
          return { abort: true, result: { shortage: { id: item.id, name: item.name, size: item.size, available: 0, requested: item.qty } } };
        }
        available = Math.max(0, Number(product.sizes[item.sizeKey].stock) || 0);
        if (available < item.qty) return { abort: true, result: { shortage: { id: item.id, name: item.name, size: item.size, available, requested: item.qty } } };
        product.sizes[item.sizeKey].stock = available - item.qty;
        if (product.stock != null) product.stock = Math.max(0, (Number(product.stock) || 0) - item.qty);
      } else {
        available = Math.max(0, Number(product.stock) || 0);
        if (available < item.qty) return { abort: true, result: { shortage: { id: item.id, name: item.name, available, requested: item.qty } } };
        product.stock = available - item.qty;
      }
      bucket.items[item.lineKey] = { state: "reserved", qty: item.qty };
      product._orderReservations[markerKey] = bucket;
      return { value: product, result: { reserved: true } };
    });
    if (result.result && result.result.shortage) {
      await releaseQuoteItems(ctx, token, uid, attemptId, quote, attemptPath, owner, ownerGeneration);
      return { ok: false, shortages: [result.result.shortage] };
    }
    reserved.push(item.lineKey);
  }
  return { ok: true, markerKey, reserved };
}

async function releaseQuoteItems(ctx, token, uid, attemptId, quote, attemptPath, owner, ownerGeneration) {
  const markerKey = await reservationMarkerKey(quote);
  for (const item of quote.items) {
    if (attemptPath) await renewAttemptLease(ctx, token, attemptPath, owner, ownerGeneration);
    await rtdbEtagMutate(ctx.dbUrl, "products/" + item.productKey, token, (current) => {
      if (!current || !current._orderReservations || !current._orderReservations[markerKey]) {
        return { abort: true, result: { released: false } };
      }
      const product = cloneJson(current);
      const bucket = product._orderReservations[markerKey];
      const marker = bucket.items && bucket.items[item.lineKey];
      if (!marker || marker.state !== "reserved") return { abort: true, result: { released: false } };
      if (item.sizeKey !== null && product.sizes && product.sizes[item.sizeKey]) {
        product.sizes[item.sizeKey].stock = Math.max(0, Number(product.sizes[item.sizeKey].stock) || 0) + item.qty;
        if (product.stock != null) product.stock = Math.max(0, Number(product.stock) || 0) + item.qty;
      } else {
        product.stock = Math.max(0, Number(product.stock) || 0) + item.qty;
      }
      marker.state = "released";
      return { value: product, result: { released: true } };
    });
  }
  await cleanReservationMarkers(ctx, token, quote);
}

async function cleanReservationMarkers(ctx, token, quote) {
  const markerKey = await reservationMarkerKey(quote);
  for (const item of quote.items) {
    await rtdbEtagMutate(ctx.dbUrl, "products/" + item.productKey, token, (current) => {
      if (!current || !current._orderReservations || !current._orderReservations[markerKey]) {
        return { abort: true, result: { cleaned: true } };
      }
      const product = cloneJson(current);
      delete product._orderReservations[markerKey];
      if (!Object.keys(product._orderReservations).length) delete product._orderReservations;
      return { value: product, result: { cleaned: true } };
    });
  }
}

function canonicalMatchesAttempt(order, uid, quote, payloadHash) {
  return !!order && String(order.uid) === uid && String(order.id) === String(quote.orderId) && order.payloadHash === payloadHash;
}

async function buildCanonicalOrder(identity, intent, quote, payloadHash, cashbackUsed) {
  const orderItems = {};
  for (const item of quote.items) {
    const encodedKey = "l_" + (await sha256Hex(item.id + "\u0000" + item.size)).slice(0, 40);
    orderItems[encodedKey] = item.qty;
  }
  return {
    id: quote.orderId,
    code: quote.code,
    uid: identity.uid,
    status: "kutilmoqda",
    createdAt: quote.createdAt,
    date: new Date(quote.createdAt).toLocaleDateString("uz-UZ"),
    time: new Date(quote.createdAt).toLocaleTimeString("uz-UZ"),
    items: orderItems,
    itemDetails: quote.items,
    total: quote.total,
    cashbackUsed,
    payable: quote.total - cashbackUsed,
    cbRate: quote.cbRate,
    customerName: quote.customer.name,
    customerPhone: quote.customer.phone,
    customerAddress: quote.delivery.address || quote.customer.address,
    customerUsername: quote.customer.username,
    customer: quote.customer,
    delivery: quote.delivery,
    payment: quote.payment,
    deliveryMethod: quote.delivery.method,
    deliveryMapLink: quote.delivery.mapLink,
    attemptId: intent.attemptId,
    payloadHash,
  };
}

async function claimOrderAttempt(ctx, token, attemptPath, uid, attemptId, payloadHash, quote, owner) {
  const now = Date.now();
  const claim = await rtdbEtagMutate(ctx.dbUrl, attemptPath, token, (current) => {
    if (current) {
      if (current.payloadHash !== payloadHash) throw httpError(409, "attemptId boshqa payload bilan ishlatilgan");
      if (current.state === "committed" || current.state === "rejected") {
        return { abort: true, result: current };
      }
      if (current.state !== "processing") throw httpError(409, "attempt holati noto'g'ri");
      if (Number(current.leaseUntil) > now) {
        return { abort: true, result: { ...current, busy: true } };
      }
      const value = {
        ...current,
        owner,
        ownerGeneration: Math.max(0, Number(current.ownerGeneration) || 0) + 1,
        leaseUntil: now + ATTEMPT_LEASE_MS,
        updatedAt: now,
      };
      return { value, result: value };
    }
    const value = {
      state: "processing",
      uid,
      attemptId,
      payloadHash,
      quote,
      owner,
      ownerGeneration: 1,
      leaseUntil: now + ATTEMPT_LEASE_MS,
      createdAt: now,
    };
    return { value, result: value };
  });
  return claim.result || claim.value;
}

async function finalizeOrderAttempt(ctx, token, attemptPath, uid, attemptId, payloadHash, canonicalOrder) {
  const resultBody = { ok: true, committed: true, attemptId, order: canonicalOrder };
  await rtdbEtagMutate(ctx.dbUrl, attemptPath, token, (current) => {
    if (!current || current.payloadHash !== payloadHash) throw httpError(409, "attempt yakuni mos emas");
    if (current.state === "committed") return { abort: true, result: current };
    if (current.state === "rejected") throw httpError(409, "rad etilgan attempt yakunlanmaydi");
    const value = {
      state: "committed",
      uid,
      attemptId,
      payloadHash,
      orderKey: uid + "_" + canonicalOrder.id,
      result: resultBody,
      committedAt: Date.now(),
    };
    return { value, result: value };
  });
  return resultBody;
}

async function reconcileUserOrderProjection(ctx, token, identity, quote, payloadHash, canonicalOrder) {
  await rtdbEtagMutate(ctx.dbUrl, "users/" + identity.uid + "/orders/" + quote.orderId, token, (current) => {
    if (current == null) return { value: canonicalOrder, result: canonicalOrder };
    if (!current || current.payloadHash !== payloadHash || String(current.uid) !== identity.uid ||
        String(current.id) !== String(quote.orderId) || Number(current.total) !== Number(canonicalOrder.total) ||
        Number(current.cashbackUsed) !== Number(canonicalOrder.cashbackUsed) ||
        Number(current.payable) !== Number(canonicalOrder.payable)) {
      throw httpError(409, "user buyurtma proyeksiyasi mos emas");
    }
    if (String(current.status) === String(canonicalOrder.status) &&
        Number(current.statusUpdatedAt || 0) === Number(canonicalOrder.statusUpdatedAt || 0)) {
      return { abort: true, result: current };
    }
    const next = cloneJson(current);
    next.status = canonicalOrder.status;
    if (canonicalOrder.statusUpdatedAt != null) next.statusUpdatedAt = canonicalOrder.statusUpdatedAt;
    return { value: next, result: next };
  });
}

async function reconcileCommittedOrder(ctx, token, identity, intent, payloadHash, quote, canonicalOrder, attemptPath) {
  if (!canonicalMatchesAttempt(canonicalOrder, identity.uid, quote, payloadHash)) {
    throw httpError(409, "canonical buyurtma boshqa payloadga tegishli");
  }
  const orderKey = quote.orderKey;
  await reconcileUserOrderProjection(ctx, token, identity, quote, payloadHash, canonicalOrder);
  await rtdbCreateIfNull(
    ctx.dbUrl,
    "order_state/" + orderKey,
    { current: String(canonicalOrder.status || "kutilmoqda"), pending: null, version: 0, updatedAt: Date.now() },
    token,
    (value) => {
      if (!value || !ORDER_STATUSES.includes(String(value.current)) || !Number.isFinite(Number(value.version))) return false;
      if (String(value.current) === String(canonicalOrder.status)) return true;
      return !!value.pending && value.pending.target === canonicalOrder.status &&
        value.pending.from === value.current && Number.isFinite(Number(value.pending.transitionVersion));
    }
  );
  await rtdbCreateIfNull(
    ctx.dbUrl,
    "notification_outbox/" + orderKey,
    { type: "order_created", uid: identity.uid, orderKey, orderId: quote.orderId, createdAt: Date.now(), delivered: false },
    token,
    (value) => !!value && value.type === "order_created" && value.uid === identity.uid &&
      value.orderKey === orderKey && String(value.orderId) === String(quote.orderId)
  );
  const account = await ensureLoyaltyAccount(ctx, token, identity.uid);
  await writeLoyaltyProjection(ctx, token, identity.uid, account);
  await cleanReservationMarkers(ctx, token, quote);
  return await finalizeOrderAttempt(
    ctx, token, attemptPath, identity.uid, intent.attemptId, payloadHash, canonicalOrder
  );
}

async function handleOrderCommit(request, env) {
  let claimed = false;
  try {
    const body = await readJsonBody(request);
    const identity = await authenticateBody(body, env);
    const intent = normalizeOrderIntent(body);
    const payloadHash = await sha256Hex(stableStringify(intent));
    const ctx = getDbContext(env);
    const token = await getAccessToken(env);
    const attemptPath = "order_attempts/" + identity.uid + "/" + intent.attemptId;

    let existing = await rtdbGet(ctx.dbUrl, attemptPath, token);
    if (existing) {
      if (existing.payloadHash !== payloadHash) throw httpError(409, "attemptId boshqa payload bilan ishlatilgan");
      if (existing.state === "committed" && existing.result) return json(existing.result);
      if (existing.state === "rejected") throw httpError(409, existing.error || "buyurtma rad etilgan", { shortages: existing.shortages || [] });
      if (existing.quote) {
        const canonical = await rtdbGet(ctx.dbUrl, "orders/" + existing.quote.orderKey, token);
        if (canonical) {
          const reconciled = await reconcileCommittedOrder(
            ctx, token, identity, intent, payloadHash, existing.quote, canonical, attemptPath
          );
          return json(reconciled);
        }
      }
    }

    let quote = existing && existing.quote;
    if (!quote) quote = await buildOrderQuote(ctx, token, identity.uid, intent, payloadHash);
    const owner = randomOwnerToken();
    existing = await claimOrderAttempt(
      ctx, token, attemptPath, identity.uid, intent.attemptId, payloadHash, quote, owner
    );
    if (existing.state === "committed" && existing.result) return json(existing.result);
    if (existing.state === "rejected") throw httpError(409, existing.error || "buyurtma rad etilgan", { shortages: existing.shortages || [] });
    if (existing.busy || existing.owner !== owner) {
      throw httpError(503, "attempt bajarilmoqda; ayni attemptId bilan qayta urinib ko'ring", { retryable: true });
    }
    claimed = true;
    quote = existing.quote;

    const canonicalBeforeReserve = await rtdbGet(ctx.dbUrl, "orders/" + quote.orderKey, token);
    if (canonicalBeforeReserve) {
      const reconciled = await reconcileCommittedOrder(
        ctx, token, identity, intent, payloadHash, quote, canonicalBeforeReserve, attemptPath
      );
      return json(reconciled);
    }

    const stock = await reserveQuoteItems(
      ctx, token, identity.uid, intent.attemptId, quote, attemptPath, owner, existing.ownerGeneration
    );
    if (!stock.ok) {
      await rtdbEtagMutate(ctx.dbUrl, attemptPath, token, (current) => {
        if (current && current.payloadHash === payloadHash && current.state === "processing" &&
            current.owner === owner && Number(current.ownerGeneration) === Number(existing.ownerGeneration)) {
          const next = {
            state: "rejected", uid: identity.uid, attemptId: intent.attemptId, payloadHash,
            error: "stock", shortages: stock.shortages, rejectedAt: Date.now(),
          };
          return { value: next, result: next };
        }
        return { abort: true, result: current };
      });
      throw httpError(409, "stock", { shortages: stock.shortages });
    }

    await renewAttemptLease(ctx, token, attemptPath, owner, existing.ownerGeneration);
    const spendKey = "spend_" + (await sha256Hex(quote.orderKey)).slice(0, 40);
    const spend = await mutateLoyalty(ctx, token, identity.uid, spendKey, (account) => {
      const amount = Math.min(quote.cashbackRequested, quote.total, loyaltyAvailable(account));
      account.spent = Math.max(0, Number(account.spent) || 0) + amount;
      return { type: "spend", amount, orderKey: quote.orderKey };
    });
    const cashbackUsed = Math.max(0, Number(spend.operation.amount) || 0);
    await renewAttemptLease(ctx, token, attemptPath, owner, existing.ownerGeneration);
    const proposedOrder = await buildCanonicalOrder(identity, intent, quote, payloadHash, cashbackUsed);
    const canonicalCommit = await rtdbCreateIfNull(
      ctx.dbUrl,
      "orders/" + quote.orderKey,
      proposedOrder,
      token,
      (value) => canonicalMatchesAttempt(value, identity.uid, quote, payloadHash)
    );
    const canonicalOrder = canonicalCommit.value;
    const resultBody = await reconcileCommittedOrder(
      ctx, token, identity, intent, payloadHash, quote, canonicalOrder, attemptPath
    );
    return json(resultBody, canonicalCommit.created ? 201 : 200);
  } catch (err) {
    const definitiveStockRejection = claimed && err && err.status === 409 &&
      err.extra && Array.isArray(err.extra.shortages);
    if (claimed && !definitiveStockRejection) {
      return errorResponse(httpError(503, "buyurtma qisman bajarildi; ayni attemptId bilan qayta urinib ko'ring", { retryable: true }));
    }
    return errorResponse(err);
  }
}


async function claimOrderStatus(ctx, token, orderKey, currentStatus, targetStatus, owner) {
  const path = "order_state/" + orderKey;
  const now = Date.now();
  const result = await rtdbEtagMutate(ctx.dbUrl, path, token, (raw) => {
    const state = raw && typeof raw === "object"
      ? cloneJson(raw)
      : { current: currentStatus, pending: null, version: 0 };
    if (state.pending) {
      if (Number(state.pending.leaseUntil) > now) {
        throw httpError(409, "status o'zgarishi bajarilmoqda", { retryable: true });
      }
      if (state.pending.target !== targetStatus) {
        throw httpError(409, "avvalgi status o'zgarishini shu target bilan davom ettiring", {
          pendingStatus: state.pending.target,
        });
      }
      state.pending.owner = owner;
      state.pending.ownerGeneration = Math.max(0, Number(state.pending.ownerGeneration) || 0) + 1;
      state.pending.leaseUntil = now + STATUS_LEASE_MS;
      state.updatedAt = now;
      return { value: state, result: { state, claimed: true, takeover: true } };
    }
    if (state.current === targetStatus) {
      if (currentStatus !== targetStatus) {
        throw httpError(409, "order_state va canonical status mos emas", { canonicalStatus: currentStatus });
      }
      return { abort: true, result: { state, already: true } };
    }
    if (currentStatus === targetStatus) {
      state.current = targetStatus;
      state.pending = null;
      state.updatedAt = now;
      return { value: state, result: { state, already: true, reconciled: true } };
    }
    if (state.current !== currentStatus) {
      throw httpError(409, "canonical status va transition holati mos emas");
    }
    const allowed = ORDER_TRANSITIONS[state.current] || [];
    if (!allowed.includes(targetStatus)) {
      throw httpError(409, "status o'tishi mumkin emas", { from: state.current, to: targetStatus });
    }
    const transitionVersion = (Number(state.version) || 0) + 1;
    state.pending = {
      target: targetStatus,
      from: state.current,
      owner,
      ownerGeneration: 1,
      transitionVersion,
      leaseUntil: now + STATUS_LEASE_MS,
    };
    state.version = transitionVersion;
    state.updatedAt = now;
    return { value: state, result: { state, claimed: true } };
  });
  return result.result;
}

function retryableInventoryConflict(message, extra) {
  throw httpError(409, message, { retryable: true, ...(extra || {}) });
}

async function resolveOrderStockItems(ctx, token, order) {
  const products = toEntries(await rtdbGet(ctx.dbUrl, "products", token));
  let sourceItems;
  if (Array.isArray(order.itemDetails) && order.itemDetails.length) {
    sourceItems = order.itemDetails;
  } else {
    const rawItems = order.items && typeof order.items === "object" ? order.items : {};
    sourceItems = Object.keys(rawItems).map((key, index) => {
      const separator = key.indexOf("||");
      if (separator <= 0) retryableInventoryConflict("buyurtma mahsulotlarini tiklab bo'lmaydi", { itemKey: key });
      return {
        lineKey: "legacy_" + index,
        id: key.slice(0, separator),
        size: key.slice(separator + 2) || "Universal",
        qty: rawItems[key],
      };
    });
  }
  if (!sourceItems.length) retryableInventoryConflict("buyurtmada tiklanadigan mahsulot yo'q");

  const out = [];
  const lineKeys = new Set();
  for (let index = 0; index < sourceItems.length; index++) {
    const item = sourceItems[index];
    if (!item || typeof item !== "object") retryableInventoryConflict("buyurtma mahsuloti noto'g'ri", { index });
    const id = String(item.id || "");
    const qty = Number(item.qty);
    const lineKey = String(item.lineKey || ("i" + index));
    const size = String(item.size || "Universal");
    if (!id || id.length > 200 || !Number.isSafeInteger(qty) || qty <= 0 ||
        !/^[A-Za-z0-9_-]{1,80}$/.test(lineKey) || lineKeys.has(lineKey)) {
      retryableInventoryConflict("buyurtma mahsuloti yoki miqdori noto'g'ri", { index, id });
    }
    lineKeys.add(lineKey);

    const idMatches = products.filter((entry) => String(entry.val.id) === id);
    if (idMatches.length !== 1) {
      retryableInventoryConflict("mahsulot id bo'yicha topilmadi", { productId: id });
    }
    const storedProduct = item.productKey != null
      ? products.find((entry) => entry.key === String(item.productKey))
      : null;
    const productHit = storedProduct && String(storedProduct.val.id) === id ? storedProduct : idMatches[0];
    const sizeEntries = toEntries(productHit.val.sizes);
    const isSized = productHit.val.product_type === "razmerli" || sizeEntries.length > 0;
    let sizeKey = null;
    if (size !== "Universal") {
      const sizeMatches = sizeEntries.filter((entry) => String(entry.val.size) === size);
      if (sizeMatches.length !== 1) {
        retryableInventoryConflict("mahsulot razmeri topilmadi", { productId: id, size });
      }
      sizeKey = sizeMatches[0].key;
    } else if (isSized) {
      retryableInventoryConflict("razmerli mahsulot razmeri yo'q", { productId: id });
    }
    out.push({
      lineKey,
      id,
      name: String(productHit.val.name || item.name || id),
      size,
      qty,
      productKey: productHit.key,
      sizeKey,
    });
  }
  return out;
}

async function restockOperationKey(orderKey) {
  return "r_" + (await sha256Hex("restock|" + orderKey)).slice(0, 36);
}

async function restockOrderOnce(ctx, token, orderKey, items, owner, pending) {
  const opKey = await restockOperationKey(orderKey);
  const results = [];
  for (const item of items) {
    if (!Number.isSafeInteger(item.qty) || item.qty <= 0) {
      retryableInventoryConflict("tiklash miqdori noto'g'ri", { productId: item.id });
    }
    await renewStatusLease(ctx, token, orderKey, owner, pending);
    const mutation = await rtdbEtagMutate(ctx.dbUrl, "products/" + item.productKey, token, (current) => {
      if (!current || String(current.id) !== String(item.id)) {
        retryableInventoryConflict("mahsulot joyi o'zgargan", { productId: item.id });
      }
      const product = cloneJson(current);
      product._orderOperations = product._orderOperations && typeof product._orderOperations === "object"
        ? product._orderOperations
        : {};
      const marker = product._orderOperations[opKey] && typeof product._orderOperations[opKey] === "object"
        ? product._orderOperations[opKey]
        : { items: {} };
      marker.items = marker.items && typeof marker.items === "object" ? marker.items : {};
      if (marker.items[item.lineKey] && marker.items[item.lineKey].done === true) {
        return { abort: true, result: { duplicate: true, productKey: item.productKey, lineKey: item.lineKey } };
      }
      if (item.sizeKey !== null) {
        if (!product.sizes || !product.sizes[item.sizeKey] ||
            String(product.sizes[item.sizeKey].size) !== item.size) {
          retryableInventoryConflict("mahsulot razmeri o'zgargan", { productId: item.id, size: item.size });
        }
        product.sizes[item.sizeKey].stock = Math.max(0, Number(product.sizes[item.sizeKey].stock) || 0) + item.qty;
        if (product.stock != null) product.stock = Math.max(0, Number(product.stock) || 0) + item.qty;
      } else {
        const sizeEntries = toEntries(product.sizes);
        if (item.size !== "Universal" || product.product_type === "razmerli" || sizeEntries.length) {
          retryableInventoryConflict("mahsulot razmer turi o'zgargan", { productId: item.id });
        }
        product.stock = Math.max(0, Number(product.stock) || 0) + item.qty;
      }
      marker.items[item.lineKey] = { done: true, qty: item.qty };
      product._orderOperations[opKey] = marker;
      return { value: product, result: { restocked: true, productKey: item.productKey, lineKey: item.lineKey } };
    });
    const lineResult = mutation.result;
    if (!lineResult || (!lineResult.restocked && !lineResult.duplicate)) {
      retryableInventoryConflict("mahsulot stoki tiklanmadi", { productId: item.id });
    }
    results.push(lineResult);
  }
  if (results.length !== items.length) retryableInventoryConflict("barcha mahsulot stoki tiklanmadi");
  return { opKey, results };
}

async function cleanRestockMarkers(ctx, token, orderKey, touchedItems) {
  const opKey = await restockOperationKey(orderKey);
  const products = toEntries(await rtdbGet(ctx.dbUrl, "products", token));
  const productKeys = new Set((touchedItems || []).map((item) => String(item.productKey)));
  for (const entry of products) {
    if (entry.val._orderOperations && entry.val._orderOperations[opKey]) productKeys.add(entry.key);
  }
  for (const productKey of productKeys) {
    await rtdbEtagMutate(ctx.dbUrl, "products/" + productKey, token, (current) => {
      if (!current || !current._orderOperations || !current._orderOperations[opKey]) {
        return { abort: true, result: { cleaned: true } };
      }
      const product = cloneJson(current);
      delete product._orderOperations[opKey];
      if (!Object.keys(product._orderOperations).length) delete product._orderOperations;
      return { value: product, result: { cleaned: true } };
    });
  }
}

async function applyStatusLoyalty(ctx, token, uid, order, targetStatus) {
  const orderKeyHash = (await sha256Hex(String(order.uid) + "_" + String(order.id))).slice(0, 36);
  if (targetStatus === "yetkazildi") {
    const amount = Math.max(0, Math.round((Number(order.payable) || 0) * (Number(order.cbRate) || 0)));
    return await mutateLoyalty(ctx, token, uid, "earn_" + orderKeyHash, (account) => {
      account.earned = Math.max(0, Number(account.earned) || 0) + amount;
      return { type: "earn", amount, orderId: String(order.id) };
    });
  }
  if (targetStatus === "bekor_qilingan") {
    return await mutateLoyalty(ctx, token, uid, "cancel_" + orderKeyHash, (account) => {
      const cashbackRefund = Math.max(0, Number(order.cashbackUsed) || 0);
      const earnOp = account.ops && account.ops["earn_" + orderKeyHash];
      const earnedReversal = earnOp ? Math.max(0, Number(earnOp.amount) || 0) : 0;
      account.refunded = Math.max(0, Number(account.refunded) || 0) + cashbackRefund;
      account.reversed = Math.max(0, Number(account.reversed) || 0) + earnedReversal;
      return { type: "cancel", cashbackRefund, earnedReversal, orderId: String(order.id) };
    });
  }
  const account = await ensureLoyaltyAccount(ctx, token, uid);
  return { account, operation: { type: "status", amount: 0 }, duplicate: true };
}

async function renewStatusLease(ctx, token, orderKey, owner, pending) {
  const result = await rtdbEtagMutate(ctx.dbUrl, "order_state/" + orderKey, token, (current) => {
    if (!current || !current.pending || current.pending.owner !== owner ||
        Number(current.pending.transitionVersion) !== Number(pending.transitionVersion) ||
        Number(current.pending.ownerGeneration) !== Number(pending.ownerGeneration)) {
      throw httpError(409, "status lease egasi o'zgargan", { retryable: true });
    }
    const next = cloneJson(current);
    next.pending.leaseUntil = Date.now() + STATUS_LEASE_MS;
    next.updatedAt = Date.now();
    return { value: next, result: next };
  });
  return result.result || result.value;
}

async function commitCanonicalStatus(ctx, token, orderPath, uid, orderId, fromStatus, targetStatus) {
  const result = await rtdbEtagMutate(ctx.dbUrl, orderPath, token, (current) => {
    if (!current || String(current.uid) !== uid || String(current.id) !== orderId) {
      throw httpError(404, "buyurtma topilmadi");
    }
    const currentStatus = String(current.status || "kutilmoqda");
    if (currentStatus === targetStatus) return { abort: true, result: { order: current, duplicate: true } };
    if (currentStatus !== fromStatus) {
      throw httpError(409, "canonical status boshqa holatga o'tgan", { currentStatus });
    }
    const next = cloneJson(current);
    next.status = targetStatus;
    next.statusUpdatedAt = Date.now();
    return { value: next, result: { order: next, duplicate: false } };
  });
  return result.result;
}

async function completeStatusTransition(ctx, token, orderKey, owner, pending, targetStatus) {
  const result = await rtdbEtagMutate(ctx.dbUrl, "order_state/" + orderKey, token, (current) => {
    if (current && current.current === targetStatus && !current.pending) {
      return { abort: true, result: { state: current, duplicate: true } };
    }
    if (!current || !current.pending || current.pending.owner !== owner ||
        Number(current.pending.transitionVersion) !== Number(pending.transitionVersion) ||
        Number(current.pending.ownerGeneration) !== Number(pending.ownerGeneration) ||
        current.pending.target !== targetStatus) {
      throw httpError(409, "status yakunlovchisi eskirgan", { retryable: true });
    }
    const next = {
      current: targetStatus,
      pending: null,
      version: Number(current.version) || Number(pending.transitionVersion),
      lastTransition: {
        from: pending.from,
        target: targetStatus,
        transitionVersion: Number(pending.transitionVersion),
      },
      updatedAt: Date.now(),
    };
    return { value: next, result: { state: next, duplicate: false } };
  });
  return result.result;
}

async function reconcileUserOrderStatus(ctx, token, uid, orderId, fromStatus, targetStatus) {
  await rtdbEtagMutate(ctx.dbUrl, "users/" + uid + "/orders/" + orderId, token, (current) => {
    if (!current) return { abort: true, result: null };
    const status = String(current.status || "kutilmoqda");
    if (status === targetStatus) return { abort: true, result: current };
    if (status !== fromStatus) return { abort: true, result: current };
    const next = cloneJson(current);
    next.status = targetStatus;
    next.statusUpdatedAt = Date.now();
    return { value: next, result: next };
  });
}

async function publishStatusProjections(ctx, token, uid, orderId, orderKey, order, fromStatus, targetStatus, transitionVersion) {
  const loyalty = await applyStatusLoyalty(ctx, token, uid, order, targetStatus);
  const processed = {
    st: targetStatus,
    cb: targetStatus === "yetkazildi" ? Math.max(0, Number(loyalty.operation.amount) || 0) : 0,
    ur: targetStatus === "bekor_qilingan" ? Math.max(0, Number(loyalty.operation.cashbackRefund) || 0) : 0,
    rv: targetStatus === "bekor_qilingan" ? Math.max(0, Number(loyalty.operation.earnedReversal) || 0) : 0,
  };
  await reconcileUserOrderStatus(ctx, token, uid, orderId, fromStatus, targetStatus);
  await writeLoyaltyProjection(ctx, token, uid, loyalty.account);
  await rtdbCreateIfNull(
    ctx.dbUrl,
    "users/" + uid + "/phase2/processedOrders/" + orderId + "_v" + transitionVersion,
    processed,
    token,
    (value) => value && value.st === targetStatus
  );
  const outboxKey = orderKey + "_status_" + transitionVersion;
  await rtdbCreateIfNull(
    ctx.dbUrl,
    "notification_outbox/" + outboxKey,
    {
      type: "order_status", uid, orderKey, orderId, from: fromStatus, status: targetStatus,
      createdAt: Date.now(), delivered: false, transitionVersion,
    },
    token,
    (value) => value && value.status === targetStatus && Number(value.transitionVersion) === Number(transitionVersion)
  );
  return processed;
}

async function handleOrderStatus(request, env) {
  let claimed = false;
  try {
    const body = await readJsonBody(request);
    const identity = await authenticateBody(body, env);
    if (!getAdminIds(env).includes(identity.uid)) throw httpError(403, "faqat admin");
    const uid = requireSafeUid(cleanText(body.uid, 128, true), 400);
    const orderId = cleanText(body.orderId, 80, true);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(orderId)) throw httpError(400, "uid yoki orderId noto'g'ri");
    const status = cleanText(body.status, 32, true);
    if (!ORDER_STATUSES.includes(status)) throw httpError(400, "status noto'g'ri");

    const ctx = getDbContext(env);
    const token = await getAccessToken(env);
    const orderKey = uid + "_" + orderId;
    const orderPath = "orders/" + orderKey;
    const order = await rtdbGet(ctx.dbUrl, orderPath, token);
    if (!order || String(order.uid) !== uid || String(order.id) !== orderId) throw httpError(404, "buyurtma topilmadi");

    const owner = randomOwnerToken();
    const claim = await claimOrderStatus(
      ctx, token, orderKey, String(order.status || "kutilmoqda"), status, owner
    );
    if (claim.already) {
      const last = claim.state.lastTransition && claim.state.lastTransition.target === status
        ? claim.state.lastTransition
        : { from: status, transitionVersion: Number(claim.state.version) || 0 };
      if (status === "bekor_qilingan") {
        try {
          await cleanRestockMarkers(ctx, token, orderKey, []);
        } catch (_) {
          // Cancellation is already complete; a later duplicate request retries cleanup.
        }
      }
      const processed = await publishStatusProjections(
        ctx, token, uid, orderId, orderKey, order, last.from, status, last.transitionVersion
      );
      return json({ ok: true, duplicate: true, orderKey, status, sideEffects: processed });
    }
    claimed = true;
    const state = claim.state;
    const pending = state.pending;
    const originalStatus = pending.from;
    let stockItems = [];
    if (status === "bekor_qilingan") {
      stockItems = await resolveOrderStockItems(ctx, token, order);
      await restockOrderOnce(ctx, token, orderKey, stockItems, owner, pending);
    }
    await renewStatusLease(ctx, token, orderKey, owner, pending);
    await commitCanonicalStatus(ctx, token, orderPath, uid, orderId, originalStatus, status);
    await renewStatusLease(ctx, token, orderKey, owner, pending);
    await applyStatusLoyalty(ctx, token, uid, order, status);
    await renewStatusLease(ctx, token, orderKey, owner, pending);
    await completeStatusTransition(ctx, token, orderKey, owner, pending, status);
    if (status === "bekor_qilingan") {
      try {
        await cleanRestockMarkers(ctx, token, orderKey, stockItems);
      } catch (_) {
        // State and stock are correct; a duplicate request can reconcile marker cleanup.
      }
    }
    const processed = await publishStatusProjections(
      ctx, token, uid, orderId, orderKey, order, originalStatus, status, pending.transitionVersion
    );
    return json({ ok: true, orderKey, from: originalStatus, status, sideEffects: processed });
  } catch (err) {
    if (claimed && (!err || !Number.isInteger(err.status) || err.status >= 500)) {
      return errorResponse(httpError(503, "status qisman bajarildi; ayni so'rovni qayta yuboring", { retryable: true }));
    }
    return errorResponse(err);
  }
}

async function referralIndexesMatch(ctx, token, refUid, redeemerUid, link) {
  const [authoritative, firstIndex, secondIndex] = await Promise.all([
    rtdbGet(ctx.dbUrl, "referralRedeemed/" + redeemerUid, token),
    rtdbGet(ctx.dbUrl, "referrals/" + refUid + "/" + redeemerUid, token),
    rtdbGet(ctx.dbUrl, "users/" + refUid + "/phase2/referrals/" + redeemerUid, token),
  ]);
  const expectedPaid = link.paid === true;
  const expectedDate = Number(link.date) || 0;
  const indexMatches = (value) => !!value && value.uid === redeemerUid &&
    value.paid === expectedPaid && (Number(value.date) || 0) === expectedDate;
  return !!authoritative && String(authoritative.code) === String(link.code) &&
    String(authoritative.refUid) === refUid && indexMatches(firstIndex) && indexMatches(secondIndex);
}

async function handleReferralSecure(request, env) {
  try {
    const body = await readJsonBody(request);
    const identity = await authenticateBody(body, env);
    const code = cleanText(body.code, 40, true).toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw httpError(400, "kod noto'g'ri");
    const ctx = getDbContext(env);
    const token = await getAccessToken(env);
    const refUidRaw = await rtdbGet(ctx.dbUrl, "refcodes/" + code, token);
    if (!refUidRaw) throw httpError(404, "kod topilmadi");
    const refUid = requireSafeUid(refUidRaw, 400);
    if (refUid === identity.uid) throw httpError(400, "oz kodi");
    const now = Date.now();
    const path = "referralRedeemed/" + identity.uid;
    const claim = await rtdbEtagMutate(ctx.dbUrl, path, token, (current) => {
      if (current) {
        if (String(current.code) !== code || String(current.refUid) !== refUid) {
          throw httpError(409, "boshqa referral allaqachon ishlatilgan");
        }
        return { abort: true, result: current };
      }
      const value = { code, refUid, redeemerUid: identity.uid, date: now, paid: false, state: "pending" };
      return { value, result: value };
    });
    const link = claim.result || claim.value;
    const updates = {};
    const firstIndexPath = "referrals/" + refUid + "/" + identity.uid;
    const secondIndexPath = "users/" + refUid + "/phase2/referrals/" + identity.uid;
    updates[firstIndexPath + "/uid"] = identity.uid;
    updates[firstIndexPath + "/date"] = link.date;
    updates[firstIndexPath + "/paid"] = link.paid === true;
    updates[secondIndexPath + "/uid"] = identity.uid;
    updates[secondIndexPath + "/date"] = link.date;
    updates[secondIndexPath + "/paid"] = link.paid === true;
    try {
      await rtdbPatch(ctx.dbUrl, "", updates, token);
    } catch (_) {
      if (!await referralIndexesMatch(ctx, token, refUid, identity.uid, link)) {
        throw httpError(503, "referral indekslari yakunlanmadi", { retryable: true });
      }
    }
    return json({ ok: true, pending: link.paid !== true, paid: link.paid === true, refUid, duplicate: !claim.committed });
  } catch (err) {
    return errorResponse(err);
  }
}

function deliveredUserOrders(raw) {
  return toEntries(raw)
    .map((entry) => ({ key: entry.key, order: entry.val }))
    .filter((entry) => entry.order && entry.order.status === "yetkazildi")
    .sort((a, b) =>
      (Number(a.order.createdAt || a.order.id || a.key) || 0) -
      (Number(b.order.createdAt || b.order.id || b.key) || 0)
    );
}

async function handleReferralQualifySecure(request, env) {
  try {
    const body = await readJsonBody(request);
    const identity = await authenticateBody(body, env);
    const ctx = getDbContext(env);
    const token = await getAccessToken(env);
    const linkPath = "referralRedeemed/" + identity.uid;
    const link = await rtdbGet(ctx.dbUrl, linkPath, token);
    if (!link || !link.refUid || !link.code) throw httpError(404, "referral yoq");
    const refUid = requireSafeUid(link.refUid, 400);
    if (refUid === identity.uid) throw httpError(400, "oz kodi");
    const codeOwner = await rtdbGet(ctx.dbUrl, "refcodes/" + String(link.code), token);
    if (requireSafeUid(codeOwner, 400) !== refUid) throw httpError(409, "referral kodi egasi o'zgargan");

    const payoutPath = "referral_payouts/" + identity.uid;
    let payout = await rtdbGet(ctx.dbUrl, payoutPath, token);
    let payoutClaimCommitted = false;
    if (!payout && link.paid === true) {
      return json({
        ok: true,
        duplicate: true,
        legacyPaid: true,
        bonus: Math.max(0, Number(link.bonus) || 0),
        refUid,
        orderAmount: Math.max(0, Number(link.orderAmount) || 0),
      });
    }
    if (!payout) {
      const orders = deliveredUserOrders(
        await rtdbGet(ctx.dbUrl, "users/" + identity.uid + "/orders", token)
      );
      if (!orders.length) throw httpError(412, "serverda yetkazilgan buyurtma yoq");
      const firstProjection = orders[0];
      const firstOrderId = String(firstProjection.order.id || firstProjection.key);
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(firstOrderId) || firstProjection.key !== firstOrderId) {
        throw httpError(409, "birinchi buyurtma proyeksiyasi noto'g'ri");
      }
      const firstOrderKey = identity.uid + "_" + firstOrderId;
      const first = await rtdbGet(ctx.dbUrl, "orders/" + firstOrderKey, token);
      if (!first || String(first.uid) !== identity.uid || String(first.id) !== firstOrderId ||
          first.status !== "yetkazildi") {
        throw httpError(409, "birinchi buyurtma canonical yozuvi mos emas");
      }
      const paidAmount = Math.max(0, Number(
        first.payable != null ? first.payable : Number(first.total || 0) - Number(first.cashbackUsed || 0)
      ) || 0);
      const minimum = parseInt(env.REFERRAL_MIN_ORDER || String(DEFAULT_REFERRAL_MIN_ORDER), 10) || DEFAULT_REFERRAL_MIN_ORDER;
      if (paidAmount <= minimum) throw httpError(412, "summa yetarli emas", { need: minimum, got: paidAmount });
      const bonus = parseInt(env.REFERRAL_BONUS || String(DEFAULT_REFERRAL_BONUS), 10) || DEFAULT_REFERRAL_BONUS;
      const proposed = {
        state: "processing",
        redeemerUid: identity.uid,
        refUid,
        orderId: firstOrderId,
        orderKey: firstOrderKey,
        orderAmount: paidAmount,
        bonus,
        createdAt: Date.now(),
      };
      const claim = await rtdbCreateIfNull(
        ctx.dbUrl,
        payoutPath,
        proposed,
        token,
        (value) => value && String(value.refUid) === refUid &&
          String(value.redeemerUid) === identity.uid && String(value.orderId) === firstOrderId &&
          String(value.orderKey) === firstOrderKey && Number(value.orderAmount) === paidAmount &&
          Number(value.bonus) === bonus
      );
      payout = claim.value;
      payoutClaimCommitted = claim.created;
    }

    if (!payout || (payout.state !== "processing" && payout.state !== "paid") ||
        String(payout.refUid) !== refUid || String(payout.redeemerUid) !== identity.uid ||
        !payout.orderKey || !payout.orderId || !Number.isSafeInteger(Number(payout.orderAmount)) ||
        !Number.isSafeInteger(Number(payout.bonus)) || Number(payout.bonus) < 0) {
      throw httpError(409, "referral payout claim noto'g'ri");
    }
    const claimedBonus = Number(payout.bonus);
    const claimedAmount = Number(payout.orderAmount);
    const claimedOrderId = String(payout.orderId);
    const claimedOrderKey = String(payout.orderKey);

    const verifyQualifyingOrder = async () => {
      const order = await rtdbGet(ctx.dbUrl, "orders/" + claimedOrderKey, token);
      if (!order || String(order.uid) !== identity.uid || String(order.id) !== claimedOrderId || order.status !== "yetkazildi") {
        throw httpError(409, "qualifying buyurtma yetkazilgan holatda emas");
      }
      const actualAmount = Math.max(0, Number(
        order.payable != null ? order.payable : Number(order.total || 0) - Number(order.cashbackUsed || 0)
      ) || 0);
      if (actualAmount !== claimedAmount) throw httpError(409, "qualifying buyurtma summasi mos emas");
      return order;
    };
    await verifyQualifyingOrder();

    const loyaltyOp = "referral_" + (await sha256Hex(identity.uid)).slice(0, 36);
    const loyalty = await mutateLoyalty(ctx, token, refUid, loyaltyOp, (account) => {
      account.earned = Math.max(0, Number(account.earned) || 0) + claimedBonus;
      return { type: "referral", amount: claimedBonus, orderId: claimedOrderId, orderKey: claimedOrderKey };
    });
    if (loyalty.operation.type !== "referral" || Number(loyalty.operation.amount) !== claimedBonus ||
        String(loyalty.operation.orderId) !== claimedOrderId || String(loyalty.operation.orderKey) !== claimedOrderKey) {
      throw httpError(409, "referral loyalty operatsiyasi mos emas");
    }
    await verifyQualifyingOrder();

    const paidAt = payout.paidAt || Date.now();
    const finalized = await rtdbEtagMutate(ctx.dbUrl, payoutPath, token, (current) => {
      if (!current || String(current.refUid) !== refUid || String(current.orderKey) !== claimedOrderKey ||
          Number(current.orderAmount) !== claimedAmount || Number(current.bonus) !== claimedBonus) {
        throw httpError(409, "referral payout claim o'zgargan");
      }
      if (current.state === "paid") return { abort: true, result: current };
      const next = { ...current, state: "paid", paidAt };
      return { value: next, result: next };
    });
    payout = finalized.result || finalized.value;
    await writeLoyaltyProjection(ctx, token, refUid, loyalty.account);

    const indexValue = { uid: identity.uid, date: link.date || paidAt, paid: true, paidAt, bonus: claimedBonus };
    const updates = {};
    updates[linkPath + "/paid"] = true;
    updates[linkPath + "/paidAt"] = paidAt;
    updates[linkPath + "/bonus"] = claimedBonus;
    updates[linkPath + "/orderCode"] = claimedOrderId;
    updates[linkPath + "/orderAmount"] = claimedAmount;
    updates["referrals/" + refUid + "/" + identity.uid] = indexValue;
    updates["users/" + refUid + "/phase2/referrals/" + identity.uid] = indexValue;
    updates["users/" + refUid + "/phase2/notifications/referral_" + identity.uid] = {
      id: "referral_" + identity.uid,
      icon: "🤝",
      title: "Referral bonus!",
      text: "Do'stingiz birinchi xaridini qildi. +" + claimedBonus + " so'm cashback qo'shildi!",
      date: paidAt,
      read: false,
    };
    updates["notification_outbox/referral_" + identity.uid] = {
      type: "referral_paid", uid: refUid, redeemerUid: identity.uid,
      bonus: claimedBonus, createdAt: paidAt, delivered: false,
    };
    try {
      await rtdbPatch(ctx.dbUrl, "", updates, token);
    } catch (_) {
      const [linkAfter, firstIndex, secondIndex] = await Promise.all([
        rtdbGet(ctx.dbUrl, linkPath, token),
        rtdbGet(ctx.dbUrl, "referrals/" + refUid + "/" + identity.uid, token),
        rtdbGet(ctx.dbUrl, "users/" + refUid + "/phase2/referrals/" + identity.uid, token),
      ]);
      const indexMatches = (value) => !!value && value.uid === identity.uid && value.paid === true &&
        Number(value.date) === Number(indexValue.date) && Number(value.paidAt) === Number(paidAt) &&
        Number(value.bonus) === claimedBonus;
      if (!linkAfter || linkAfter.paid !== true || Number(linkAfter.paidAt) !== Number(paidAt) ||
          Number(linkAfter.bonus) !== claimedBonus || String(linkAfter.orderCode) !== claimedOrderId ||
          Number(linkAfter.orderAmount) !== claimedAmount || !indexMatches(firstIndex) || !indexMatches(secondIndex)) {
        throw httpError(503, "referral to'lovi proyeksiyalari yakunlanmadi", { retryable: true });
      }
    }
    return json({
      ok: true,
      bonus: claimedBonus,
      refUid,
      orderAmount: claimedAmount,
      duplicate: payout.state === "paid" && !payoutClaimCommitted,
    });
  } catch (err) {
    return errorResponse(err);
  }
}


function consumeMessageRate(identity, isAdmin) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = isAdmin ? 30 : 10;
  const current = messageRateLimits.get(identity);
  const bucket = !current || now - current.startedAt >= windowMs
    ? { startedAt: now, count: 0 }
    : current;
  bucket.count += 1;
  messageRateLimits.set(identity, bucket);
  if (messageRateLimits.size > 1000) {
    for (const [key, value] of messageRateLimits) {
      if (now - value.startedAt >= windowMs) messageRateLimits.delete(key);
      if (messageRateLimits.size <= 800) break;
    }
  }
  if (bucket.count > limit) {
    throw httpError(429, "juda ko'p xabar", { retryAfter: Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000)) });
  }
}

async function handleDeprecatedStockCommit(request, env) {
  try {
    const body = await readJsonBody(request);
    await authenticateBody(body, env);
    return json({
      ok: false,
      stockCommit: true,
      error: "stock-commit bekor qilingan; /order-commit dan foydalaning",
    }, 410);
  } catch (err) {
    const response = errorResponse(err);
    const original = await response.json();
    return json({ ...original, stockCommit: true }, response.status);
  }
}

async function handleSendMessageSecure(request, env) {
  try {
    const body = await readJsonBody(request);
    const identity = await authenticateBody(body, env);
    const allowedFields = new Set([
      "initData", "idToken", "chat_id", "text", "parse_mode",
      "disable_web_page_preview", "disable_notification",
    ]);
    for (const key of Object.keys(body)) {
      if (!allowedFields.has(key)) throw httpError(400, "ruxsat etilmagan maydon: " + key);
    }
    const chatId = cleanText(body.chat_id, 24, true);
    if (!/^-?[1-9]\d{0,19}$/.test(chatId)) throw httpError(400, "chat_id noto'g'ri");
    const text = body.text == null ? "" : String(body.text);
    if (!text.trim() || text.length > 4096 || /[\u0000\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
      throw httpError(400, "text noto'g'ri");
    }
    const adminIds = getAdminIds(env);
    const isAdmin = adminIds.includes(identity.uid);
    if (!isAdmin && chatId !== identity.uid && !adminIds.includes(chatId)) {
      throw httpError(403, "chat_id ga ruxsat yoq");
    }
    consumeMessageRate(identity.uid, isAdmin);
    const payload = { chat_id: chatId, text };
    if (body.parse_mode != null) {
      if (body.parse_mode !== "HTML" && body.parse_mode !== "MarkdownV2") throw httpError(400, "parse_mode noto'g'ri");
      payload.parse_mode = body.parse_mode;
    }
    if (typeof body.disable_web_page_preview === "boolean") payload.disable_web_page_preview = body.disable_web_page_preview;
    if (typeof body.disable_notification === "boolean") payload.disable_notification = body.disable_notification;
    if (!env.BOT_TOKEN) throw httpError(500, "BOT_TOKEN sozlanmagan");
    const telegram = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data;
    try { data = await telegram.json(); } catch (_) { data = null; }
    if (!telegram.ok || !data || data.ok !== true) {
      throw httpError(502, "Telegram xabarni qabul qilmadi", {
        telegramStatus: telegram.status,
        telegramError: data && data.description ? String(data.description).slice(0, 300) : undefined,
      });
    }
    return json(data);
  } catch (err) {
    const response = errorResponse(err);
    if (response.status === 429) response.headers.set("Retry-After", String(err.extra && err.extra.retryAfter || 60));
    return response;
  }
}
