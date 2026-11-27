
// =====================================================================
// #24 — YUKLANISH SKELETONI (shimmer) yordamchisi
//   window._skel(n, h) -> n ta skeleton qator (balandligi h px) qaytaradi.
// =====================================================================
window._skel = function (n, h) {
    n = n || 4; h = h || 64;
    var out = '';
    for (var i = 0; i < n; i++) out += '<div class="skeleton" style="height:' + h + 'px; margin:0 0 10px;"></div>';
    return out;
};

// =====================================================================
// #23 — KLAVIATURA BILAN ISHLATISH (accessibility)
//   1) [role="button"] elementlar Enter/Bo'shliq bilan bosiladi.
//   2) Pastki navigatsiya (.nav-item) — fokuslanadigan va o'qiladigan bo'ladi.
// =====================================================================
(function a11yInit() {
    try {
        document.addEventListener('keydown', function (e) {
            if ((e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) {
                var el = e.target;
                if (el && el.getAttribute && el.getAttribute('role') === 'button') {
                    e.preventDefault();
                    el.click();
                }
            }
        });
        var setup = function () {
            document.querySelectorAll('.nav-item').forEach(function (el) {
                el.setAttribute('role', 'button');
                if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
                if (!el.hasAttribute('aria-label')) {
                    var lbl = el.querySelector('span');
                    if (lbl) el.setAttribute('aria-label', lbl.textContent.trim());
                }
            });
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
        else setup();
    } catch (e) {}
})();
