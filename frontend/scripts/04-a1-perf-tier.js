
    (function adaptivePerf() {
      'use strict';
      var root = document.documentElement;
      var LS_PREF = 'a1_perf_pref';      // 'auto' | 'low' | 'high'
      var LS_AUTO = 'a1_perf_auto_v2';   // { tier, at, sig, src, reasons }
      var AUTO_TTL = 7 * 24 * 3600 * 1000;   // aniqlash natijasi
      var GUARD_TTL = 2 * 24 * 3600 * 1000;  // qorovul pasaytirgan natija (vaqtinchalik holat bo'lishi mumkin)
      var MID_BLUR_MAX = 8;              // mid darajada blur radiusi chegarasi (px)
      var RANK = { low: 0, mid: 1, high: 2 };
      var DOWN = { high: 'mid', mid: 'low', low: 'low' };
      // 📱 Ilovada (Android ilova / iPhone bosh ekran ilovasi) qorovul «yengil»
      //    rejimga TUSHIRMAYDI: u deyarli barcha animatsiyalarni o'chirardi.
      //    Ilovadagi qotish sabablari endi alohida tuzatilgan (a1-app-perf).
      var APP = root.classList.contains('a1-app');
      if (APP) DOWN = { high: 'mid', mid: 'mid', low: 'low' };
      var ua = navigator.userAgent || '';

      function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
      function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
      function lower(a, b) { return RANK[a] <= RANK[b] ? a : b; }
      function signature() {
        var s = ua + '|' + (navigator.hardwareConcurrency || '') + '|' + (navigator.deviceMemory || '') +
                '|' + (window.screen ? Math.min(screen.width, screen.height) + 'x' + Math.max(screen.width, screen.height) : '');   // burilsa ham bir xil
        var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return String(h);
      }

      /* ---------- GPU nomi bo'yicha daraja (faqat Telegram sinfi yo'q Android) ---------- */
      function gpuTier() {
        try {
          var cv = document.createElement('canvas');
          var gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
          if (!gl) return { tier: 'low', name: 'no-webgl' };
          var ext = gl.getExtension('WEBGL_debug_renderer_info');
          var r = String((ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '');
          var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
          var t = null;
          if (/Mali-(4\d\d|T\d+|G31|G51|G52)\b|PowerVR Rogue|GE8\d{3}|Adreno[^\d]*(3\d\d|4\d\d|50\d|51\d|60\d|610)\b/i.test(r)) t = 'low';
          else if (/Mali-G(57|68|71|72|76|77)\b|PowerVR B|Adreno[^\d]*(5[2-4]\d|6[1-4]\d)\b/i.test(r)) t = 'mid';
          else if (/Mali|Adreno|Xclipse|Immortalis|PowerVR/i.test(r)) t = 'high';
          return t ? { tier: t, name: r.slice(0, 40) } : null;
        } catch (e) { return null; }
      }

      function detect() {
        var reasons = [], tier = 'high', src = 'default';
        var isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
        var isAndroid = /Android/i.test(ua);
        var tgm = ua.match(/Telegram-Android\/[\d.]+.*;\s*(LOW|AVERAGE|HIGH)\s*\)/i);   // model nomida qavs bo'lsa ham
        var mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency;

        if (tgm) {
          var c = tgm[1].toUpperCase();
          tier = c === 'LOW' ? 'low' : (c === 'AVERAGE' ? 'mid' : 'high');
          src = 'telegram'; reasons.push('tg:' + c);
          // Telegram 8 yadroli arzon telefonlarni (Helio G35/G85...) ko'pincha AVERAGE deydi —
          // shuning uchun AVERAGE'da grafik protsessorni ham tekshirib, pastrog'ini olamiz.
          if (c === 'AVERAGE' && isAndroid) {
            var g0 = gpuTier();
            if (g0) { tier = lower(tier, g0.tier); reasons.push('gpu:' + g0.name); }
          }
        } else if (isIOS) {
          src = 'ios';
        } else if (isAndroid) {
          src = 'android';
          var g = gpuTier();
          // Ilovada faqat haqiqatan zaif GPU pasaytiradi — aks holda blur radiusi
          // Telegram'dagidan farq qilib qolardi
          if (g && !(APP && g.tier === 'mid')) { tier = lower(tier, g.tier); reasons.push('gpu:' + g.name); }
          else if (typeof mem === 'number' && mem <= 4) { tier = lower(tier, 'mid'); reasons.push('ram<=4'); }
          if (typeof cores === 'number' && cores <= 4) { tier = 'low'; reasons.push('cpu<=4'); }
        }
        // Umumiy xavfsizlik belgilari (har qanday platformada faqat pasaytiradi)
        if (typeof mem === 'number' && mem <= 2) { tier = 'low'; reasons.push('ram<=2'); }
        if (typeof cores === 'number' && cores <= 3) { tier = 'low'; reasons.push('cpu<=3'); }
        var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn) {
          if (conn.saveData) { tier = 'low'; reasons.push('save-data'); }
          var et = String(conn.effectiveType || '');
          if (/^(slow-2g|2g)$/.test(et)) { tier = 'low'; reasons.push('net:' + et); }
          else if (et === '3g') { tier = lower(tier, 'mid'); reasons.push('net:3g'); }
        }
        return { tier: tier, src: src, reasons: reasons };
      }

      function readAuto() {
        try {
          var b = JSON.parse(lsGet(LS_AUTO) || 'null');
          // Ilovada qorovul ilgari saqlab qo'ygan pasaytirish e'tiborga olinmaydi
          if (APP && b && (b.src === 'guard' || (b.src === 'android' && b.tier === 'mid'))) return null;
          if (b && RANK[b.tier] !== undefined && b.sig === signature() && (Date.now() - b.at) < (b.ttl || AUTO_TTL)) return b;
        } catch (e) {}
        return null;
      }
      function saveAuto(tier, src, reasons, ttl) {
        lsSet(LS_AUTO, JSON.stringify({ tier: tier, at: Date.now(), ttl: ttl || AUTO_TTL, sig: signature(), src: src, reasons: reasons || [] }));
      }
      function autoTier() {
        var c = readAuto();
        if (c) return c;
        var d = detect();
        saveAuto(d.tier, d.src, d.reasons);
        d.at = Date.now();
        return d;
      }

      /* ---------- MID: shisha blur radiusini kamaytirish (CSSOM orqali) ----------
         Har bir backdrop-filter qoidasi topiladi va blur(Npx) -> blur(min(N, 8)px).
         Asl qiymatlar eslab qolinadi — "To'liq" tanlansa aynan tiklanadi.
         Kelajakda qo'shilgan yangi blur qoidalar ham avtomatik qamraladi. */
      var midEdits = [], midDone = (window.WeakSet ? new WeakSet() : null), midOn = false;
      function clampBlur(v) {
        return v.replace(/blur\(\s*([\d.]+)px\s*\)/g, function (m, n) {
          var x = parseFloat(n); return x > MID_BLUR_MAX ? 'blur(' + MID_BLUR_MAX + 'px)' : m;
        });
      }
      function edit(st, prop, nv) {
        midEdits.push([st, prop, st.getPropertyValue(prop), st.getPropertyPriority(prop)]);
        st.setProperty(prop, nv, st.getPropertyPriority(prop));
      }
      function walkRules(list) {
        for (var i = 0; i < list.length; i++) {
          var r = list[i];
          if (r.type === 7) continue;                                     // @keyframes — tegmaymiz
          if (r.style && !(midDone && midDone.has(r))) {
            if (midDone) midDone.add(r);
            var st = r.style;
            ['backdrop-filter', '-webkit-backdrop-filter'].forEach(function (p) {
              var v = st.getPropertyValue(p);
              if (v && v.indexOf('blur(') !== -1) { var nv = clampBlur(v); if (nv !== v) edit(st, p, nv); }
            });
            ['--nav-blur', '--header-blur'].forEach(function (p) {
              var v = st.getPropertyValue(p);
              var m = v && v.match(/^\s*([\d.]+)px\s*$/);
              if (m && parseFloat(m[1]) > MID_BLUR_MAX) edit(st, p, MID_BLUR_MAX + 'px');
            });
          }
          if (r.cssRules) { try { walkRules(r.cssRules); } catch (e) {} }
        }
      }
      function applyMid() {
        if (!midOn) return;
        var ss = document.styleSheets;
        for (var i = 0; i < ss.length; i++) { try { walkRules(ss[i].cssRules || []); } catch (e) { /* tashqi CSS (shriftlar) — o'tkazamiz */ } }
      }
      function setMid(on) {
        if (on === midOn) { if (on) applyMid(); return; }
        midOn = on;
        if (on) { applyMid(); return; }
        for (var i = midEdits.length - 1; i >= 0; i--) {
          var e = midEdits[i]; try { if (e[2]) e[0].setProperty(e[1], e[2], e[3]); else e[0].removeProperty(e[1]); } catch (x) {}
        }
        midEdits = []; midDone = (window.WeakSet ? new WeakSet() : null);
      }

      /* ---------- darajani qo'llash ---------- */
      var state = { pref: 'auto', tier: 'high', src: '', reasons: [] };
      function paint(t) {
        state.tier = t;
        root.setAttribute('data-perf', t);
        root.classList.toggle('perf-low', t === 'low');
        root.classList.toggle('perf-mid', t === 'mid');
        window.__perfLite = (t === 'low');
        window.__perfTier = t;
        if (t === 'low') root.classList.add('lite');
        else if (!window.__bootLiteOnly) root.classList.remove('lite');
        if (t !== 'low') root.classList.remove('pf-weak');
        setMid(t === 'mid');
      }

      // Boot: daraja
      try {
        var p = lsGet(LS_PREF);
        state.pref = (p === 'low' || p === 'high') ? p : 'auto';
        root.setAttribute('data-perf-pref', state.pref);
        if (state.pref === 'auto') {
          var a = autoTier(); state.tier = a.tier; state.src = a.src; state.reasons = a.reasons || [];
        } else { state.tier = state.pref; state.src = 'manual'; }
      } catch (e) { state.tier = 'high'; }

      window.__perfReasons = state.reasons;
      if (state.tier === 'low') {
        root.classList.add('lite'); root.classList.add('pf-weak');   // welcome ham qisqaradi
      } else {
        // ⚡ BOOT SMOOTHING: og'ir yuklanish oynasida (welcome ortida) 'lite' vaqtincha yoqiladi.
        root.classList.add('lite');
        window.__bootLiteOnly = true;
      }
      paint(state.tier);
      // CSS'ning hammasi (body oxiridagi <style> lar ham) o'qilgach mid qoidalarini qo'llaymiz
      document.addEventListener('DOMContentLoaded', function () { if (midOn) applyMid(); });
      window.addEventListener('a1-ready', function () { if (midOn) applyMid(); });   // keyin JS qo'shgan uslublar

      // Boot-lite'ni olib tashlovchi funksiya (boot gate va renderProducts chaqiradi)
      window.__endBootLite = function () {
        try {
          if (!window.__bootLiteOnly) return;
          window.__bootLiteOnly = false;
          if (!window.__perfLite) root.classList.remove('lite');
        } catch (e) {}
      };
      window.addEventListener('load', function () {
        if (window.__bootLiteOnly) setTimeout(window.__endBootLite, 3500);
      });

      /* ---------- "ko'rinmas payt"da qo'llash navbati ---------- */
      var pending = null;
      function queue(t) { pending = t; }
      function flush() { if (pending) { var t = pending; pending = null; paint(t); } }
      document.addEventListener('pointerdown', function (e) {
        if (!pending) return;
        var el = e.target;
        // Faqat bo'lim almashuvi: ekran baribir to'liq almashadi -> qayta chizish sezilmaydi.
        // (Tovar kartochkasi bosilganda QO'LLANMAYDI — oyna ochilishi kechikmasin.)
        if (el && el.closest && el.closest('.nav-item, .bottom-nav a, .bottom-nav button')) flush();
      }, true);
      document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });

      /* ---------- FPS QOROVULI v2 (faqat interaksiya paytida) ---------- */
      var G = { on: false, raf: 0, last: 0, until: 0, total: 0, frames: 0, jank: 0, bad: 0, good: 0, samples: 0, lowBatt: false };
      function gStop() { G.on = false; if (G.raf) { cancelAnimationFrame(G.raf); G.raf = 0; } }
      /** 3 soniyalik oyna bahosi: 'good' | 'bad' | 'capped'.
          'capped' — ekran barqaror ~30 Hz da (quvvat tejash rejimi cheklagan),
          kadrlar TEKIS, qotish yo'q -> bu telefon zaifligi EMAS, hisobga olinmaydi. */
      function classify(fps, jr) {
        if (fps >= 26 && fps <= 34 && jr < 0.05) return 'capped';
        if (fps < 40 || jr > 0.2) return 'bad';
        return 'good';
      }
      // Batareya kam va zaryadlanmayapti -> telefon o'zi sekinlashtirgan bo'lishi mumkin:
      // pasaytirish faqat SHU SEANS uchun qo'llanadi, saqlanmaydi.
      try {
        if (navigator.getBattery) navigator.getBattery().then(function (b) {
          var upd = function () { G.lowBatt = !b.charging && b.level <= 0.2; };
          upd(); b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd);
        }).catch(function () {});
      } catch (e) {}
      function gEval() {
        var fps = G.frames * 1000 / G.total, jr = G.jank / G.total;
        G.total = 0; G.frames = 0; G.jank = 0; G.samples++;
        var k = classify(fps, jr);
        if (k === 'bad') { G.good = 0; G.bad++; } else if (k === 'good') { G.bad = 0; G.good++; }
        if (G.bad >= 2) {
          G.bad = 0;
          var cur = pending || state.tier, nx = DOWN[cur];
          if (nx !== cur) {
            state.reasons = (state.reasons || []).concat('fps:' + Math.round(fps) + '/j' + Math.round(jr * 100) + (G.lowBatt ? '/batt' : ''));
            window.__perfReasons = state.reasons;
            // Qorovul natijasi qisqa (2 kun) saqlanadi: vaqtincha qizish/fon yuklanishi
            // tufayli mijoz bir hafta yengil rejimda qolib ketmasin.
            if (!G.lowBatt) saveAuto(nx, 'guard', state.reasons, GUARD_TTL);
            queue(nx);
          }
          if (nx === 'low') gStop();
        } else if (G.good >= 3 || G.samples >= 20) {
          gStop();                                   // telefon yetarli tez — qorovul to'xtaydi
        }
      }
      function gFrame(ts) {
        G.raf = 0;
        if (!G.on) return;
        if (G.last) {
          var d = ts - G.last;
          if (d > 0 && d < 1000) { G.total += d; G.frames++; if (d > 50) G.jank += d; }
          if (G.total >= 3000) gEval();
        }
        G.last = ts;
        if (G.on && Date.now() < G.until && !document.hidden) G.raf = requestAnimationFrame(gFrame);
        else G.last = 0;
      }
      function gPoke() {
        if (!G.on || document.hidden) return;
        G.until = Date.now() + 1200;
        if (!G.raf) { G.last = 0; G.raf = requestAnimationFrame(gFrame); }
      }
      function gStart() {
        if (G.on || state.pref !== 'auto' || state.tier === 'low') return;
        G.on = true; G.bad = 0; G.good = 0; G.samples = 0; G.total = 0; G.frames = 0; G.jank = 0;
      }
      ['touchstart', 'touchmove', 'wheel'].forEach(function (ev) {
        document.addEventListener(ev, gPoke, { passive: true, capture: true });
      });
      document.addEventListener('scroll', gPoke, { passive: true, capture: true });
      var started = false;
      function startLater(ms) { if (started) return; started = true; setTimeout(gStart, ms); }
      window.addEventListener('a1-ready', function () { startLater(2000); });
      window.addEventListener('load', function () { setTimeout(function () { startLater(0); }, 9000); });  // zaxira

      /* ---------- qo'lda tanlash (Profil -> «Ko'rinish») ---------- */
      var LBL = { auto: 'Avto', low: 'Yengil', high: "To\u2018liq" };
      var TLBL = { low: 'yengil', mid: "o\u2018rtacha", high: "to\u2018liq" };
      function setPref(p) {
        if (p !== 'low' && p !== 'high') p = 'auto';
        state.pref = p; pending = null; gStop(); started = false;
        lsSet(LS_PREF, p);
        root.setAttribute('data-perf-pref', p);
        var t = p;
        if (p === 'auto') { var a = autoTier(); t = a.tier; state.src = a.src; state.reasons = a.reasons || []; }
        else state.src = 'manual';
        paint(t);
        if (p === 'auto') startLater(1500);
        try {
          if (typeof window.showToast === 'function')
            window.showToast("Ko\u2018rinish: " + LBL[p] + (p === 'auto' ? ' (' + TLBL[t] + ')' : ''), 'success');
        } catch (e) {}
      }
      function openPicker() {
        var tg = window.Telegram && window.Telegram.WebApp;
        var msg = 'Hozir: ' + LBL[state.pref] + (state.pref === 'auto' ? ' \u2014 ' + TLBL[state.tier] : '') +
                  "\n\nYengil \u2014 blur va bezak animatsiyalarisiz, oddiy telefonlarda ham silliq.\nTo\u2018liq \u2014 barcha effektlar.\nAvto \u2014 telefoningizga qarab o\u2018zi tanlaydi.";
        var native = false;
        try { native = !!(tg && tg.showPopup && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')); } catch (e) {}
        if (native) {
          // Telegram oynasi xato bersa (masalan boshqa popup ochiq) — hech narsa o'zgartirmaymiz.
          try {
            tg.showPopup({
              title: "Ko\u2018rinish",
              message: msg,
              buttons: [{ id: 'auto', type: 'default', text: 'Avto' }, { id: 'low', type: 'default', text: 'Yengil' }, { id: 'high', type: 'default', text: "To\u2018liq" }]
            }, function (id) { if (id) setPref(id); });
          } catch (e) {}
          return;
        }
        setPref(state.pref === 'auto' ? 'low' : (state.pref === 'low' ? 'high' : 'auto'));   // zaxira: aylantirish
      }

      window.A1Perf = {
        openPicker: openPicker,
        setPref: setPref,
        /** CI sinovi uchun (.github/test-perf-tier.js) */
        _t: { detect: detect, classify: classify, signature: signature, readAuto: readAuto },
        /** Sinov uchun (konsol): A1Perf.force('mid') — saqlanmaydi */
        force: function (t) { if (RANK[t] !== undefined) { gStop(); pending = null; paint(t); } },
        info: function () {
          return { tier: state.tier, pref: state.pref, src: state.src, reasons: state.reasons, pending: pending,
                   guard: { on: G.on, samples: G.samples, bad: G.bad, good: G.good }, midRules: midEdits.length, ua: ua };
        }
      };
    })();
    