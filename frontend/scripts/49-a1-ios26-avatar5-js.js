
(function () {
    'use strict';
    var OUT_MAX = 1080;      // saqlanadigan rasm: 1080×1080 gacha (Retina'da ham tiniq)
    var QUALITY = 0.92;
    var ICAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
    var IPIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg>';
    var IEYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    var ITRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

    function hap(k) { try { if (typeof window._hap === 'function') window._hap(k); } catch (e) {} }
    function toast(m, t) { try { if (typeof showToast === 'function') showToast(m, t); } catch (e) {} }
    function uid() { return window.currentUser ? String(window.currentUser) : ''; }
    function realUser() { var u = uid(); return u && !/^tg_url_|^guest|^fake/i.test(u); }
    function DB() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : firebase.database(); } catch (e) { return null; } }
    function cacheKey() { return 'a1_avatar_' + uid(); }
    function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

    var current = '';   // joriy rasm URL
    function letter() { var el = document.getElementById('pf-avatar'); return (el && el.textContent || 'A').trim().charAt(0) || 'A'; }
    function wrapEl() { var a = document.getElementById('pf-avatar'); return a ? a.closest('.pfx-av-wrap') : null; }

    function apply(url) {
        current = url || '';
        var w = wrapEl(); if (!w) return;
        var img = w.querySelector('.a5-av-img');
        if (!current) { w.classList.remove('a5-has'); if (img) img.removeAttribute('src'); return; }
        if (!img) { img = document.createElement('img'); img.className = 'a5-av-img'; img.alt = 'Profil rasmi'; img.decoding = 'async'; w.insertBefore(img, w.firstChild); }
        if (img.getAttribute('src') === current) { w.classList.add('a5-has'); return; }
        img.onload = function () { w.classList.add('a5-has'); };
        img.onerror = function () { w.classList.remove('a5-has'); };
        img.src = current;
    }
    function remember(url) {
        try { if (url) localStorage.setItem(cacheKey(), url); else localStorage.removeItem(cacheKey()); } catch (e) {}
        try { if (typeof myProfile !== 'undefined' && myProfile) { if (url) myProfile.avatar = url; else delete myProfile.avatar; } } catch (e) {}
        apply(url);
    }

    function setup() {
        var w = wrapEl(); if (!w || w.__a5) return; w.__a5 = true;
        var cam = document.createElement('span'); cam.className = 'a5-cam'; cam.innerHTML = ICAM; w.appendChild(cam);
        var pr = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        pr.setAttribute('class', 'a5-prog'); pr.setAttribute('viewBox', '0 0 70 70');
        pr.innerHTML = '<circle class="bg" cx="35" cy="35" r="33"/><circle class="fg" cx="35" cy="35" r="33" stroke-dasharray="207.3" stroke-dashoffset="207.3"/>';
        w.appendChild(pr);
        w.setAttribute('role', 'button'); w.setAttribute('aria-label', 'Profil rasmini o\'zgartirish'); w.tabIndex = 0;
        // Karta bosilsa "tahrirlash" ochiladi — avatar bosilganda esa faqat rasm menyusi.
        w.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); hap('selection'); sheet(); }, true);
        w.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); sheet(); } });
        // updateProfileUI() harfni qayta yozganda rasmni qayta tiklaymiz
        var av = document.getElementById('pf-avatar');
        new MutationObserver(function () {
            var a = ''; try { a = (typeof myProfile !== 'undefined' && myProfile && myProfile.avatar) || ''; } catch (e) {}
            if (a && a !== current) remember(a); else apply(current);
        }).observe(av, { childList: true, characterData: true, subtree: true });
        var c = ''; try { c = localStorage.getItem(cacheKey()) || ''; } catch (e) {}
        try { if (typeof myProfile !== 'undefined' && myProfile && myProfile.avatar) c = myProfile.avatar; } catch (e) {}
        if (c) apply(c);
    }

    // Bazadagi haqiqiy qiymat (boshqa qurilmada o'chirilgan bo'lsa ham)
    var attached = '';
    function listen() {
        var u = uid(), d = DB();
        if (!u || !d || attached === u) return;
        attached = u;
        try { var c = localStorage.getItem(cacheKey()); if (c && !current) apply(c); } catch (e) {}
        d.ref('users/' + u + '/profile/avatar').on('value', function (s) {
            var v = s.val(); remember(typeof v === 'string' && /^https:\/\//.test(v) ? v : '');
        }, function () { attached = ''; });
    }

    // ── Action sheet ──
    function close(el, cb) { el.classList.remove('on'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); if (cb) cb(); }, 300); }
    function sheet() {
        var name = (document.getElementById('pf-name') || {}).textContent || 'Mijoz';
        var ov = document.createElement('div'); ov.className = 'a5-ov';
        ov.innerHTML = '<div class="a5-as" role="dialog" aria-label="Profil rasmi">' +
            '<div class="a5-grp">' +
                '<div class="a5-hd"><span class="a5-hd-av">' + (current ? '<img src="' + esc(current) + '" alt="">' : esc(letter())) + '</span>' +
                '<span><b>' + esc(name) + '</b><i>' + (current ? 'Profil rasmingiz yuqori sifatda saqlangan' : 'O\'zingizga yoqqan rasmni qo\'ying — u faqat sizning profilingizda ko\'rinadi') + '</i></span></div>' +
                '<button class="a5-it" data-a="pick">' + IPIC + (current ? 'Rasmni almashtirish' : 'Galereyadan tanlash') + '</button>' +
                (current ? '<button class="a5-it" data-a="view">' + IEYE + 'Rasmni ko\'rish</button><button class="a5-it red" data-a="del">' + ITRASH + 'Rasmni o\'chirish</button>' : '') +
            '</div>' +
            '<div class="a5-grp"><button class="a5-it bold" data-a="x">Bekor qilish</button></div></div>';
        document.body.appendChild(ov);
        requestAnimationFrame(function () { ov.classList.add('on'); });
        ov.addEventListener('click', function (e) {
            var b = e.target.closest('[data-a]');
            if (!b) { if (e.target === ov) close(ov); return; }
            var a = b.getAttribute('data-a'); hap('selection');
            if (a === 'pick') { pickFile(); close(ov); }   // fayl tanlash — foydalanuvchi bosishi ichida chaqiriladi (iOS talabi)
            else if (a === 'view') close(ov, view);
            else if (a === 'del') close(ov, removeAvatar);
            else close(ov);
        });
    }
    function view() {
        if (!current) return;
        var v = document.createElement('div'); v.className = 'a5-vw';
        v.innerHTML = '<img src="' + esc(current) + '" alt="Profil rasmi"><button class="a5-tb" aria-label="Yopish"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
        document.body.appendChild(v); requestAnimationFrame(function () { v.classList.add('on'); });
        v.addEventListener('click', function () { close(v); });
    }
    function removeAvatar() {
        if (!realUser()) { remember(''); return; }
        var d = DB(); if (!d) return;
        d.ref('users/' + uid() + '/profile/avatar').remove().then(function () { remember(''); hap('success'); toast('Profil rasmi o\'chirildi', 'success'); })
            .catch(function () { toast('O\'chirib bo\'lmadi. Internetni tekshiring.', 'warning'); });
    }

    function pickFile() {
        var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
        inp.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
        document.body.appendChild(inp);
        inp.addEventListener('change', function () {
            var f = inp.files && inp.files[0]; inp.remove();
            if (!f) return;
            if (!/^image\//.test(f.type || 'image/')) { toast('Faqat rasm tanlang', 'warning'); return; }
            if (f.size > 25 * 1024 * 1024) { toast('Rasm juda katta (25 MB gacha)', 'warning'); return; }
            crop(f);
        });
        inp.click();
    }

    // ── Kesish: surish + chimchilab kattalashtirish ──
    function crop(file) {
        var url = URL.createObjectURL(file);
        var im = new Image();
        im.onload = function () { openCrop(im, url); };
        im.onerror = function () { URL.revokeObjectURL(url); toast('Rasmni ochib bo\'lmadi', 'warning'); };
        im.src = url;
    }
    window.__a5crop = crop;   // test uchun

    function openCrop(im, url) {
        var W = im.naturalWidth, H = im.naturalHeight;
        var S = Math.round(Math.min(window.innerWidth * 0.82, window.innerHeight * 0.5, 340));
        var base = S / Math.min(W, H), z = 1, tx = 0, ty = 0, ZMAX = Math.max(1, Math.min(5, Math.min(W, H) / 240));
        var cr = document.createElement('div'); cr.className = 'a5-cr';
        cr.innerHTML = '<div class="a5-cr-top"><button class="a5-tb" data-a="x">Bekor</button><b><span class="a5-mono">A1</span>Rasmni joylang</b><button class="a5-tb ic" data-a="r" aria-label="Qaytarish"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 9 9 9"/></svg></button></div>' +
            '<div class="a5-stage"><div class="a5-frame" style="--S:' + S + 'px"></div><div class="a5-mask" style="width:' + S + 'px;height:' + S + 'px;left:calc(50% - ' + S / 2 + 'px);top:calc(50% - ' + S / 2 + 'px)"></div>' +
            '<div class="a5-hint">Suring va ikki barmoq bilan kattalashtiring</div></div>' +
            '<div class="a5-cr-bot"><div class="a5-zoom"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>' +
            '<input type="range" min="1" max="' + ZMAX.toFixed(2) + '" step="0.01" value="1" aria-label="Kattalashtirish"' + (ZMAX <= 1 ? ' disabled' : '') + '>' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="4"/></svg></div>' +
            '<button class="a5-save" data-a="ok">' + ICAM.replace('2.3', '2') + 'Saqlash</button>' +
            '<div class="a5-q">' + W + '×' + H + ' · ' + Math.min(OUT_MAX, Math.round(Math.min(W, H))) + 'px sifatda saqlanadi</div></div>';
        var stage = cr.querySelector('.a5-stage'), frame = cr.querySelector('.a5-frame'), rng = cr.querySelector('input'), q = cr.querySelector('.a5-q');
        im.draggable = false; im.alt = ''; frame.appendChild(im);
        document.body.appendChild(cr); requestAnimationFrame(function () { cr.classList.add('on'); });

        function clamp() {
            var sc = base * z, mx = Math.max(0, (W * sc - S) / 2), my = Math.max(0, (H * sc - S) / 2);
            tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty));
        }
        function outSize() { return Math.max(160, Math.min(OUT_MAX, Math.round(S / (base * z)))); }
        function draw() {
            clamp(); var sc = base * z;
            im.style.width = (W * sc) + 'px'; im.style.height = (H * sc) + 'px';
            im.style.transform = 'translate(calc(-50% + ' + tx + 'px), calc(-50% + ' + ty + 'px))';
            rng.value = z; rng.style.setProperty('--p', ZMAX > 1 ? ((z - 1) / (ZMAX - 1) * 100) + '%' : '0%');
            q.textContent = W + '×' + H + ' · ' + outSize() + 'px sifatda saqlanadi';
        }
        draw();

        var pts = {}, last = null;
        function snap() { var k = Object.keys(pts); if (k.length === 1) return { x: pts[k[0]].x, y: pts[k[0]].y, d: 0 }; if (k.length >= 2) { var a = pts[k[0]], b = pts[k[1]]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; } return null; }
        stage.addEventListener('pointerdown', function (e) { stage.setPointerCapture && stage.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY }; last = snap(); });
        stage.addEventListener('pointermove', function (e) {
            if (!pts[e.pointerId]) return; pts[e.pointerId] = { x: e.clientX, y: e.clientY };
            var s = snap(); if (!s || !last) { last = s; return; }
            if (s.d && last.d) { var nz = Math.max(1, Math.min(ZMAX, z * s.d / last.d)), f = nz / z; tx *= f; ty *= f; z = nz; }
            tx += s.x - last.x; ty += s.y - last.y; last = s; draw();
        });
        function up(e) { delete pts[e.pointerId]; last = snap(); }
        stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
        stage.addEventListener('wheel', function (e) { e.preventDefault(); var nz = Math.max(1, Math.min(ZMAX, z * (e.deltaY < 0 ? 1.08 : 0.926))), f = nz / z; tx *= f; ty *= f; z = nz; draw(); }, { passive: false });
        rng.addEventListener('input', function () { var nz = parseFloat(rng.value) || 1, f = nz / z; tx *= f; ty *= f; z = nz; draw(); });

        function done() { URL.revokeObjectURL(url); close(cr); }
        cr.addEventListener('click', function (e) {
            var b = e.target.closest('[data-a]'); if (!b) return;
            var a = b.getAttribute('data-a');
            if (a === 'x') done();
            else if (a === 'r') { z = 1; tx = 0; ty = 0; draw(); hap('selection'); }
            else if (a === 'ok') {
                b.disabled = true;
                var sc = base * z, sw = S / sc, sx = (W * sc / 2 - S / 2 - tx) / sc, sy = (H * sc / 2 - S / 2 - ty) / sc, o = outSize();
                var cv = document.createElement('canvas'); cv.width = o; cv.height = o;
                var cx = cv.getContext('2d'); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
                cx.fillStyle = '#000'; cx.fillRect(0, 0, o, o);
                cx.drawImage(im, sx, sy, sw, sw, 0, 0, o, o);
                var preview = cv.toDataURL('image/jpeg', 0.8);
                cv.toBlob(function (blob) { done(); if (blob) upload(blob, preview); else toast('Rasmni tayyorlab bo\'lmadi', 'warning'); }, 'image/jpeg', QUALITY);
            }
        });
    }

    function progress(p) {
        var w = wrapEl(); if (!w) return;
        var fg = w.querySelector('.a5-prog .fg'); if (fg) fg.setAttribute('stroke-dashoffset', String(207.3 * (1 - p / 100)));
    }
    function upload(blob, preview) {
        var w = wrapEl(), prev = current;
        apply(preview); if (w) w.classList.add('a5-busy'); progress(4);
        if (typeof uploadFileWithProgress !== 'function') { if (w) w.classList.remove('a5-busy'); apply(prev); toast('Yuklash xizmati topilmadi', 'warning'); return; }
        uploadFileWithProgress(blob, function (p) { progress(Math.max(4, p * 0.95)); }).then(function (link) {
            if (!/^https:\/\//.test(link || '')) throw new Error('URL');
            progress(100);
            if (!realUser()) return link;
            return DB().ref('users/' + uid() + '/profile/avatar').set(link).then(function () { return link; });
        }).then(function (link) {
            var pre = new Image();
            pre.onload = pre.onerror = function () { remember(link); if (w) w.classList.remove('a5-busy'); hap('success'); toast('✅ Profil rasmi yangilandi', 'success'); };
            pre.src = link;
        }).catch(function (err) {
            if (w) w.classList.remove('a5-busy'); apply(prev); hap('error');
            toast('Rasm yuklanmadi: ' + (err && err.message ? err.message : 'xato'), 'warning');
        });
    }

    function init() { setup(); listen(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.addEventListener('load', init);
    try { firebase.auth().onAuthStateChanged(function (u) { if (u) { attached = ''; listen(); } }); } catch (e) {}
    var n = 0, t = setInterval(function () { init(); if (attached || ++n > 40) clearInterval(t); }, 1500);
})();
