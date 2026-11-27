
(function motionPackage() {
    'use strict';

    // ───────────────────────────────────────────────────────────
    // D) YAGONA "HARAKAT RUXSATMI?" MANBASI
    //    Ilgari bu tekshiruv kodda 8 joyda qayta-qayta yozilgan edi
    //    (har biri bir oz boshqacha) — natijada bir joyda hisobga
    //    olinardi, boshqa joyda unutilardi.
    // ───────────────────────────────────────────────────────────
    var Motion = {
        /** Foydalanuvchi tizim sozlamasida harakatni kamaytirgan (a11y). */
        reduced: function () {
            try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
            catch (e) { return false; }
        },
        /** Qurilma zaif (yoki FPS tushib ketgan) — bezaklar cheklanadi. */
        lite: function () {
            try {
                return document.documentElement.classList.contains('lite') || !!window.__perfLite;
            } catch (e) { return false; }
        },
        /** Ikkisidan biri — "kamroq harakat" rejimi. */
        weak: function () { return Motion.reduced() || Motion.lite(); },
        /** Vaqtni qaytaradi; a11y rejimida 0 (ya'ni darhol). */
        dur: function (ms) { return Motion.reduced() ? 0 : (parseInt(ms, 10) || 0); }
    };
    window.Motion = Motion;

    // ───────────────────────────────────────────────────────────
    // A1) MODAL YOPILISH ANIMATSIYASI
    //     Modallar `class` bilan emas, INLINE `display` bilan
    //     boshqariladi — shuning uchun sof CSS bilan chiqish
    //     animatsiyasi qilib bo'lmaydi. Yagona yashirish nuqtasi
    //     `popstate` handleridagi bir qator; u shu funksiyani
    //     chaqiradi (topilmasa — eski xatti-harakat).
    // ───────────────────────────────────────────────────────────
    function cancelClose(el) {
        if (!el) return;
        if (el.__moCloseT) { clearTimeout(el.__moCloseT); el.__moCloseT = null; }
        if (el.classList) el.classList.remove('m-closing');
    }
    window._modalCancelClose = cancelClose;

    window._modalHide = function (el) {
        if (!el) return;
        cancelClose(el);
        // a11y: harakat kerak bo'lmasa — darhol yashiramiz
        if (Motion.reduced()) { el.style.display = 'none'; return; }
        var ms = Motion.lite() ? 130 : 210;
        el.classList.add('m-closing');
        el.__moCloseT = setTimeout(function () {
            el.classList.remove('m-closing');
            el.style.display = 'none';
            el.__moCloseT = null;
        }, ms);
    };

    // ───────────────────────────────────────────────────────────
    // A2) openModal ustiga o'ram:
    //     1) yopilish o'rtasida QAYTA ochilsa — oyna "yarim
    //        g'oyib" holatda qotib qolmasin;
    //     2) savat oynasi ochilganda jami summa 0 dan sanaladi.
    // ───────────────────────────────────────────────────────────
    if (typeof window.openModal === 'function' && !window._origOpenModal_mo) {
        window._origOpenModal_mo = window.openModal;
        window.openModal = function (id) {
            var el = null;
            try { el = document.getElementById(id); } catch (e) {}
            cancelClose(el);
            var r = window._origOpenModal_mo.apply(this, arguments);
            cancelClose(el);   // `display:flex` dan keyin ham toza bo'lsin
            if (id === 'cartModal') countUpCartTotal();
            return r;
        };
    }

    /** Savat jami summasi 0 dan haqiqiy qiymatga sanab chiqadi. */
    function countUpCartTotal() {
        if (Motion.reduced()) return;
        setTimeout(function () {
            try {
                var el = document.getElementById('cart-total-sum');
                if (!el) return;
                var target = parseInt(String(el.innerText).replace(/[^0-9]/g, ''), 10) || 0;
                if (target <= 0) return;
                el.innerText = "0 so'm";
                if (typeof window.animatePrice === 'function') window.animatePrice('cart-total-sum', target);
                else el.innerText = target.toLocaleString() + " so'm";
            } catch (e) {}
        }, 40);
    }

    // ───────────────────────────────────────────────────────────
    // A3) Tovar oynasidagi narx ham sanab chiqadi.
    //     Kichik detal, lekin narxni "jonli" qiladi va mijozning
    //     e'tiborini aynan kerakli joyga qaratadi.
    // ───────────────────────────────────────────────────────────
    if (typeof window.openProduct === 'function' && !window._origOpenProduct_mo) {
        window._origOpenProduct_mo = window.openProduct;
        window.openProduct = function () {
            var r = window._origOpenProduct_mo.apply(this, arguments);
            if (!Motion.reduced()) {
                setTimeout(function () {
                    try {
                        var el = document.getElementById('pm-price');
                        if (!el) return;
                        var target = parseInt(String(el.innerText).replace(/[^0-9]/g, ''), 10) || 0;
                        if (target <= 0) return;
                        el.innerText = "0 so'm";
                        if (typeof window.animatePrice === 'function') window.animatePrice('pm-price', target);
                        else el.innerText = target.toLocaleString() + " so'm";
                    } catch (e) {}
                }, 60);
            }
            return r;
        };
    }

    // ───────────────────────────────────────────────────────────
    // B5) SAVATGA UCHISH — `transform` versiyasi
    //     Eski funksiya `left/top/width/height` ni animatsiya
    //     qilardi (har kadrda layout). Yangisi bitta `transform`
    //     ishlatadi va `transitionend` bilan tugaydi (taymer
    //     faqat xavfsizlik chegarasi).
    // ───────────────────────────────────────────────────────────
    window.flyToCartAnimation = function (e, imgSrc) {
        try {
            if (Motion.reduced()) return;
            var cx = (e && e.clientX) || (e && e.touches && e.touches.length ? e.touches[0].clientX : null);
            var cy = (e && e.clientY) || (e && e.touches && e.touches.length ? e.touches[0].clientY : null);
            if (!cx || !cy) return;
            var cartNav = document.getElementById('nav-cart');
            if (!cartNav) return;

            var img = document.createElement('img');
            img.src = imgSrc || (window._brandPlaceholder ? window._brandPlaceholder('A1') : '');
            img.className = 'flying-img mo-fly';
            img.style.left = (cx - 30) + 'px';
            img.style.top = (cy - 30) + 'px';
            img.style.width = '60px';
            img.style.height = '60px';
            document.body.appendChild(img);

            var r = cartNav.getBoundingClientRect();
            var dx = (r.left + r.width / 2) - cx;
            var dy = (r.top + r.height / 2) - cy;

            var done = false;
            function finish() {
                if (done) return;
                done = true;
                try { img.remove(); } catch (_) {}
                cartNav.classList.add('cart-bounce');
                try {
                    if (typeof tg !== 'undefined' && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
                } catch (_) {}
                setTimeout(function () { cartNav.classList.remove('cart-bounce'); }, 400);
            }

            // Ikki marta rAF: brauzer boshlang'ich holatni CHIZIB olsin,
            // shundan keyingina transform o'zgarsin (aks holda sakrab o'tadi).
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    img.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(0.22) rotate(300deg)';
                    img.style.opacity = '0.25';
                });
            });
            img.addEventListener('transitionend', finish, { once: true });
            setTimeout(finish, 900);   // xavfsizlik: transitionend kelmasa ham tozalanadi
        } catch (err) {
            if (window._dwarn) window._dwarn('[motion] fly xato:', err);
        }
    };

    if (window._dlog) window._dlog('%c[Qatlam 2026.17] Harakat paketi: yopilish + jank tuzatildi', 'color:#C9A84C;font-weight:bold;');
})();
