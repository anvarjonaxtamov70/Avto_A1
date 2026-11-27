
/* 👤 PROFIL (iOS) — ko'prik: mavjud modullar (VIP, Phase2, buyurtmalar, mashina)
   o'z ishini qilaveradi; bu yerda faqat ularning natijasi yangi qatorlarga ulanadi. */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var E = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var fmt = function (n) { return (Math.round(Number(n) || 0)).toLocaleString('ru-RU').replace(/,/g, ' '); };
    var GEM = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l4 6-10 12L2 9l4-6z"/></svg>';
    var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

    /* 1) Phase2 tugmalarini «Ilova» guruhiga ko'chirish (har qayta chizilganda) */
    function moveTiles() {
        var hub = $('p2-hub'), app = $('pfx-app');
        if (!hub || !app) return;
        var grid = hub.querySelector('.p2-grid');
        if (!grid) return;
        app.innerHTML = '';
        app.appendChild(grid);
        // "Yordam"dagi «Kafolat va yetkazib berish» bilan adashmasin
        var w = grid.querySelector('.p2-tile[onclick^="Phase2.openWarranty"] .p2-tile-lbl');
        if (w) w.textContent = 'Tovarlar kafolati';
    }
    function watchHub() {
        var hub = $('p2-hub');
        if (!hub) return false;
        // Hub «Imtiyozlar» guruhi ichida bo'lishi kerak (Phase2 uni #pf-stats-box dan keyin qo'yadi)
        var perks = $('pfx-perks');
        if (perks && hub.parentNode !== perks) perks.appendChild(hub);
        moveTiles();
        if (!hub.__pfxObs && window.MutationObserver) {
            hub.__pfxObs = new MutationObserver(function () { moveTiles(); });
            hub.__pfxObs.observe(hub, { childList: true });
        }
        return true;
    }

    /* 2) Daraja: ism ostidagi belgi + «Mijoz darajasi» qatori */
    function paintTier() {
        var V = window.VIP, st = V && V.state;
        var pill = $('pfx-tier-pill'), val = $('pfx-tier-val');
        if (!st || !st.tier) { if (pill) pill.hidden = true; return; }
        var t = st.tier;
        if (pill) {
            pill.hidden = false;
            pill.classList.toggle('is-plain', !st.isVip);
            pill.innerHTML = (st.isVip ? GEM : '') + E(t.name);
        }
        if (val) val.textContent = st.isVip ? 'VIP' : 'Oddiy';
    }

    /* 3) Mashina qiymati — rangini qator uslubiga moslash */
    function paintCar() {
        var el = $('pf-my-car-info');
        if (!el) return;
        var t = (el.textContent || '').trim();
        var unset = !t || /^Belgilanmagan/.test(t);
        el.classList.toggle('is-set', !unset);
        if (unset && t !== 'Tanlang') el.textContent = 'Tanlang';
    }

    /* 4) Buyurtmalar soni */
    function paintOrders() {
        var el = $('pfx-orders-count');
        if (!el) return;
        var arr = Array.isArray(window.myOrders) ? window.myOrders.filter(Boolean) : [];
        el.textContent = arr.length ? String(arr.length) : '';
    }

    function paintAll() { try { watchHub(); } catch (e) {} try { paintTier(); } catch (e) {} try { paintCar(); } catch (e) {} try { paintOrders(); } catch (e) {} }

    /* Ulanish: VIP.render, renderMyCar, showProfile, renderMyOrders dan keyin */
    function wrap(obj, name, after) {
        if (!obj || typeof obj[name] !== 'function' || obj[name].__pfx) return;
        var orig = obj[name];
        var w = function () { var r = orig.apply(this, arguments); try { after(); } catch (e) {} return r; };
        w.__pfx = true; obj[name] = w;
    }
    function hookAll() {
        if (window.VIP) wrap(window.VIP, 'render', paintTier);
        wrap(window, 'renderMyCar', paintCar);
        wrap(window, 'showProfile', function () { setTimeout(paintAll, 80); });
        if (window.Phase2) wrap(window.Phase2, 'renderProfile', function () { setTimeout(watchHub, 0); });
    }
    hookAll();
    // Kech yuklanadigan modullar uchun bir necha marta urinib ko'ramiz
    var tries = 0, iv = setInterval(function () { hookAll(); paintAll(); if (++tries > 10) clearInterval(iv); }, 600);
    if (document.readyState !== 'loading') paintAll(); else document.addEventListener('DOMContentLoaded', paintAll);

    /* 5) Daraja oynasi */
    window._pfxOpenTier = function () {
        var V = window.VIP;
        if (V && !V.state && V.refresh) { try { V.refresh(window.myOrders || []); } catch (e) {} }
        var st = V && V.state;
        if (!st) { if (typeof showToast === 'function') showToast("Daraja ma'lumoti yuklanmoqda…", 'warning'); return; }
        var m = $('pfxTierModal');
        if (!m) {
            m = document.createElement('div');
            m.id = 'pfxTierModal';
            m.className = 'modal-standard';
            m.innerHTML = '<div class="modal-header"><h2><svg class="uic" aria-hidden="true"><use href="#i-award"></use></svg>Mijoz darajasi</h2><button class="close-btn" aria-label="Yopish" onclick="closeModal()">\u00D7</button></div><div id="pfx-tier-body"></div>';
            document.body.appendChild(m);
        }
        var t = st.tier, n = st.next, tiers = (V.TIERS || []);
        var rate = V.ratePct ? V.ratePct(t) : '';
        var nextTx = n ? ('<b>' + E(n.name) + '</b> darajasiga yana ' + fmt(st.needSom) + " so'm") : 'Eng yuqori darajadasiz. Ishonchingiz uchun rahmat!';
        var body = '<div class="pft">' +
            '<section class="pft-hero" id="pft-hero">' +
                '<div class="pft-k">Avto A1 \u00B7 mijoz darajasi</div>' +
                '<div class="pft-name">' + E(t.name) + '</div>' +
                '<div class="pft-spent">Xaridlaringiz: ' + fmt(st.spent) + " so'm \u00B7 " + (st.count || 0) + ' ta yetkazilgan</div>' +
                (n ? '<div class="pft-bar"><i id="pft-bar"></i></div>' : '') +
                '<div class="pft-next">' + nextTx + '</div>' +
            '</section>' +
            '<div class="pft-sec">Imtiyozlaringiz</div><div class="pft-grp">' +
                '<div class="pft-r"><span class="pfx-ic" style="--ic:#30d158">' + '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1a3 3 0 0 0-5.5-1.65l-.5.67-.5-.68A3 3 0 0 0 6 5c0 .35.07.69.18 1H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-5-2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM9 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 12 7.4 15.38 12 17 10.83 14.92 8H20v6z"/></svg>' + '</span><span class="t">Cashback<small>Har xariddan hisobingizga qaytadi</small></span><span class="v">' + E(rate) + '%</span></div>' +
                '<div class="pft-r"><span class="pfx-ic" style="--ic:#0a84ff">' + '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2a3 3 0 0 0 6 0h6a3 3 0 0 0 6 0h2v-5l-3-4zM6 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm13.5-9 1.96 2.5H17V9.5h2.5zM18 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>' + '</span><span class="t">Bepul yetkazish<small>Shahar bo\u2018ylab, shu summadan</small></span><span class="v">' + fmt(t.freeDelivery) + " so'm</span></div>" +
            '</div>' +
            '<div class="pft-sec">Barcha darajalar</div><div class="pft-grp">' +
            tiers.map(function (x, i) {
                var now = i === st.tierIdx, done = i < st.tierIdx;
                return '<div class="pft-r' + (now ? ' is-now' : '') + '"><span class="pfx-ic" style="--ic:' + (i ? 'linear-gradient(135deg,#f0d060,#a8851f)' : '#8e8e93') + '">' + GEM + '</span>' +
                    '<span class="t">' + E(x.name) + '<small>' + (x.minSpent ? fmt(x.minSpent) + " so'mdan" : 'Boshlang\u2018ich') + ' \u00B7 ' + E(V.ratePct ? V.ratePct(x) : '') + '% cashback</small></span>' +
                    (now ? '<span class="v">Siz</span>' : (done ? '<span class="pft-tick">' + TICK + '</span>' : '')) + '</div>';
            }).join('') +
            '</div>' +
            '<p class="pft-note">Daraja faqat yetkazib berilgan buyurtmalar summasi bo\u2018yicha hisoblanadi.</p>' +
        '</div>';
        $('pfx-tier-body').innerHTML = body;
        try { if (V.paintTier) V.paintTier($('pft-hero'), t); } catch (e) {}
        if (typeof openModal === 'function') openModal('pfxTierModal');
        var bar = $('pft-bar');
        if (bar) requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = Math.max(0, Math.min(100, st.progress || 0)) + '%'; }); });
        try { if (window._hap) window._hap('light'); } catch (e) {}
    };
})();
