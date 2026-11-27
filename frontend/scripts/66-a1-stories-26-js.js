
(function a1Stories26() {
    'use strict';
    if (window.__a1sv26) return;
    window.__a1sv26 = true;

    var W = window, D = document, ROOT = D.documentElement;

    /* ═══════════════ 0) YORDAMCHILAR ═══════════════ */
    function $(s, r) { return (r || D).querySelector(s); }
    function mk(tag, cls, html) { var e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
        });
    }
    function hap(k) { try { if (typeof W._hap === 'function') W._hap(k || 'light'); } catch (e) {} }
    function toast(m, k) { try { if (typeof W.showToast === 'function') W.showToast(m, k || 'success'); } catch (e) {} }
    function tierLow() { return ROOT.classList.contains('lite') || ROOT.getAttribute('data-perf') === 'low'; }
    function tierHigh() { return !tierLow() && ROOT.getAttribute('data-perf') === 'high'; }
    function reduced() { try { return !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
    function lowData() {
        try { var c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g$/.test(String(c.effectiveType || '')))); }
        catch (e) { return false; }
    }
    function DBX() {
        try { if (typeof db !== 'undefined' && db && db.ref) return db; } catch (e) {}
        try { return (W.firebase && firebase.database) ? firebase.database() : null; } catch (e) { return null; }
    }
    function authUid() { try { var u = (W.firebase && firebase.auth) ? firebase.auth().currentUser : null; return u ? String(u.uid) : ''; } catch (e) { return ''; } }
    function amAdmin() { try { return typeof W.isAdmin === 'function' && !!W.isAdmin(); } catch (e) { return false; } }
    function lsGet(k) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; } }
    function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function trimMap(m, max) {
        var ks = Object.keys(m);
        if (ks.length <= max) return m;
        ks.sort(function (a, b) {
            var x = m[a], y = m[b];
            var tx = typeof x === 'number' ? x : (x && x.t) || (Array.isArray(x) && x.length ? x[x.length - 1].t : 0);
            var ty = typeof y === 'number' ? y : (y && y.t) || (Array.isArray(y) && y.length ? y[y.length - 1].t : 0);
            return (tx || 0) - (ty || 0);
        });
        ks.slice(0, ks.length - max).forEach(function (k) { delete m[k]; });
        return m;
    }
    function anim(el, kf, o) { try { if (el && el.animate) return el.animate(kf, o); } catch (e) {} return null; }
    function ago(ts) {
        ts = Number(ts) || 0;
        if (!ts) return '';
        var s = Math.max(0, (Date.now() - ts) / 1000);
        if (s < 60) return 'hozir';
        if (s < 3600) return Math.floor(s / 60) + ' daqiqa';
        if (s < 86400) return Math.floor(s / 3600) + ' soat';
        if (s < 172800) return 'kecha';
        if (s < 86400 * 30) return Math.floor(s / 86400) + ' kun';
        try { return new Date(ts).toLocaleDateString('uz-UZ'); } catch (e) { return ''; }
    }
    function agoLong(ts) { var a = ago(ts); return (/daqiqa|soat|kun$/.test(a)) ? a + ' oldin' : a; }
    function initials(n) {
        var w = String(n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
        return (w.map(function (x) { return Array.from(x)[0] || ''; }).join('') || '?').toUpperCase();
    }
    function confirmAsk(q) {
        return new Promise(function (res) {
            try {
                if (typeof W._a1Confirm === 'function') { W._a1Confirm(q).then(res, function () { res(false); }); return; }
                if (typeof tg !== 'undefined' && tg.showConfirm && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) { tg.showConfirm(q, function (ok) { res(!!ok); }); return; }
            } catch (e) {}
            try { res(W.confirm(q)); } catch (e) { res(false); }
        });
    }
    function isTgInit() { try { return typeof tg !== 'undefined' && tg && tg.initData ? String(tg.initData) : ''; } catch (e) { return ''; } }
    function proxyBase() { try { return typeof TG_PROXY !== 'undefined' ? TG_PROXY : 'https://avtoa1bot.anvaraxtamov70.workers.dev'; } catch (e) { return 'https://avtoa1bot.anvaraxtamov70.workers.dev'; } }

    var IC = {
        x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        on: '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
        off: '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
        heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>',
        send: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>',
        eye: '<svg viewBox="0 0 24 24"><path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3.2"/></svg>',
        chat: '<svg viewBox="0 0 24 24"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20l1.2-4.1A8.5 8.5 0 1 1 20.5 11.5z"/></svg>',
        trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12.2A2 2 0 0 0 8.5 21h7a2 2 0 0 0 2-1.8L18.5 7M9 7V4.5h6V7"/></svg>',
        chev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
        ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#e2c46e" d="M12 1.8l2.5 1.9 3.1-.3 1.1 2.9 2.7 1.6-.6 3.1 1.3 2.8-2.3 2.1-.4 3.1-3.1.5-2 2.4-2.9-1.2-2.9 1.2-2-2.4-3.1-.5-.4-3.1L.8 13.8l1.3-2.8-.6-3.1 2.7-1.6 1.1-2.9 3.1.3z"/><path d="M7.8 12.3l2.8 2.8 5.6-5.8" fill="none" stroke="#1a1405" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        warn: '<svg viewBox="0 0 24 24"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.2"/></svg>',
        bolt: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
        users: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>'
    };
    var EMOJI = ['\u2764\uFE0F', '\uD83D\uDD25', '\uD83D\uDC4D', '\uD83D\uDE2E', '\uD83D\uDE02', '\u2753'];
    var IMAGE_MS = 5600;
    var NAMES = { aksiyalar: 'Aksiyalar', bugun: 'Bugun', mijozlar: 'Mijozlar', dostavka: 'Yetkazish', kafolat: 'Kafolat', lokatsiya: 'Manzil', tolov: "To\u2018lov", aloqa: 'Aloqa' };

    function ringEl(cat) { return D.querySelector('.story-ring[data-story="' + String(cat).replace(/["\\]/g, '') + '"]'); }
    function ringOrder() {
        var out = [];
        D.querySelectorAll('.story-ring[data-story]').forEach(function (r) { var c = r.getAttribute('data-story'); if (c && out.indexOf(c) < 0) out.push(c); });
        Object.keys(NAMES).forEach(function (c) { if (out.indexOf(c) < 0) out.push(c); });
        return out;
    }
    function catName(cat) {
        var r = ringEl(cat), s = r && r.parentElement ? r.parentElement.querySelector('span') : null;
        return (s && s.textContent.trim()) || NAMES[cat] || String(cat);
    }
    function catAvatar(cat) { var r = ringEl(cat), i = r ? r.querySelector('img') : null; return i ? (i.currentSrc || i.src || '') : ''; }

    /* ═══════════════ 1) MA'LUMOT (Firebase `stories`, kalitlari bilan) ═══════════════ */
    var DATA = {}, RAW = {};
    function sidFor(cat, key) { return String(cat) + '__' + String(key); }
    function legacyKey(cat, v) { v = v || {}; return String(v.id || v.story_id || v.src || ((cat || '-') + ':' + (v.timestamp || ''))); }
    function norm(cat, key, v) {
        var src = String(v.src || '');
        // Tashqi havola emas yoki eski (bot tokeni ochiq turgan) havola — ko'rsatilmaydi.
        if (!/^https:\/\//i.test(src) || /api\.telegram\.org\/file\/bot/i.test(src)) return null;
        var poster = String(v.poster || '');
        return {
            cat: cat, key: String(key), sid: sidFor(cat, key), type: v.type === 'video' ? 'video' : 'image', src: src,
            poster: /^https:\/\//i.test(poster) ? poster : '', caption: String(v.caption || '').slice(0, 300),
            link: String(v.link || '').slice(0, 500), ts: Number(v.timestamp) || 0, raw: v
        };
    }
    function ingest(val) {
        var out = {};
        RAW = (val && typeof val === 'object') ? val : {};
        Object.keys(RAW).forEach(function (cat) {
            var node = RAW[cat];
            if (!node || typeof node !== 'object') return;
            var list = Object.keys(node).map(function (k) {
                return (node[k] && typeof node[k] === 'object') ? norm(cat, k, node[k]) : null;
            }).filter(Boolean).sort(function (a, b) { return a.ts - b.ts; });
            if (list.length) out[cat] = list;
        });
        var prev = DATA;
        DATA = out;
        gcRemoved(prev, out);
        if (S.open) onDataChanged();
        if (MGR.painted) schedule(paintManager);
    }
    function findItem(cat, key) {
        var l = DATA[cat] || [];
        for (var i = 0; i < l.length; i++) if (l[i].key === String(key)) return l[i];
        return null;
    }
    function listen() {
        var d = DBX();
        if (!d) { setTimeout(listen, 700); return; }
        try { d.ref('stories').on('value', function (s) { ingest(s.val()); }, function () {}); } catch (e) {}
    }
    /** Admin qurilmasida: o'chirilgan storisning ko'rish/javoblarini ham tozalaymiz. */
    function gcRemoved(prev, next) {
        if (!amAdmin()) return;
        var had = {};
        Object.keys(prev).forEach(function (c) { prev[c].forEach(function (it) { had[it.sid] = 1; }); });
        Object.keys(next).forEach(function (c) { next[c].forEach(function (it) { delete had[it.sid]; }); });
        var d = DBX();
        Object.keys(had).forEach(function (sid) {
            if (!d) return;
            try { d.ref('story_views/' + sid).remove().catch(function () {}); } catch (e) {}
            try { d.ref('story_replies/' + sid).remove().catch(function () {}); } catch (e) {}
            delete STATS[sid];
        });
    }

    /* ═══════════════ 2) KO'RILGAN — qurilma + Firebase (ko'rgan odamga halqa QAYTA YONMAYDI) ═══════════════ */
    var SEEN2_KEY = 'a1_story_seen_v2', SEEN1_KEY = 'avto_seen_story_items';
    var SEEN2 = lsGet(SEEN2_KEY), SEEN1 = lsGet(SEEN1_KEY);
    function itemSid(cat, it) {
        if (!it) return '';
        if (it.sid) return it.sid;
        var k = it._key != null ? it._key : (it.key != null ? it.key : it.id);
        return k != null ? sidFor(cat, k) : '';
    }
    function isSeen(cat, it) {
        if (!it) return false;
        var s = itemSid(cat, it);
        return !!((s && SEEN2[s]) || SEEN1[legacyKey(cat, it.raw || it)]);
    }
    var seenQ = {}, seenT = 0;
    function markSeen(it) {
        if (!it) return;
        var t = Date.now(), ch = false;
        if (!SEEN2[it.sid]) { SEEN2[it.sid] = t; ch = true; seenQ[it.sid] = t; }
        var lk = legacyKey(it.cat, it.raw);
        if (!SEEN1[lk]) { SEEN1[lk] = t; ch = true; }
        if (ch) {
            lsSet(SEEN2_KEY, trimMap(SEEN2, 800));
            lsSet(SEEN1_KEY, trimMap(SEEN1, 600));
            clearTimeout(seenT); seenT = setTimeout(flushSeen, 1500);
        }
        recordView(it);
    }
    function flushSeen() {
        var uid = authUid(), d = DBX(), up = seenQ;
        if (!uid || !d || !Object.keys(up).length) return;
        seenQ = {};
        try { d.ref('users/' + uid + '/story_seen').update(up).catch(function () { Object.keys(up).forEach(function (k) { seenQ[k] = up[k]; }); }); } catch (e) {}
    }
    var pulledFor = '';
    function pullSeen() {
        var uid = authUid(), d = DBX();
        if (!uid || !d || pulledFor === uid) return;
        pulledFor = uid;
        try {
            d.ref('users/' + uid + '/story_seen').once('value').then(function (s) {
                var v = s.val() || {}, ch = false;
                Object.keys(v).forEach(function (k) { if (!SEEN2[k]) { SEEN2[k] = Number(v[k]) || 1; ch = true; } });
                // Qurilmada ko'rilgan, lekin bulutda yo'q — bulutga ham yozamiz (boshqa qurilmada ham kulrang tursin)
                Object.keys(DATA).forEach(function (c) {
                    DATA[c].forEach(function (it) { if (!v[it.sid] && isSeen(c, it)) seenQ[it.sid] = SEEN2[it.sid] || Date.now(); });
                });
                if (ch) { lsSet(SEEN2_KEY, trimMap(SEEN2, 800)); refreshRings(); }
                if (Object.keys(seenQ).length) flushSeen();
            }).catch(function () { pulledFor = ''; });
        } catch (e) { pulledFor = ''; }
    }
    function refreshRings() { try { if (typeof W._refreshStoryRingsPublic === 'function') W._refreshStoryRingsPublic(); } catch (e) {} }
    function firstUnseen(cat) {
        var l = DATA[cat] || [];
        for (var i = 0; i < l.length; i++) if (!isSeen(cat, l[i])) return i;
        return 0;
    }

    /* ═══════════════ 3) KO'RISHLAR (admin uchun "kim ko'rdi") ═══════════════ */
    var viewedNow = {};
    function whoAmI() {
        var tu = null, pr = null;
        try { tu = (typeof tg !== 'undefined' && tg.initDataUnsafe && tg.initDataUnsafe.user) || null; } catch (e) {}
        try { pr = (typeof myProfile !== 'undefined' && myProfile) ? myProfile : null; } catch (e) {}
        var n = (pr && pr.name && pr.name !== 'Mijoz') ? pr.name : '';
        if (!n && tu) n = ((tu.first_name || '') + (tu.last_name ? ' ' + tu.last_name : '')).trim();
        var a = (pr && /^https:\/\//.test(String(pr.avatar || ''))) ? String(pr.avatar) : ((tu && /^https:\/\//.test(String(tu.photo_url || ''))) ? String(tu.photo_url) : '');
        var u = (tu && tu.username) ? String(tu.username).replace(/^@+/, '') : '';
        return { n: String(n || '').slice(0, 80), a: a.slice(0, 500), u: /^[A-Za-z0-9_]{3,64}$/.test(u) ? u : '' };
    }
    function recordView(it) {
        if (!it || viewedNow[it.sid] || amAdmin()) return;
        var uid = authUid(), d = DBX();
        if (!uid || !d) return;
        viewedNow[it.sid] = 1;
        var me = whoAmI(), rec = { t: Date.now() };
        if (me.n) rec.n = me.n;
        if (me.a) rec.a = me.a;
        if (me.u) rec.u = me.u;
        try { d.ref('story_views/' + it.sid + '/' + uid).set(rec).catch(function () { viewedNow[it.sid] = 0; }); } catch (e) {}
    }

    /* ═══════════════ MP4 "faststart" (qayta kodlashsiz) ═══════════════ */
    function a1FastStartBytes(b) {
        function rU32(buf, o) { return ((buf[o] << 24) >>> 0) + (buf[o + 1] << 16) + (buf[o + 2] << 8) + buf[o + 3]; }
        function rU64(buf, o) { return rU32(buf, o) * 4294967296 + rU32(buf, o + 4); }
        function wU32(buf, o, v) { buf[o] = (v >>> 24) & 255; buf[o + 1] = (v >>> 16) & 255; buf[o + 2] = (v >>> 8) & 255; buf[o + 3] = v & 255; }
        function wU64(buf, o, v) { wU32(buf, o, Math.floor(v / 4294967296)); wU32(buf, o + 4, v % 4294967296); }
        function typ(buf, o) { return String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]); }
        function atoms(buf, start, end) {
            var out = [], o = start;
            while (o + 8 <= end) {
                var size = rU32(buf, o), t = typ(buf, o + 4), hdr = 8;
                if (size === 1) { if (o + 16 > end) return null; size = rU64(buf, o + 8); hdr = 16; }
                else if (size === 0) size = end - o;
                if (size < hdr || o + size > end) return null;
                out.push({ t: t, s: o, n: size, h: hdr });
                o += size;
            }
            return o === end ? out : null;
        }
        var BOXES = { moov: 1, trak: 1, mdia: 1, minf: 1, stbl: 1 };
        function patch(buf, start, end, delta, lo, hi) {
            var list = atoms(buf, start, end);
            if (!list) return false;
            for (var i = 0; i < list.length; i++) {
                var a = list[i], p, c, k, v, w;
                if (a.t === 'stco' || a.t === 'co64') {
                    w = a.t === 'stco' ? 4 : 8;
                    c = rU32(buf, a.s + a.h + 4);
                    p = a.s + a.h + 8;
                    if (p + c * w > a.s + a.n) return false;
                    for (k = 0; k < c; k++, p += w) {
                        v = w === 4 ? rU32(buf, p) : rU64(buf, p);
                        if (v >= lo && v < hi) {
                            v += delta;
                            if (w === 4) { if (v > 4294967295) return false; wU32(buf, p, v); } else wU64(buf, p, v);
                        }
                    }
                } else if (BOXES[a.t]) {
                    if (!patch(buf, a.s + a.h, a.s + a.n, delta, lo, hi)) return false;
                }
            }
            return true;
        }
        var top = atoms(b, 0, b.length);
        if (!top) return null;
        var mi = -1, di = -1, i;
        for (i = 0; i < top.length; i++) {
            if (top[i].t === 'moof') return null;
            if (top[i].t === 'moov' && mi < 0) mi = i;
            if (top[i].t === 'mdat' && di < 0) di = i;
        }
        if (mi < 0 || di < 0 || mi < di || top[mi].h !== 8) return null;
        var mv = top[mi];
        var moov = b.slice(mv.s, mv.s + mv.n);
        if (!patch(moov, 8, moov.length, mv.n, top[di].s, mv.s)) return null;
        var out = new Uint8Array(b.length), wp = 0;
        function put(a) { out.set(b.subarray(a.s, a.s + a.n), wp); wp += a.n; }
        for (i = 0; i < di; i++) put(top[i]);
        out.set(moov, wp); wp += moov.length;
        for (i = di; i < top.length; i++) if (i !== mi) put(top[i]);
        return wp === b.length ? out : null;
    }

    /* ═══════════════ 4) KO'RUVCHI (VIEWER) ═══════════════ */
    var S = {
        built: false, open: false, closing: false, root: null, bg: null, deck: null, cards: [], cur: 0,
        cats: [], ci: 0, ii: 0, gen: 0, item: null, media: null, ready: false, prog: null, vWaiting: false,
        hold: false, typing: false, sheet: false, hidden: false, menu: false, dragging: false,
        pushed: false, fromRing: false, muted: false, policyMuted: false,
        holdT: 0, dogT: 0, stallT: 0, spinT: 0, endT: 0, errT: 0, popT: 0, afterReady: null
    };
    try { S.muted = localStorage.getItem('a1sv_muted') === '1'; } catch (e) {}
    var PRE = { img: {}, imgKeys: [], v: null };

    function buildCard() {
        var c = mk('section', 'a1sv-card');
        c.hidden = true;
        c.innerHTML =
            '<div class="a1sv-media"><div class="a1sv-m"></div><div class="a1sv-m"></div></div>' +
            '<div class="a1sv-gt"></div><div class="a1sv-gb"></div>' +
            '<div class="a1sv-top"><div class="a1sv-bars"></div>' +
                '<div class="a1sv-head"><span class="a1sv-av"><img alt="" decoding="async"></span>' +
                    '<span class="a1sv-id"><b></b><span>Avto A1' + IC.ok + '</span></span>' +
                    '<span class="a1sv-acts">' +
                        '<button type="button" class="a1sv-btn a1sv-snd" aria-label="Ovoz" hidden></button>' +
                        '<button type="button" class="a1sv-btn a1sv-x" aria-label="Yopish">' + IC.x + '</button>' +
                    '</span></div></div>' +
            '<div class="a1sv-spin"><i></i></div>' +
            '<div class="a1sv-err"><b>Yuklanmadi</b><span>Internet sust bo\u2018lishi mumkin</span><button type="button">Qayta urinish</button></div>' +
            '<div class="a1sv-cap"><p></p><button type="button" class="a1sv-link" hidden><span>Batafsil</span>' + IC.chev + '</button></div>';
        return {
            el: c, slots: [].slice.call(c.querySelectorAll('.a1sv-m')), on: 0, bars: c.querySelector('.a1sv-bars'),
            name: c.querySelector('.a1sv-id b'), av: c.querySelector('.a1sv-av img'), snd: c.querySelector('.a1sv-snd'),
            spin: c.querySelector('.a1sv-spin'), err: c.querySelector('.a1sv-err'), capP: c.querySelector('.a1sv-cap p'),
            link: c.querySelector('.a1sv-link'), cat: null
        };
    }

    function build() {
        if (S.built) return;
        S.built = true;
        var r = mk('div', '');
        r.id = 'a1sv';
        r.setAttribute('role', 'dialog');
        r.setAttribute('aria-modal', 'true');
        r.setAttribute('aria-label', 'Stories');
        r.innerHTML = '<div class="a1sv-bg" style="position:absolute;inset:0;background:#000"></div><div class="a1sv-deck"></div><div class="a1sv-hint"></div>' +
            '<div class="a1sv-foot">' +
                '<div class="a1sv-mine" hidden></div>' +
                '<div class="a1sv-tray" role="group" aria-label="Tezkor reaksiya"></div>' +
                '<div class="a1sv-row a1sv-cust">' +
                    '<form class="a1sv-reply" autocomplete="off" novalidate><input type="text" maxlength="500" enterkeyhint="send" placeholder="Javob yozing\u2026" aria-label="Javob yozing">' +
                    '<button type="submit" class="a1sv-send" aria-label="Yuborish">' + IC.send + '</button></form>' +
                    '<button type="button" class="a1sv-ic a1sv-like" aria-label="Yoqdi">' + IC.heart + '</button>' +
                '</div>' +
                '<div class="a1sv-row a1sv-adm" hidden>' +
                    '<button type="button" class="a1sv-pill a1sv-views" aria-label="Kim ko\u2018rdi"><span class="a1sv-faces"></span>' + IC.eye + '<span class="a1sv-vn">0</span><em>ko\u2018rdi</em></button>' +
                    '<button type="button" class="a1sv-pill a1sv-reps" aria-label="Javoblar">' + IC.chat + '<span class="a1sv-rn">0</span></button>' +
                    '<span class="a1sv-flex"></span>' +
                    '<button type="button" class="a1sv-btn a1sv-del" aria-label="O\u2018chirish">' + IC.trash + '</button>' +
                '</div>' +
            '</div>';
        D.body.appendChild(r);
        S.root = r;
        S.bg = r.querySelector('.a1sv-bg');
        S.deck = r.querySelector('.a1sv-deck');
        S.hint = r.querySelector('.a1sv-hint');
        S.foot = r.querySelector('.a1sv-foot');
        S.mine = r.querySelector('.a1sv-mine');
        S.tray = r.querySelector('.a1sv-tray');
        S.cust = r.querySelector('.a1sv-cust');
        S.adm = r.querySelector('.a1sv-adm');
        S.form = r.querySelector('.a1sv-reply');
        S.input = S.form.querySelector('input');
        S.like = r.querySelector('.a1sv-like');
        S.tray.innerHTML = EMOJI.map(function (e) { return '<button type="button" data-e="' + e + '" aria-label="' + e + '">' + e + '</button>'; }).join('');
        S.cards = [buildCard(), buildCard()];
        S.cards.forEach(function (c) { S.deck.appendChild(c.el); });
        wire();
    }

    function cardEl() { return S.cards[S.cur].el; }
    function curCard() { return S.cards[S.cur]; }

    /* ---------- media slotlari ---------- */
    function releaseEl(el) {
        if (!el) return;
        if (el.tagName === 'VIDEO') {
            try { if (el.__off) el.__off(); } catch (e) {}
            try { el.pause(); el.removeAttribute('src'); el.removeAttribute('poster'); el.load(); } catch (e) {}
            el.__src = '';
        } else if (el.tagName === 'IMG') {
            el.onload = el.onerror = null;
        }
    }
    function clearSlot(slot) {
        if (!slot) return;
        try { if (slot.getAnimations) slot.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
        while (slot.firstChild) { releaseEl(slot.firstChild); slot.removeChild(slot.firstChild); }
        slot.classList.remove('is-on');
        slot.removeAttribute('data-fit');
        slot.style.opacity = '';
        slot.style.transform = '';
    }
    function resetCard(card) {
        card.slots.forEach(clearSlot);
        card.on = 0;
        card.el.classList.remove('has-cap');
        setSpin(card, false);
        setErr(card, false);
        try { card.el.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
        card.el.style.transform = '';
        card.el.style.opacity = '';
        card.el.style.zIndex = '';
    }
    /** Media va kartaning nisbati yaqin bo'lsa — to'liq qoplaydi (cover), aks holda butun ko'rinadi + xira fon. */
    function fit(slot, w, h) {
        if (!slot || !w || !h) return;
        var r = S.deck.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var k = (w / h) / (r.width / r.height);
        if (k > 0.82 && k < 1.22) slot.setAttribute('data-fit', 'cover'); else slot.removeAttribute('data-fit');
    }
    function setSpin(card, on) {
        if (!card || !card.spin) return;
        card.spin.classList.toggle('on', !!on);
        var i = card.spin.firstChild;
        if (on && !card.spinA) card.spinA = anim(i, [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 850, iterations: Infinity });
        if (!on && card.spinA) { try { card.spinA.cancel(); } catch (e) {} card.spinA = null; }
    }
    function setErr(card, on) { if (card && card.err) card.err.classList.toggle('on', !!on); }
    function spinSoon(card, g) {
        clearTimeout(S.spinT);
        S.spinT = setTimeout(function () { if (g === S.gen && (!S.ready || S.vWaiting)) setSpin(card, true); }, 360);
    }
    function clearTimers() {
        clearTimeout(S.dogT); clearTimeout(S.stallT); clearTimeout(S.spinT); clearTimeout(S.endT); clearTimeout(S.errT);
        S.afterReady = null;
    }
    function fillOf(card, ii) { var s = card.bars.children[ii]; return s ? s.firstChild : null; }

    /* ---------- progress (Web Animations: transform, kompozitorda) ---------- */
    function makeProg(fill, ms, onEnd) {
        var p = { ms: Math.max(400, ms || IMAGE_MS), t: 0, playing: false, dead: false, a: null, raf: 0, last: 0 };
        if (fill && fill.animate) {
            try {
                p.a = fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: p.ms, easing: 'linear', fill: 'forwards' });
                p.a.pause();
                p.a.onfinish = function () { if (!p.dead) { p.dead = true; p.playing = false; onEnd(); } };
            } catch (e) { p.a = null; }
        }
        p.play = function () {
            if (p.dead || p.playing) return;
            p.playing = true;
            if (p.a) { try { p.a.play(); } catch (e) {} return; }
            if (!fill) return;
            p.last = performance.now();
            var step = function (now) {
                if (!p.playing || p.dead) return;
                p.t += now - p.last; p.last = now;
                var k = Math.min(1, p.t / p.ms);
                fill.style.transform = 'scaleX(' + k + ')';
                if (k >= 1) { p.dead = true; p.playing = false; onEnd(); return; }
                p.raf = requestAnimationFrame(step);
            };
            p.raf = requestAnimationFrame(step);
        };
        p.pause = function () { if (!p.playing) return; p.playing = false; if (p.a) { try { p.a.pause(); } catch (e) {} } else cancelAnimationFrame(p.raf); };
        p.time = function () { return p.a ? (Number(p.a.currentTime) || 0) : p.t; };
        p.seek = function (t) {
            t = Math.max(0, Math.min(p.ms - 1, t));
            if (p.a) { try { p.a.currentTime = t; } catch (e) {} } else { p.t = t; if (fill) fill.style.transform = 'scaleX(' + (t / p.ms) + ')'; }
        };
        p.setDuration = function (ms2) {
            ms2 = Math.max(400, ms2);
            if (Math.abs(ms2 - p.ms) < 60) return;
            var k = p.time() / p.ms;
            p.ms = ms2;
            if (p.a) { try { p.a.effect.updateTiming({ duration: ms2 }); p.a.currentTime = k * ms2; } catch (e) {} }
        };
        p.cancel = function () { p.dead = true; p.playing = false; if (p.a) { try { p.a.cancel(); } catch (e) {} } else cancelAnimationFrame(p.raf); };
        return p;
    }
    function stopProgress() { if (S.prog) { S.prog.cancel(); S.prog = null; } }
    function paintBars(card, ii) {
        var list = DATA[card.cat] || [];
        if (card.bars.children.length !== list.length) card.bars.innerHTML = list.map(function () { return '<span><i></i></span>'; }).join('');
        var kids = card.bars.children;
        for (var i = 0; i < kids.length; i++) {
            var f = kids[i].firstChild;
            try { if (f.getAnimations) f.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
            f.style.transform = i < ii ? 'scaleX(1)' : 'scaleX(0)';
        }
    }

    /* ---------- pauza: bosib turish, yozish, statistika, fon, menyu, surish ---------- */
    function wantPause() { return S.hold || S.typing || S.sheet || S.hidden || S.menu || S.dragging; }
    function applyPause() {
        var m = S.media, p = wantPause();
        if (p) {
            if (S.prog) S.prog.pause();
            if (m && m.tagName === 'VIDEO') { try { m.pause(); } catch (e) {} }
            return;
        }
        if (m && m.tagName === 'VIDEO') { if (S.ready || m.readyState >= 2) safePlay(m); }
        else if (S.prog && S.ready) S.prog.play();
    }
    function safePlay(v) {
        if (!v || wantPause()) return;
        var pr;
        try { pr = v.play(); } catch (e) { pr = null; }
        if (pr && typeof pr.catch === 'function') {
            pr.catch(function (err) {
                // Brauzer ovozli avtoijroni bloklasa — ovozsiz davom etamiz (tugma bilan yoqiladi)
                if (err && err.name === 'NotAllowedError' && !v.muted && v === S.media) {
                    v.muted = true; S.policyMuted = true; paintSound();
                    hint(IC.off, 'Ovoz uchun \uD83D\uDD0A ni bosing');
                    try { v.play().catch(function () {}); } catch (e) {}
                }
            });
        }
    }
    function hint(icon, text) {
        if (!S.hint) return;
        S.hint.innerHTML = icon + '<span>' + esc(text) + '</span>';
        try { S.hint.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
        var a = anim(S.hint, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.92)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .18 },
            { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .8 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.98)' }], { duration: 1500, easing: 'ease-out' });
        if (!a) { S.hint.style.opacity = '1'; setTimeout(function () { S.hint.style.opacity = '0'; }, 1300); }
    }
    function paintSound() {
        var card = curCard(), m = S.media;
        var isV = !!(m && m.tagName === 'VIDEO');
        S.cards.forEach(function (c) { c.snd.hidden = true; });
        if (!isV) return;
        card.snd.hidden = false;
        card.snd.innerHTML = m.muted ? IC.off : IC.on;
        card.snd.setAttribute('aria-label', m.muted ? 'Ovozni yoqish' : 'Ovozni o\u2018chirish');
    }
    function toggleSound() {
        var m = S.media;
        if (!m || m.tagName !== 'VIDEO') return;
        var muted = !m.muted;
        m.muted = muted; S.muted = muted; S.policyMuted = false;
        try { localStorage.setItem('a1sv_muted', muted ? '1' : '0'); } catch (e) {}
        if (PRE.v) PRE.v.muted = true;
        paintSound();
        hint(muted ? IC.off : IC.on, muted ? 'Ovozsiz' : 'Ovoz yoqildi');
        hap('selection');
        if (!muted) safePlay(m);
    }

    /* ---------- media yaratish ---------- */
    function mediaUrl(it) {
        // Worker /media: `t=v` — server videoni aniq "video/mp4" deb uzatsin (iOS Safari
        // `application/octet-stream` videoni ba'zan umuman o'ynatmaydi). Eski Worker
        // noma'lum parametrni e'tiborsiz qoldiradi.
        var s = it.src;
        if (it.type === 'video' && /\/media\?id=/.test(s) && !/[?&]t=/.test(s)) s += '&t=v';
        return s;
    }
    function newVideo() {
        var v = D.createElement('video');
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        v.setAttribute('disablepictureinpicture', '');
        v.setAttribute('disableremoteplayback', '');
        v.setAttribute('x-webkit-airplay', 'deny');
        v.setAttribute('preload', 'auto');
        v.playsInline = true;
        v.controls = false;
        return v;
    }
    function dropPreVideo() { if (PRE.v) { releaseEl(PRE.v); PRE.v = null; } }
    function failed(card, it, g) {
        if (g !== S.gen) return;
        clearTimers();
        stopProgress();
        setSpin(card, false);
        setErr(card, true);
        S.ready = false;
        // O'zi keyingisiga o'tadi (qotib qolmasin); "Qayta urinish" bosilsa — bekor qilinadi
        S.errT = setTimeout(function () { if (g === S.gen && S.open) next(); }, 3200);
    }
    function mountImage(slot, card, it, g) {
        var img = PRE.img[it.src] || null;
        delete PRE.img[it.src];
        // Oldindan yuklash yiqilgan bo'lsa (complete, lekin o'lchami 0) — uning `error`
        // hodisasi allaqachon o'tib ketgan: qayta ishlatsak storis watchdog'gacha qotardi.
        if (!img || (img.complete && !img.naturalWidth)) img = new Image();
        img.className = 'a1sv-el';
        img.alt = '';
        img.decoding = 'async';
        img.draggable = false;
        slot.appendChild(img);
        if (img.getAttribute('src') !== it.src) img.src = it.src;
        var done = false;
        var ready = new Promise(function (res) {
            var ok = function () {
                if (done) return; done = true;
                fit(slot, img.naturalWidth, img.naturalHeight);
                res(true);
            };
            var dec = function () { (img.decode ? img.decode() : Promise.resolve()).then(ok, ok); };
            if (img.complete && img.naturalWidth) { dec(); return; }
            img.onload = dec;
            // Yuklanmagan rasm brauzerning "singan rasm" belgisi va ramkasini chizmasin
            img.onerror = function () { img.style.visibility = 'hidden'; if (!done) { done = true; res(false); } };
        });
        ready.then(function (ok) {
            if (g !== S.gen) return;
            clearTimeout(S.dogT);
            setSpin(card, false);
            if (!ok) { failed(card, it, g); return; }
            S.ready = true;
            S.prog = makeProg(fillOf(card, S.ii), IMAGE_MS, function () { if (g === S.gen) next(); });
            applyPause();
            if (S.afterReady) { var f = S.afterReady; S.afterReady = null; f(); }
        });
        S.dogT = setTimeout(function () { if (g === S.gen && !S.ready) failed(card, it, g); }, 12000);
        spinSoon(card, g);
        return { el: img, ready: ready };
    }
    function mountVideo(slot, card, it, g) {
        var v = null;
        if (PRE.v && PRE.v.__src === it.src) {
            // Oldindan yuklash xato bilan tugagan bo'lsa — qayta ishlatmaymiz (yangisi yuklanadi)
            if (PRE.v.error) dropPreVideo(); else { v = PRE.v; PRE.v = null; }
        }
        if (!v) v = newVideo();
        v.className = 'a1sv-el';
        v.muted = S.muted;
        if (it.poster) v.setAttribute('poster', it.poster); else v.removeAttribute('poster');
        slot.appendChild(v);
        if (v.__src !== it.src) { v.__src = it.src; v.src = mediaUrl(it); }
        if (v.__off) v.__off();
        var H = {}, started = false, readyRes = null;
        var ready = new Promise(function (r) { readyRes = r; });
        var on = function (ev, fn) { H[ev] = function (e) { if (g === S.gen) fn(e); }; v.addEventListener(ev, H[ev]); };
        on('loadedmetadata', function () { fit(slot, v.videoWidth, v.videoHeight); });
        on('loadeddata', function () { readyRes(true); });
        on('canplay', function () { readyRes(true); if (v.paused && !wantPause()) safePlay(v); });
        on('playing', function () {
            S.vWaiting = false;
            clearTimeout(S.stallT); clearTimeout(S.dogT);
            setSpin(card, false);
            readyRes(true);
            if (!started) {
                started = true;
                S.ready = true;
                var d = (isFinite(v.duration) && v.duration > 0) ? v.duration * 1000 : 15000;
                S.prog = makeProg(fillOf(card, S.ii), d, function () {
                    // `ended` odatda shu zahoti keladi; kelmasa (fayl chala) — baribir o'tamiz
                    clearTimeout(S.endT);
                    S.endT = setTimeout(function () { if (g === S.gen) next(); }, 900);
                });
                S.prog.seek(v.currentTime * 1000);
                if (S.afterReady) { var f = S.afterReady; S.afterReady = null; setTimeout(f, 700); }
            }
            if (wantPause()) { try { v.pause(); } catch (e) {} return; }
            if (S.prog) S.prog.play();
        });
        on('pause', function () { if (S.prog) S.prog.pause(); });
        on('waiting', function () {
            S.vWaiting = true;
            if (S.prog) S.prog.pause();
            spinSoon(card, g);
            clearTimeout(S.stallT);
            S.stallT = setTimeout(function () { if (g === S.gen && S.vWaiting && !wantPause()) failed(card, it, g); }, 15000);
        });
        on('timeupdate', function () {
            if (!S.prog || !isFinite(v.duration) || !(v.duration > 0)) return;
            S.prog.setDuration(v.duration * 1000);
            var t = v.currentTime * 1000;
            if (Math.abs(S.prog.time() - t) > 260) S.prog.seek(t);
        });
        on('ended', function () { clearTimeout(S.endT); next(); });
        on('error', function () { readyRes(false); failed(card, it, g); });
        v.__off = function () { Object.keys(H).forEach(function (k) { v.removeEventListener(k, H[k]); }); v.__off = null; };
        if (v.readyState >= 2) readyRes(true);
        S.dogT = setTimeout(function () { if (g === S.gen && !started && v.readyState < 2) failed(card, it, g); }, 13000);
        spinSoon(card, g);
        if (!wantPause()) safePlay(v);
        return { el: v, ready: ready };
    }
    function mountMedia(slot, card, it, g) {
        clearSlot(slot);
        var bd = it.type === 'video' ? it.poster : it.src;
        if (bd && !tierLow()) {
            var b = new Image();
            b.className = 'a1sv-bd';
            b.alt = '';
            b.decoding = 'async';
            b.onerror = function () { b.style.visibility = 'hidden'; };
            b.src = bd;
            slot.appendChild(b);
        }
        return it.type === 'video' ? mountVideo(slot, card, it, g) : mountImage(slot, card, it, g);
    }
    function teardownCurrent() {
        var m = S.media;
        S.media = null;
        if (m && m.tagName === 'VIDEO') {
            try { if (m.__off) m.__off(); } catch (e) {}
            try { m.pause(); } catch (e) {}
        }
    }

    /* ---------- bitta storisni ko'rsatish ---------- */
    function headInfo(card, it) {
        card.name.innerHTML = esc(catName(card.cat)) + '<i>' + esc(ago(it.ts)) + '</i>';
        var hasCap = !!(it.caption || it.link);
        card.el.classList.toggle('has-cap', hasCap);
        card.capP.textContent = it.caption || '';
        card.link.hidden = !it.link;
    }
    function show(ii, mode) {
        if (!S.open) return;
        var card = curCard(), list = DATA[card.cat] || [];
        if (!list.length) { nextCat(1); return; }
        ii = Math.max(0, Math.min(list.length - 1, ii));
        S.ii = ii;
        var it = list[ii];
        S.item = it;
        var g = ++S.gen;
        teardownCurrent();
        stopProgress();
        clearTimers();
        S.ready = false;
        S.vWaiting = false;
        setErr(card, false);
        setSpin(card, false);
        paintBars(card, ii);
        headInfo(card, it);
        var slot = card.slots[1 - card.on], old = card.slots[card.on];
        var m = mountMedia(slot, card, it, g);
        S.media = m.el;
        paintSound();
        footer(it);
        var swapped = false;
        var swap = function () {
            if (swapped || g !== S.gen) return;
            swapped = true;
            card.on = 1 - card.on;
            slot.classList.add('is-on');
            var instant = mode === 'open' || mode === 'cat' || reduced() || !old.firstChild;
            if (instant) { old.classList.remove('is-on'); clearSlot(old); return; }
            var dur = tierLow() ? 140 : 230;
            anim(slot, [{ opacity: 0, transform: tierHigh() ? 'scale(1.018)' : 'none' }, { opacity: 1, transform: 'none' }], { duration: dur, easing: 'cubic-bezier(.25,.8,.25,1)' });
            var a2 = anim(old, [{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: 'linear', fill: 'forwards' });
            var fin = function () { if (slot !== old) { old.classList.remove('is-on'); clearSlot(old); } };
            if (a2) a2.onfinish = fin; else fin();
        };
        // Media tayyor bo'lsa — shu zahoti almashadi; 260 ms ichida tayyor bo'lmasa ham
        // almashamiz (muqova/xira fon ko'rinadi, kerak bo'lsa spinner chiqadi).
        setTimeout(swap, mode === 'open' || mode === 'cat' ? 0 : 260);
        m.ready.then(swap);
        markSeen(it);
        preloadAfter(it, g);
    }
    function peekNext() {
        var card = curCard(), list = DATA[card.cat] || [];
        if (S.ii + 1 < list.length) return list[S.ii + 1];
        for (var ci = S.ci + 1; ci < S.cats.length; ci++) {
            var l = DATA[S.cats[ci]] || [];
            if (l.length) return l[firstUnseen(S.cats[ci])];
        }
        return null;
    }
    function preloadAfter(it, g) {
        var nx = peekNext();
        if (!nx) return;
        var addImg = function (url) {
            if (!url || PRE.img[url]) return;
            var im = new Image();
            im.decoding = 'async';
            im.src = url;
            PRE.img[url] = im;
            PRE.imgKeys.push(url);
            while (PRE.imgKeys.length > 6) delete PRE.img[PRE.imgKeys.shift()];
        };
        if (nx.type === 'image') { addImg(nx.src); return; }
        addImg(nx.poster);
        // Zaif tarmoq/telefonda video oldindan YUKLANMAYDI (joriy video bilan raqobat qilmasin)
        if (lowData() || tierLow()) return;
        var go = function () {
            if (g !== S.gen || !S.open) return;
            if (PRE.v && PRE.v.__src === nx.src) return;
            dropPreVideo();
            var v = newVideo();
            v.muted = true;
            v.__src = nx.src;
            v.src = mediaUrl(nx);
            try { v.load(); } catch (e) {}
            PRE.v = v;
        };
        // Joriy storis O'YNAY boshlagach (tarmoq bo'shagach) — keyingisini yuklaymiz
        if (S.ready) setTimeout(go, 500); else S.afterReady = go;
    }

    /* ---------- navigatsiya ---------- */
    function next() {
        if (!S.open || S.closing) return;
        var list = DATA[curCard().cat] || [];
        if (S.ii + 1 < list.length) show(S.ii + 1, 'next');
        else nextCat(1);
    }
    function prev() {
        if (!S.open || S.closing) return;
        if (S.ii > 0) { show(S.ii - 1, 'prev'); return; }
        for (var ci = S.ci - 1; ci >= 0; ci--) if ((DATA[S.cats[ci]] || []).length) { S.ci = ci; switchCard(S.cats[ci], DATA[S.cats[ci]].length - 1, -1); return; }
        show(0, 'prev');   // eng birinchisi — boshidan
    }
    function nextCat(dir) {
        for (var ci = S.ci + dir; ci >= 0 && ci < S.cats.length; ci += dir) {
            var cat = S.cats[ci];
            if ((DATA[cat] || []).length) { S.ci = ci; switchCard(cat, firstUnseen(cat), dir); return; }
        }
        if (dir > 0) close(); else show(0, 'prev');
    }
    /** Bo'limlar orasida o'tish: iOS uslubidagi "karta surilishi" (zaif telefonda — qisqa opacity). */
    function switchCard(cat, ii, dir) {
        var from = curCard(), toIdx = 1 - S.cur, to = S.cards[toIdx];
        var fromEl = from.el, toEl = to.el, fromT = fromEl.style.transform || 'translate3d(0,0,0) scale(1)';
        teardownCurrent();
        stopProgress();
        clearTimers();
        resetCard(to);
        to.cat = cat;
        to.av.removeAttribute('src');
        var av = catAvatar(cat);
        if (av) to.av.src = av;
        toEl.hidden = false;
        S.cur = toIdx;
        show(ii, 'cat');
        hap('selection');
        var done = function () { fromEl.hidden = true; resetCard(from); from.cat = null; toEl.style.zIndex = ''; };
        if (reduced()) { done(); return; }
        if (tierLow()) {
            anim(fromEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'linear', fill: 'forwards' });
            var al = anim(toEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear' });
            if (al) al.onfinish = done; else done();
            return;
        }
        var X = dir > 0 ? 1 : -1, dur = tierHigh() ? 400 : 330, ease = 'cubic-bezier(.22,.9,.24,1)';
        toEl.style.zIndex = '2';
        fromEl.style.zIndex = '1';
        anim(fromEl, [{ transform: fromT, opacity: 1 }, { transform: 'translate3d(' + (-X * 24) + '%,0,0) scale(.9)', opacity: .3 }], { duration: dur, easing: ease, fill: 'forwards' });
        var a1 = anim(toEl, [{ transform: 'translate3d(' + (X * 100) + '%,0,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: dur, easing: ease });
        if (a1) a1.onfinish = done; else done();
    }
    function onDataChanged() {
        if (!S.open || !S.item) return;
        var card = curCard(), list = DATA[card.cat] || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i].sid === S.item.sid) {
                S.ii = i;
                S.item = list[i];
                if (card.bars.children.length !== list.length) {
                    // Yangi storis qo'shildi — chiziqlar soni yangilanadi, joriy progress saqlanadi
                    var t = S.prog ? S.prog.time() : 0, ms = S.prog ? S.prog.ms : IMAGE_MS, was = S.prog && S.prog.playing;
                    stopProgress();
                    paintBars(card, i);
                    var g = S.gen;
                    if (S.ready) {
                        S.prog = makeProg(fillOf(card, i), ms, function () { if (g === S.gen) next(); });
                        S.prog.seek(t);
                        if (was) S.prog.play();
                    }
                }
                return;
            }
        }
        // Joriy storis o'chirildi (admin) — keyingisiga
        S.cats = ringOrder();
        if (!list.length) nextCat(1); else show(Math.min(S.ii, list.length - 1), 'next');
    }

    /* ---------- ochish / yopish (+ Telegram «Orqaga» bilan to'g'ri ishlash) ---------- */
    function layoutClass() {
        var tall = false;
        try { tall = W.matchMedia('(max-aspect-ratio: 10/19)').matches; } catch (e) {}
        S.root.classList.toggle('tall', tall);
    }
    function ringRect(cat) {
        var r = ringEl(cat);
        if (!r) return null;
        var rr = r.getBoundingClientRect();
        if (!rr.width || rr.bottom < 0 || rr.top > W.innerHeight) return null;
        return rr;
    }
    function zoomKeys(card, rr) {
        var cr = card.getBoundingClientRect();
        if (!rr || !cr.width) return null;
        var s = rr.width / cr.width;
        var dx = (rr.left + rr.width / 2) - (cr.left + cr.width / 2), dy = (rr.top + rr.height / 2) - (cr.top + cr.height / 2);
        return { t: 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0) scale(' + s.toFixed(4) + ')', r: (cr.width / 2).toFixed(0) + 'px' };
    }
    function openAnim(cat) {
        if (reduced()) return;
        var card = cardEl(), low = tierLow();
        anim(S.bg, [{ opacity: 0 }, { opacity: 1 }], { duration: low ? 150 : 260, easing: 'ease-out' });
        anim(S.foot, [{ opacity: 0 }, { opacity: 1 }], { duration: low ? 150 : 340, easing: 'ease-out' });
        var z = (!low && S.fromRing) ? zoomKeys(card, ringRect(cat)) : null;
        if (z) {
            anim(card, [{ transform: z.t, borderRadius: z.r, opacity: .35 }, { transform: 'translate3d(0,0,0) scale(1)', borderRadius: getComputedStyle(card).borderTopLeftRadius || '0px', opacity: 1 }],
                { duration: tierHigh() ? 400 : 340, easing: 'cubic-bezier(.2,.9,.25,1)' });
        } else {
            anim(card, [{ opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'none' }], { duration: low ? 150 : 240, easing: 'cubic-bezier(.2,.9,.25,1)' });
        }
    }
    function pushHistory() {
        try {
            W._a1svPrevActive = (typeof activeModal !== 'undefined') ? activeModal : null;
            if (typeof activeModal !== 'undefined') activeModal = '__story__';
            W.history.pushState({ modal: '__story__' }, '');
            S.pushed = true;
            if (typeof updateBtns === 'function') updateBtns();
        } catch (e) { S.pushed = false; }
    }
    function restoreActive() {
        try {
            if (typeof activeModal !== 'undefined' && activeModal === '__story__') activeModal = W._a1svPrevActive || null;
            W._a1svPrevActive = null;
            if (typeof updateBtns === 'function') updateBtns();
        } catch (e) {}
    }
    /**
     * Ochish. opts: { key: shu storisdan boshlash, from: 'admin' }
     * Halqa bosilganda — o'sha bo'limning BIRINCHI KO'RILMAGAN storisidan boshlanadi.
     */
    function startStories(cat, caption, opts) {
        opts = opts || {};
        cat = String(cat || '');
        var list = DATA[cat] || [];
        if (!list.length) { toast("Hali yangiliklar yo'q!", 'warning'); return; }
        if (S.closing) return;
        build();
        layoutClass();
        S.cats = ringOrder();
        if (S.cats.indexOf(cat) < 0) S.cats.push(cat);
        S.ci = S.cats.indexOf(cat);
        var ii = firstUnseen(cat);
        if (opts.key != null) { for (var i = 0; i < list.length; i++) if (list[i].key === String(opts.key)) { ii = i; break; } }
        S.fromRing = !opts.from;
        var reopen = S.open;
        S.cards.forEach(function (c) { resetCard(c); c.el.hidden = true; c.cat = null; });
        S.cur = 0;
        var card = curCard();
        card.cat = cat;
        var av = catAvatar(cat);
        if (av) card.av.src = av; else card.av.removeAttribute('src');
        card.el.hidden = false;
        S.hold = S.typing = S.sheet = S.menu = S.dragging = false;
        S.hidden = D.hidden;
        S.root.classList.remove('is-hold', 'is-typing');
        S.open = true;
        S.closing = false;
        S.root.classList.add('on');
        ROOT.classList.add('a1sv-lock');
        if (!reopen) pushHistory();
        show(ii, 'open');
        if (!reopen) openAnim(cat);
        hap('light');
        // Eski ko'ruvchi tasodifan ochiq qolgan bo'lsa — yashiramiz
        try { var old = D.getElementById('story-viewer'); if (old) old.style.display = 'none'; } catch (e) {}
    }
    function cleanup() {
        clearTimers();
        stopProgress();
        teardownCurrent();
        dropPreVideo();
        S.cards.forEach(function (c) { resetCard(c); c.el.hidden = true; c.cat = null; });
        S.root.classList.remove('on', 'is-hold', 'is-typing');
        try { S.root.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); }); } catch (e) {}
        S.bg.style.opacity = '';
        S.foot.style.transform = '';
        ROOT.classList.remove('a1sv-lock');
        S.open = false;
        S.closing = false;
        S.item = null;
        S.gen++;
        hideTray();
        flushSeen();
        refreshRings();
    }
    function hideNow() {
        if (!S.open || S.closing) return;
        S.closing = true;
        try { S.input.blur(); } catch (e) {}
        teardownCurrent();
        stopProgress();
        clearTimers();
        insHideNow();
        var card = cardEl(), done = function () { cleanup(); };
        if (reduced()) { done(); return; }
        var low = tierLow(), dur = low ? 150 : 270;
        anim(S.bg, [{ opacity: Number(getComputedStyle(S.bg).opacity) || 1 }, { opacity: 0 }], { duration: dur, easing: 'ease-in', fill: 'forwards' });
        anim(S.foot, [{ opacity: 1 }, { opacity: 0 }], { duration: dur * .6, easing: 'ease-in', fill: 'forwards' });
        var from = card.style.transform || 'translate3d(0,0,0) scale(1)';
        var z = (!low && S.fromRing) ? zoomKeys(card, ringRect(S.cats[S.ci])) : null;
        var a = z
            ? anim(card, [{ transform: from, opacity: 1 }, { transform: z.t, borderRadius: z.r, opacity: .15 }], { duration: dur + 30, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' })
            : anim(card, [{ transform: from, opacity: 1 }, { transform: 'scale(.9)', opacity: 0 }], { duration: dur, easing: 'ease-in', fill: 'forwards' });
        if (a) a.onfinish = done; else done();
        setTimeout(function () { if (S.closing) done(); }, dur + 400);   // kafolat
    }
    /** UI'dan yopish (✕, pastga surish, oxiri): yagona yo'l — history.back(). */
    function close() {
        if (!S.open || S.closing) return;
        if (S.pushed) {
            S.pushed = false;
            try {
                W.history.back();
                clearTimeout(S.popT);
                S.popT = setTimeout(function () { if (S.open && !S.closing) { restoreActive(); hideNow(); } }, 500);
                return;
            } catch (e) {}
        }
        restoreActive();
        hideNow();
    }
    W._a1svHideFromHistory = function () { S.pushed = false; clearTimeout(S.popT); hideNow(); };

    /* ---------- imo-ishoralar (bosish / bosib turish / surish) ---------- */
    function spring(c) {
        var from = c.style.transform;
        c.style.transform = '';
        S.bg.style.opacity = '';
        if (!from || reduced()) return;
        anim(c, [{ transform: from }, { transform: 'translate3d(0,0,0) scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,.9,.25,1)' });
    }
    function wire() {
        var deck = S.deck, P = null;
        deck.addEventListener('pointerdown', function (e) {
            if (!S.open || S.closing || P) return;
            if (e.target.closest && e.target.closest('button, a, input, .a1sv-err')) return;
            if (S.typing) { try { S.input.blur(); } catch (er) {} return; }
            P = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), mode: '', dx: 0, dy: 0 };
            try { deck.setPointerCapture(e.pointerId); } catch (er) {}
            clearTimeout(S.holdT);
            S.holdT = setTimeout(function () {
                if (P && !P.mode) { S.hold = true; S.root.classList.add('is-hold'); applyPause(); }
            }, 200);
        });
        deck.addEventListener('pointermove', function (e) {
            if (!P || e.pointerId !== P.id) return;
            var dx = e.clientX - P.x, dy = e.clientY - P.y;
            P.dx = dx; P.dy = dy;
            if (!P.mode && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
                P.mode = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h';
                clearTimeout(S.holdT);
                S.dragging = true;
                applyPause();
            }
            var c = cardEl();
            if (P.mode === 'v') {
                var y = dy > 0 ? dy : dy * .2;
                c.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0) scale(' + (1 - Math.min(.16, Math.abs(y) / 1900)).toFixed(4) + ')';
                S.bg.style.opacity = String(Math.max(.2, 1 - Math.abs(y) / 560));
            } else if (P.mode === 'h') {
                c.style.transform = 'translate3d(' + (dx * .4).toFixed(1) + 'px,0,0)';
            }
        });
        var end = function (e, cancel) {
            if (!P || (e && e.pointerId !== P.id)) return;
            var p = P;
            P = null;
            clearTimeout(S.holdT);
            var dt = performance.now() - p.t, wasHold = S.hold;
            S.dragging = false;
            if (S.hold) { S.hold = false; S.root.classList.remove('is-hold'); }
            var c = cardEl();
            if (p.mode === 'v') {
                var vy = p.dy / Math.max(1, dt);
                if (!cancel && (p.dy > 110 || (p.dy > 36 && vy > .5))) { close(); return; }
                spring(c); applyPause(); return;
            }
            if (p.mode === 'h') {
                if (!cancel && Math.abs(p.dx) > 60) { nextCat(p.dx < 0 ? 1 : -1); applyPause(); return; }
                spring(c); applyPause(); return;
            }
            applyPause();
            if (cancel || wasHold || dt > 380) return;
            var r = deck.getBoundingClientRect();
            if (p.x - r.left < r.width * .3) prev(); else next();
        };
        deck.addEventListener('pointerup', function (e) { end(e, false); });
        deck.addEventListener('pointercancel', function (e) { end(e, true); });
        deck.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        deck.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('button') : null;
            if (!b) return;
            e.stopPropagation();
            if (b.classList.contains('a1sv-x')) { hap('light'); close(); return; }
            if (b.classList.contains('a1sv-snd')) { toggleSound(); return; }
            if (b.classList.contains('a1sv-link')) { openLink(S.item); return; }
            if (b.closest('.a1sv-err')) { retry(); return; }
        });
        // Pastki panel
        S.form.addEventListener('submit', function (e) { e.preventDefault(); sendReply(S.input.value); });
        S.input.addEventListener('focus', function () { S.typing = true; S.root.classList.add('is-typing'); showTray(); applyPause(); });
        S.input.addEventListener('blur', function () {
            setTimeout(function () {
                if (D.activeElement === S.input) return;
                S.typing = false; S.root.classList.remove('is-typing'); hideTray(); S.foot.style.transform = ''; applyPause();
            }, 140);
        });
        S.input.addEventListener('input', function () { S.form.classList.toggle('has-text', S.input.value.trim().length > 0); });
        S.tray.addEventListener('pointerdown', function (e) { e.preventDefault(); });
        S.tray.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('button[data-e]') : null;
            if (!b) return;
            sendReaction(b.getAttribute('data-e'), b);
            try { S.input.blur(); } catch (er) {}
        });
        S.like.addEventListener('click', function () { sendReaction('\u2764\uFE0F', S.like); });
        S.adm.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('button') : null;
            if (!b || !S.item) return;
            if (b.classList.contains('a1sv-views')) openInsights(S.item, 'v', true);
            else if (b.classList.contains('a1sv-reps')) openInsights(S.item, 'r', true);
            else if (b.classList.contains('a1sv-del')) deleteItem(S.item);
        });
        // Klaviatura (iOS: visualViewport) — panel klaviatura ustida tursin
        if (W.visualViewport) {
            var vv = W.visualViewport, lift = function () {
                if (!S.open || !S.typing) return;
                var kb = Math.max(0, W.innerHeight - vv.height - vv.offsetTop);
                S.foot.style.transform = kb > 40 ? 'translate3d(0,' + (-kb).toFixed(0) + 'px,0)' : '';
            };
            vv.addEventListener('resize', lift);
            vv.addEventListener('scroll', lift);
        }
        D.addEventListener('keydown', function (e) {
            if (!S.open || S.typing || S.sheet) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === ' ') { e.preventDefault(); S.menu = !S.menu; applyPause(); }
        });
        D.addEventListener('visibilitychange', function () { S.hidden = D.hidden; if (S.open) applyPause(); });
        W.addEventListener('resize', function () { if (S.open) layoutClass(); });
    }
    function retry() {
        var it = S.item;
        if (!it) return;
        clearTimeout(S.errT);
        if (it.type === 'video') dropPreVideo();
        show(S.ii, 'jump');
    }
    function openLink(it) {
        if (!it || !it.link) return;
        var v = String(it.link).trim();
        hap('light');
        if (/^https?:\/\//i.test(v)) {
            try { if (typeof W.a1OpenExternal === 'function') { W.a1OpenExternal(v); return; } } catch (e) {}
            try { if (typeof tg !== 'undefined' && tg.openLink) { tg.openLink(v); return; } } catch (e) {}
            try { W.open(v, '_blank'); } catch (e) {}
            return;
        }
        // Tovar kodi / id — storisni yopib, tovar oynasini ochamiz
        var dbp = W.productsDB || [];
        var p = dbp.filter(function (x) { return x && (String(x.id) === v || String(x.code || '').toLowerCase() === v.toLowerCase()); })[0];
        if (!p) { toast('Tovar topilmadi: ' + v, 'warning'); return; }
        close();
        setTimeout(function () { try { if (typeof W.openProduct === 'function') W.openProduct(p.id); } catch (e) {} }, 380);
    }
    function showTray() { if (!amAdmin()) S.tray.classList.add('on'); paintTray(); }
    function hideTray() { if (S.tray) S.tray.classList.remove('on'); }

    /* ═══════════════ 5) JAVOBLAR VA REAKSIYALAR (mijoz o'zi yozganini KO'RADI) ═══════════════ */
    var MINE = lsGet('a1sv_mine_v1'), REACT = lsGet('a1sv_react_v1'), pulledMine = {};
    var lastSend = 0;
    function addMine(sid, rec) {
        var a = Array.isArray(MINE[sid]) ? MINE[sid] : (MINE[sid] = []);
        for (var i = 0; i < a.length; i++) if (a[i].t === rec.t && a[i].x === rec.x && a[i].e === rec.e) return;
        a.push(rec);
        a.sort(function (x, y) { return x.t - y.t; });
        if (a.length > 6) a.splice(0, a.length - 6);
        lsSet('a1sv_mine_v1', trimMap(MINE, 200));
    }
    function renderMine(it) {
        var a = (it && Array.isArray(MINE[it.sid])) ? MINE[it.sid] : [];
        var txt = a.filter(function (r) { return r.x; }).slice(-3);
        if (!txt.length) { S.mine.hidden = true; S.mine.innerHTML = ''; return; }
        // 💬 Do'kon javobi (s:1) — chap tomonda, tilla ramkada: mijoz qayerdan
        //    yozganidan qat'i nazar (ilova, sayt, Telegram) javobni shu yerda ko'radi.
        S.mine.innerHTML = txt.map(function (r) {
            if (r.s) return '<div class="a1sv-bub is-shop"><b>Avto A1</b>' + esc(r.x) + '<small>' + esc(agoLong(r.t) || 'hozir') + ' \u00B7 do\u2018kon javobi</small></div>';
            return '<div class="a1sv-bub">' + esc(r.x) + '<small>Siz \u00B7 ' + esc(agoLong(r.t) || 'hozir') + ' \u00B7 yuborildi \u2713</small></div>';
        }).join('');
        S.mine.hidden = false;
    }
    function pullMine(it) {
        var uid = authUid(), d = DBX();
        if (!uid || !d || pulledMine[it.sid]) return;
        pulledMine[it.sid] = 1;
        try {
            d.ref('story_replies/' + it.sid + '/' + uid).once('value').then(function (s) {
                var v = s.val() || {};
                Object.keys(v).forEach(function (k) {
                    var r = v[k] || {};
                    if (r.x) addMine(it.sid, { x: String(r.x), t: Number(r.t) || 0, s: r.s === 1 ? 1 : 0 });
                    if (r.e && !r.s && !REACT[it.sid]) { REACT[it.sid] = String(r.e); lsSet('a1sv_react_v1', trimMap(REACT, 400)); }
                });
                if (S.item === it) { renderMine(it); paintLike(it); }
            }).catch(function () {});
        } catch (e) {}
    }
    function paintLike(it) {
        var r = it ? REACT[it.sid] : '';
        S.like.classList.toggle('on', r === '\u2764\uFE0F');
        S.like.setAttribute('aria-pressed', r === '\u2764\uFE0F' ? 'true' : 'false');
        paintTray();
    }
    function paintTray() {
        var r = S.item ? REACT[S.item.sid] : '';
        S.tray.querySelectorAll('button[data-e]').forEach(function (b) { b.classList.toggle('on', !!r && b.getAttribute('data-e') === r); });
    }
    function burst(emoji, from) {
        if (reduced() || tierLow() || !from) return;
        var r = from.getBoundingClientRect();
        for (var i = 0; i < 6; i++) {
            var s = mk('span', '', esc(emoji));
            s.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;font-size:' + (22 + Math.random() * 14).toFixed(0) + 'px;left:' + (r.left + r.width / 2 - 14) + 'px;top:' + (r.top - 6) + 'px;';
            D.body.appendChild(s);
            var dx = (Math.random() - .5) * 120, dy = -(150 + Math.random() * 160), rot = (Math.random() - .5) * 50;
            var a = anim(s, [{ transform: 'translate(0,0) scale(.6)', opacity: 0 }, { transform: 'translate(' + (dx * .3).toFixed(0) + 'px,' + (dy * .25).toFixed(0) + 'px) scale(1.1)', opacity: 1, offset: .2 },
                { transform: 'translate(' + dx.toFixed(0) + 'px,' + dy.toFixed(0) + 'px) rotate(' + rot.toFixed(0) + 'deg) scale(.9)', opacity: 0 }],
                { duration: 900 + Math.random() * 400, delay: i * 45, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' });
            (function (node) { var rm = function () { if (node.parentNode) node.parentNode.removeChild(node); }; if (a) a.onfinish = rm; setTimeout(rm, 1600); })(s);
        }
    }
    function persistReply(it, body) {
        var uid = authUid(), d = DBX();
        if (!uid || !d) return;
        var me = whoAmI(), rec = { t: Date.now() };
        if (body.x) rec.x = body.x;
        if (body.e) rec.e = body.e;
        if (me.n) rec.n = me.n;
        if (me.u) rec.u = me.u;
        if (me.a) rec.a = me.a;
        try { d.ref('story_replies/' + it.sid + '/' + uid).push(rec).then(null, function () {}); } catch (e) {}
    }
    function notifyAdmins(it, isReaction, contentHtml) {
        var ids = [];
        try { ids = (typeof ADMIN_IDS !== 'undefined' ? ADMIN_IDS : []).map(String); } catch (e) {}
        if (!ids.length || typeof W.tgProxySend !== 'function') return;
        var me = whoAmI(), uid = String(W.currentUser || authUid() || '');
        var link = me.u ? 'https://t.me/' + me.u : (/^\d+$/.test(uid) ? 'tg://user?id=' + uid : '');
        var who = link ? '<a href="' + esc(link) + '">' + esc(me.n || 'Mijoz') + '</a>' : esc(me.n || 'Mijoz');
        var list = DATA[it.cat] || [], no = list.indexOf(it) + 1;
        var NL = '\n';
        var text = '\uD83D\uDCAC <b>Stories \u2014 yangi ' + (isReaction ? 'reaksiya' : 'javob') + '</b>' + NL + NL +
            '\uD83D\uDC64 ' + who + (me.u ? ' (@' + esc(me.u) + ')' : (/^\d+$/.test(uid) ? ' (ID: <code>' + esc(uid) + '</code>)' : '')) + NL +
            '\uD83C\uDFAC ' + esc(catName(it.cat)) + (no > 0 ? ' \u00B7 ' + no + '-storis' : '') + (it.caption ? ' \u00AB' + esc(it.caption.slice(0, 60)) + '\u00BB' : '') + NL +
            (isReaction ? '\u2728 Reaksiya: ' : '\u270D\uFE0F Xabar: ') + contentHtml + NL + NL +
            '<i>Barcha ko\u2018rishlar va javoblar: Admin \u2192 Stories \u2192 \uD83D\uDC41</i>';
        var self = String(W.currentUser || '');
        var send = ids.filter(function (id) { return id !== self; }), i = 0;
        (function step() {
            if (i >= send.length) return;
            var id = send[i++];
            Promise.resolve().then(function () { return W.tgProxySend({ chat_id: id, text: text, parse_mode: 'HTML', disable_web_page_preview: true }); })
                .catch(function () {}).then(function () { setTimeout(step, 150); });
        })();
    }
    // 🛰 Javob SERVER orqali (/story-reply): Worker uni ism + TASDIQLANGAN raqam
    //    bilan yozadi va adminlarga «✍️ Javob yozish» tugmali kartochka yuboradi —
    //    ilova/saytdan (Telegram'siz) yozgan mijozga ham javob berish mumkin.
    //    Worker eski bo'lsa (404) yoki tarmoq uzilsa — eski yo'l (to'g'ridan yozish).
    function capOf(it) {
        var list = DATA[it.cat] || [], no = list.indexOf(it) + 1;
        return (catName(it.cat) + (no > 0 ? ' \u00B7 ' + no + '-storis' : '') + (it.caption ? ' \u00AB' + String(it.caption).slice(0, 50) + '\u00BB' : '')).slice(0, 120);
    }
    function sendStoryReply(it, body, isReaction, contentHtml) {
        var legacy = function () { persistReply(it, body); notifyAdmins(it, isReaction, contentHtml); };
        if (typeof W._workerPost !== 'function') { legacy(); return; }
        var me = whoAmI(), p = { sid: it.sid, cap: capOf(it), via: W.A1_APP ? 'app' : 'web' };
        if (body.x) p.x = body.x; else p.e = body.e;
        if (me.n) p.n = me.n;
        if (me.a) p.a = me.a;
        W._workerPost('/story-reply', p).then(function (r) {
            var st = r && r.resp ? r.resp.status : 0;
            if (st >= 200 && st < 300 && r.data && r.data.ok) return;
            if (st === 429) { toast('Juda tez \u2014 biroz kuting', 'warning'); return; }
            if (st === 404 || st === 405 || st === 0 || st >= 500) legacy();
        }, legacy);
    }
    function sendReply(text) {
        text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 500);
        var it = S.item;
        if (!text || !it) return;
        if (Date.now() - lastSend < 4000) { toast('Biroz kuting \u2014 oldingi xabar yuborilyapti', 'warning'); return; }
        lastSend = Date.now();
        S.input.value = '';
        S.form.classList.remove('has-text');
        var rec = { x: text, t: Date.now() };
        addMine(it.sid, rec);
        renderMine(it);
        if (S.mine.lastChild) anim(S.mine.lastChild, [{ opacity: 0, transform: 'translateY(10px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.25,1)' });
        hap('success');
        sendStoryReply(it, { x: text }, false, esc(text));
        toast('Javobingiz do\u2018konga yuborildi \u2705 Javob shu yerda va \uD83D\uDD14 da chiqadi', 'success');
        try { S.input.blur(); } catch (e) {}
    }
    function sendReaction(emoji, fromEl) {
        var it = S.item;
        if (!it || !emoji) return;
        var prev = REACT[it.sid];
        REACT[it.sid] = emoji;
        lsSet('a1sv_react_v1', trimMap(REACT, 400));
        burst(emoji, fromEl || S.like);
        if (fromEl === S.like) anim(S.like, [{ transform: 'scale(1)' }, { transform: 'scale(1.32)', offset: .4 }, { transform: 'scale(1)' }], { duration: 360, easing: 'cubic-bezier(.2,.9,.25,1)' });
        hap('light');
        paintLike(it);
        if (prev) return;   // bitta storisga — adminga BIR marta (spam bo'lmasin)
        sendStoryReply(it, { e: emoji }, true, esc(emoji) + (emoji === '\u2753' ? ' <i>(narx / ma\u2018lumot so\u2018rayapti)</i>' : ''));
    }

    /* ═══════════════ 6) ADMIN: kim ko'rdi + javoblar ═══════════════ */
    var STATS = {};
    function loadStats(it, cb, force) {
        var c = STATS[it.sid];
        if (c && !force && Date.now() - c.at < 20000) { cb(c); return; }
        var d = DBX();
        if (!d) { cb({ v: [], r: [], ans: [], at: 0, err: 'db' }); return; }
        Promise.all([
            d.ref('story_views/' + it.sid).once('value').then(function (s) { return s.val() || {}; }),
            d.ref('story_replies/' + it.sid).once('value').then(function (s) { return s.val() || {}; })
        ]).then(function (res) {
            var V = res[0], R = res[1], v = [], r = [], ans = [];
            Object.keys(V).forEach(function (uid) { var x = V[uid] || {}; v.push({ uid: uid, t: Number(x.t) || 0, n: String(x.n || ''), a: String(x.a || ''), u: String(x.u || '') }); });
            Object.keys(R).forEach(function (uid) {
                var m = R[uid] || {};
                Object.keys(m).forEach(function (k) {
                    var x = m[k] || {};
                    // s:1 — do'kon javobi (admin yozgan): hisobga kirmaydi, mijoz qatori ostida chiqadi
                    (x.s === 1 ? ans : r).push({ uid: uid, k: k, t: Number(x.t) || 0, x: String(x.x || ''), e: String(x.e || ''), n: String(x.n || ''), a: String(x.a || ''), u: String(x.u || ''),
                        ph: String(x.ph || ''), pv: x.pv === 1 });
                });
            });
            v.sort(function (a, b) { return b.t - a.t; });
            r.sort(function (a, b) { return b.t - a.t; });
            ans.sort(function (a, b) { return a.t - b.t; });
            var st = { v: v, r: r, ans: ans, at: Date.now() };
            STATS[it.sid] = st;
            cb(st);
        }).catch(function (err) { cb({ v: [], r: [], ans: [], at: 0, err: String((err && (err.code || err.message)) || 'err') }); });
    }
    function face(p) {
        return '<i>' + (p.a ? '<img src="' + esc(p.a) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : esc(initials(p.n || 'M'))) + '</i>';
    }
    function footer(it) {
        var adm = amAdmin();
        S.cust.hidden = adm;
        S.adm.hidden = !adm;
        if (adm) {
            S.mine.hidden = true;
            S.adm.querySelector('.a1sv-vn').textContent = STATS[it.sid] ? String(STATS[it.sid].v.length) : '\u2026';
            S.adm.querySelector('.a1sv-rn').textContent = STATS[it.sid] ? String(STATS[it.sid].r.length) : '\u2026';
            S.adm.querySelector('.a1sv-faces').innerHTML = '';
            loadStats(it, function (st) {
                if (S.item !== it) return;
                S.adm.querySelector('.a1sv-vn').textContent = String(st.v.length);
                S.adm.querySelector('.a1sv-rn').textContent = String(st.r.length);
                S.adm.querySelector('.a1sv-faces').innerHTML = st.v.slice(0, 3).map(face).join('');
            });
        } else {
            renderMine(it);
            paintLike(it);
            pullMine(it);
        }
    }

    /* ---------- statistika oynasi (iOS 26 sheet) ---------- */
    var INS = { el: null, it: null, tab: 'v', st: null, fromViewer: false, pushed: false, popT: 0, closing: false };
    function insBuild() {
        if (INS.el) return;
        var r = mk('div', '');
        r.id = 'a1sv-ins';
        r.setAttribute('role', 'dialog');
        r.setAttribute('aria-modal', 'true');
        r.innerHTML = '<div class="in-dim"></div><div class="in-sheet"><div class="in-grab"></div>' +
            '<div class="in-hd"><span class="in-th"></span><span class="in-tt"><b>Statistika</b><span></span></span>' +
            '<button type="button" class="in-x" aria-label="Yopish">' + IC.x + '</button></div>' +
            '<div class="in-seg" role="tablist"><i></i><button type="button" data-t="v" role="tab">Ko\u2018rganlar<em>0</em></button><button type="button" data-t="r" role="tab">Javoblar<em>0</em></button></div>' +
            '<div class="in-body"></div></div>';
        D.body.appendChild(r);
        INS.el = r;
        INS.sheet = r.querySelector('.in-sheet');
        INS.dim = r.querySelector('.in-dim');
        INS.body = r.querySelector('.in-body');
        INS.seg = r.querySelector('.in-seg');
        r.querySelector('.in-x').addEventListener('click', insClose);
        INS.dim.addEventListener('click', insClose);
        INS.seg.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('button[data-t]') : null;
            if (!b) return;
            INS.tab = b.getAttribute('data-t');
            hap('selection');
            insRender();
        });
        // Sarlavhadan pastga tortib yopish
        var hd = r.querySelector('.in-hd'), grab = r.querySelector('.in-grab'), P = null;
        [hd, grab].forEach(function (h) {
            h.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; P = { y: e.clientY, id: e.pointerId }; try { h.setPointerCapture(e.pointerId); } catch (er) {} });
            h.addEventListener('pointermove', function (e) { if (!P || e.pointerId !== P.id) return; var dy = Math.max(0, e.clientY - P.y); INS.sheet.style.transform = 'translate3d(0,' + dy + 'px,0)'; });
            var up = function (e) {
                if (!P || e.pointerId !== P.id) return;
                var dy = Math.max(0, e.clientY - P.y); P = null;
                if (dy > 90) { insClose(); return; }
                var from = INS.sheet.style.transform; INS.sheet.style.transform = '';
                if (from) anim(INS.sheet, [{ transform: from }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.25,1)' });
            };
            h.addEventListener('pointerup', up);
            h.addEventListener('pointercancel', up);
        });
    }
    function openInsights(it, tab, fromViewer) {
        if (!it) return;
        insBuild();
        INS.it = it;
        INS.tab = tab || 'v';
        INS.fromViewer = !!fromViewer;
        INS.st = STATS[it.sid] || null;
        INS.el.classList.toggle('is-dark', !!fromViewer);
        var th = it.type === 'video' ? it.poster : it.src;
        INS.el.querySelector('.in-th').innerHTML = th ? '<img src="' + esc(th) + '" alt="">' : '';
        var list = DATA[it.cat] || [], no = list.indexOf(it) + 1;
        INS.el.querySelector('.in-tt span').textContent = catName(it.cat) + (no > 0 ? ' \u00B7 ' + no + '-storis' : '') + (it.ts ? ' \u00B7 ' + agoLong(it.ts) : '');
        insRender();
        INS.el.classList.add('on');
        INS.closing = false;
        INS.sheet.style.transform = '';
        if (!reduced()) {
            anim(INS.dim, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out', fill: 'forwards' });
            anim(INS.sheet, [{ transform: 'translate3d(0,105%,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: tierLow() ? 200 : 380, easing: 'cubic-bezier(.2,.9,.25,1)' });
        } else INS.dim.style.opacity = '1';
        if (fromViewer) { S.sheet = true; applyPause(); }
        hap('light');
        try {
            W._a1svInsPrev = (typeof activeModal !== 'undefined') ? activeModal : null;
            if (typeof activeModal !== 'undefined') activeModal = '__storyins__';
            W.history.pushState({ modal: '__storyins__' }, '');
            INS.pushed = true;
            if (typeof updateBtns === 'function') updateBtns();
        } catch (e) { INS.pushed = false; }
        loadStats(it, function (st) { if (INS.it === it) { INS.st = st; insRender(); } }, true);
    }
    function insRender() {
        var st = INS.st, tab = INS.tab;
        INS.seg.classList.toggle('r', tab === 'r');
        var em = INS.seg.querySelectorAll('em');
        em[0].textContent = st ? String(st.v.length) : '';
        em[1].textContent = st ? String(st.r.length) : '';
        INS.seg.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-t') === tab ? 'true' : 'false'); });
        if (!st) { INS.body.innerHTML = '<div class="in-sk"></div><div class="in-sk"></div><div class="in-sk"></div>'; return; }
        var html = '';
        if (st.err) {
            html = '<div class="in-empty">' + IC.warn + '<b>Ma\u2019lumot o\u2018qilmadi</b>' +
                (/permission/i.test(st.err) ? 'Firebase qoidalari hali yangilanmagan. GitHub \u2192 Actions \u2192 \u00ABDeploy Firebase qoidalari\u00BB ni bir marta ishga tushiring.' : 'Internetni tekshiring va qayta oching.') + '</div>';
            INS.body.innerHTML = html;
            return;
        }
        var uniq = {};
        st.r.forEach(function (x) { uniq[x.uid] = 1; });
        html += '<div class="in-sum"><div><b>' + st.v.length + '</b><span>ko\u2018rdi</span></div><div><b>' + st.r.length + '</b><span>javob/reaksiya</span></div><div><b>' + Object.keys(uniq).length + '</b><span>yozgan mijoz</span></div></div>';
        if (tab === 'v') {
            if (!st.v.length) html += '<div class="in-empty">' + IC.eye + '<b>Hali hech kim ko\u2018rmagan</b>Mijozlar ko\u2018rishi bilan shu yerda paydo bo\u2018ladi.</div>';
            else {
                var replied = {};
                st.r.forEach(function (x) { replied[x.uid] = x.e || '\uD83D\uDCAC'; });
                html += '<div class="in-list">' + st.v.map(function (p) {
                    var act = p.u ? '<a class="in-act is-gray" href="https://t.me/' + esc(p.u) + '" data-tg="' + esc(p.u) + '">Yozish</a>' : '';
                    return '<div class="in-row"><span class="in-av">' + (p.a ? '<img src="' + esc(p.a) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : esc(initials(p.n || 'Mijoz'))) + '</span>' +
                        '<span class="in-mid"><b>' + esc(p.n || 'Mijoz') + (replied[p.uid] ? ' <span style="display:inline;font-size:15px">' + esc(replied[p.uid]) + '</span>' : '') + '</b><span>' + esc(agoLong(p.t)) + (p.u ? ' \u00B7 @' + esc(p.u) : '') + '</span></span>' + act + '</div>';
                }).join('') + '</div>';
            }
        } else {
            // Har mijozning ENG OXIRGI javobi ostida — do'kon javoblari, aloqa tugmalari va «Javob».
            var ans = st.ans || [], shownAns = {};
            if (!st.r.length) html += '<div class="in-empty">' + IC.chat + '<b>Hali javob yo\u2018q</b>Mijoz storisga yozsa yoki reaksiya bildirsa \u2014 shu yerda va Telegram\u2019da ko\u2018rasiz.</div>';
            else html += '<div class="in-list">' + st.r.map(function (p, idx) {
                var first = !shownAns[p.uid];
                shownAns[p.uid] = 1;
                var mine = first ? ans.filter(function (a) { return a.uid === p.uid; }) : [];
                var ct = '';
                if (first) {
                    var ph = String(p.ph || '');
                    if (!ph) st.r.some(function (q) { if (q.uid === p.uid && q.ph) { ph = q.ph; return true; } return false; });
                    if (ph) ct += '<a href="tel:' + esc(ph.replace(/[^0-9+]/g, '')) + '" data-ph="' + esc(ph) + '">\uD83D\uDCDE ' + esc(ph) + (p.pv ? ' <span class="is-ok">\u2713</span>' : '') + '</a>';
                    if (p.u) ct += '<a href="https://t.me/' + esc(p.u) + '" data-tg="' + esc(p.u) + '">\u2708\uFE0F @' + esc(p.u) + '</a>';
                }
                return '<div class="in-row" style="align-items:flex-start" data-i="' + idx + '"><span class="in-av">' + (p.a ? '<img src="' + esc(p.a) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : esc(initials(p.n || 'Mijoz'))) + '</span>' +
                    '<span class="in-mid"><b>' + esc(p.n || 'Mijoz') + '</b><span>' + esc(agoLong(p.t)) + '</span>' +
                    '<span class="in-q' + (p.e && !p.x ? ' is-emo' : '') + '">' + esc(p.x || p.e) + '</span>' +
                    mine.map(function (a) { return '<span class="in-ans">' + esc(a.x) + '<small>Siz \u00B7 ' + esc(agoLong(a.t)) + '</small></span>'; }).join('') +
                    (ct ? '<span class="in-ct">' + ct + '</span>' : '') + '</span>' +
                    (first ? '<span class="in-acts"><button type="button" class="in-act is-gold" data-ans="' + idx + '">Javob</button></span>' : '') + '</div>';
            }).join('') + '</div>';
        }
        html += '<p class="in-note">Admin ko\u2018rishlari hisobga olinmaydi. \u00abJavob\u00bb \u2014 mijozga ilovada (\uD83D\uDD14) va Telegram\u2019da boradi, qayerdan yozganidan qat\u2019i nazar.</p>';
        INS.body.innerHTML = html;
        INS.body.querySelectorAll('button[data-ans]').forEach(function (b) {
            b.addEventListener('click', function () { openComposer(st.r[Number(b.getAttribute('data-ans'))], b.closest('.in-row')); });
        });
        INS.body.querySelectorAll('a[data-ph]').forEach(function (a) {
            a.addEventListener('click', function () {
                // Telegram ichida tel: ochilmasligi mumkin — raqam baribir nusxalanadi
                try { if (navigator.clipboard) navigator.clipboard.writeText(a.getAttribute('data-ph')); toast('Raqam nusxalandi', 'success'); } catch (er) {}
            });
        });
        INS.body.querySelectorAll('a[data-tg]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                var u = 'https://t.me/' + a.getAttribute('data-tg');
                try { if (typeof tg !== 'undefined' && tg.openTelegramLink && tg.initData) { tg.openTelegramLink(u); return; } } catch (er) {}
                try { if (typeof W.a1OpenExternal === 'function') { W.a1OpenExternal(u); return; } } catch (er) {}
                try { W.open(u, '_blank'); } catch (er) {}
            });
        });
    }
    // ✍️ Admin javobi — mijozga ilovada (storis suhbati + 🔔) va Telegram'da (/story-answer)
    function openComposer(p, rowEl) {
        if (!p || !rowEl || !INS.it) return;
        var old = INS.body.querySelector('.in-cmp');
        if (old) { var same = old.__uid === p.uid; if (old.parentNode) old.parentNode.removeChild(old); if (same) return; }
        var it = INS.it;
        var f = mk('form', 'in-cmp');
        f.__uid = p.uid;
        f.innerHTML = '<textarea rows="1" maxlength="1000" enterkeyhint="send" placeholder="' + esc((p.n || 'Mijoz') + 'ga javob\u2026') + '"></textarea>' +
            '<button type="submit" aria-label="Yuborish"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>';
        rowEl.parentNode.insertBefore(f, rowEl.nextSibling);
        var ta = f.querySelector('textarea'), btn = f.querySelector('button');
        ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
        setTimeout(function () { try { ta.focus(); } catch (e) {} }, 60);
        hap('light');
        f.addEventListener('submit', function (e) {
            e.preventDefault();
            var text = String(ta.value || '').trim();
            if (!text || btn.disabled) return;
            if (typeof W._workerPost !== 'function') { toast('Ilovani yangilang', 'warning'); return; }
            btn.disabled = true;
            W._workerPost('/story-answer', { sid: it.sid, uid: p.uid, text: text.slice(0, 1000) }).then(function (r) {
                var code = r && r.resp ? r.resp.status : 0;
                if (code === 200 && r.data && r.data.ok) {
                    hap('success');
                    toast(r.data.telegram === 'sent' ? 'Javob yuborildi \u2014 ilovada va Telegram\u2019da' : 'Javob yuborildi \u2014 mijoz ilovada ko\u2018radi (\uD83D\uDD14)', 'success');
                    var cur = STATS[it.sid];
                    if (cur) (cur.ans = cur.ans || []).push({ uid: p.uid, t: Date.now(), x: text });
                    if (INS.it === it) { INS.st = STATS[it.sid] || INS.st; insRender(); }
                    return;
                }
                btn.disabled = false;
                toast(code === 404 ? 'Server hali yangilanmagan (Worker deploy kerak)' : ('Yuborilmadi: ' + ((r && r.data && r.data.error) || ('HTTP ' + code))), 'warning');
            }, function () { btn.disabled = false; toast('Internet aloqasini tekshiring', 'warning'); });
        });
    }
    function insHideNow() {
        if (!INS.el || !INS.el.classList.contains('on') || INS.closing) return;
        INS.closing = true;
        var fin = function () {
            INS.el.classList.remove('on');
            INS.closing = false;
            try { INS.el.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); }); } catch (e) {}
            INS.dim.style.opacity = '';
            INS.sheet.style.transform = '';
            if (INS.fromViewer) { S.sheet = false; applyPause(); }
        };
        if (reduced()) { fin(); return; }
        var from = INS.sheet.style.transform || 'translate3d(0,0,0)';
        anim(INS.dim, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
        var a = anim(INS.sheet, [{ transform: from }, { transform: 'translate3d(0,105%,0)' }], { duration: 240, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
        if (a) a.onfinish = fin; else fin();
        setTimeout(function () { if (INS.closing) fin(); }, 600);
    }
    function insClose() {
        if (!INS.el || !INS.el.classList.contains('on')) return;
        if (INS.pushed) {
            INS.pushed = false;
            try {
                W.history.back();
                clearTimeout(INS.popT);
                INS.popT = setTimeout(function () { if (INS.el.classList.contains('on') && !INS.closing) { insRestore(); insHideNow(); } }, 500);
                return;
            } catch (e) {}
        }
        insRestore();
        insHideNow();
    }
    function insRestore() {
        try {
            if (typeof activeModal !== 'undefined' && activeModal === '__storyins__') activeModal = W._a1svInsPrev || null;
            W._a1svInsPrev = null;
            if (typeof updateBtns === 'function') updateBtns();
        } catch (e) {}
    }
    W._a1svInsHideFromHistory = function () { INS.pushed = false; clearTimeout(INS.popT); insHideNow(); };

    function deleteItem(it) {
        if (!it || !amAdmin()) return;
        S.menu = true;
        applyPause();
        confirmAsk('Ushbu storisni butunlay o\u2018chirasizmi?\n\nKo\u2018rishlar va javoblar ham o\u2018chadi.').then(function (ok) {
            S.menu = false;
            if (!ok) { applyPause(); return; }
            var d = DBX();
            if (!d) { applyPause(); return; }
            d.ref('stories/' + it.cat + '/' + it.key).remove().then(function () {
                hap('success');
                toast('Storis o\u2018chirildi', 'success');
                try { d.ref('story_views/' + it.sid).remove().catch(function () {}); } catch (e) {}
                try { d.ref('story_replies/' + it.sid).remove().catch(function () {}); } catch (e) {}
                delete STATS[it.sid];
            }).catch(function (err) {
                toast('O\u2018chirilmadi: ' + ((err && err.message) || 'ruxsat yo\u2018q'), 'warning');
                applyPause();
            });
        });
    }

    /* ═══════════════ 7) ADMIN «STORIES» BOSHQARUVI ═══════════════ */
    var MGR = { painted: false, q: false, fs: lsGet('a1sv_fs_v1'), probing: {}, busy: false };
    function schedule(fn) { if (MGR.q) return; MGR.q = true; setTimeout(function () { MGR.q = false; try { fn(); } catch (e) {} }, 60); }
    function wireManager() {
        var box = D.getElementById('admin-stories-list');
        if (!box || box.__a1sv) return;
        box.__a1sv = true;
        // Kartadagi «ko'rish» — AYNAN shu storisdan ochiladi (ilgari bo'lim boshidan); 📊 — statistika
        box.addEventListener('click', function (e) {
            var t = e.target;
            var st = t.closest && t.closest('.a1sv-stat');
            var op = !st && t.closest && t.closest('[data-open]');
            if (!st && !op) return;
            var card = (st || op).closest('.st2-card');
            if (!card) return;
            var it = findItem(card.getAttribute('data-cat'), card.getAttribute('data-key'));
            if (!it) return;
            e.stopImmediatePropagation();
            e.preventDefault();
            if (st) openInsights(it, 'v', false);
            else startStories(it.cat, null, { key: it.key, from: 'admin' });
        }, true);
        new MutationObserver(function () { schedule(paintManager); }).observe(box, { childList: true, subtree: true });
    }
    function paintManager() {
        var box = D.getElementById('admin-stories-list');
        if (!box || !amAdmin()) return;
        wireManager();
        MGR.painted = true;
        box.querySelectorAll('.st2-card[data-cat][data-key]').forEach(function (card) {
            if (card.querySelector('.a1sv-stat')) return;
            var it = findItem(card.getAttribute('data-cat'), card.getAttribute('data-key'));
            if (!it) return;
            var mid = card.querySelector('.st2-mid') || card;
            var b = mk('button', 'a1sv-stat is-load', IC.eye + '<span>\u2026</span>');
            b.type = 'button';
            b.setAttribute('aria-label', 'Statistika');
            mid.appendChild(b);
            loadStats(it, function (s) {
                b.classList.remove('is-load');
                if (s.err) { b.innerHTML = IC.eye + '<span>\u2014</span>'; return; }
                b.innerHTML = IC.eye + '<span>' + s.v.length + '</span><em>ko\u2018rdi</em>' + (s.r.length ? '<span style="margin-left:4px">\u00B7 ' + IC.chat.replace('<svg', '<svg style="vertical-align:-2px"') + ' ' + s.r.length + '</span>' : '');
            });
        });
        paintBanners(box);
    }
    function leakedList() {
        var out = [];
        Object.keys(RAW).forEach(function (cat) {
            var n = RAW[cat];
            if (!n || typeof n !== 'object') return;
            Object.keys(n).forEach(function (k) { var v = n[k]; if (v && /api\.telegram\.org\/file\/bot/i.test(String(v.src || ''))) out.push({ cat: cat, key: k }); });
        });
        return out;
    }
    function paintBanners(box) {
        var host = box.querySelector('.st2-sum') ? box : null;
        if (!host) return;
        // 1) Bot tokeni ochiq turgan eski storislar (XAVFSIZLIK)
        var leak = leakedList(), lb = box.querySelector('.a1sv-warn[data-k="leak"]');
        if (leak.length && !lb) {
            lb = mk('div', 'a1sv-warn', IC.warn + '<div><b>' + leak.length + ' ta eski storisda bot tokeni ochiq</b>' +
                'Bu yozuvlar (eski \u00ABjarayon/manzil\u00BB bo\u2018limlari) havolasida bot tokeni bor \u2014 uni hamma o\u2018qiy oladi. O\u2018chiring, so\u2018ng BotFather\u2019da tokenni yangilang (/revoke).' +
                '<br><button type="button">O\u2018chirish</button></div>');
            lb.setAttribute('data-k', 'leak');
            box.insertBefore(lb, box.firstChild);
            lb.querySelector('button').addEventListener('click', function () {
                var btn = this;
                confirmAsk(leak.length + ' ta eski storis o\u2018chirilsinmi?').then(function (ok) {
                    if (!ok) return;
                    btn.disabled = true;
                    var d = DBX(), up = {};
                    leak.forEach(function (x) { up['stories/' + x.cat + '/' + x.key] = null; });
                    d.ref().update(up).then(function () { toast('Eski storislar o\u2018chirildi. Endi BotFather\u2019da tokenni yangilang.', 'success'); if (lb.parentNode) lb.parentNode.removeChild(lb); })
                        .catch(function (err) { btn.disabled = false; toast('O\u2018chirilmadi: ' + ((err && err.message) || ''), 'warning'); });
                });
            });
        } else if (!leak.length && lb && lb.parentNode) lb.parentNode.removeChild(lb);
        // 2) Sekin ochiladigan videolar (indeks fayl oxirida)
        var vids = [];
        Object.keys(DATA).forEach(function (c) { DATA[c].forEach(function (it) { if (it.type === 'video' && /\/media\?id=/.test(it.src)) vids.push(it); }); });
        vids.forEach(function (it) { if (!MGR.fs[it.sid] && !MGR.probing[it.sid]) probe(it); });
        var slow = vids.filter(function (it) { return MGR.fs[it.sid] === 'slow'; });
        var sb = box.querySelector('.a1sv-warn[data-k="slow"]');
        if (slow.length && !sb && !MGR.busy) {
            // Ilova/saytdagi admin (Telegram orqali kirgan) — Firebase idToken bilan
            var canFix = !!isTgInit() || (amAdmin() && !!authUid());
            sb = mk('div', 'a1sv-warn is-info', IC.bolt + '<div><b></b>' +
                'Bu videolarda indeks fayl oxirida \u2014 mijoz telefoni avval oxirini, keyin boshini yuklaydi (2\u20134 s qora ekran). Tezlashtirish sifatni o\u2018zgartirmaydi.' +
                '<br><button type="button"' + (canFix ? '' : ' disabled') + '>' + (canFix ? 'Tezlashtirish' : 'Telegram ichida oching') + '</button></div>');
            sb.setAttribute('data-k', 'slow');
            var after = box.querySelector('.a1sv-warn[data-k="leak"]');
            box.insertBefore(sb, after ? after.nextSibling : box.firstChild);
            if (canFix) sb.querySelector('button').addEventListener('click', function () { optimize(sb.__list || [], sb); });
        } else if (!slow.length && sb && sb.parentNode && !MGR.busy) { sb.parentNode.removeChild(sb); sb = null; }
        // Tekshiruvlar asinxron tugaydi — banner soni va ro'yxati har chizishda yangilanadi
        if (sb && !MGR.busy) {
            sb.__list = slow;
            var tb = sb.querySelector('b'), tx = slow.length + ' ta video sekin ochiladi';
            if (tb && tb.textContent !== tx) tb.textContent = tx;
        }
    }
    function probe(it) {
        MGR.probing[it.sid] = 1;
        fetch(mediaUrl(it), { headers: { Range: 'bytes=0-65535' } }).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (buf) {
            if (!buf) return;
            var b = new Uint8Array(buf), o = 0, order = [];
            while (o + 8 <= b.length && order.length < 6) {
                var n = ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
                var t = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
                if (n === 1 && o + 16 <= b.length) n = (((b[o + 8] << 24) >>> 0) + (b[o + 9] << 16) + (b[o + 10] << 8) + b[o + 11]) * 4294967296 + (((b[o + 12] << 24) >>> 0) + (b[o + 13] << 16) + (b[o + 14] << 8) + b[o + 15]);
                order.push(t);
                if (t === 'moov' || t === 'mdat' || n < 8) break;
                o += n;
            }
            var res = order.indexOf('mdat') >= 0 && order.indexOf('moov') < 0 ? 'slow' : 'ok';
            MGR.fs[it.sid] = res;
            lsSet('a1sv_fs_v1', trimMap(MGR.fs, 300));
            if (res === 'slow') schedule(paintManager);
        }).catch(function () {}).then(function () { delete MGR.probing[it.sid]; });
    }
    // /upload auth: Telegram ichida initData, ilova/saytda — Firebase idToken (Bearer)
    function uploadHeaders() {
        var init = isTgInit();
        if (init) return Promise.resolve({ 'X-Init-Data': init });
        try {
            var u = (W.firebase && firebase.auth) ? firebase.auth().currentUser : null;
            if (u) return u.getIdToken().then(function (t) { return { Authorization: 'Bearer ' + t }; }, function () { return null; });
        } catch (e) {}
        return Promise.resolve(null);
    }
    W._a1UploadHeaders = uploadHeaders;
    function optimize(list, banner) {
        if (MGR.busy) return;
        MGR.busy = true;
        var btn = banner.querySelector('button'), title = banner.querySelector('b');
        btn.disabled = true;
        var i = 0, okN = 0;
        var step = function () {
            if (i >= list.length) {
                MGR.busy = false;
                title.textContent = okN ? okN + ' ta video tezlashtirildi \u2705' : 'Videolar allaqachon tez';
                btn.style.display = 'none';
                toast(okN ? 'Videolar tezlashtirildi' : 'O\u2018zgarish kerak bo\u2018lmadi', 'success');
                setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); schedule(paintManager); }, 2600);
                return;
            }
            var it = list[i++];
            title.textContent = i + '/' + list.length + ' \u00B7 yuklab olinmoqda\u2026';
            fetch(mediaUrl(it)).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(function (buf) {
                var out = W._a1FastStartBytes(new Uint8Array(buf));
                if (!out) { MGR.fs[it.sid] = 'ok'; return null; }
                title.textContent = i + '/' + list.length + ' \u00B7 qayta joylanmoqda\u2026';
                var fd = new FormData();
                fd.append('video', new Blob([out], { type: 'video/mp4' }), 'story.mp4');
                return uploadHeaders().then(function (hd) {
                    if (!hd) throw new Error('admin sifatida kiring');
                    return fetch(proxyBase() + '/upload?kind=video', { method: 'POST', headers: hd, body: fd });
                })
                    .then(function (r) { return r.json().catch(function () { return null; }); })
                    .then(function (j) {
                        if (!j || !j.ok || !j.url) throw new Error((j && j.error) || 'yuklanmadi');
                        var up = { src: j.url, optimizedAt: Date.now() };
                        if (j.thumb_url) up.poster = j.thumb_url;
                        return DBX().ref('stories/' + it.cat + '/' + it.key).update(up).then(function () { MGR.fs[it.sid] = 'ok'; okN++; });
                    });
            }).catch(function (err) {
                toast('Video ' + i + ': ' + ((err && err.message) || 'xato'), 'warning');
            }).then(function () { lsSet('a1sv_fs_v1', trimMap(MGR.fs, 300)); step(); });
        };
        step();
    }

    /* ═══════════════ 8) YUKLASH: rasm siqish + video "faststart" ═══════════════ */
    /*  Rasm: telefon fotosi (3-6 MB, 4000 px) endi 1600 px gacha kichraytiriladi —
        storis va tovar rasmlari mijozda bir necha barobar tez ochiladi. Shaffoflik
        uchun PNG/WEBP o'z formatida qoladi. Xato bo'lsa — asl fayl ketadi. */
    function shrinkImage(file) {
        return new Promise(function (resolve) {
            var t = String((file && file.type) || '').toLowerCase();
            if (!file || !/^image\/(jpeg|jpg|png|webp|heic|heif)$/.test(t)) { resolve(file); return; }
            var url = '';
            try { url = URL.createObjectURL(file); } catch (e) { resolve(file); return; }
            var img = new Image();
            img.onload = function () {
                var w = img.naturalWidth, h = img.naturalHeight, max = 1600;
                if (!w || !h) { URL.revokeObjectURL(url); resolve(file); return; }
                var k = Math.min(1, max / Math.max(w, h));
                if (k >= 1 && file.size <= 1.5 * 1048576) { URL.revokeObjectURL(url); resolve(file); return; }
                var cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
                var cv = D.createElement('canvas');
                cv.width = cw; cv.height = ch;
                var cx = cv.getContext('2d');
                if (!cx) { URL.revokeObjectURL(url); resolve(file); return; }
                cx.imageSmoothingEnabled = true;
                cx.imageSmoothingQuality = 'high';
                cx.drawImage(img, 0, 0, cw, ch);
                URL.revokeObjectURL(url);
                var type = /png/.test(t) ? 'image/png' : (/webp/.test(t) ? 'image/webp' : 'image/jpeg');
                try {
                    cv.toBlob(function (blob) {
                        if (!blob || blob.size >= file.size) { resolve(file); return; }
                        var ext = type === 'image/png' ? '.png' : (type === 'image/webp' ? '.webp' : '.jpg');
                        var name = String(file.name || 'image').replace(/\.[A-Za-z0-9]+$/, '') + ext;
                        try { resolve(new File([blob], name, { type: type })); } catch (e) { blob.name = name; resolve(blob); }
                    }, type, type === 'image/png' ? undefined : 0.86);
                } catch (e) { resolve(file); }
            };
            img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };   // masalan HEIC (Android) — asl fayl
            img.src = url;
        });
    }
    function uploadImgbbBinary(file, onProgress) {
        return new Promise(function (resolve, reject) {
            var key = '';
            try { key = typeof IMGBB_API_KEY !== 'undefined' ? IMGBB_API_KEY : ''; } catch (e) {}
            if (!key) { reject(new Error('kalit yo\u2018q')); return; }
            var fd = new FormData();
            fd.append('key', key);
            fd.append('image', file, file.name || 'image.jpg');
            var xhr = new XMLHttpRequest(), last = 0;
            xhr.open('POST', 'https://api.imgbb.com/1/upload');
            xhr.upload.onprogress = function (e) {
                if (!e.lengthComputable || !onProgress) return;
                var now = Date.now(), pct = Math.round(e.loaded / e.total * 100);
                if (pct < 100 && now - last < 110) return;   // DOM'ni har 50 ms da qayta chizmaymiz
                last = now;
                onProgress(pct);
            };
            xhr.onload = function () {
                try {
                    var j = JSON.parse(xhr.responseText);
                    if (j && j.success && j.data && j.data.url) resolve(j.data.url);
                    else reject(new Error(j && j.error && j.error.message ? j.error.message : 'ImgBB rad etdi'));
                } catch (err) { reject(err); }
            };
            xhr.onerror = function () { reject(new Error('Tarmoq xatosi')); };
            xhr.send(fd);
        });
    }
    (function patchUpload() {
        var orig = W.uploadFileWithProgress;
        if (typeof orig !== 'function' || orig.__a1sv) return;
        var wrapped = function (file, onProgress) {
            return shrinkImage(file).then(function (f) {
                return uploadImgbbBinary(f, onProgress).catch(function () { return orig(f, onProgress); });
            });
        };
        wrapped.__a1sv = true;
        W.uploadFileWithProgress = wrapped;
    })();

    /* ═══════════════ 9) ULANISH: eski API'lar yangi ko'ruvchiga yo'naltiriladi ═══════════════ */
    W._a1FastStartBytes = a1FastStartBytes;
    /** Video faylni "faststart" qiladi (indeksni boshiga). Xato/kerak emas — asl fayl. */
    W._a1FastStart = function (file) {
        return new Promise(function (resolve) {
            try {
                if (!file || !file.size || file.size > 64 * 1048576 || typeof file.arrayBuffer !== 'function') { resolve(file); return; }
                file.arrayBuffer().then(function (buf) {
                    var out = null;
                    try { out = a1FastStartBytes(new Uint8Array(buf)); } catch (e) { out = null; }
                    if (!out) { resolve(file); return; }
                    var name = file.name || 'story.mp4';
                    try { resolve(new File([out], name, { type: file.type || 'video/mp4' })); }
                    catch (e) { var b = new Blob([out], { type: file.type || 'video/mp4' }); b.name = name; resolve(b); }
                }, function () { resolve(file); });
            } catch (e) { resolve(file); }
        });
    };
    W._isStorySeen = function (cat, it) { try { return isSeen(cat, it); } catch (e) { return false; } };
    W._markStorySeen = function (cat, it) {
        try {
            if (!it) return;
            var n = it.sid ? it : (findItem(cat, it._key != null ? it._key : it.id) || null);
            if (n) markSeen(n);
        } catch (e) {}
    };
    W.startStories = function (cat, caption, opts) { startStories(cat, caption, opts); };
    W.closeStoryViewer = function () { if (S.open) close(); };
    W.nextStory = function (e) { if (e && e.stopPropagation) e.stopPropagation(); next(); };
    W.prevStory = function (e) { if (e && e.stopPropagation) e.stopPropagation(); prev(); };
    W.deleteCurrentStory = function () { if (S.item) deleteItem(S.item); };
    W.A1Stories = {
        open: startStories, close: close, next: next, prev: prev, insights: openInsights,
        state: function () {
            return { open: S.open, cat: S.open ? curCard().cat : null, ii: S.ii, sid: S.item ? S.item.sid : null, ready: S.ready,
                paused: wantPause(), muted: !!(S.media && S.media.muted), media: S.media ? S.media.tagName : null, cats: S.cats.slice() };
        },
        data: function () { return DATA; },
        _ingest: ingest
    };

    // Admin boshqaruvi ochilganda — statistika tugmalari va bannerlar
    (function hookAdmin() {
        var S2 = W.AvtoStories;
        if (!S2 || typeof S2.openAdmin !== 'function' || S2.openAdmin.__a1sv) { if (!S2) setTimeout(hookAdmin, 800); return; }
        var o = S2.openAdmin;
        var w = function () { var r = o.apply(this, arguments); setTimeout(function () { wireManager(); schedule(paintManager); }, 30); return r; };
        w.__a1sv = true;
        S2.openAdmin = w;
    })();

    // Auth tayyor bo'lgach — bulutdagi "ko'rilgan" belgilarini qo'shamiz (boshqa qurilmada ko'rilganlar ham kulrang)
    (function hookAuth() {
        try {
            if (W.firebase && firebase.auth) { firebase.auth().onAuthStateChanged(function (u) { if (u) { pulledFor = ''; pullSeen(); } }); return; }
        } catch (e) {}
        setTimeout(hookAuth, 900);
    })();

    listen();
    // Erta poyga tuzatildi: halqalar shu yerda yangi (to'liq) mantiq bilan qayta chiziladi
    refreshRings();
    D.addEventListener('visibilitychange', function () { if (D.hidden) flushSeen(); });
    W.addEventListener('pagehide', flushSeen);
    if (W._dlog) W._dlog('%c[a1-stories-26] Stories (iOS 26) yuklandi', 'color:#C9A84C;font-weight:bold;');
})();
