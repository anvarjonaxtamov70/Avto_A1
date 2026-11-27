
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var E = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var fmt = function (n) { return (Math.round(Number(n) || 0)).toLocaleString('ru-RU').replace(/,/g, ' '); };
    var hap = function (k) { try { if (window._hap) window._hap(k); } catch (e) {} };
    var toast = function (m, t) { try { showToast(m, t || 'warning'); } catch (e) {} };
    var I = {
        pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>',
        map: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 5.1L9 3 3 5v16l6-2 6 2 6-2V3l-6 2.1zM15 19l-6-2.1V5l6 2.1V19z"/></svg>',
        plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
        card: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>',
        phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 1H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm-5 21a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5-4H7V4h10v14z"/></svg>',
        cash: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 6h20v12H2V6zm2 2v8h16V8H4zm8 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>',
        gift: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1a3 3 0 0 0-5.5-1.65l-.5.67-.5-.68A3 3 0 0 0 6 5c0 .35.07.69.18 1H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm0 13H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 12 7.4 15.38 12 17 10.83 14.92 8H20v6z"/></svg>',
        box: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3 6.5 3.6L12 11.5 5.5 7.9 12 4.3zM5 9.6l6 3.3v6.8l-6-3.3V9.6zm8 10.1v-6.8l6-3.3v6.8l-6 3.3z"/></svg>',
        city: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
        copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
        cart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 20.01 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>'
    };
    var CHEV = '<span class="co-chev">\u203A</span>';
    // 💳 To'lov usullari — FAQAT Payme va naqd pul. ("Karta orqali o'tkazma" va
    //    Click do'kon egasining qarori bilan olib tashlandi.) Kalit 'app' saqlangan.
    var PAY = {
        app:  { name: 'Payme', sub: 'Payme ilovasi orqali', ic: I.phone, color: '#00a8c6' },
        cash: { name: 'Naqd pul', sub: 'Tovar kelganda to\u2018laysiz', ic: I.cash, color: '#30d158' }
    };
    var CARD_NO = '5614 6818 7479 6349';

    /* ═══ 0) SUMMA "SANAB CHIQISH" XATOSI ═══
       Savat ochilganda bir element uchun 3 ta count-up bir vaqtda ishlardi;
       ulardan biri yakuniy qiymatni ekrandagi ORALIQ raqamdan o'qib, noto'g'ri
       summada to'xtardi (masalan 495 000 o'rniga 10 333). Endi har element
       uchun faqat OXIRGI animatsiya ishlaydi va doim aniq qiymatda tugaydi. */
    function counter(duration, fromCurrent) {
        return function (id, end) {
            var el = document.getElementById(id);
            if (!el) return;
            end = Math.round(Number(end) || 0);
            if (id === 'cart-total-sum' && typeof window._cartTotal === 'number') end = Math.round(window._cartTotal);
            var tok = (el.__coTok = (el.__coTok || 0) + 1);
            var start = fromCurrent ? (parseInt(String(el.innerText).replace(/[^0-9]/g, ''), 10) || 0) : 0;
            var reduce = false;
            try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('lite'); } catch (e) {}
            if (reduce || start === end) { el.innerHTML = fmt(end) + " so'm"; return; }
            var t0 = null;
            function step(ts) {
                if (el.__coTok !== tok) return;          // yangi animatsiya boshlandi — bunisi to'xtaydi
                if (t0 === null) t0 = ts;
                var p = Math.min(1, (ts - t0) / duration);
                var v = p >= 1 ? end : Math.floor(start + (end - start) * (1 - Math.pow(1 - p, 3)));
                el.innerHTML = fmt(v) + " so'm";
                if (p < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        };
    }
    window.animatePrice = counter(700, true);
    window.animateValue = counter(900, false);

    /* ═══ 1) SAVAT ═══ */
    function lineOf(fullId) {
        var parts = String(fullId).split('||');
        var pdb = window.productsDB || (typeof productsDB !== 'undefined' ? productsDB : []);
        var p = pdb.find(function (x) { return x.id == parts[0]; });
        if (!p) return null;
        var qty = parseInt(cart[fullId], 10) || 0;
        var opt = parts[1] ? parts[1].replace(/_dot_/g, '.') : '';
        if (opt === 'Universal' || opt === 'undefined') opt = '';
        return { id: fullId, p: p, qty: qty, opt: opt, sum: (Number(p.price) || 0) * qty };
    }
    function cartLines() {
        var out = [];
        for (var k in (cart || {})) { var l = lineOf(k); if (l && l.qty > 0) out.push(l); }
        return out;
    }
    function grossTotal() { return cartLines().reduce(function (s, l) { return s + l.sum; }, 0); }

    window.renderCartItems = function () {
        var c = $('cart-items-container'); if (!c) return;
        var btn = $('main-checkout-btn'), foot = $('cart-total-footer'), wrap = $('cart-progress-wrap'), trust = $('cart-trust-badges'), cnt = $('co-cart-count');
        var lines = cartLines();
        if (!lines.length) {
            c.innerHTML = '<div class="co-empty"><div class="co-empty-ic">' + I.cart + '</div><b>Savatingiz bo\u2018sh</b>Katalogda mashinangizga mos ehtiyot qismlarni toping.' +
                '<button type="button" class="co-btn" onclick="closeModal(); showCatalog();">Katalogga o\u2018tish</button></div>';
            [btn, foot, wrap, trust].forEach(function (el) { if (el) el.style.display = 'none'; });
            window._cartTotal = 0;
            return;
        }
        var t = 0, pcs = 0;
        var thumb = (typeof window._thumb === 'function') ? window._thumb : function (u) { return u; };
        c.innerHTML = '<div class="co-grp">' + lines.map(function (l) {
            t += l.sum; pcs += l.qty;
            var sid = E(String(l.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
            var img = l.p.img || l.p.image || '';
            return '<div class="co-item">' +
                (img ? '<img class="co-img" src="' + E(thumb(img, 140)) + '" alt="" loading="lazy" decoding="async" onerror="window._imgFallback ? window._imgFallback(this) : (this.style.visibility=\'hidden\')">' : '<span class="co-img"></span>') +
                '<div class="co-mid"><div class="co-nm">' + E(l.p.name) + '</div>' +
                    (l.opt ? '<span class="co-opt">' + E(l.opt) + '</span>' : '') +
                    '<div class="co-price"><b>' + fmt(l.sum) + '</b>' + (l.qty > 1 ? fmt(l.p.price) + ' \u00D7 ' + l.qty : "so'm") + '</div></div>' +
                '<div class="co-step">' +
                    (l.qty <= 1
                        ? '<button type="button" class="del" aria-label="O\u2018chirish" onclick="chg(\'' + sid + '\',-1)">' + I.trash + '</button>'
                        : '<button type="button" aria-label="Kamaytirish" onclick="chg(\'' + sid + '\',-1)">\u2212</button>') +
                    '<span>' + l.qty + '</span>' +
                    '<button type="button" aria-label="Ko\u2018paytirish" onclick="chg(\'' + sid + '\',1)">+</button>' +
                '</div></div>';
        }).join('') + '</div>';
        window._cartTotal = t;
        var sumEl = $('cart-total-sum');
        if (sumEl) { sumEl.__coTok = (sumEl.__coTok || 0) + 1; sumEl.innerHTML = fmt(t) + " so'm"; }
        if (cnt) cnt.textContent = '\u00B7 ' + pcs + ' dona';
        if (btn) btn.style.display = 'flex';
        if (foot) foot.style.display = 'flex';
        if (trust) trust.style.display = 'block';
        if (wrap) {
            var target = (window.VIP && window.VIP.freeDeliveryTarget) ? window.VIP.freeDeliveryTarget() : 3000000;
            var pct = Math.min(100, t / target * 100);
            var msg = $('cart-progress-msg'), bar = $('cart-progress-bar');
            wrap.style.display = 'block';
            wrap.classList.toggle('is-done', pct >= 100);
            if (msg) msg.innerHTML = pct >= 100 ? 'Shahar bo\u2018ylab yetkazish <b style="color:inherit">bepul</b>' : 'Bepul yetkazishgacha <b>' + fmt(target - t) + " so'm</b>";
            if (bar) requestAnimationFrame(function () { bar.style.width = pct + '%'; });
        }
    };

    /* ═══ 2) RASMIYLASHTIRISH ═══ */
    var st = { smq: false, pay: null, bts: { region: '', district: '', branch: '' } };
    function addrs() { try { return (typeof getAddresses === 'function') ? getAddresses() : []; } catch (e) { return []; } }
    function cbBal() { try { return window._cbBalance ? (window._cbBalance() || 0) : 0; } catch (e) { return 0; } }
    function cbOn() { try { return window._cbIsOn ? window._cbIsOn() : false; } catch (e) { return false; } }
    function money() {
        var gross = grossTotal();
        var use = 0; try { if (window._cbGetApplied) use = window._cbGetApplied(gross) || 0; } catch (e) {}
        var payable = Math.max(0, gross - use);
        var rate = 0.008; try { if (window._cashbackRate) rate = window._cashbackRate(); } catch (e) {}
        return { gross: gross, use: use, payable: payable, earn: Math.round(payable * rate), rate: rate, pcs: cartLines().reduce(function (s, l) { return s + l.qty; }, 0) };
    }
    function ensureModal(id, title, icon) {
        var m = $(id);
        if (m) return m;
        m = document.createElement('div');
        m.id = id; m.className = 'modal-standard';
        m.innerHTML = '<div class="modal-header"><h2><svg class="uic" aria-hidden="true"><use href="#' + icon + '"></use></svg>' + title + '</h2><button class="close-btn" aria-label="Yopish" onclick="closeModal()">\u00D7</button></div><div class="co-wrap co-page" id="' + id + '-body"></div>';
        document.body.appendChild(m);
        return m;
    }
    function btsData() { return window.BTS_BRANCHES || {}; }
    function selRow(label, icon, color, value, options, onchange, off) {
        return '<label class="co-row co-sel' + (off ? ' is-off' : '') + '"><span class="co-ic" style="--ic:' + color + '">' + icon + '</span><span class="co-t">' + label + '</span>' +
            '<span class="co-v' + (value ? ' gold' : '') + '">' + (value ? E(value) : 'Tanlang') + '</span>' + CHEV +
            '<select onchange="' + onchange + '"' + (off ? ' disabled' : '') + '><option value="">\u2014 Tanlang \u2014</option>' + options + '</select></label>';
    }

    window._coRender = function () {
        var body = $('checkoutModal-body'); if (!body) return;
        var method = window._dlvMethod === 'bts' ? 'bts' : 'courier';
        var A = addrs();
        if (method === 'courier' && (typeof window._dlvSelectedAddr !== 'number' || !A[window._dlvSelectedAddr])) window._dlvSelectedAddr = A.length ? 0 : null;
        if (method === 'bts' && st.pay === 'cash') st.pay = null;
        var M = money();
        var html = '<div class="co-sec">Yetkazish</div>' +
            '<div class="co-dlv" role="tablist">' +
                '<button type="button" role="tab" aria-selected="' + (method === 'courier') + '" class="co-dlv-o' + (method === 'courier' ? ' on' : '') + '" onclick="window._coSetMethod(\'courier\')">' +
                    '<span class="co-dlv-ic"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 7c0-1.1-.9-2-2-2h-3v2h3v2.65L13.52 14H10V9H6c-2.21 0-4 1.79-4 4v3h2c0 1.66 1.34 3 3 3s3-1.34 3-3h4.48L19 10.35V7zM7 17c-.55 0-1-.45-1-1h2c0 .55-.45 1-1 1z"/><path d="M5 6h5v2H5zm14 7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg></span>' +
                    '<span class="co-dlv-t">Kuryer<small>Samarqand shahri</small><em>1 kun</em></span><span class="co-dlv-r" aria-hidden="true"></span></button>' +
                '<button type="button" role="tab" aria-selected="' + (method === 'bts') + '" class="co-dlv-o' + (method === 'bts' ? ' on' : '') + '" onclick="window._coSetMethod(\'bts\')">' +
                    '<span class="co-dlv-ic"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 3H4c-1.1 0-2 .9-2 2v2.01c0 .72.43 1.34 1 1.69V19c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V5c0-1.1-.9-2-2-2zm-5 12H9v-2h6v2zm5-8H4V5h16v2z"/></svg></span>' +
                    '<span class="co-dlv-t">BTS pochta<small>Viloyat va tumanlar</small><em>2\u20134 kun</em></span><span class="co-dlv-r" aria-hidden="true"></span></button>' +
            '</div>' +
            '<div class="co-seg-hint">' + (method === 'courier' ? 'Kuryer manzilingizgacha olib keladi' : 'Tovarni BTS filialidan olasiz') + '</div>';
        if (method === 'courier') {
            var a = (typeof window._dlvSelectedAddr === 'number') ? A[window._dlvSelectedAddr] : null;
            var aSub = a ? (window._addrCoordOnly && window._addrCoordOnly(a.address) ? 'Xaritada belgilangan nuqta' : (a.address || '')) : 'Yetkazish manzilini tanlang';
            html += '<div class="co-grp">' +
                '<button type="button" class="co-row" onclick="window._coOpenSheet(\'addr\')"><span class="co-ic" style="--ic:#34c759">' + I.pin + '</span>' +
                    '<span class="co-t' + (a ? '' : ' is-warn') + '">' + (a ? E(a.label || (window._addrMeta ? window._addrMeta(a).name : 'Manzil')) : 'Manzil tanlanmagan') + '<small>' + E(aSub) + '</small></span>' + CHEV + '</button>' +
                '<button type="button" class="co-row" onclick="window._coToggleSmq()"><span class="co-ic" style="--ic:#ff9500">' + I.city + '</span><span class="co-t">Manzilim Samarqand shahri ichida<small>Kuryer faqat shahar ichida yetkazadi</small></span><span class="co-sw' + (st.smq ? ' on' : '') + '" role="switch" aria-checked="' + st.smq + '"></span></button>' +
            '</div>';
        } else {
            var D = btsData(), b = st.bts;
            var regs = Object.keys(D);
            var dists = b.region && D[b.region] ? Object.keys(D[b.region]) : [];
            var brs = (b.region && b.district && D[b.region] && D[b.region][b.district]) ? D[b.region][b.district] : [];
            var opt = function (arr, cur, valFn, txtFn) { return arr.map(function (x, i) { var v = valFn(x, i); return '<option value="' + E(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + E(txtFn(x)) + '</option>'; }).join(''); };
            var br = (b.branch !== '' && brs[parseInt(b.branch, 10)]) || null;
            html += '<div class="co-grp">' +
                selRow('Viloyat', I.map, '#0a84ff', b.region, opt(regs, b.region, function (x) { return x; }, function (x) { return x; }), "window._coBts('region', this.value)") +
                selRow('Tuman', I.city, '#5e5ce6', b.district, opt(dists, b.district, function (x) { return x; }, function (x) { return x; }), "window._coBts('district', this.value)", !b.region) +
                selRow('Filial', I.box, '#ff9500', br ? br.name : '', opt(brs, b.branch, function (x, i) { return i; }, function (x) { return x.name; }), "window._coBts('branch', this.value)", !b.district) +
                (br ? '<div class="co-info"><b>BTS ' + E(br.name) + '</b>' + E(br.address || '') + (br.landmark ? '<br>Mo\u2018ljal: ' + E(br.landmark) : '') + (br.hours ? '<br>' + E(br.hours) : '') + '</div>' : '') +
            '</div>' +
            '<p class="co-note">BTS orqali jo\u2018natishda to\u2018lov oldindan qilinadi \u2014 naqd pul mavjud emas.</p>';
        }
        if (st.pay && !PAY[st.pay]) st.pay = null;   // eski (olib tashlangan) usul tanlangan bo'lsa
        var P = st.pay ? PAY[st.pay] : null;
        html += '<div class="co-sec">To\u2018lov</div><div class="co-grp">' +
            '<button type="button" class="co-row" onclick="window._coOpenSheet(\'pay\')"><span class="co-ic" style="--ic:' + (P ? P.color : '#8e8e93') + '">' + (P ? P.ic : I.cash) + '</span>' +
                '<span class="co-t' + (P ? '' : ' is-warn') + '">' + (P ? P.name : 'To\u2018lov usulini tanlang') + '<small>' + (P ? P.sub : 'Payme' + (method === 'bts' ? '' : ' yoki naqd pul')) + '</small></span>' + CHEV + '</button>';
        var bal = cbBal();
        if (bal > 0) {
            html += '<button type="button" class="co-row" onclick="window._coToggleCb()"><span class="co-ic" style="--ic:#30d158">' + I.gift + '</span><span class="co-t">Cashback ishlatish<small>Balans: ' + fmt(bal) + " so'm</small></span><span class=\"co-sw" + (cbOn() ? ' on' : '') + '" role="switch" aria-checked="' + cbOn() + '"></span></button>';
        }
        html += '</div>';
        html += '<div class="co-sec">Hisob</div><div class="co-grp">' +
            '<div class="co-row no-ic"><span class="co-t">Mahsulotlar \u00B7 ' + M.pcs + ' dona</span><span class="co-v">' + fmt(M.gross) + " so'm</span></div>" +
            (M.use > 0 ? '<div class="co-row no-ic"><span class="co-t">Cashback</span><span class="co-v green">\u2212' + fmt(M.use) + " so'm</span></div>" : '') +
            '<div class="co-row no-ic"><span class="co-t">Yetkazish</span><span class="co-v">' + (method === 'courier' ? 'Kuryer' : 'BTS pochta') + '</span></div>' +
            (M.earn > 0 ? '<div class="co-row no-ic"><span class="co-t">Sizga qaytadi<small>' + (+(M.rate * 100).toFixed(2)) + '% cashback, yetkazilgach</small></span><span class="co-v gold">+' + fmt(M.earn) + " so'm</span></div>" : '') +
        '</div>' +
        '<div class="co-dock-sp"></div>' +
        '<div class="co-dock"><div class="co-sumline"><span>To\u2018lanadi</span><b>' + fmt(M.payable) + " so'm</b></div>" +
            '<button type="button" class="co-btn" onclick="window._coSubmit()">' + (st.pay === 'app' ? 'To\u2018lovga o\u2018tish' : 'Buyurtmani tasdiqlash') + '</button></div>';
        body.innerHTML = html;
    };

    window.openCheckout = function () {
        if (!cart || !Object.keys(cart).length) { toast("Savat bo'sh"); return; }
        var prof = (typeof myProfile !== 'undefined') ? myProfile : window.myProfile;
        if (!prof || !prof.phone) {
            toast('Avval telefon raqamingizni kiriting!');
            setTimeout(function () { try { closeModal(); showProfile(); setTimeout(function () { openModal('profileEditModal'); }, 300); } catch (e) {} }, 1500);
            return;
        }
        if (window._dlvMethod !== 'bts') window._dlvMethod = 'courier';
        ensureModal('checkoutModal', 'Rasmiylashtirish', 'i-truck');
        window._coRender();
        openModal('checkoutModal');
        var m = $('checkoutModal'); if (m) m.scrollTop = 0;
        hap('light');
    };
    // Eski kirish nuqtasi ham yangi sahifaga olib keladi
    window._legacyOpenDeliveryModal = window.openDeliveryModal;
    window.openDeliveryModal = window.openCheckout;

    window._coSetMethod = function (m) {
        window._dlvMethod = m === 'bts' ? 'bts' : 'courier';
        hap('selection'); window._coRender();
    };
    window._coToggleSmq = function () { st.smq = !st.smq; hap('selection'); window._coRender(); };
    window._coToggleCb = function () { if (window._cbSetOn) window._cbSetOn(!cbOn()); hap('selection'); window._coRender(); };
    window._coBts = function (k, v) {
        if (k === 'region') { st.bts = { region: v, district: '', branch: '' }; }
        else if (k === 'district') { st.bts.district = v; st.bts.branch = ''; }
        else st.bts.branch = v;
        hap('selection'); window._coRender();
    };

    /* ═══ 3) PASTDAN CHIQUVCHI OYNA ═══ */
    function sheetEl() {
        var el = $('coSheet');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'coSheet';
        el.innerHTML = '<div class="co-sheet" id="coSheet-panel"></div>';
        el.addEventListener('click', function (e) { if (e.target === el) window.history.back(); });
        document.body.appendChild(el);
        return el;
    }
    function sheetHTML(kind) {
        if (kind === 'pay') {
            var bts = window._dlvMethod === 'bts';
            return '<div class="co-grab"></div><div class="co-sh-t">To\u2018lov usuli<button type="button" onclick="history.back()">Tayyor</button></div><div class="co-grp">' +
                ['app', 'cash'].filter(function (k) { return !(bts && k === 'cash'); }).map(function (k) {
                    var P = PAY[k];
                    return '<button type="button" class="co-row" onclick="window._coPick(\'pay\',\'' + k + '\')"><span class="co-ic" style="--ic:' + P.color + '">' + P.ic + '</span><span class="co-t">' + P.name + '<small>' + P.sub + '</small></span>' + (st.pay === k ? '<span class="co-tick">\u2713</span>' : '') + '</button>';
                }).join('') + '</div>' +
                '<p class="co-note">' + (bts ? 'BTS orqali jo\u2018natishda faqat Payme orqali oldindan to\u2018lov.' : 'Payme tanlansa, to\u2018lov ma\u2019lumotlari keyingi qadamda ko\u2018rsatiladi.') + '</p>';
        }
        var A = addrs();
        return '<div class="co-grab"></div><div class="co-sh-t">Yetkazish manzili<button type="button" onclick="history.back()">Tayyor</button></div>' +
            (A.length ? '<div class="co-grp">' + A.map(function (a, i) {
                var meta = window._addrMeta ? window._addrMeta(a) : { icon: I.pin, name: 'Manzil', color: '#34c759' };
                var sub = window._addrCoordOnly && window._addrCoordOnly(a.address) ? 'Xaritada belgilangan nuqta' : (a.address || '');
                return '<button type="button" class="co-row" onclick="window._coPick(\'addr\',' + i + ')"><span class="co-ic" style="--ic:' + meta.color + '">' + meta.icon + '</span><span class="co-t">' + E(a.label || meta.name) + '<small>' + E(sub) + '</small></span>' + (window._dlvSelectedAddr === i ? '<span class="co-tick">\u2713</span>' : '') + '</button>';
            }).join('') + '</div>' : '<p class="co-note" style="margin:0 6px 12px">Saqlangan manzil yo\u2018q. Xaritadan belgilang yoki qo\u2018lda yozing.</p>') +
            '<div class="co-grp" style="margin-top:10px">' +
                '<button type="button" class="co-row" onclick="window.openMapPicker && openMapPicker()"><span class="co-ic" style="--ic:#5e5ce6">' + I.map + '</span><span class="co-t">Xaritadan belgilash</span>' + CHEV + '</button>' +
                '<button type="button" class="co-row" onclick="addNewAddress()"><span class="co-ic" style="--ic:#8e8e93">' + I.plus + '</span><span class="co-t">Qo\u2018lda qo\u2018shish</span>' + CHEV + '</button>' +
            '</div>';
    }
    var sheetKind = null;
    window._coOpenSheet = function (kind) {
        if (activeModal !== 'checkoutModal') return;
        sheetKind = kind;
        var el = sheetEl();
        $('coSheet-panel').innerHTML = sheetHTML(kind);
        try { if (window._modalCancelClose) window._modalCancelClose(el); } catch (e) {}
        el.style.display = 'flex';
        window._modalStack = window._modalStack || [];
        window._modalStack.push('checkoutModal');
        activeModal = 'coSheet';
        window.history.pushState({ modal: 'coSheet' }, '');
        try { tg.BackButton.show(); } catch (e) {}
        try { updateBtns(); } catch (e) {}
        hap('light');
    };
    window._coPick = function (kind, v) {
        if (kind === 'pay') st.pay = v; else window._dlvSelectedAddr = v;
        hap('selection');
        window._coRender();
        var panel = $('coSheet-panel'); if (panel) panel.innerHTML = sheetHTML(kind);
        setTimeout(function () { if (activeModal === 'coSheet') window.history.back(); }, 140);
    };
    // Sheet ichidan yangi manzil qo'shilsa — darhol tanlanadi va ro'yxat yangilanadi
    function afterAddrAdded() {
        var A = addrs(); if (A.length) window._dlvSelectedAddr = A.length - 1;
        setTimeout(function () {
            try { window._coRender(); } catch (e) {}
            try { if (sheetKind === 'addr' && $('coSheet-panel')) $('coSheet-panel').innerHTML = sheetHTML('addr'); } catch (e) {}
        }, 260);
    }
    ['saveNewAddress', 'saveMapAddressWithName'].forEach(function (fn) {
        var orig = window[fn];
        if (typeof orig !== 'function' || orig.__co) return;
        var w = function () { var before = addrs().length; var r = orig.apply(this, arguments); if (addrs().length > before && $('checkoutModal')) afterAddrAdded(); return r; };
        w.__co = true; window[fn] = w;
    });

    /* ═══ 4) TASDIQLASH ═══ */
    window._coSubmit = function () {
        var method = window._dlvMethod === 'bts' ? 'bts' : 'courier';
        if (method === 'courier') {
            var A = addrs(), a = (typeof window._dlvSelectedAddr === 'number') ? A[window._dlvSelectedAddr] : null;
            if (!a) { toast('Manzilni tanlang yoki xaritadan belgilang!'); window._coOpenSheet('addr'); return; }
            if (!st.smq) { toast('Kuryer faqat Samarqand shahri ichida. Tasdiqlang yoki BTS pochtani tanlang.'); return; }
            window.selectedDelivery = { method: 'courier', address: a.address, mapLink: a.mapLink || '', city: 'Samarqand' };
        } else {
            var b = st.bts, D = btsData();
            if (!b.region) { toast('Viloyatni tanlang!'); return; }
            if (!b.district) { toast('Tumanni tanlang!'); return; }
            var br = b.branch !== '' ? ((D[b.region] || {})[b.district] || [])[parseInt(b.branch, 10)] : null;
            if (!br) { toast('Filialni tanlang!'); return; }
            window.selectedDelivery = { method: 'bts', region: b.region, district: b.district, branch: br.name, branchAddress: br.address, branchLandmark: br.landmark, branchHours: br.hours };
        }
        if (!st.pay || !PAY[st.pay] || (method === 'bts' && st.pay === 'cash')) { st.pay = PAY[st.pay] ? st.pay : null; toast('To\u2018lov usulini tanlang'); window._coOpenSheet('pay'); return; }
        var M = money();
        hap('success');
        if (st.pay === 'cash') {
            var txt = 'Buyurtmani tasdiqlaysizmi?\n\nTovarlar: ' + fmt(M.gross) + " so'm" + (M.use > 0 ? '\nCashback: \u2212' + fmt(M.use) + " so'm" : '') +
                '\nTo\u2018lanadi: ' + fmt(M.payable) + " so'm" + (M.earn > 0 ? '\nSizga qaytadi: ' + fmt(M.earn) + " so'm cashback" : '') + "\nTo'lov: Naqd pul (yetkazilganda)";
            var ask = window._a1Confirm ? window._a1Confirm(txt) : Promise.resolve(window.confirm(txt));
            ask.then(function (ok) { if (ok) confirmOrder('Naqd pul (yetkazilganda)'); });
            return;
        }
        openPay(st.pay, M);
    };

    // 💳 Payme orqali to'lash: Payme ilovasida do'kon kartasiga o'tkazma (merchant
    //    integratsiyasi yo'q), so'ng «To'ladim». Karta va Click usullari olib tashlandi.
    function openPay(kind, M) {
        var title = 'Payme orqali to\u2018lash';
        ensureModal('coPayModal', title, 'i-shield');
        var head = $('coPayModal').querySelector('.modal-header h2');
        if (head) head.lastChild.textContent = title;
        var steps = ['Karta raqamini nusxalang (kartani bosing)', 'Payme ilovasini oching va kartaga ' + fmt(M.payable) + " so'm o'tkazing", 'Qaytib, \u00ABTo\u2018ladim\u00BB tugmasini bosing'];
        var html = '<div class="co-card" onclick="copyCard()" role="button" aria-label="Karta raqamini nusxalash"><div class="chip"></div><span class="co-copy">' + I.copy + 'Nusxalash</span>' +
                '<div class="num">' + CARD_NO + '</div><div class="ft"><span>AXTAMOV ANVARJON</span><i>UZCARD</i></div></div>' +
            '<div class="co-grp">' +
                '<div class="co-row no-ic"><span class="co-t">O\u2018tkazish kerak</span><span class="co-v strong" style="color:var(--co-gold)">' + fmt(M.payable) + " so'm</span></div>" +
                '<div class="co-row no-ic"><span class="co-t">Qabul qiluvchi</span><span class="co-v">Avto A1 do\u2018koni</span></div>' +
            '</div>' +
            '<div class="co-btns" style="margin-top:12px"><button type="button" class="co-btn ghost" onclick="openPayApp(\'payme\')">Payme\u2019ni ochish</button></div>' +
            '<div class="co-sec">Qanday to\u2018lash</div><div class="co-grp">' +
                steps.map(function (t, i) { return '<div class="co-row"><span class="co-num">' + (i + 1) + '</span><span class="co-t" style="font-size:14.5px">' + E(t) + '</span></div>'; }).join('') +
            '</div>' +
            '<p class="co-note">Admin to\u2018lovni tekshirgach buyurtma tasdiqlanadi. Payme chekini saqlab qo\u2018ying.</p>' +
            '<div class="co-dock-sp"></div>' +
            '<div class="co-dock"><button type="button" class="co-btn" onclick="confirmOrder(\'Payme\')">To\u2018ladim \u2014 buyurtmani yuborish</button></div>';
        $('coPayModal-body').innerHTML = html;
        openModal('coPayModal');
        var m = $('coPayModal'); if (m) m.scrollTop = 0;
    }
})();
