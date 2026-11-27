
(function () {
    'use strict';
    var STAR_D = 'M12 2.4c.38 0 .73.22.9.56l2.5 5.06 5.58.81c.38.06.69.32.81.68.12.36.02.76-.25 1.02l-4.04 3.94.95 5.56c.07.37-.09.75-.39.97-.31.22-.71.25-1.05.07L12 18.47l-4.99 2.62c-.34.18-.74.15-1.05-.07-.3-.22-.46-.6-.39-.97l.95-5.56-4.04-3.94c-.27-.26-.37-.66-.25-1.02.12-.36.43-.62.81-.68l5.58-.81 2.5-5.06c.17-.34.52-.56.9-.56z';
    var LABELS = ['', 'Juda yomon', 'Yomon', "O\u2018rtacha", 'Yaxshi', "A\u2019lo!"];
    var TAGS_GOOD = ["Original sifat", "Mashinaga mos keldi", "Tez yetkazildi", "Narxi arzon", "Yaxshi qadoqlangan", "Xizmat zo\u2018r"];
    var TAGS_BAD = ["Sifati past", "Mos kelmadi", "Kech yetkazildi", "Qadoq shikastlangan", "Narxi qimmat", "Tavsifga mos emas"];
    var MAX_TEXT = 500;
    var PROMPT_DAYS = 30;

    /* ---------------- yordamchilar ---------------- */
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function $(id) { return document.getElementById(id); }
    function DB() { try { return (typeof db !== 'undefined' && db) ? db : (window.firebase && firebase.database ? firebase.database() : null); } catch (e) { return null; } }
    function uid() { var u = window.currentUser; return (u === null || u === undefined || u === '') ? '' : String(u); }
    function products() { try { return (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : (window.productsDB || []); } catch (e) { return window.productsDB || []; } }
    function orders() { try { return Array.isArray(window.myOrders) ? window.myOrders : ((typeof myOrders !== 'undefined' && Array.isArray(myOrders)) ? myOrders : []); } catch (e) { return []; } }
    function prod(id) { var p = products(); for (var i = 0; i < p.length; i++) if (p[i] && String(p[i].id) === String(id)) return p[i]; return null; }
    function thumb(u, w) { try { return (typeof window._thumb === 'function') ? window._thumb(u, w) : u; } catch (e) { return u; } }
    function lite() { try { return document.documentElement.classList.contains('lite') || !!window.__perfLite || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
    function hap(k) { try { if (typeof window._hap === 'function') window._hap(k); } catch (e) {} }
    function toast(m, t) { try { if (typeof window.showToast === 'function') window.showToast(m, t || 'success'); } catch (e) {} }
    function myName() {
        var n = '';
        try { n = (typeof myProfile !== 'undefined' && myProfile && myProfile.name) ? myProfile.name : ''; } catch (e) {}
        if (!n) { try { var u = window.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user; if (u) n = [u.first_name, u.last_name].filter(Boolean).join(' '); } catch (e) {} }
        return String(n || 'Mijoz').trim().slice(0, 60);
    }
    function activeModalNow() { try { return (typeof activeModal !== 'undefined') ? activeModal : window.activeModal; } catch (e) { return window.activeModal; } }
    function orderTime(o) { var t = Number(o && (o.deliveredAt || o.updatedAt || o.createdAt)) || parseInt(String(o && o.id || ''), 10) || 0; return t > 1e11 ? t : 0; }
    function relDate(ts, fallback) {
        ts = Number(ts) || 0; if (!ts) return fallback || '';
        var d = Math.floor((Date.now() - ts) / 86400000);
        if (d <= 0) return 'bugun'; if (d === 1) return 'kecha'; if (d < 7) return d + ' kun oldin';
        if (d < 30) return Math.floor(d / 7) + ' hafta oldin';
        try { return new Date(ts).toLocaleDateString('uz-UZ'); } catch (e) { return fallback || ''; }
    }
    function starSvg(cls) { return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR_D + '"' + (cls === 'rv-s-fg' || cls === 'rv-gold' ? ' fill="url(#rvGold)"' : '') + '/></svg>'; }
    function ensureDefs() {
        if ($('rv-defs')) return;
        var d = document.createElement('div');
        d.id = 'rv-defs'; d.setAttribute('aria-hidden', 'true');
        d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        d.innerHTML = '<svg width="0" height="0"><defs><linearGradient id="rvGold" x1="0" y1="0" x2="0.4" y2="1">' +
            '<stop offset="0" stop-color="#FFF1B0"/><stop offset=".38" stop-color="#FFD34E"/><stop offset=".75" stop-color="#F2A900"/><stop offset="1" stop-color="#C77F00"/>' +
            '</linearGradient></defs></svg>';
        document.body.appendChild(d);
    }

    /** O'qish uchun yulduzlar (qisman to'ldirilgan). */
    function avgHTML(v, size) {
        v = Math.max(0, Math.min(5, parseFloat(v) || 0));
        var one = function (cls) { var s = ''; for (var i = 0; i < 5; i++) s += starSvg(cls); return s; };
        return '<span class="rv-avg ' + (size || 'rv-sm') + '" role="img" aria-label="' + v.toFixed(1) + ' / 5">' +
            '<span class="rv-avg-bg">' + one('rv-avg-bg') + '</span>' +
            '<span class="rv-avg-fg" style="width:' + (v / 5 * 100).toFixed(1) + '%">' + one('rv-gold') + '</span></span>';
    }

    /* ---------------- xarid / buyurtmalar ---------------- */
    /** Buyurtmadagi mahsulot id'lari (yangi: itemDetails[].id, eski: "id||variant" kalitlari). */
    function orderProductIds(o) {
        var out = [], seen = {};
        function add(id) { id = String(id || ''); if (id && !seen[id]) { seen[id] = 1; out.push(id); } }
        if (o && Array.isArray(o.itemDetails) && o.itemDetails.length) o.itemDetails.forEach(function (it) { if (it) add(it.id); });
        else if (o && o.items && typeof o.items === 'object') Object.keys(o.items).forEach(function (k) { if (!/^l_[0-9a-f]{20,}$/.test(k)) add(String(k).split('||')[0]); });
        return out;
    }
    function itemName(o, pid) {
        if (o && Array.isArray(o.itemDetails)) for (var i = 0; i < o.itemDetails.length; i++) { var it = o.itemDetails[i]; if (it && String(it.id) === String(pid) && it.name) return it.name; }
        var p = prod(pid); return p ? p.name : 'Tovar';
    }
    function deliveredOrders() { return orders().filter(function (o) { return o && o.status === 'yetkazildi'; }); }
    /** pid -> eng so'nggi yetkazilgan buyurtma. */
    function purchaseOf(pid) {
        var best = null;
        deliveredOrders().forEach(function (o) {
            if (orderProductIds(o).indexOf(String(pid)) >= 0 && (!best || orderTime(o) >= orderTime(best))) best = o;
        });
        return best;
    }
    window._a1HasBought = function (pid) { return !!purchaseOf(pid); };

    /* ---------------- sharhlar keshi ---------------- */
    var cache = {};   // pid -> { list:[], mine:obj|null, at }
    function fetchReviews(pid, force) {
        var c = cache[pid];
        if (c && !force && (Date.now() - c.at) < 60000) return Promise.resolve(c);
        var d = DB(); if (!d) return Promise.resolve({ list: [], mine: null, at: Date.now() });
        return d.ref('reviews/' + pid).once('value').then(function (snap) {
            var v = snap.val() || {}, me = uid(), list = [], mine = null;
            Object.keys(v).forEach(function (k) {
                var r = v[k]; if (!r || !(Number(r.rating) > 0)) return;
                r = Object.assign({}, r, { _k: k, rating: Math.max(1, Math.min(5, Math.round(Number(r.rating)))) });
                list.push(r);
                if (me && (k === me || String(r.userId) === me)) mine = r;
            });
            list.sort(function (a, b) { return (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0); });
            cache[pid] = { list: list, mine: mine, at: Date.now() };
            return cache[pid];
        }).catch(function () { return cache[pid] || { list: [], mine: null, at: 0 }; });
    }

    /* ---------------- yulduz tanlagich ---------------- */
    function burst(btn) {
        if (lite()) return;
        var b = btn.querySelector('.rv-burst'); if (!b) return;
        var h = '';
        for (var i = 0; i < 8; i++) {
            var a = (i / 8) * Math.PI * 2 + Math.random() * .4, r = 26 + Math.random() * 14;
            h += '<i style="--dx:' + (Math.cos(a) * r).toFixed(1) + 'px;--dy:' + (Math.sin(a) * r).toFixed(1) + 'px;animation-delay:' + (Math.random() * 60).toFixed(0) + 'ms"></i>';
        }
        b.innerHTML = h;
        setTimeout(function () { b.innerHTML = ''; }, 800);
    }
    /** el ichiga 5 yulduz. opts: { value, size:'rv-xl'|'rv-md', onChange(v), readonly, label:el } */
    function picker(el, opts) {
        ensureDefs();
        opts = opts || {};
        var h = '<div class="rv-stars ' + (opts.size || 'rv-xl') + (opts.readonly ? ' rv-ro' : '') + '" role="radiogroup" aria-label="Baho">';
        for (var i = 1; i <= 5; i++) {
            h += '<button type="button" class="rv-star" role="radio" aria-checked="false" aria-label="' + i + ' yulduz" data-v="' + i + '">' +
                starSvg('rv-s-bg') + starSvg('rv-s-fg') + '<span class="rv-burst"></span></button>';
        }
        h += '</div>';
        el.innerHTML = h;
        var wrap = el.firstChild, btns = wrap.querySelectorAll('.rv-star'), value = 0;
        function paint(v, animate) {
            for (var i = 0; i < btns.length; i++) {
                var on = i < v;
                btns[i].style.transitionDelay = '';
                var fg = btns[i].querySelector('.rv-s-fg');
                if (fg) fg.style.transitionDelay = (animate && on) ? (i * 45) + 'ms' : '0ms';
                btns[i].classList.toggle('on', on);
                btns[i].setAttribute('aria-checked', i === v - 1 ? 'true' : 'false');
            }
            wrap.classList.toggle('rv-five', v === 5 && animate);
            if (opts.label) {
                opts.label.textContent = v ? LABELS[v] : (opts.placeholder || '');
                opts.label.className = 'rv-label' + (v ? ' l' + v : '');
                if (animate && v) { void opts.label.offsetWidth; opts.label.classList.add('bump'); }
            }
        }
        function set(v, animate, silent) {
            v = Math.max(0, Math.min(5, v | 0));
            var changed = v !== value; value = v;
            paint(v, animate);
            if (animate && v) {
                var b = btns[v - 1];
                b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
                burst(b);
                hap(v === 5 ? 'success' : 'light');
            }
            if (changed && !silent && opts.onChange) opts.onChange(v);
        }
        if (!opts.readonly) {
            var dragging = false, last = 0;
            var idxAt = function (x) {
                for (var i = 0; i < btns.length; i++) { var r = btns[i].getBoundingClientRect(); if (x < r.right + 4) return i + 1; }
                return 5;
            };
            wrap.addEventListener('pointerdown', function (e) {
                dragging = true; last = idxAt(e.clientX);
                try { wrap.setPointerCapture(e.pointerId); } catch (x) {}
                paint(last, false);
                hap('selection');
            });
            wrap.addEventListener('pointermove', function (e) {
                if (!dragging) return;
                var v = idxAt(e.clientX);
                if (v !== last) { last = v; paint(v, false); hap('selection'); }
            });
            var end = function (e) {
                if (!dragging) return; dragging = false;
                var v = e && e.type !== 'pointercancel' ? idxAt(e.clientX) : last;
                set(v, true);
            };
            wrap.addEventListener('pointerup', end);
            wrap.addEventListener('pointercancel', end);
            wrap.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { set(Math.min(5, value + 1), true); e.preventDefault(); }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { set(Math.max(1, value - 1), true); e.preventDefault(); }
            });
        }
        set(opts.value || 0, false, true);
        return { get: function () { return value; }, set: set };
    }

    /* ---------------- baholash oynasi ---------------- */
    var S = null;   // { order, pids:[], i, drafts:{pid:{rating,text,tags}}, saved:0 }
    function ensureModal() {
        var m = $('a1RateModal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'a1RateModal';
        m.className = 'modal-standard';
        m.innerHTML = '<div class="modal-header"><h2 id="rv-title">Baholash</h2>' +
            '<button class="close-btn" aria-label="Yopish" onclick="closeModal()">\u00D7</button></div>' +
            '<div class="rv-body" id="rv-body"></div>';
        document.body.appendChild(m);
        return m;
    }
    function open(order, startPid, preset) {
        if (!order) return;
        var pids = orderProductIds(order);
        if (!pids.length) { toast("Bu buyurtmada baholanadigan tovar topilmadi", 'warning'); return; }
        S = { order: order, pids: pids, i: Math.max(0, pids.indexOf(String(startPid || ''))), drafts: {}, saved: 0, preset: preset || 0 };
        ensureModal();
        try { window.openModal('a1RateModal'); } catch (e) { var m = $('a1RateModal'); if (m) m.style.display = 'flex'; }
        // mavjud baholarni oldindan yuklab, qoralamaga qo'yamiz
        Promise.all(pids.map(function (p) { return fetchReviews(p); })).then(function (rs) {
            rs.forEach(function (r, k) { if (r && r.mine) S.drafts[pids[k]] = { rating: r.mine.rating, text: r.mine.text || '', tags: (r.mine.tags || []).slice(), existed: true }; });
            renderStep();
        });
        renderStep(true);
    }
    function renderStep(loading) {
        var body = $('rv-body'); if (!body || !S) return;
        var pid = S.pids[S.i], p = prod(pid), o = S.order;
        var d = S.drafts[pid] || (S.drafts[pid] = { rating: 0, text: '', tags: [] });
        if (S.preset && !d.rating && !d.existed) { d.rating = S.preset; }
        S.preset = 0;
        var img = p && (p.img || p.image);
        var prog = '';
        if (S.pids.length > 1) {
            prog = '<div class="rv-prog" aria-label="' + (S.i + 1) + ' / ' + S.pids.length + '">';
            for (var k = 0; k < S.pids.length; k++) prog += '<i class="' + (k === S.i ? 'cur' : (k < S.i ? 'done' : '')) + '"></i>';
            prog += '</div>';
        }
        $('rv-title').textContent = S.pids.length > 1 ? ('Baholash \u00B7 ' + (S.i + 1) + '/' + S.pids.length) : 'Baholash';
        body.innerHTML = '<div class="rv-step-in" style="width:100%;display:flex;flex-direction:column;align-items:center">' + prog +
            '<div class="rv-hero">' + (img ? '<img src="' + esc(thumb(img, 320)) + '" alt="" decoding="async">' : '<div class="rv-hero-ph">\uD83D\uDE97</div>') + '</div>' +
            '<div class="rv-pname">' + esc(itemName(o, pid)) + '</div>' +
            '<div class="rv-pmeta"><span class="rv-ok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Yetkazildi</span>' +
                (o.code ? '<span>\u00B7 #' + esc(o.code) + '</span>' : '') + '</div>' +
            '<div class="rv-q">' + (d.existed ? 'Bahoingizni o\u2018zgartirishingiz mumkin' : 'Tovar sizga qanchalik yoqdi?') + '</div>' +
            '<div id="rv-pick"></div><div class="rv-label" id="rv-lbl"></div>' +
            '<div class="rv-tags" id="rv-tags"></div>' +
            '<div class="rv-ta-wrap"><textarea id="rv-text" class="rv-ta" maxlength="' + MAX_TEXT + '" rows="3" placeholder="Fikringizni yozing (ixtiyoriy)"></textarea><span class="rv-cnt" id="rv-cnt">0/' + MAX_TEXT + '</span></div>' +
            '<div class="rv-actions"><button type="button" class="rv-btn rv-btn-pri" id="rv-send"' + (loading ? ' disabled' : '') + '>' + (d.existed ? 'Yangilash' : 'Yuborish') + '</button>' +
            '<button type="button" class="rv-btn rv-btn-sec" id="rv-skip">' + (S.i < S.pids.length - 1 ? 'Keyingi tovar' : 'Keyinroq') + '</button></div></div>';
        var ta = $('rv-text'), cnt = $('rv-cnt'), send = $('rv-send');
        ta.value = d.text || '';
        cnt.textContent = ta.value.length + '/' + MAX_TEXT;
        ta.addEventListener('input', function () { d.text = ta.value.slice(0, MAX_TEXT); cnt.textContent = d.text.length + '/' + MAX_TEXT; });
        function tags(v) {
            var box = $('rv-tags'); if (!box) return;
            if (!v) { box.classList.remove('show'); box.innerHTML = ''; return; }
            var set = v >= 4 ? TAGS_GOOD : TAGS_BAD;
            d.tags = d.tags.filter(function (t) { return set.indexOf(t) >= 0; });
            box.innerHTML = set.map(function (t) { return '<button type="button" class="rv-tag' + (d.tags.indexOf(t) >= 0 ? ' on' : '') + '" data-t="' + esc(t) + '">' + esc(t) + '</button>'; }).join('');
            box.classList.add('show');
            ta.placeholder = v >= 4 ? 'Nimasi yoqdi? (ixtiyoriy)' : 'Nima yoqmadi? Biz albatta tuzatamiz (ixtiyoriy)';
        }
        $('rv-tags').addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('.rv-tag'); if (!b) return;
            var t = b.getAttribute('data-t'), i = d.tags.indexOf(t);
            if (i >= 0) d.tags.splice(i, 1); else if (d.tags.length < 4) d.tags.push(t);
            b.classList.toggle('on', d.tags.indexOf(t) >= 0); hap('selection');
        });
        picker($('rv-pick'), {
            value: d.rating, size: 'rv-xl', label: $('rv-lbl'), placeholder: 'Yulduzni bosing yoki suring',
            onChange: function (v) { d.rating = v; tags(v); send.disabled = !v || !!loading; }
        });
        tags(d.rating);
        send.disabled = !d.rating || !!loading;
        send.addEventListener('click', function () { submit(pid, d, send); });
        $('rv-skip').addEventListener('click', next);
    }
    function next() {
        if (!S) return;
        if (S.i < S.pids.length - 1) { S.i++; renderStep(); try { $('a1RateModal').scrollTop = 0; } catch (e) {} return; }
        if (S.saved) renderDone(); else { try { window.closeModal(); } catch (e) {} }
    }
    var lastSend = 0;
    function submit(pid, d, btn) {
        var me = uid(), base = DB();
        if (!me || !base) { toast("Xavfsiz ulanish kerak \u2014 ilovani qayta oching", 'warning'); return; }
        if (!d.rating) { toast("Avval yulduzni tanlang", 'warning'); return; }
        if (Date.now() - lastSend < 2500) return;
        lastSend = Date.now();
        btn.classList.add('busy'); btn.textContent = 'Yuborilmoqda\u2026';
        var now = new Date();
        var data = {
            userId: me, userName: myName(), rating: d.rating,
            text: String(d.text || '').trim().slice(0, MAX_TEXT),
            tags: (d.tags || []).slice(0, 4),
            orderId: String(S.order.id || ''),
            date: now.toLocaleDateString('uz-UZ'), timestamp: now.getTime()
        };
        if (d.existed) data.edited = true;
        base.ref('reviews/' + pid + '/' + me).set(data).then(function () {
            d.existed = true; S.saved++;
            delete cache[pid];
            hap('success');
            try { if (typeof window.loadProductRatings === 'function') window.loadProductRatings(); else if (typeof loadProductRatings === 'function') loadProductRatings(); } catch (e) {}
            try { if (typeof currentReviewProductId !== 'undefined' && String(currentReviewProductId) === String(pid)) window.loadProductReviews(pid); } catch (e) {}
            refreshOrderBox();
            if (S.i < S.pids.length - 1) { toast("Saqlandi \u2014 keyingi tovar"); next(); }
            else renderDone();
        }).catch(function (err) {
            btn.classList.remove('busy'); btn.textContent = d.existed ? 'Yangilash' : 'Yuborish';
            lastSend = 0;
            var denied = err && /permission/i.test(String(err.code || err.message || ''));
            toast(denied ? "Saqlanmadi: ulanish tasdiqlanmagan. Ilovani yopib qayta oching." : "Saqlanmadi \u2014 internetni tekshirib, qayta bosing", 'warning');
            hap('error');
        });
    }
    function renderDone() {
        var body = $('rv-body'); if (!body) return;
        ensureDefs();
        $('rv-title').textContent = 'Rahmat!';
        var nm = myName().split(' ')[0];
        body.innerHTML = '<div class="rv-done rv-step-in">' +
            '<div class="rv-done-star"><span class="rv-rays"></span>' + starSvg('rv-gold') + '</div>' +
            '<h3>Rahmat' + (nm && nm !== 'Mijoz' ? ', ' + esc(nm) : '') + '!</h3>' +
            '<p>Bahoingiz boshqa haydovchilarga to\u2018g\u2018ri ehtiyot qism tanlashga yordam beradi.</p>' +
            '<div class="rv-actions" style="margin:28px auto 0"><button type="button" class="rv-btn rv-btn-pri" id="rv-ok">Tayyor</button></div></div>';
        $('rv-ok').addEventListener('click', function () { try { window.closeModal(); } catch (e) {} });
        hap('success');
    }

    window.A1Rate = {
        openOrder: function (orderId, pid, preset) {
            var o = orders().filter(function (x) { return x && String(x.id) === String(orderId); })[0];
            if (!o || o.status !== 'yetkazildi') { toast("Baholash tovar yetkazilgandan keyin ochiladi", 'warning'); return; }
            open(o, pid, preset);
        },
        openProduct: function (pid, preset) {
            var o = purchaseOf(pid);
            if (!o) { toast("Baholash faqat xarid qilingan va yetkazilgan tovar uchun", 'warning'); return; }
            open(o, pid, preset);
        }
    };

    /* ---------------- tovar oynasi: baholar bo'limi ---------------- */
    var pmState = { pid: null, showAll: false };
    function revHTML(r) {
        var nm = String(r.userName || 'Mijoz').trim() || 'Mijoz';
        var tags = Array.isArray(r.tags) && r.tags.length ? '<div class="rv-rev-tags">' + r.tags.slice(0, 4).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '';
        return '<div class="rv-rev"><div class="rv-rev-h"><div class="rv-ava">' + esc(nm.charAt(0).toUpperCase()) + '</div>' +
            '<div class="rv-rev-who"><div class="rv-rev-nm">' + esc(nm) + '</div>' +
            '<div class="rv-rev-meta">' + avgHTML(r.rating, 'rv-xs') + '<span>' + esc(relDate(r.timestamp, r.date)) + (r.edited ? ' \u00B7 tahrirlangan' : '') + '</span></div></div></div>' +
            tags + (r.text ? '<div class="rv-rev-tx">' + esc(r.text) + '</div>' : '') + '</div>';
    }
    function renderPM(pid, data) {
        var sec = $('pm-review-section'); if (!sec || pmState.pid !== pid) return;
        ensureDefs();
        var list = data.list, n = list.length, mine = data.mine, bought = !!purchaseOf(pid), me = uid();
        var sum = 0, dist = [0, 0, 0, 0, 0, 0];
        list.forEach(function (r) { sum += r.rating; dist[r.rating]++; });
        var avg = n ? sum / n : 0;
        var h = '<div class="rv-pm-head"><h3>Baholar va sharhlar</h3>' + (n > 3 ? '<button type="button" class="rv-pm-all" id="rv-pm-all">' + (pmState.showAll ? 'Kamroq' : 'Barchasi (' + n + ')') + '</button>' : '') + '</div>';
        if (n) {
            h += '<div class="rv-card rv-sum"><div class="rv-sum-big"><b>' + (Math.round(avg * 10) / 10).toFixed(1) + '</b>' + avgHTML(avg, 'rv-sm') + '<small>' + n + ' ta baho</small></div><div class="rv-dist">';
            for (var s = 5; s >= 1; s--) h += '<div class="rv-dist-row"><span>' + s + '</span><div class="rv-dist-bar"><i data-w="' + (n ? (dist[s] / n * 100).toFixed(1) : 0) + '"></i></div></div>';
            h += '</div></div>';
        }
        if (me && mine) {
            h += '<div class="rv-card"><div class="rv-mine-head"><div><div class="rv-k">Sizning bahoingiz</div><div style="margin-top:6px">' + avgHTML(mine.rating, 'rv-sm') + '</div></div>' +
                (bought ? '<button type="button" class="rv-edit" id="rv-pm-edit">Tahrirlash</button>' : '') + '</div>' +
                (mine.text ? '<div class="rv-rev-tx">' + esc(mine.text) + '</div>' : '') + '</div>';
        } else if (me && bought) {
            h += '<div class="rv-card rv-cta"><div class="rv-cta-t">Siz bu tovarni xarid qilgansiz</div><div class="rv-cta-s">Baholang \u2014 bu boshqa mijozlarga yordam beradi</div><div id="rv-pm-pick"></div></div>';
        }
        if (n) {
            var shown = list.filter(function (r) { return !mine || r._k !== mine._k; });
            var cut = pmState.showAll ? shown : shown.slice(0, 3);
            if (cut.length) h += '<div class="rv-card">' + cut.map(revHTML).join('') + '</div>';
            if (!pmState.showAll && shown.length > 3) h += '<button type="button" class="rv-more" id="rv-pm-more">Yana ' + (shown.length - 3) + ' ta sharh</button>';
        } else if (!(me && bought)) {
            h += '<div class="rv-card rv-empty">' + avgHTML(0, 'rv-md') + '<b>Hali baho yo\u2018q</b><span>Tovarni olgan mijozlar bu yerda baho qoldiradi</span></div>';
        }
        if (me && !bought && !mine) h += '<div class="rv-note">Baho qoldirish tovar sizga yetkazilgandan keyin ochiladi.</div>';
        sec.innerHTML = h;
        // taqsimot chiziqlari silliq to'ladi
        requestAnimationFrame(function () { requestAnimationFrame(function () {
            sec.querySelectorAll('.rv-dist-bar i').forEach(function (i) { i.style.width = i.getAttribute('data-w') + '%'; });
        }); });
        var pk = $('rv-pm-pick');
        if (pk) picker(pk, { size: 'rv-md', onChange: function (v) { if (v) setTimeout(function () { window.A1Rate.openProduct(pid, v); }, 260); } });
        var ed = $('rv-pm-edit'); if (ed) ed.addEventListener('click', function () { window.A1Rate.openProduct(pid); });
        var more = $('rv-pm-more'), all = $('rv-pm-all');
        var toggle = function () { pmState.showAll = !pmState.showAll; renderPM(pid, data); };
        if (more) more.addEventListener('click', toggle);
        if (all) all.addEventListener('click', toggle);
    }
    window.loadProductReviews = function (productId) {
        try { if (typeof currentReviewProductId !== 'undefined') currentReviewProductId = productId; } catch (e) {}
        var sec = $('pm-review-section'); if (!sec) return;
        pmState = { pid: String(productId), showAll: false };
        sec.innerHTML = '<div class="rv-pm-head"><h3>Baholar va sharhlar</h3></div>' + (window._skel ? window._skel(2, 70) : '');
        fetchReviews(String(productId), true).then(function (data) { renderPM(String(productId), data); });
    };

    /* ---------------- buyurtma tafsiloti ---------------- */
    var odCur = null;
    function refreshOrderBox() { if (odCur) renderOrderBox(odCur); }
    function renderOrderBox(o) {
        odCur = o;
        var box = $('od-rate-box');
        if (!box) {
            var acts = document.querySelector('#orderDetailModal .mo-acts');
            if (!acts || !acts.parentNode) return;
            box = document.createElement('div'); box.id = 'od-rate-box';
            acts.parentNode.insertBefore(box, acts);
        }
        if (!o || o.status !== 'yetkazildi' || !uid()) { box.innerHTML = ''; return; }
        var pids = orderProductIds(o); if (!pids.length) { box.innerHTML = ''; return; }
        var oid = String(o.id);
        Promise.all(pids.map(function (p) { return fetchReviews(p); })).then(function (rs) {
            if (!odCur || String(odCur.id) !== oid) return;
            var done = rs.filter(function (r) { return r && r.mine; }).length;
            ensureDefs();
            if (done >= pids.length) {
                box.innerHTML = '<div class="rv-card"><span class="rv-od-done"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Baholaganingiz uchun rahmat</span>' +
                    '<button type="button" class="rv-edit" id="rv-od-edit" style="margin-top:8px">Bahoni ko\u2018rish / o\u2018zgartirish</button></div>';
                $('rv-od-edit').addEventListener('click', function () { window.A1Rate.openOrder(oid); });
                return;
            }
            var first = pids.filter(function (p, k) { return !(rs[k] && rs[k].mine); })[0];
            box.innerHTML = '<div class="rv-card"><div class="rv-od-t">Tovarlarni baholang</div><div class="rv-od-s">' +
                (pids.length > 1 ? (done ? done + ' / ' + pids.length + ' ta baholandi' : pids.length + ' ta tovar') : 'Tovar sizga yoqdimi?') + '</div><div id="rv-od-pick"></div></div>';
            picker($('rv-od-pick'), { size: 'rv-md', onChange: function (v) { if (v) setTimeout(function () { window.A1Rate.openOrder(oid, first, v); }, 260); } });
        });
    }
    function wrapOrderDetail() {
        var o = window._renderOrderCancel;
        if (typeof o !== 'function' || o.__rv) return;
        var w = function (order) {
            var r = o.apply(this, arguments);
            try { renderOrderBox(order); } catch (e) {}
            return r;
        };
        w.__rv = true;
        window._renderOrderCancel = w;
    }

    /* ---------------- yetkazilgandan keyin taklif kartasi ---------------- */
    var PKEY = function () { return 'a1_rv_prompted_' + uid(); };
    function prompted() { try { return JSON.parse(localStorage.getItem(PKEY()) || '{}') || {}; } catch (e) { return {}; } }
    function markPrompted(id) { try { var m = prompted(); m[id] = Date.now(); var ks = Object.keys(m); if (ks.length > 80) delete m[ks[0]]; localStorage.setItem(PKEY(), JSON.stringify(m)); } catch (e) {} }
    var nudgeBusy = false;
    function hideNudge() {
        var n = $('rv-nudge'); if (!n) return;
        n.classList.remove('show');
        setTimeout(function () { if (n.parentNode && !n.classList.contains('show')) n.parentNode.removeChild(n); }, 500);
    }
    function showNudge(o, pid) {
        ensureDefs();
        hideNudge();
        var p = prod(pid), img = p && (p.img || p.image);
        var n = document.createElement('div');
        n.id = 'rv-nudge'; n.setAttribute('role', 'dialog'); n.setAttribute('aria-label', 'Buyurtmani baholash');
        n.innerHTML = (img ? '<img class="rvn-img" src="' + esc(thumb(img, 120)) + '" alt="">' : '<div class="rvn-img"></div>') +
            '<div class="rvn-mid"><div class="rvn-t">Yetkazildi! Qanday baholaysiz?</div><div class="rvn-s" id="rvn-pick"></div></div>' +
            '<button type="button" class="rvn-x" aria-label="Yopish">\u00D7</button>';
        document.body.appendChild(n);
        picker($('rvn-pick'), { size: 'rv-sm', onChange: function (v) {
            if (!v) return;
            setTimeout(function () { hideNudge(); window.A1Rate.openOrder(o.id, pid, v); }, 280);
        } });
        // kichik yulduzlar — barmoq uchun kattaroq
        var st = n.querySelector('.rv-stars'); if (st) { st.style.setProperty('--rv-sz', '28px'); st.style.setProperty('--rv-gap', '6px'); }
        n.querySelector('.rvn-x').addEventListener('click', hideNudge);
        requestAnimationFrame(function () { requestAnimationFrame(function () { n.classList.add('show'); }); });
        hap('light');
        setTimeout(function () { if ($('rv-nudge') === n) hideNudge(); }, 20000);
    }
    function checkPrompt() {
        if (nudgeBusy || !window.__a1Booted || !uid() || document.hidden) return;
        if (activeModalNow()) return;
        if ($('rv-nudge')) return;
        var pm = prompted(), now = Date.now();
        var cand = deliveredOrders().filter(function (o) {
            var t = orderTime(o);
            return o && o.id && !pm[String(o.id)] && (!t || now - t < PROMPT_DAYS * 86400000);
        }).sort(function (a, b) { return orderTime(b) - orderTime(a); })[0];
        if (!cand) return;
        var pids = orderProductIds(cand);
        if (!pids.length) { markPrompted(String(cand.id)); return; }
        nudgeBusy = true;
        Promise.all(pids.map(function (p) { return fetchReviews(p); })).then(function (rs) {
            nudgeBusy = false;
            markPrompted(String(cand.id));
            var k = -1; for (var i = 0; i < rs.length; i++) if (!(rs[i] && rs[i].mine)) { k = i; break; }
            if (k < 0 || activeModalNow()) return;
            showNudge(cand, pids[k]);
        }).catch(function () { nudgeBusy = false; });
    }

    /* ---------------- ishga tushirish ---------------- */
    function boot() {
        wrapOrderDetail();
        // eski (anti-spam) o'ramlari yangi oqimni chetlab o'tmasin
        window.submitReview = function () { var pid = (typeof currentReviewProductId !== 'undefined') ? currentReviewProductId : null; if (pid) window.A1Rate.openProduct(pid); };
    }
    boot();
    document.addEventListener('DOMContentLoaded', boot);
    window.addEventListener('a1-ready', function () {
        boot();
        setTimeout(checkPrompt, 3500);
        setInterval(checkPrompt, 8000);   // buyurtma ilova ochiq paytda "yetkazildi" bo'lsa ham
    });
})();
