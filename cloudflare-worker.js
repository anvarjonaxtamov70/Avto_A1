// =============================================================
//  AVTO A1 — Telegram xabar yuboruvchi PROXY (Cloudflare Worker)
// =============================================================
//  Bu kichik "pochtachi". Brauzer unga xabarni beradi,
//  u esa MAXFIY tokenni o'zi qo'shib Telegram'ga yuboradi.
//  Token shu yerda, Cloudflare ichida yashiringan turadi —
//  brauzerga (mijozga) hech qachon ko'rinmaydi.
// =============================================================

export default {
  async fetch(request, env) {
    // --- CORS sarlavhalari (brauzer ruxsat so' raganda kerak) ---
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Brauzer avval "ruxsatmi?" deb so'raydi (preflight) — ha deymiz
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // Faqat POST qabul qilamiz
    if (request.method !== "POST") {
      return new Response("Faqat POST", { status: 405, headers: cors });
    }

    try {
      // Brauzer yuborgan ma'lumotni o'qiymiz: { chat_id, text, parse_mode, ... }
      const body = await request.json();

      // Maxfiy token Cloudflare sozlamalaridan olinadi (kodda YO'Q!)
      const token = env.BOT_TOKEN;

      // Telegram'ga uzatamiz
      const tgRes = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const data = await tgRes.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e) }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  },
};
