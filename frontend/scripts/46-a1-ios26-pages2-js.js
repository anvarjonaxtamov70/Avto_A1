
/* ══════════════════════════════════════════════════════════════════
   🍏 iOS 26 — 2-bosqich JS: Manzillarim (xarita eskizlari), Ma'lumotlarim,
   Mening mashinam, Qoralamalar, Xabar yuborish (hisoblagich + ko'rinish),
   Stories (SVG tugmalar, vaqt), AI tugmasi belgisi.
   ══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function $(id) { return document.getElementById(id); }
    function hap(k) { try { if (typeof window._hap === 'function') window._hap(k); } catch (e) {} }
    function isDark() { return document.documentElement.getAttribute('data-theme') !== 'light'; }
    var I = {
        x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
        chev: '<span class="a1-chev"><svg viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5 6.5 6.5 1.5 11.5"/></svg></span>',
        user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
        phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
        pin: '<svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
        map: '<svg viewBox="0 0 24 24"><path d="M9 3 3 5.5v15.5l6-2.5 6 2.5 6-2.5V3l-6 2.5z"/><path d="M9 3v15.5M15 5.5V21"/></svg>',
        car: '<svg viewBox="0 0 24 24"><path d="M5 17h14M5 17a2 2 0 1 1-4 0v-5l2.5-6A2 2 0 0 1 5.4 5h13.2a2 2 0 0 1 1.9 1l2.5 6v5a2 2 0 1 1-4 0"/><path d="M3 12h18"/></svg>',
        check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
        mag: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
        trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
        edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
        folder: '<svg viewBox="0 0 48 40" aria-hidden="true"><defs><linearGradient id="drFg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dc7e"/><stop offset="1" stop-color="#b8901f"/></linearGradient></defs><path d="M4 6a4 4 0 0 1 4-4h10l5 5h17a4 4 0 0 1 4 4v3H4z" fill="#a8851f"/><rect x="2" y="10" width="44" height="28" rx="5" fill="url(#drFg)"/><path d="M6 14h36" stroke="rgba(255,255,255,.45)" stroke-width="1.2" stroke-linecap="round"/></svg>',
        spkOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
        spkOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
        heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.4-9.1C1.2 8 3.2 4.5 6.7 4.5c2 0 3.6 1.1 5.3 3 1.7-1.9 3.3-3 5.3-3 3.5 0 5.5 3.5 4.1 6.9-1.9 4.5-9.4 9.1-9.4 9.1z"/></svg>',
        send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
    };

    /* ══════════ 📍 MANZILLARIM — xarita eskizli ro'yxat ══════════ */
    function thumbStyle(ll) {
        var z = 15, n = Math.pow(2, z);
        var xt = (ll.lng + 180) / 360 * n;
        var lr = ll.lat * Math.PI / 180;
        var yt = (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n;
        var x = Math.floor(xt), y = Math.floor(yt);
        var px = Math.round((xt - x) * 256), py = Math.round((yt - y) * 256);
        var url = 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png';
        return '--tb:url(' + url + ');--tp:' + (23 - px) + 'px ' + (23 - py) + 'px';
    }
    window.renderAddresses = function () {
        var addrs = (typeof getAddresses === 'function') ? getAddresses() : [];
        var cnt = $('pf-addr-count'); if (cnt) cnt.textContent = addrs.length ? String(addrs.length) : '';
        var pe = $('pe-addr-n'); if (pe) pe.textContent = addrs.length ? String(addrs.length) : '';
        var el = $('addr-sheet-list'); if (!el) return;
        if (!addrs.length) {
            el.innerHTML = '<div class="a1-empty"><span class="a1-empty-ic">' + I.pin.replace('<svg', '<svg aria-hidden="true"') + '</span><b>Manzil qo\u2018shilmagan</b><p>Xaritadan nuqta belgilang yoki manzilni qo\u2018lda yozing — keyingi buyurtmada bir bosishda tanlaysiz.</p></div>';
            return;
        }
        el.innerHTML = '<div class="ad-sec">Saqlangan \u00B7 ' + addrs.length + ' ta</div><div class="ad-group">' + addrs.map(function (a, i) {
            var meta = window._addrMeta(a), address = String(a.address || '').trim();
            var sub = address && !window._addrCoordOnly(address) ? esc(address) : (a.mapLink ? 'Xaritada belgilangan nuqta' : esc(address));
            var ll = window._addrLatLng ? window._addrLatLng(a) : null;
            var lead = ll ? '<span class="ad-thumb" style="' + thumbStyle(ll) + '" aria-hidden="true"></span>' : '<span class="ad-ic" style="--ic:' + meta.color + '">' + meta.icon + '</span>';
            var map = (a.mapLink && /^https:\/\//i.test(String(a.mapLink)))
                ? '<a class="ad-act" href="' + esc(a.mapLink) + '" target="_blank" rel="noopener" aria-label="Xaritada ochish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg></a>' : '';
            return '<div class="ad-row" style="--i:' + i + '">' + lead +
                '<span class="ad-tx"><b>' + esc(a.label || meta.name) + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</span>' + map +
                '<button type="button" class="ad-act ad-del" onclick="window._addrDelete(' + i + ')" aria-label="Manzilni o\'chirish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg></button></div>';
        }).join('') + '</div>';
    };
    // Qo'lda qo'shishda «Joriy joylashuv»: Telegram → brauzer GPS → manzil matni
    window.getLocationForAddress = function () {
        var btn = $('addr-loc-btn'), txt = $('addr-text');
        if (btn) btn.classList.add('se-busy');
        var done = function (lat, lng) {
            if (btn) btn.classList.remove('se-busy');
            var coords = '📍 ' + lat.toFixed(5) + ', ' + lng.toFixed(5);
            if (txt) txt.value = coords;
            hap('success');
            if (window._a1Geo) window._a1Geo.reverse(lat, lng).then(function (t) { if (t && txt && txt.value === coords) txt.value = t + ' (' + lat.toFixed(5) + ', ' + lng.toFixed(5) + ')'; }).catch(function () {});
            try { showToast('📍 Joylashuv olindi', 'success'); } catch (e) {}
        };
        var fail = function () { if (btn) btn.classList.remove('se-busy'); try { showToast("Joylashuvni olib bo'lmadi — ruxsat bering yoki qo'lda yozing", 'warning'); } catch (e) {} };
        var gps = function () {
            if (!navigator.geolocation) { fail(); return; }
            navigator.geolocation.getCurrentPosition(function (p) { done(p.coords.latitude, p.coords.longitude); }, fail, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
        };
        try {
            var lm = (typeof tg !== 'undefined' && tg) ? tg.LocationManager : null;
            if (lm && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0')) {
                var go = function () { if (!lm.isLocationAvailable) { gps(); return; } lm.getLocation(function (l) { if (l && l.latitude) done(l.latitude, l.longitude); else gps(); }); };
                if (lm.isInited) go(); else lm.init(go);
                return;
            }
        } catch (e) {}
        gps();
    };

    /* ══════════ 👤 MA'LUMOTLARIM ══════════ */
    function fmtPhone(v) {
        var d = String(v || '').replace(/\D/g, '');
        if (d.indexOf('998') !== 0 || d.length > 12) return v;
        var p = [d.slice(0, 3), d.slice(3, 5), d.slice(5, 8), d.slice(8, 10), d.slice(10, 12)].filter(Boolean);
        return '+' + p.join(' ');
    }
    function syncPE() {
        var n = $('user-edit-name'), av = $('pe-av'), nm = $('pe-name');
        var name = (n && n.value.trim()) || 'Mijoz';
        if (av) av.textContent = name.charAt(0).toUpperCase();
        if (nm) nm.textContent = name;
        var car = '';
        try { car = localStorage.getItem('avto_my_car') || ''; } catch (e) {}
        var pc = $('pe-car'); if (pc) pc.textContent = car ? (window.myCarLabel ? window.myCarLabel(car) : car) : 'Belgilanmagan';
        var pa = $('pe-addr-n'); if (pa) { try { var A = getAddresses(); pa.textContent = A.length ? String(A.length) : ''; } catch (e) {} }
        var ph = $('user-edit-phone'); if (ph && ph.value) ph.value = fmtPhone(ph.value);
    }
    window._peSync = syncPE;
    document.addEventListener('input', function (e) {
        var t = e.target;
        if (!t || !t.id) return;
        if (t.id === 'user-edit-name') syncPE();
        if (t.id === 'user-edit-phone') {
            var f = t.closest('.pe-f'); if (f) f.classList.remove('is-bad');
            var d = t.value.replace(/\D/g, '');
            if (d.indexOf('998') === 0 && e.inputType && e.inputType.indexOf('delete') < 0) t.value = fmtPhone(t.value);
        }
    }, true);

    /* ══════════ 🚗 MENING MASHINAM ══════════ */
    function getCar() { try { return localStorage.getItem('avto_my_car') || ''; } catch (e) { return ''; } }
    function brandLogo(title) {
        var t = window.CATALOG_TREE || [];
        for (var i = 0; i < t.length; i++) if ((t[i].title || t[i].brand) === title) return t[i].logo || '';
        return '';
    }
    window.openMyCarModal = function () {
        var m = $('myCarModal');
        if (!m) {
            m = document.createElement('div');
            m.id = 'myCarModal'; m.className = 'modal-standard';
            m.innerHTML = '<div class="modal-header"><h2>Mening mashinam</h2><button class="close-btn" aria-label="Yopish" onclick="closeModal()">\u00D7</button></div>' +
                '<p class="a1-foot" style="margin:-4px 4px 12px;font-size:14px">Mashinangizni tanlang — buyurtmada admin aynan mos qismni tanlab beradi.</p>' +
                '<div id="my-car-current"></div>' +
                '<div class="mc-sticky"><label class="a1-search">' + I.mag + '<input type="search" id="my-car-search" placeholder="Qidirish: Nexia, Gazel, Cobalt…" autocomplete="off" oninput="renderMyCarList(this.value)"></label></div>' +
                '<div id="my-car-list"></div>';
            document.body.appendChild(m);
        }
        var si = $('my-car-search'); if (si) si.value = '';
        window.renderMyCarList('');
        if (typeof window.openModal === 'function') window.openModal('myCarModal');
    };
    window.renderMyCarList = function (query) {
        var q = String(query == null ? '' : query).toLowerCase().trim();
        var cur = getCar(), list = window._catalogCarList ? window._catalogCarList() : [];
        var curBox = $('my-car-current'), box = $('my-car-list');
        if (curBox) curBox.innerHTML = cur
            ? '<div class="a1-hero" style="margin-bottom:6px"><div class="mc-cur"><span class="mc-cur-ic">' + I.car + '</span><div class="mc-cur-tx"><small>Tanlangan</small><b>' + esc(window.myCarLabel(cur)) + '</b></div>' +
              '<button type="button" class="mc-cur-x" onclick="saveMyCarChoice(\'\')">Olib tashlash</button></div></div>'
            : '';
        if (!box) return;
        var groups = [], gm = {};
        list.forEach(function (it) {
            if (q && (it.brand + ' ' + it.name).toLowerCase().indexOf(q) < 0) return;
            if (!gm[it.brand]) { gm[it.brand] = []; groups.push(it.brand); }
            gm[it.brand].push(it);
        });
        if (!groups.length) { box.innerHTML = '<div class="mc-none">Topilmadi — boshqacha yozib ko\u2018ring</div>'; return; }
        box.innerHTML = groups.map(function (b) {
            var logo = brandLogo(b);
            return '<div class="mc-brand">' + (logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy">' : '') + '<span>' + esc(b) + '</span></div><div class="a1-grp">' +
                gm[b].map(function (it) {
                    var jsv = esc(it.slug).replace(/'/g, "\\'");
                    return '<button type="button" class="mc-row' + (it.img ? ' has-img' : '') + (it.slug === cur ? ' on' : '') + '" onclick="saveMyCarChoice(\'' + jsv + '\')">' +
                        (it.img ? '<img src="' + esc(it.img) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
                        '<span>' + esc(it.name) + '</span><i>' + I.check + '</i></button>';
                }).join('') + '</div>';
        }).join('');
    };
    // Profil va «Ma'lumotlarim» qatorlarini ham yangilaymiz
    (function () {
        var orig = window.renderMyCar;
        if (typeof orig === 'function' && !orig.__a1) {
            var w = function () { var r = orig.apply(this, arguments); try { syncPE(); } catch (e) {} return r; };
            w.__a1 = true; window.renderMyCar = w;
        }
    })();

    /* ══════════ 📝 QORALAMALAR ══════════ */
    function prettyB(b) { try { return window._prettyBatch ? window._prettyBatch(b) : b; } catch (e) { return b; } }
    window.showDraftFolders = function () {
        $('draft-folders-view').style.display = 'block';
        $('draft-items-view').style.display = 'none';
        $('drafts-modal-title').textContent = 'Qoralamalar';
        var cb = $('drafts-close-btn'); if (cb) { cb.innerHTML = I.x; cb.setAttribute('aria-label', 'Yopish'); }
        var drafts = (window.productsDB || (typeof productsDB !== 'undefined' ? productsDB : [])).filter(function (p) { return p && p.is_draft; });
        var folders = {}, order = [];
        drafts.forEach(function (p) { var b = p.batch_id || 'Boshqalar'; if (!folders[b]) { folders[b] = 0; order.push(b); } folders[b]++; });
        var clr = document.querySelector('#adminDraftsModal > .dr-clear'); if (clr) clr.classList.toggle('is-off', !drafts.length);
        var lead = document.querySelector('#draft-folders-view > p');
        if (lead) lead.textContent = drafts.length ? 'Ro\u2018yxat qilib qo\u2018shilgan tovarlar papkalarda saqlanadi. Papkani ochib, rasm va narxni to\u2018ldiring.' : '';
        var html = order.map(function (b, i) {
            var jb = esc(b).replace(/'/g, "\\'");
            return '<button type="button" class="dr-f" style="--i:' + i + '" onclick="openDraftFolder(\'' + jb + '\')">' +
                '<span class="dr-f-acts"><span role="button" aria-label="Nomini o\u2018zgartirish" onclick="renameFolder(event,\'' + jb + '\')">' + I.edit + '</span>' +
                '<span role="button" class="is-del" aria-label="Papkani o\u2018chirish" onclick="deleteFolder(event,\'' + jb + '\')">' + I.trash + '</span></span>' +
                '<span class="dr-f-ic">' + I.folder + '</span><b>' + esc(prettyB(b)) + '</b><small>' + folders[b] + ' ta tovar</small></button>';
        }).join('');
        if (!order.length) html = '<div class="a1-empty"><span class="a1-empty-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></span><b>Qoralamalar yo\u2018q</b><p>Ro\u2018yxat yoki AI orqali qo\u2018shilgan, hali tugallanmagan tovarlar shu yerda papkalarda saqlanadi.</p></div>';
        $('draft-folders-list').innerHTML = html;
    };
    (function () {
        var orig = window.openDraftFolder;
        if (typeof orig !== 'function' || orig.__a1) return;
        var w = function (b) {
            var r = orig.apply(this, arguments);
            var t = $('drafts-modal-title'); if (t) t.textContent = prettyB(b);
            var cb = $('drafts-close-btn'); if (cb) { cb.innerHTML = I.back; cb.setAttribute('aria-label', 'Papkalarga qaytish'); }
            return r;
        };
        w.__a1 = true; window.openDraftFolder = w;
    })();

    /* ══════════ 📣 XABAR YUBORISH — hisoblagich, tez formatlash, ko'rinish ══════════ */
    function tgPreview(s) {
        var h = esc(s);
        h = h.replace(/&lt;(\/?)(b|strong|i|em|u|s|code)&gt;/g, '<$1$2>');
        h = h.replace(/&lt;a href=&quot;(https?:\/\/[^&]+?)&quot;&gt;([\s\S]*?)&lt;\/a&gt;/g, '<a href="$1" target="_blank" rel="noopener">$2</a>');
        return h;
    }
    function enhanceBroadcast() {
        var ta = $('bc-text'); if (!ta || ta.__a1) return;
        ta.__a1 = true;
        var hint = document.querySelector('#broadcastModal .bcx-hint');
        var meta = document.createElement('div');
        meta.className = 'bcx-meta';
        meta.innerHTML = '<span class="bcx-tools"><button type="button" data-t="b"><b>B</b></button><button type="button" data-t="i"><i>I</i></button><button type="button" data-t="u"><u>U</u></button></span><span><b id="bcx-n">0</b> / 3500</span>';
        var grp = ta.closest('.bcx-grp'); if (grp) grp.insertAdjacentElement('afterend', meta);
        var prev = document.createElement('div');
        prev.className = 'bcx-prev';
        prev.innerHTML = '<p class="bcx-prev-t">Mijozda ko\u2018rinishi</p><div class="bcx-bubble" id="bcx-bubble"></div>';
        (hint || meta).insertAdjacentElement('afterend', prev);
        var upd = function () {
            $('bcx-n').textContent = ta.value.length;
            var b = $('bcx-bubble'); b.innerHTML = tgPreview(ta.value.trim());
            var d = new Date(); b.setAttribute('data-time', ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2));
        };
        ta.addEventListener('input', upd);
        meta.querySelector('.bcx-tools').addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-t]'); if (!btn) return;
            var t = btn.getAttribute('data-t'), s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
            var sel = v.slice(s, en) || 'matn';
            ta.value = v.slice(0, s) + '<' + t + '>' + sel + '</' + t + '>' + v.slice(en);
            ta.focus(); ta.setSelectionRange(s + t.length + 2, s + t.length + 2 + sel.length);
            upd(); hap('selection');
        });
        upd();
    }
    (function () {
        var orig = window.openBroadcastModal;
        if (typeof orig !== 'function' || orig.__a1) return;
        var w = function () { var r = orig.apply(this, arguments); try { enhanceBroadcast(); } catch (e) {} return r; };
        w.__a1 = true; window.openBroadcastModal = w;
    })();

    /* ══════════ 📸 STORIES ══════════ */
    window._svSoundIco = function (muted) { return muted ? I.spkOff : I.spkOn; };
    window._svHeartIco = I.heart;
    /* Sarlavha ostidagi qator: raqam/vaqt EMAS — brend imzosi (Avto A1 + oltin "tasdiqlangan" belgisi).
       ⚠️ Ilgari meta #story-caption ICHIGA yozilardi — reaksiya yuborilganda adminga
       caption.textContent "AksiyalarAvto A1 · 136 kun" bo'lib ketardi. Endi alohida qatorda. */
    var VERIFIED = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#e2c46e" d="M12 1.8l2.5 1.9 3.1-.3 1.1 2.9 2.7 1.6-.6 3.1 1.3 2.8-2.3 2.1-.4 3.1-3.1.5-2 2.4-2.9-1.2-2.9 1.2-2-2.4-3.1-.5-.4-3.1L.8 13.8l1.3-2.8-.6-3.1 2.7-1.6 1.1-2.9 3.1.3z"/><path d="M7.8 12.3l2.8 2.8 5.6-5.8" fill="none" stroke="#1a1405" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    function decorateStory() {
        var old = document.querySelector('#story-caption .sv-meta'); if (old) old.remove();
        var sb = $('sv-sound-btn'); if (sb && !sb.querySelector('svg')) sb.innerHTML = I.spkOn;
        var hb = $('sv-heart-btn'); if (hb && !hb.classList.contains('sv-reacted')) hb.innerHTML = I.heart;
    }
    /** Ovoz · o'chirish · yopish — sarlavha qatorining o'ng tomonida, bitta guruhda. */
    function mountStoryActs() {
        var top = document.querySelector('#story-viewer .story-top-info'); if (!top) return;
        var acts = top.querySelector('.sv-acts');
        if (!acts) { acts = document.createElement('div'); acts.className = 'sv-acts'; top.appendChild(acts); }
        ['sv-sound-btn', 'admin-story-delete-btn'].forEach(function (id) {
            var el = $(id); if (el && el.parentNode !== acts) acts.appendChild(el);
        });
        var cl = document.querySelector('#story-viewer .story-close-btn');
        if (cl && (cl.parentNode !== acts || acts.lastElementChild !== cl)) acts.appendChild(cl);
    }
    (function () {
        var orig = window.playCurrentStory;
        if (typeof orig !== 'function' || orig.__a1) return;
        var w = function () { var r = orig.apply(this, arguments); try { decorateStory(); } catch (e) {} return r; };
        w.__a1 = true; window.playCurrentStory = w;
    })();
    (function () {
        var orig = window.startStories;
        if (typeof orig !== 'function' || orig.__a1) return;
        var w = function () { var r = orig.apply(this, arguments); try { mountStoryActs(); } catch (e) {} return r; };
        w.__a1 = true; window.startStories = w;
    })();
    (function initStoryChrome() {
        var top = document.querySelector('#story-viewer .story-top-info');
        if (top && !top.querySelector('.sv-ava')) top.insertAdjacentHTML('afterbegin', '<span class="sv-ava" aria-hidden="true"><b>A1</b></span>');
        var cap = $('story-caption');
        if (top && cap && !cap.closest('.sv-id')) {
            var idw = document.createElement('div'); idw.className = 'sv-id';
            cap.parentNode.insertBefore(idw, cap); idw.appendChild(cap);
            idw.insertAdjacentHTML('beforeend', '<span class="sv-meta">Avto A1' + VERIFIED + '<em>\u00B7 rasmiy do\u2018kon</em></span>');
        }
        var cl = document.querySelector('#story-viewer .story-close-btn');
        if (cl) { cl.innerHTML = I.x; cl.setAttribute('role', 'button'); cl.setAttribute('aria-label', 'Yopish'); }
        var del = $('admin-story-delete-btn'); if (del) { del.innerHTML = I.trash; del.setAttribute('role', 'button'); del.setAttribute('aria-label', 'Storisni o\u2018chirish'); del.setAttribute('title', 'O\u2018chirish'); }
        var snd = document.querySelector('#story-viewer .sv-reply-send'); if (snd) snd.innerHTML = I.send;
        var hb = $('sv-heart-btn'); if (hb && !hb.classList.contains('sv-reacted')) hb.innerHTML = I.heart;
        mountStoryActs();
    })();
    /* ⏸ BOSIB TURIB PAUZA — tuzatildi.
       ⚠️ Ilgari pauza ishlovchilari #story-content'ga ulangan, lekin uning USTIDA chap/o'ng
       bosish zonalari (z-index:5) turadi — barmoq kontentga hech qachon yetmasdi, ya'ni
       "bosib turib to'xtatish" umuman ishlamasdi. Endi zonalarning o'zi uzoq bosishni
       taniydi: 220ms+ bosilsa — pauza, qo'yib yuborilganda keyingi storisga SAKRAMAYDI. */
    (function storyHold() {
        var viewer = $('story-viewer'); if (!viewer) return;
        var timer = null, held = false, swallow = false, x0 = 0, y0 = 0;
        function content() { return $('story-content'); }
        function down(e) {
            held = false; x0 = e.clientX; y0 = e.clientY;
            clearTimeout(timer);
            timer = setTimeout(function () {
                var c = content(); if (!c || typeof c.onmousedown !== 'function') return;
                held = true; try { c.onmousedown(e); } catch (er) {}
            }, 220);
        }
        function up() {
            clearTimeout(timer); timer = null;
            if (!held) return;
            held = false; swallow = true; setTimeout(function () { swallow = false; }, 350);
            var c = content(); if (c && typeof c.onmouseup === 'function') { try { c.onmouseup(); } catch (er) {} }
        }
        function move(e) { if (timer && !held && (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10)) { clearTimeout(timer); timer = null; } }
        viewer.querySelectorAll('.story-tap-left, .story-tap-right').forEach(function (z) {
            z.addEventListener('pointerdown', down);
            z.addEventListener('pointerup', up);
            z.addEventListener('pointercancel', up);
            z.addEventListener('pointerleave', up);
            z.addEventListener('pointermove', move);
            z.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        });
        viewer.addEventListener('click', function (e) {
            if (swallow && e.target.closest && e.target.closest('.story-tap-left, .story-tap-right')) { e.stopPropagation(); e.preventDefault(); swallow = false; }
        }, true);
    })();

    /* ══════════ ✦ AI TUGMASI ══════════ */
    (function () {
        var mk = document.querySelector('#shogird-launcher .shogird-mark');
        if (!mk) return;
        mk.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="a1SparkG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc7e"/><stop offset=".55" stop-color="#d4af37"/><stop offset="1" stop-color="#a8851f"/></linearGradient></defs>' +
            '<path class="a1-spark-big" d="M13 3.5c.9 5.6 3.4 8.2 9 9.2v.6c-5.6 1-8.1 3.6-9 9.2h-.6c-.9-5.6-3.4-8.2-9-9.2v-.6c5.6-1 8.1-3.6 9-9.2z"/>' +
            '<path class="a1-spark-sm" d="M23.5 2.5c.4 2.6 1.5 3.7 4 4.2v.4c-2.5.5-3.6 1.6-4 4.2h-.4c-.4-2.6-1.5-3.7-4-4.2v-.4c2.5-.5 3.6-1.6 4-4.2z"/>' +
            '<path class="a1-spark-xs" d="M24 18.5c.3 2 1.2 2.9 3.2 3.3v.3c-2 .4-2.9 1.3-3.2 3.3h-.3c-.3-2-1.2-2.9-3.2-3.3v-.3c2-.4 2.9-1.3 3.2-3.3z"/></svg>';
        var b = $('shogird-launcher'); if (b) b.setAttribute('aria-label', 'Shogird — Avto A1 AI yordamchisi');
    })();
})();
