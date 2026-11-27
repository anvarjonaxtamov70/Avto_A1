
/* 🎛 KARTA DIZAYNI — bitta sozlama, hamma uchun.
   Manba: Firebase `settings/ui/cardStyle` (o'qish — hamma, yozish — faqat admin).
   Birinchi chizishda miltillamasligi uchun oxirgi qiymat localStorage'da saqlanadi. */
(function () {
    'use strict';
    var KEY = 'avto_card_style';
    var STYLES = {
        market:   { name: 'Bozor kartasi', sub: 'Narx birinchi, to\u2018liq \u00ABSavatga\u00BB tugmasi' },
        appstore: { name: 'App Store kartasi', sub: 'Narx pastda, yumaloq \u00AB+\u00BB tugma' },
        classic:  { name: 'Klassik karta', sub: 'Avvalgi dizayn: narx tilla tugma ichida' }
    };
    var valid = function (v) { return Object.prototype.hasOwnProperty.call(STYLES, v); };
    try { var c = localStorage.getItem(KEY); if (valid(c)) window.__cardStyle = c; } catch (e) {}
    if (!valid(window.__cardStyle)) window.__cardStyle = 'market';

    function rerender() {
        try { if (typeof window.renderProducts === 'function') window.renderProducts(); } catch (e) {}
        try {
            var ws = document.getElementById('wishlist-section');
            if (ws && !ws.classList.contains('hidden') && typeof renderWishlist === 'function') renderWishlist();
        } catch (e) {}
        try { if (typeof initReveal === 'function') setTimeout(initReveal, 60); } catch (e) {}
        paintAdmin();
    }
    function apply(v, silent) {
        if (!valid(v) || v === window.__cardStyle) { paintAdmin(); return; }
        window.__cardStyle = v;
        try { localStorage.setItem(KEY, v); } catch (e) {}
        if (!silent) rerender();
    }

    // Jonli tinglash — admin o'zgartirsa, ochiq turgan har bir telefonda darhol yangilanadi
    var tries = 0;
    (function listen() {
        var d = (typeof db !== 'undefined') ? db : (window.firebase && firebase.database ? firebase.database() : null);
        if (!d || !d.ref) { if (++tries < 40) setTimeout(listen, 250); return; }
        try {
            d.ref('settings/ui/cardStyle').on('value', function (snap) {
                var v = snap && snap.val();
                if (valid(v)) apply(v);
            }, function () {});
        } catch (e) {}
    })();

    function paintAdmin() {
        var sub = document.getElementById('cs-admin-sub');
        if (sub) sub.textContent = 'Hozir: ' + STYLES[window.__cardStyle].name;
    }

    var GLYPH = {
        market:   '<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="5" y="3" width="18" height="22" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="8" y="6" width="12" height="9" rx="2" fill="currentColor" opacity=".35"/><rect x="8" y="18" width="12" height="4" rx="2" fill="currentColor"/></svg>',
        appstore: '<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="5" y="3" width="18" height="22" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="8" y="6" width="12" height="9" rx="2" fill="currentColor" opacity=".35"/><rect x="8" y="18" width="7" height="2.2" rx="1.1" fill="currentColor"/><circle cx="18.5" cy="20" r="2.4" fill="currentColor"/></svg>',
        classic:  '<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="5" y="3" width="18" height="22" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="8" y="6" width="12" height="9" rx="2" fill="currentColor" opacity=".35"/><rect x="8" y="17.5" width="12" height="2" rx="1" fill="currentColor" opacity=".6"/><rect x="8" y="20.8" width="8" height="2" rx="1" fill="currentColor"/></svg>'
    };

    function render() {
        var body = document.getElementById('cardStyleModal-body'); if (!body) return;
        body.innerHTML = '<p class="cs-lead">Tanlangan dizayn <b>barcha foydalanuvchilarda</b> darhol ko\u2018rinadi.</p>' +
            '<div class="cs-grp">' + ['market', 'appstore', 'classic'].map(function (k) {
                var S = STYLES[k], on = window.__cardStyle === k;
                return '<button type="button" class="cs-row' + (on ? ' on' : '') + '" onclick="CardStyle.set(\'' + k + '\')" aria-pressed="' + on + '">' +
                    '<span class="cs-gl">' + GLYPH[k] + '</span>' +
                    '<span class="cs-name">' + S.name + '<small>' + S.sub + '</small></span>' +
                    '<span class="cs-ok" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
                '</button>';
            }).join('') + '</div>' +
            '<p class="cs-note">Faqat ko\u2018rinish o\u2018zgaradi: narx, savat va buyurtmalar o\u2018zgarmaydi.</p>';
    }

    window.CardStyle = {
        get: function () { return window.__cardStyle; },
        openAdmin: function () {
            if (typeof window.isAdmin === 'function' && !window.isAdmin()) { try { showToast('Faqat admin uchun', 'warning'); } catch (e) {} return; }
            var m = document.getElementById('cardStyleModal');
            if (!m) {
                m = document.createElement('div');
                m.id = 'cardStyleModal'; m.className = 'modal-standard';
                m.innerHTML = '<div class="modal-header"><h2><svg class="uic" aria-hidden="true"><use href="#i-list"></use></svg>Karta dizayni</h2><button class="close-btn" aria-label="Yopish" onclick="closeModal()">\u00D7</button></div><div id="cardStyleModal-body"></div>';
                document.body.appendChild(m);
            }
            render();
            openModal('cardStyleModal');
        },
        set: function (v) {
            if (!valid(v)) return;
            if (v === window.__cardStyle) { try { showToast('Bu dizayn allaqachon tanlangan'); } catch (e) {} return; }
            var prev = window.__cardStyle;
            var d = (typeof db !== 'undefined') ? db : null;
            var go = function () {
                if (!d) { try { showToast('Baza ulanmagan', 'warning'); } catch (e) {} return; }
                d.ref('settings/ui/cardStyle').set(v).then(function () {
                    apply(v); render();
                    try { if (window._hap) window._hap('success'); } catch (e) {}
                    try { showToast('\u2705 \u00AB' + STYLES[v].name + '\u00BB hamma uchun yoqildi'); } catch (e) {}
                }).catch(function (err) {
                    window.__cardStyle = prev; render();
                    try { showToast('Saqlanmadi: ' + ((err && err.code) || 'ruxsat yo\u2018q'), 'warning'); } catch (e) {}
                });
            };
            if (window._ensureAuth) window._ensureAuth().then(go, go); else go();
        }
    };
    setTimeout(paintAdmin, 800);
})();
