
(function stockServerGuard() {
    'use strict';

    function proxyBase() {
        var u = window.TG_PROXY || '';
        try { if (!u && typeof TG_PROXY !== 'undefined') u = TG_PROXY; } catch (e) {}
        return String(u).replace(/\/+$/, '');
    }

    function initData() {
        try { if (typeof tg !== 'undefined' && tg && tg.initData) return tg.initData; } catch (e) {}
        return '';
    }

    /** stockChanges -> serverga yuboriladigan minimal ro'yxat */
    function toItems(changes) {
        if (!Array.isArray(changes)) return [];
        return changes.map(function (ch) {
            return {
                id: (ch && ch.id != null) ? ch.id : null,
                name: (ch && ch.name) ? String(ch.name) : '',
                size: (ch && ch.size != null) ? String(ch.size) : '',
                qty: parseInt(ch && ch.qty, 10) || 0
            };
        }).filter(function (it) { return it.id != null && it.qty > 0; });
    }

    /**
     * Zaxirani serverda band qiladi (yoki qaytaradi).
     * @param {Array} changes  stockChanges ro'yxati
     * @param {string} [op]    'commit' (default) yoki 'release'
     * @returns {Promise<Object>}
     *   { mode:'server' }                          — server bajardi
     *   { mode:'fallback' }                        — server yo'q/xato: mijoz yo'liga o'tiladi
     *   { mode:'skip' }                            — kamaytirish kerak emas
     *   { shortage:true, shortages:[...] }         — omborda yetarli emas, buyurtma RAD etiladi
     */
    window._stockCommit = function (changes, op) {
        var items = toItems(changes);
        if (!items.length) return Promise.resolve({ mode: 'skip' });

        var base = proxyBase();
        var id = initData();
        // initData yo'q (brauzer/APK) yoki manzil yo'q -> serverga bora olmaymiz.
        if (!base || !id) return Promise.resolve({ mode: 'fallback' });

        // Tarmoq osilib qolmasin: 8 soniyadan keyin mijoz yo'liga o'tamiz.
        var timer = null;
        var guard = new Promise(function (resolve) {
            timer = setTimeout(function () { resolve({ mode: 'fallback', timeout: true }); }, 8000);
        });

        var call = fetch(base + '/stock-commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: id, op: (op === 'release' ? 'release' : 'commit'), items: items })
        }).then(function (r) {
            return r.json().then(function (d) { return { status: r.status, data: d }; })
                            .catch(function () { return { status: r.status, data: null }; });
        }).then(function (out) {
            var d = out.data;
            // Worker'ning ESKI versiyasi bu manzilni bilmaydi va sendMessage
            // proxy sifatida javob beradi -> `stockCommit` belgisi bo'lmaydi.
            if (!d || d.stockCommit !== true) return { mode: 'fallback', legacy: true };
            if (d.ok === true) return { mode: 'server' };
            if (d.error === 'stock' && Array.isArray(d.shortages) && d.shortages.length) {
                return { shortage: true, shortages: d.shortages };
            }
            // Serverning boshqa xatosi (token, baza) — savdo to'xtamasin.
            if (window._dwarn) window._dwarn('[stock] server xatosi, mijoz yo\'liga o\'tildi:', d.error);
            return { mode: 'fallback', serverError: d.error || ('http ' + out.status) };
        }).catch(function (e) {
            if (window._dwarn) window._dwarn('[stock] /stock-commit ishlamadi:', e);
            return { mode: 'fallback' };
        });

        return Promise.race([call, guard]).then(function (r) {
            if (timer) clearTimeout(timer);
            return r;
        });
    };

    /**
     * Buyurtma RAD etilganda mahalliy `productsDB` stokini tiklaydi.
     * (Buyurtma yaratish tsikli stokni ekranda darhol kamaytirib qo'yadi —
     *  rad etilganda mijoz noto'g'ri sonni ko'rib qolmasligi kerak.)
     */
    window._revertLocalStock = function (changes) {
        if (!Array.isArray(changes) || !changes.length) return false;
        var list = window.productsDB;
        if (!Array.isArray(list)) return false;
        var changed = false;
        changes.forEach(function (ch) {
            if (!ch || ch.fallback == null) return;
            var p = null;
            for (var i = 0; i < list.length; i++) {
                if (list[i] && String(list[i].id) === String(ch.id)) { p = list[i]; break; }
            }
            if (!p) return;
            var orig = parseInt(ch.fallback, 10) || 0;
            var wantSize = (ch.size != null) ? String(ch.size) : '';
            if (wantSize && wantSize !== 'Universal' && Array.isArray(p.sizes)) {
                for (var j = 0; j < p.sizes.length; j++) {
                    if (p.sizes[j] && String(p.sizes[j].size) === wantSize) {
                        p.sizes[j].stock = orig; changed = true; break;
                    }
                }
                p.stock = p.sizes.reduce(function (acc, s) { return acc + (parseInt(s && s.stock, 10) || 0); }, 0);
            } else {
                p.stock = orig; changed = true;
            }
        });
        if (changed) {
            try { if (typeof renderProducts === 'function') renderProducts(); } catch (e) {}
            try { if (typeof renderCartItems === 'function') renderCartItems(); } catch (e) {}
        }
        return changed;
    };

    if (window._dlog) window._dlog('%c[Qatlam 2026.16] Ombor zaxirasi serverda band qilinadi', 'color:#C9A84C;font-weight:bold;');
})();
