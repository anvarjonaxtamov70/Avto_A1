/* =============================================================================
 *  AVTO A1 — Service Worker
 *  ---------------------------------------------------------------------------
 *  MAQSAD (ikkita, aniq):
 *    1. OFFLINE. Internet uzilsa ilova butunlay "oq ekran" bo'lib qolmasin —
 *       oxirgi ishlagan sahifa xotiradan ochiladi.
 *    2. TAKROR OCHILISH TEZLIGI. Firebase kutubxonalari (3 fayl, ~250 KB) va
 *       Google shriftlari har ochilishda qaytadan yuklanardi. Endi ular
 *       xotiradan darhol beriladi va fonda jimgina yangilanadi.
 *
 *  ⚠️ ENG MUHIM QOIDA — HTML uchun "AVVAL TARMOQ" (network-first):
 *     Do'kon egasi kunda bir necha marta deploy qiladi. Agar HTML keshdan
 *     berilsa, mijoz ESKI ilovani ko'rib qolardi — bu Service Worker'ning
 *     eng mashhur va eng og'riqli xatosi. Shuning uchun HTML har safar
 *     tarmoqdan olinadi; kesh FAQAT tarmoq ishlamaganda ishlatiladi.
 *
 *  🛟 O'CHIRISH KALITI: brauzer konsolida
 *       localStorage.avto_nosw = '1'
 *     deb yozib ilovani qayta ochsangiz, Service Worker butunlay o'chadi va
 *     keshlar tozalanadi (ro'yxatga olish kodi index.html da).
 *
 *  Versiyani o'zgartirish = barcha eski keshlarni tashlash.
 * ============================================================================= */

const SW_VERSION = 'a1-v1';
const SHELL_CACHE = SW_VERSION + '-shell';   // HTML (offline zaxira)
const ASSET_CACHE = SW_VERSION + '-assets';  // CDN: firebase, shriftlar

/** Faqat shu manbalar keshlanadi. Boshqasiga TEGILMAYDI. */
const ASSET_HOSTS = [
  'www.gstatic.com',       // firebase-*-compat.js
  'fonts.googleapis.com',  // shrift CSS
  'fonts.gstatic.com',     // shrift fayllari
];

self.addEventListener('install', (event) => {
  // Yangi versiya darhol ishga tushsin (mijoz ikki marta ochishi shart emas)
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => !n.startsWith(SW_VERSION)).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/** Tashqi buyruq: keshni tozalash / o'zini o'chirish. */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'PURGE') {
    event.waitUntil((async () => {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET bo'lmagan hech narsaga tegmaymiz (Firebase yozuvlari, Telegram API,
  // Worker /upload va /stock-commit — hammasi POST).
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // 1) HTML (navigatsiya) — AVVAL TARMOQ, keshni faqat zaxira sifatida.
  const isDoc = req.mode === 'navigate' ||
                (req.headers.get('accept') || '').indexOf('text/html') >= 0;
  if (isDoc) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 2) Ruxsat berilgan CDN manbalari — keshdan darhol, fonda yangilash.
  if (ASSET_HOSTS.indexOf(url.hostname) >= 0) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 3) Qolgan hamma narsa (Firebase RTDB, Worker, rasm hostlari) — tegilmaydi.
  //    Ular doim jonli bo'lishi kerak.
});

/** Avval tarmoq; muvaffaqiyatli bo'lsa keshni yangilaydi. Aks holda kesh. */
async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      // Zaxira nusxa (faqat offline holat uchun)
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    // Hech narsa yo'q — tushunarli offline sahifa qaytaramiz
    return new Response(
      '<!doctype html><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<div style="font:600 16px/1.6 -apple-system,system-ui,sans-serif;' +
      'background:#0b0b0d;color:#eee;min-height:100vh;display:flex;' +
      'align-items:center;justify-content:center;text-align:center;padding:24px">' +
      '<div><div style="font-size:44px;margin-bottom:12px">📴</div>' +
      "Internet yo'q<br><span style=\"font-weight:400;color:#999;font-size:14px\">" +
      'Aloqa tiklangach ilova o\'zi ishlaydi.</span></div></div>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/** Keshdan darhol beradi, parallel ravishda fonda yangilaydi. */
async function staleWhileRevalidate(req) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(req);

  const update = fetch(req).then((res) => {
    // `opaque` (cors bo'lmagan) javoblarni ham saqlaymiz — shriftlar shunday keladi
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => null);

  if (hit) return hit;
  const fresh = await update;
  if (fresh) return fresh;
  return new Response('', { status: 504, statusText: 'offline' });
}
