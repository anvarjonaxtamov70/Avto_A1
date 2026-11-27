
/* ══════════════════════════════════════════════════════════════════
   🏪 ShopInfo — do'kon ma'lumotlari (Aloqa · Manzil · Ish vaqti ·
   Yetkazish · Kafolat · Pul qaytarish). Admin ilova ichidan tahrirlaydi.
   Manba: Firebase `settings/shopInfo` (o'qish — hamma, yozish — admin;
   qoidalar database.rules.json'dagi `settings` tugunidan meros).
   Kesh: localStorage `avto_shop_info` (internet sekin bo'lsa ham darhol).
   ══════════════════════════════════════════════════════════════════ */
(function () {
    if (window.ShopInfo) return;
    var KEY = 'avto_shop_info', PATH = 'settings/shopInfo';
    var DAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
    var DSHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    var DEF = {
        phones: [{ l: 'Asosiy raqam', n: '+998 88 289 30 30' }, { l: "Qo'shimcha raqam", n: '+998 90 603 32 10' }],
        tgUser: 'anvaraxtamov2004', ig: '',
        addr: '', mark: '', lat: '', lng: '',
        days: [1, 2, 3, 4, 5, 6], open: '', close: '',
        deliv: [
            { t: 'Shahar ichida', s: 'Taksi orqali', v: '1 kun' },
            { t: 'Viloyatlarga', s: 'BTS pochta orqali', v: '2–4 kun' }
        ],
        stats: [{ v: '14 kun', l: 'Qaytarish' }, { v: '100%', l: 'Original' }, { v: '3–5 kun', l: 'Pul qaytishi' }],
        warr: [
            'Barcha tovarlar **kafolatlangan**',
            "Tovarning o'zi nosoz bo'lsa — **14 kun** ichida qaytarib olinadi",
            'Zavod nuqsoni — **bepul almashtiriladi**',
            'Tovar haqiqiyligi — **100% kafolat**',
            'Original tovarlarga zavod kafolati amal qiladi'
        ],
        refund: [
            'Tovar olganingizdan **14 kun** ichida murojaat qiling',
            "Tovar **ishlatilmagan** va asl o'ramida bo'lishi shart",
            'Pul **3–5 ish kuni** ichida kartangizga qaytariladi'
        ],
        note: ''
    };

    /* ——— yordamchilar ——— */
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
    function str(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 160); }
    function arr(v) {
        if (Array.isArray(v)) return v.filter(function (x) { return x != null; });
        if (v && typeof v === 'object') return Object.keys(v).sort(function (a, b) { return a - b; }).map(function (k) { return v[k]; }).filter(function (x) { return x != null; });
        return [];
    }
    function cleanTg(v) { return String(v || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?t(elegram)?\.me\//i, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40); }
    function cleanIg(v) { return String(v || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').replace(/[^A-Za-z0-9_.]/g, '').slice(0, 40); }
    function cleanTime(v) { v = String(v || '').trim(); return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : ''; }
    function cleanCoord(v, lim) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return (isFinite(n) && Math.abs(n) <= lim) ? String(Math.round(n * 1e6) / 1e6) : ''; }
    function telHref(n) { return 'tel:' + String(n || '').replace(/[^\d+]/g, ''); }
    function fmtSum(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    function isAdm() { try { return !!(window.isAdmin && window.isAdmin()); } catch (e) { return false; } }
    function toast(m, t) { try { showToast(esc(m), t); } catch (e) {} }
    function hap(k) { try { if (typeof window._hap === 'function') window._hap(k); } catch (e) {} }
    function webApp() { try { if (typeof tg !== 'undefined' && tg) return tg; } catch (e) {} return (window.Telegram && window.Telegram.WebApp) || null; }
    function getDb() { try { if (typeof db !== 'undefined' && db) return db; } catch (e) {} try { return firebase.database(); } catch (e) { return null; } }

    function normalize(raw) {
        raw = raw && typeof raw === 'object' ? raw : {};
        // Muharrirda saqlangan bo'lsa (updatedAt bor) — bo'sh ro'yxat «bo'sh» degani
        // (Firebase bo'sh massivni saqlamaydi); aks holda standart qiymat olinadi.
        var saved = !!raw.updatedAt;
        var o = {};
        o.phones = arr(raw.phones).map(function (p) { return { l: str(p && p.l, 40), n: str(p && p.n, 32) }; }).filter(function (p) { return p.n.replace(/\D/g, '').length >= 5; }).slice(0, 6);
        if (!raw.phones && !saved) o.phones = DEF.phones.slice();
        o.tgUser = raw.tgUser != null ? cleanTg(raw.tgUser) : DEF.tgUser;
        o.ig = cleanIg(raw.ig);
        o.addr = str(raw.addr, 220); o.mark = str(raw.mark, 160);
        o.lat = cleanCoord(raw.lat, 90); o.lng = cleanCoord(raw.lng, 180);
        o.days = (raw.days || saved) ? arr(raw.days).map(Number).filter(function (d) { return d >= 1 && d <= 7; }) : DEF.days.slice();
        o.open = cleanTime(raw.open); o.close = cleanTime(raw.close);
        o.deliv = (raw.deliv || saved) ? arr(raw.deliv).map(function (d) { return { t: str(d && d.t, 40), s: str(d && d.s, 60), v: str(d && d.v, 24) }; }).filter(function (d) { return d.t; }).slice(0, 6) : DEF.deliv.slice();
        o.stats = (raw.stats || saved) ? arr(raw.stats).map(function (d) { return { v: str(d && d.v, 12), l: str(d && d.l, 20) }; }).filter(function (d) { return d.v; }).slice(0, 4) : DEF.stats.slice();
        o.warr = (raw.warr || saved) ? arr(raw.warr).map(function (s) { return str(s, 200); }).filter(Boolean).slice(0, 12) : DEF.warr.slice();
        o.refund = (raw.refund || saved) ? arr(raw.refund).map(function (s) { return str(s, 200); }).filter(Boolean).slice(0, 8) : DEF.refund.slice();
        o.note = str(raw.note, 400);
        o.updatedAt = Number(raw.updatedAt) || 0;
        return o;
    }

    var S = (function () { try { return normalize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return normalize(null); } })();

    /* ——— ish vaqti (Toshkent vaqti bo'yicha) ——— */
    function nowTk() {
        try {
            var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
            var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
            var wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[o.weekday];
            if (wd) return { d: wd, m: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
        } catch (e) {}
        var n = new Date(); return { d: (n.getDay() + 6) % 7 + 1, m: n.getHours() * 60 + n.getMinutes() };
    }
    function mins(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
    function daysText(days) {
        var d = days.slice().sort();
        if (!d.length) return '';
        if (d.length === 7) return 'Har kuni';
        var run = d.every(function (x, i) { return i === 0 || x === d[i - 1] + 1; });
        if (run && d.length >= 3) return DAYS[d[0] - 1] + ' – ' + DAYS[d[d.length - 1] - 1];
        return d.map(function (x) { return DSHORT[x - 1]; }).join(', ');
    }
    function offText(days) {
        var off = [1, 2, 3, 4, 5, 6, 7].filter(function (x) { return days.indexOf(x) < 0; });
        return off.length ? 'Dam olish: ' + off.map(function (x) { return DAYS[x - 1]; }).join(', ') : '';
    }
    function status() {
        if (!S.open || !S.close || !S.days.length) return null;
        var n = nowTk(), o = mins(S.open), c = mins(S.close);
        var workToday = S.days.indexOf(n.d) > -1;
        if (workToday && n.m >= o && n.m < c) return { on: true, t: 'Hozir ochiq · ' + S.close + ' gacha' };
        if (workToday && n.m < o) return { on: false, t: 'Yopiq · bugun ' + S.open + ' da ochiladi' };
        for (var i = 1; i <= 7; i++) {
            var d = (n.d - 1 + i) % 7 + 1;
            if (S.days.indexOf(d) > -1) return { on: false, t: 'Yopiq · ' + (i === 1 ? 'ertaga' : DAYS[d - 1]) + ' ' + S.open + ' da' };
        }
        return null;
    }

    /* ——— ikonkalar ——— */
    var I = {
        phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
        send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>',
        pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
        share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
        copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        ig: '<rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.6" cy="6.4" r=".6" fill="currentColor"/>',
        car: '<path d="M5 17h14M5 17a2 2 0 1 1-4 0v-5l2.5-6A2 2 0 0 1 5.4 5h13.2a2 2 0 0 1 1.9 1l2.5 6v5a2 2 0 1 1-4 0"/><path d="M3 12h18"/><circle cx="7" cy="14.5" r=".8" fill="currentColor"/><circle cx="17" cy="14.5" r=".8" fill="currentColor"/>',
        box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
        truck: '<path d="M1 4h14v12H1z"/><path d="M15 9h4l3 3v4h-7V9z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>',
        gift: '<path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        chev: '<path d="M1.5 1.5 6.5 6.5 1.5 11.5"/>',
        loc: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>'
    };
    function svg(k, cls) { return '<svg class="' + (cls || 'a1-svg') + '" viewBox="0 0 24 24" aria-hidden="true">' + (I[k] || '') + '</svg>'; }
    function chev() { return '<span class="a1-chev"><svg viewBox="0 0 8 13" aria-hidden="true">' + I.chev + '</svg></span>'; }

    var GEAR = (function () {
        var N = 12, R = 47, r = 40.5, H = 33.5, step = 360 / N, rh = step * 0.27, th = step * 0.17, d = '';
        function pt(a, rad) { a = (a - 90) * Math.PI / 180; return (50 + rad * Math.cos(a)).toFixed(2) + ' ' + (50 + rad * Math.sin(a)).toFixed(2); }
        for (var i = 0; i < N; i++) {
            var c = i * step;
            if (!i) d += 'M' + pt(c - rh, r);
            d += 'L' + pt(c - th, R) + 'A' + R + ' ' + R + ' 0 0 1 ' + pt(c + th, R) + 'L' + pt(c + rh, r) + 'A' + r + ' ' + r + ' 0 0 1 ' + pt(c + step - rh, r);
        }
        d += 'ZM50 ' + (50 - H) + 'A' + H + ' ' + H + ' 0 1 0 50 ' + (50 + H) + 'A' + H + ' ' + H + ' 0 1 0 50 ' + (50 - H) + 'Z';
        return '<div class="a1-gear"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="a1GearG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F0D060"/><stop offset=".5" stop-color="#C9A84C"/><stop offset="1" stop-color="#96720A"/></linearGradient></defs>' +
            '<path fill="url(#a1GearG)" stroke="url(#a1GearG)" stroke-width="1.6" stroke-linejoin="round" fill-rule="evenodd" d="' + d + '"/></svg><b>A1</b></div>';
    })();

    /* ——— amallar ——— */
    function openExt(url) {
        var w = webApp();
        try { if (w && w.openLink) { w.openLink(url); return; } } catch (e) {}
        window.open(url, '_blank', 'noopener');
    }
    function copy(text) {
        var done = function () { hap('success'); toast("Nusxa olindi"); };
        try { if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, fallback); return; } } catch (e) {}
        fallback();
        function fallback() {
            try { var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); done(); } catch (e) { toast("Nusxa olinmadi", 'warning'); }
        }
    }
    function mapUrl(kind) {
        var has = S.lat && S.lng, q = encodeURIComponent(S.addr || 'Avto A1');
        if (kind === 'g') return has ? 'https://www.google.com/maps/search/?api=1&query=' + S.lat + ',' + S.lng : 'https://www.google.com/maps/search/?api=1&query=' + q;
        return has ? 'https://yandex.uz/maps/?pt=' + S.lng + ',' + S.lat + '&z=17&l=map' : 'https://yandex.uz/maps/?text=' + q;
    }
    function shareText() {
        var t = 'Avto A1 — original avto ehtiyot qismlar';
        if (S.phones[0]) t += '\n📞 ' + S.phones[0].n;
        if (S.addr) t += '\n📍 ' + S.addr + (S.mark ? ' (' + S.mark + ')' : '');
        if (S.open && S.close && S.days.length) t += '\n🕘 ' + daysText(S.days) + ', ' + S.open + '–' + S.close;
        if (S.tgUser) t += '\n✈️ https://t.me/' + S.tgUser;
        return t;
    }

    var API = window.ShopInfo = {
        get: function () { return S; },
        mainPhone: function () { return (S.phones[0] && S.phones[0].n) || '+998 88 289 30 30'; },
        tgUrl: function () { return 'https://t.me/' + (S.tgUser || 'anvaraxtamov2004'); },
        openTg: function (text) {
            if (!S.tgUser) { toast("Telegram manzili kiritilmagan", 'warning'); return; }
            var url = 'https://t.me/' + S.tgUser + (text ? '?text=' + encodeURIComponent(text) : '');
            var w = webApp(); hap('light');
            try { if (w && w.openTelegramLink) { w.openTelegramLink(url); return; } } catch (e) {}
            window.open(url, '_blank', 'noopener');
        },
        openIg: function () { if (S.ig) openExt('https://instagram.com/' + S.ig); },
        openMap: function (kind) {
            if (!S.addr && !(S.lat && S.lng)) { toast("Manzil hali kiritilmagan", 'warning'); return; }
            hap('light'); openExt(mapUrl(kind));
        },
        copy: function (what) {
            if (what === 'addr') return copy(S.addr + (S.mark ? ' (' + S.mark + ')' : ''));
            var i = parseInt(what, 10); if (S.phones[i]) copy(S.phones[i].n);
        },
        share: function () {
            var t = shareText();
            try { if (navigator.share) { navigator.share({ title: 'Avto A1', text: t }).catch(function () {}); return; } } catch (e) {}
            copy(t);
        },
        render: function (id) {
            if (!id || id === 'contactModal') renderContact();
            if (!id || id === 'trustModal') renderTrust();
        },
        openEditor: openEditor
    };

    /* ══════════════ 📞 ALOQA ══════════════ */
    function renderContact() {
        var m = document.getElementById('contactModal'), b = document.getElementById('ci-body');
        if (!m || !b) return;
        var adm = isAdm(); m.classList.toggle('is-adm', adm);
        var st = status(), p0 = S.phones[0], hasMap = !!(S.addr || (S.lat && S.lng)), k = 0;
        var h = '<div class="a1-in">';
        h += '<div class="a1-hero" style="--d:' + (k++) + '"><div class="ci-hero">' + GEAR + '<div class="ci-hero-tx"><b>Avto A1</b><span>Original avto ehtiyot qismlar do\'koni</span>' +
            (st ? '<em class="a1-st ' + (st.on ? 'on' : 'off') + '"><i></i>' + esc(st.t) + '</em>' : '') + '</div></div></div>';
        h += '<div class="ci-qa" style="--d:' + (k++) + '">' +
            (p0 ? '<a class="ci-qa-b is-main" href="' + esc(telHref(p0.n)) + '">' + svg('phone') + '<span>Qo\'ng\'iroq</span></a>' : '<span class="ci-qa-b is-main is-off">' + svg('phone') + '<span>Qo\'ng\'iroq</span></span>') +
            '<button type="button" class="ci-qa-b' + (S.tgUser ? '' : ' is-off') + '" onclick="ShopInfo.openTg()">' + svg('send') + '<span>Telegram</span></button>' +
            '<button type="button" class="ci-qa-b' + (hasMap ? '' : ' is-off') + '" onclick="ShopInfo.openMap(\'y\')">' + svg('pin') + '<span>Xarita</span></button>' +
            '<button type="button" class="ci-qa-b" onclick="ShopInfo.share()">' + svg('share') + '<span>Ulashish</span></button></div>';
        if (S.phones.length) {
            h += '<div style="--d:' + (k++) + '"><div class="a1-sec">Telefon</div><div class="a1-grp">' + S.phones.map(function (p, i) {
                return '<a class="a1-row" href="' + esc(telHref(p.n)) + '"><span class="a1-ic" style="--ic:#30d158">' + svg('phone') + '</span>' +
                    '<span class="a1-t"><small style="margin:0 0 1px">' + esc(p.l || 'Telefon') + '</small><span class="ci-num">' + esc(p.n) + '</span></span>' +
                    '<button type="button" class="a1-mini" aria-label="Nusxa olish" onclick="event.preventDefault();event.stopPropagation();ShopInfo.copy(' + i + ')">' + svg('copy') + '</button></a>';
            }).join('') + '</div></div>';
        }
        if (hasMap) {
            h += '<div style="--d:' + (k++) + '"><div class="a1-sec">Do\'kon manzili</div><div class="a1-grp">' +
                '<button type="button" class="ci-map" aria-label="Xaritada ochish" onclick="ShopInfo.openMap(\'y\')"><span class="ci-pin"><span><b>A1</b></span></span><span class="ci-map-tag">Avto A1</span></button>' +
                '<div class="a1-row static ci-addr"><span class="a1-ic" style="--ic:#ff453a">' + svg('pin') + '</span><span class="a1-t">' + esc(S.addr || 'Xaritadagi joylashuv') +
                (S.mark ? '<small>Mo\'ljal: ' + esc(S.mark) + '</small>' : '') + '</span>' +
                (S.addr ? '<button type="button" class="a1-mini" aria-label="Manzilni nusxalash" onclick="ShopInfo.copy(\'addr\')">' + svg('copy') + '</button>' : '') + '</div>' +
                '<div class="ci-map-acts"><button type="button" onclick="ShopInfo.openMap(\'y\')">' + svg('pin') + 'Yandex Xarita</button><button type="button" onclick="ShopInfo.openMap(\'g\')">' + svg('pin') + 'Google Maps</button></div>' +
                '</div></div>';
        } else if (adm) {
            h += '<div style="--d:' + (k++) + '"><div class="a1-sec">Do\'kon manzili</div><div class="a1-grp"><button type="button" class="a1-row ci-add" onclick="ShopInfo.openEditor()"><span class="a1-ic" style="--ic:#ff453a">' + svg('pin') + '</span><span class="a1-t" style="color:inherit">Do\'kon manzilini qo\'shing<small>Mijozlar xaritada topa olishi uchun</small></span>' + chev() + '</button></div></div>';
        }
        if (S.open && S.close && S.days.length) {
            h += '<div style="--d:' + (k++) + '"><div class="a1-sec">Ish vaqti</div><div class="a1-grp"><div class="a1-row static"><span class="a1-ic" style="--ic:#0a84ff">' + svg('clock') + '</span>' +
                '<span class="a1-t">' + esc(daysText(S.days)) + (offText(S.days) ? '<small>' + esc(offText(S.days)) + '</small>' : '') + '</span><span class="a1-v">' + esc(S.open + ' – ' + S.close) + '</span></div></div></div>';
        } else if (adm) {
            h += '<div style="--d:' + (k++) + '"><div class="a1-sec">Ish vaqti</div><div class="a1-grp"><button type="button" class="a1-row ci-add" onclick="ShopInfo.openEditor()"><span class="a1-ic" style="--ic:#0a84ff">' + svg('clock') + '</span><span class="a1-t" style="color:inherit">Ish vaqtini kiriting<small>«Hozir ochiq» belgisi avtomatik chiqadi</small></span>' + chev() + '</button></div></div>';
        }
        if (S.tgUser || S.ig) {
            h += '<div style="--d:' + (k++) + '"><div class="a1-sec">Ijtimoiy tarmoqlar</div><div class="a1-grp">' +
                (S.tgUser ? '<button type="button" class="a1-row" onclick="ShopInfo.openTg()"><span class="a1-ic" style="--ic:#2aabee">' + svg('send') + '</span><span class="a1-t">Telegram<small>@' + esc(S.tgUser) + '</small></span>' + chev() + '</button>' : '') +
                (S.ig ? '<button type="button" class="a1-row" onclick="ShopInfo.openIg()"><span class="a1-ic" style="--ic:#e1306c">' + svg('ig') + '</span><span class="a1-t">Instagram<small>@' + esc(S.ig) + '</small></span>' + chev() + '</button>' : '') +
                '</div></div>';
        }
        h += '</div>';
        b.innerHTML = h;
    }

    /* ══════════════ 🛡 KAFOLAT VA YETKAZISH ══════════════ */
    function renderTrust() {
        var m = document.getElementById('trustModal'), b = document.getElementById('tr-body');
        if (!m || !b) return;
        m.classList.toggle('is-adm', isAdm());
        var free = 3000000;
        try { if (window.VIP && typeof VIP.freeDeliveryTarget === 'function') free = VIP.freeDeliveryTarget() || free; } catch (e) {}
        var DIC = [['car', '#0a84ff'], ['box', '#ff9f0a'], ['truck', '#5e5ce6'], ['truck', '#40c8e0'], ['box', '#bf5af2'], ['car', '#30d158']];
        var k = 0, h = '<div class="a1-in">';
        h += '<div class="a1-hero" style="--d:' + (k++) + '"><div class="tr-hero-top"><span class="tr-shield">' + svg('shield') + '</span><div class="tr-hero-tx"><b>Avto A1 kafolati</b><span>Har bir xaridingiz himoyalangan — xotirjam buyurtma bering</span></div></div>' +
            (S.stats.length ? '<div class="tr-stats" style="--n:' + S.stats.length + '">' + S.stats.map(function (s) { return '<div class="tr-stat"><b>' + esc(s.v) + '</b><span>' + esc(s.l) + '</span></div>'; }).join('') + '</div>' : '') + '</div>';
        if (S.deliv.length) {
            h += '<div style="--d:' + (k++) + '"><div class="a1-sec">Yetkazib berish</div><div class="a1-grp">' + S.deliv.map(function (d, i) {
                var ic = DIC[i % DIC.length];
                return '<div class="a1-row static"><span class="a1-ic" style="--ic:' + ic[1] + '">' + svg(ic[0]) + '</span><span class="a1-t">' + esc(d.t) + (d.s ? '<small>' + esc(d.s) + '</small>' : '') + '</span>' +
                    (d.v ? '<span class="a1-v is-pill">' + esc(d.v) + '</span>' : '') + '</div>';
            }).join('') + '</div>' +
                '<div class="tr-free"><span class="a1-ic">' + svg('gift') + '</span><p><b>' + fmtSum(free) + ' so\'m</b>dan ortiq buyurtmalarga yetkazib berish <b>tekin</b></p></div></div>';
        }
        if (S.warr.length) {
            h += '<div style="--d:' + (k++) + '"><div class="a1-sec">Kafolat shartlari</div><div class="a1-grp">' + S.warr.map(function (t) {
                return '<div class="a1-row static tr-term"><span class="tr-check">' + svg('check', '') + '</span><span class="a1-t">' + md(t) + '</span></div>';
            }).join('') + '</div></div>';
        }
        if (S.refund.length) {
            h += '<div style="--d:' + (k++) + '"><div class="a1-sec">Pul qaytarish</div><div class="a1-grp tr-steps">' + S.refund.map(function (t, i) {
                return '<div class="tr-step"><i>' + (i + 1) + '</i><p>' + md(t) + '</p></div>';
            }).join('') + '</div></div>';
        }
        if (S.note) h += '<div class="tr-note" style="--d:' + (k++) + '">' + md(S.note) + '</div>';
        if (window.Phase2 && Phase2.openWarranty) {
            h += '<div style="--d:' + (k++) + ';margin-top:24px"><div class="a1-grp"><button type="button" class="a1-row" onclick="Phase2.openWarranty()"><span class="a1-ic" style="--ic:#c9a84c">' + svg('shield') + '</span><span class="a1-t">Mening kafolatlarim<small>Har bir tovar muddatini kuzating</small></span>' + chev() + '</button></div></div>';
        }
        var p0 = S.phones[0];
        h += '<div class="a1-hero tr-help" style="--d:' + (k++) + '"><b>Savollaringiz bormi?</b><span>Mutaxassisimiz tez javob beradi</span><div class="a1-btns">' +
            (p0 ? '<a class="a1-btn is-gold" href="' + esc(telHref(p0.n)) + '">' + svg('phone', '') + 'Qo\'ng\'iroq</a>' : '') +
            (S.tgUser ? '<button type="button" class="a1-btn" onclick="ShopInfo.openTg()">' + svg('send', '') + 'Telegram</button>' : '') + '</div></div>';
        h += '</div>';
        b.innerHTML = h;
    }

    /* ——— checkout'dagi qisqa yozuv ——— */
    function syncCheckoutRow() {
        var el = document.getElementById('co-trust-sub');
        if (el && S.deliv[0] && S.deliv[0].v) el.textContent = 'Yetkazish ' + S.deliv[0].v + ' · original tovar';
    }

    function apply(raw) {
        S = normalize(raw);
        try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
        API.render(); syncCheckoutRow();
    }

    /* ══════════════ ✏️ ADMIN MUHARRIRI ══════════════ */
    function liPhone(p) {
        return '<div class="se-li" data-k="ph"><div class="se-cols"><input data-f="l" maxlength="40" placeholder="Nomi" value="' + esc(p.l) + '"><input data-f="n" type="tel" inputmode="tel" maxlength="32" placeholder="+998 __ ___ __ __" value="' + esc(p.n) + '"></div>' + xBtn() + '</div>';
    }
    function liDeliv(d) {
        return '<div class="se-li" data-k="dv"><div class="se-cols" style="--cols:1fr 1fr .75fr"><input data-f="t" maxlength="40" placeholder="Qayerga" value="' + esc(d.t) + '"><input data-f="s" maxlength="60" placeholder="Qanday" value="' + esc(d.s) + '"><input data-f="v" maxlength="24" placeholder="Muddat" value="' + esc(d.v) + '"></div>' + xBtn() + '</div>';
    }
    function liStat(d) {
        return '<div class="se-li" data-k="st"><div class="se-cols" style="--cols:.8fr 1.2fr"><input data-f="v" maxlength="12" placeholder="14 kun" value="' + esc(d.v) + '"><input data-f="l" maxlength="20" placeholder="Izoh" value="' + esc(d.l) + '"></div>' + xBtn() + '</div>';
    }
    function xBtn() { return '<button type="button" class="se-x" aria-label="O\'chirish" onclick="ShopInfo._rm(this)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg></button>'; }
    function addBtn(kind, label) { return '<button type="button" class="se-add" onclick="ShopInfo._add(this,\'' + kind + '\')"><i>+</i>' + label + '</button>'; }
    function field(label, name, val, opt) {
        opt = opt || {};
        var inner = opt.area
            ? '<textarea name="' + name + '" maxlength="' + (opt.max || 400) + '" placeholder="' + esc(opt.ph || '') + '"' + (opt.rows ? ' style="min-height:' + opt.rows * 23 + 'px"' : '') + '>' + esc(val) + '</textarea>'
            : '<input name="' + name + '" type="' + (opt.type || 'text') + '"' + (opt.mode ? ' inputmode="' + opt.mode + '"' : '') + ' maxlength="' + (opt.max || 160) + '" placeholder="' + esc(opt.ph || '') + '" value="' + esc(val) + '">';
        return '<label class="se-f"><span>' + label + '</span>' + inner + '</label>';
    }
    function formHTML(D) {
        var h = '<p class="se-lead">Bu ma\'lumotlar «Aloqa» va «Kafolat va yetkazish» sahifalarida hamma mijozlarga ko\'rinadi.</p>';
        h += '<div class="a1-sec">Telefon raqamlar</div><div class="a1-grp" data-list="ph">' + D.phones.map(liPhone).join('') + addBtn('ph', 'Raqam qo\'shish') + '</div>';
        h += '<div class="a1-sec">Ijtimoiy tarmoqlar</div><div class="a1-grp">' + field('Telegram (username)', 'tgUser', D.tgUser ? '@' + D.tgUser : '', { ph: '@username' }) + field('Instagram (ixtiyoriy)', 'ig', D.ig ? '@' + D.ig : '', { ph: '@avto_a1' }) + '</div>';
        h += '<div class="a1-sec">Do\'kon manzili</div><div class="a1-grp">' + field('Manzil', 'addr', D.addr, { area: 1, rows: 2, max: 220, ph: 'Shahar, tuman, ko\'cha, uy' }) + field('Mo\'ljal', 'mark', D.mark, { ph: 'Masalan: avtobozor yonida' }) +
            '<div class="se-two">' + field('Kenglik (lat)', 'lat', D.lat, { mode: 'decimal', max: 14, ph: '41.311081' }) + field('Uzunlik (lng)', 'lng', D.lng, { mode: 'decimal', max: 14, ph: '69.240562' }) + '</div></div>' +
            '<button type="button" class="a1-btn se-geo" onclick="ShopInfo._geo(this)">' + svg('loc', '') + 'Joriy joylashuvimni olish</button>' +
            '<p class="a1-foot">Do\'konda turib bosing — mijozlar xaritada aniq nuqtani ko\'radi. Koordinata bo\'lmasa, manzil matni bo\'yicha qidiriladi.</p>';
        h += '<div class="a1-sec">Ish vaqti</div><div class="a1-grp"><div class="se-f"><span>Ish kunlari</span><div class="se-days">' + DSHORT.map(function (s, i) {
            return '<button type="button" class="se-day' + (D.days.indexOf(i + 1) > -1 ? ' on' : '') + '" data-d="' + (i + 1) + '" aria-pressed="' + (D.days.indexOf(i + 1) > -1) + '" onclick="this.classList.toggle(\'on\');this.setAttribute(\'aria-pressed\',this.classList.contains(\'on\'))">' + s + '</button>';
        }).join('') + '</div></div><div class="se-two">' + field('Ochilish', 'open', D.open, { type: 'time', max: 5 }) + field('Yopilish', 'close', D.close, { type: 'time', max: 5 }) + '</div></div>' +
            '<p class="a1-foot">Vaqt kiritilsa, «Hozir ochiq / Yopiq» belgisi Toshkent vaqti bo\'yicha avtomatik ko\'rsatiladi.</p>';
        h += '<div class="a1-sec">Yetkazib berish</div><div class="a1-grp" data-list="dv">' + D.deliv.map(liDeliv).join('') + addBtn('dv', 'Yo\'nalish qo\'shish') + '</div>';
        h += '<div class="a1-sec">Afzalliklar (yuqoridagi raqamlar)</div><div class="a1-grp" data-list="st">' + D.stats.map(liStat).join('') + addBtn('st', 'Qo\'shish') + '</div>';
        h += '<div class="a1-sec">Kafolat shartlari</div><div class="a1-grp">' + field('Har bir qator — alohida band', 'warr', D.warr.join('\n'), { area: 1, rows: 6, max: 2400 }) + '</div>';
        h += '<div class="a1-sec">Pul qaytarish bosqichlari</div><div class="a1-grp">' + field('Har bir qator — alohida bosqich', 'refund', D.refund.join('\n'), { area: 1, rows: 4, max: 1600 }) + '</div>' +
            '<p class="a1-foot">Maslahat: so\'zni **ikki yulduzcha** ichiga olsangiz, u tilla rangda qalin ko\'rinadi.</p>';
        h += '<div class="a1-sec">Qo\'shimcha izoh (ixtiyoriy)</div><div class="a1-grp">' + field('Kafolat sahifasi oxirida chiqadi', 'note', D.note, { area: 1, rows: 3, max: 400 }) + '</div>';
        h += '<div class="se-bar"><button type="button" class="a1-btn is-gold" id="se-save" onclick="ShopInfo._save()">' + svg('check', '') + 'Saqlash</button>' +
            '<button type="button" class="se-reset" onclick="ShopInfo._reset()">Standart matnlarga qaytarish</button></div>';
        return h;
    }
    function openEditor() {
        if (!isAdm()) { toast('Faqat admin uchun', 'warning'); return; }
        var m = document.getElementById('shopInfoModal');
        if (!m) {
            m = document.createElement('div');
            m.className = 'modal-standard'; m.id = 'shopInfoModal';
            m.innerHTML = '<div class="modal-header"><h2>Do\'kon ma\'lumotlari</h2><button class="close-btn" aria-label="Yopish" onclick="closeModal()">\u00D7</button></div><div id="se-body"></div>';
            document.body.appendChild(m);
        }
        document.getElementById('se-body').innerHTML = formHTML(S);
        if (typeof openModal === 'function') openModal('shopInfoModal');
        try { m.scrollTop = 0; } catch (e) {}
    }
    function collect() {
        var b = document.getElementById('se-body'); if (!b) return null;
        function v(n) { var el = b.querySelector('[name="' + n + '"]'); return el ? el.value : ''; }
        function list(k, fields) {
            return Array.prototype.map.call(b.querySelectorAll('.se-li[data-k="' + k + '"]'), function (li) {
                var o = {}; fields.forEach(function (f) { var el = li.querySelector('[data-f="' + f + '"]'); o[f] = el ? el.value : ''; }); return o;
            });
        }
        function lines(n) { return v(n).split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
        return {
            phones: list('ph', ['l', 'n']), tgUser: v('tgUser'), ig: v('ig'),
            addr: v('addr'), mark: v('mark'), lat: v('lat'), lng: v('lng'),
            days: Array.prototype.map.call(b.querySelectorAll('.se-day.on'), function (x) { return +x.getAttribute('data-d'); }),
            open: v('open'), close: v('close'),
            deliv: list('dv', ['t', 's', 'v']), stats: list('st', ['v', 'l']),
            warr: lines('warr'), refund: lines('refund'), note: v('note')
        };
    }
    API._rm = function (btn) { var li = btn.closest('.se-li'); if (li) li.remove(); hap('light'); };
    API._add = function (btn, kind) {
        var grp = btn.parentNode, n = grp.querySelectorAll('.se-li').length;
        var lim = { ph: 6, dv: 6, st: 4 }[kind];
        if (n >= lim) { toast('Ko\'pi bilan ' + lim + ' ta', 'warning'); return; }
        var html = kind === 'ph' ? liPhone({ l: '', n: '' }) : kind === 'dv' ? liDeliv({ t: '', s: '', v: '' }) : liStat({ v: '', l: '' });
        btn.insertAdjacentHTML('beforebegin', html);
        var inp = btn.previousElementSibling && btn.previousElementSibling.querySelector('input'); if (inp) inp.focus();
        hap('light');
    };
    API._geo = function (btn) {
        if (!navigator.geolocation) { toast('Qurilma joylashuvni bermaydi', 'warning'); return; }
        btn.classList.add('se-busy');
        navigator.geolocation.getCurrentPosition(function (pos) {
            btn.classList.remove('se-busy');
            var b = document.getElementById('se-body');
            b.querySelector('[name="lat"]').value = pos.coords.latitude.toFixed(6);
            b.querySelector('[name="lng"]').value = pos.coords.longitude.toFixed(6);
            hap('success'); toast('Joylashuv olindi');
        }, function () { btn.classList.remove('se-busy'); toast('Joylashuvga ruxsat berilmadi', 'warning'); }, { enableHighAccuracy: true, timeout: 12000 });
    };
    API._reset = function () {
        var b = document.getElementById('se-body'); if (!b) return;
        var keep = collect(), D = normalize(null);
        D.phones = normalize({ phones: keep.phones }).phones; D.tgUser = cleanTg(keep.tgUser); D.ig = cleanIg(keep.ig);
        D.addr = str(keep.addr, 220); D.mark = str(keep.mark, 160); D.lat = cleanCoord(keep.lat, 90); D.lng = cleanCoord(keep.lng, 180);
        D.days = keep.days; D.open = cleanTime(keep.open); D.close = cleanTime(keep.close);
        b.innerHTML = formHTML(D);
        toast('Matnlar standartga qaytdi — saqlash uchun «Saqlash»ni bosing');
    };
    API._save = function () {
        if (!isAdm()) { toast('Faqat admin uchun', 'warning'); return; }
        var raw = collect(); if (!raw) return;
        raw.updatedAt = Date.now();
        var D = normalize(raw);
        if (!D.phones.length) { toast('Kamida bitta telefon raqam kiriting', 'warning'); return; }
        if ((raw.lat || raw.lng) && !(D.lat && D.lng)) { toast('Koordinata noto\'g\'ri (masalan: 41.311081)', 'warning'); return; }
        if ((raw.open || raw.close) && !(D.open && D.close)) { toast('Ochilish va yopilish vaqtini to\'liq kiriting', 'warning'); return; }
        var d = getDb(), btn = document.getElementById('se-save');
        if (!d) { toast('Baza ulanmagan', 'warning'); return; }
        if (btn) btn.classList.add('se-busy');
        var go = function () {
            d.ref(PATH).set(D).then(function () {
                apply(D); hap('success'); toast('✅ Do\'kon ma\'lumotlari saqlandi');
                if (btn) btn.classList.remove('se-busy');
                if (typeof closeModal === 'function') closeModal();
            }).catch(function (err) {
                if (btn) btn.classList.remove('se-busy');
                toast('Saqlanmadi: ' + ((err && err.code) || 'ruxsat yo\'q'), 'warning');
            });
        };
        if (window._ensureAuth) window._ensureAuth().then(go, go); else go();
    };

    /* ——— ochilganda yangilab chizish (admin belgisi auth'dan keyin aniqlanadi) ——— */
    var _open = window.openModal;
    if (typeof _open === 'function') {
        window.openModal = function (id) {
            if (id === 'contactModal' || id === 'trustModal') { try { API.render(id); } catch (e) {} }
            return _open.apply(this, arguments);
        };
    }

    /* ——— Firebase'dan jonli tinglash ——— */
    var tries = 0;
    (function listen() {
        var d = getDb();
        if (!d || !d.ref) { if (++tries < 40) setTimeout(listen, 250); return; }
        try {
            d.ref(PATH).on('value', function (snap) {
                var v = snap && snap.val();
                if (v && typeof v === 'object') apply(v);
            }, function () {});
        } catch (e) {}
    })();

    function boot() { API.render(); syncCheckoutRow(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
