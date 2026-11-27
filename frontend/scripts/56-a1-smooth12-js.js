
/* ═══ SILLIQLIK-12 (JS) ═══ */
(function () {
    'use strict';
    // A) Narx "0 so'm" dan sanab chiqmaydi: mijoz bir lahza noto'g'ri narxni
    //    (masalan 96 846 so'm) ko'rib qolardi — ishonchsizlik. Endi darhol aniq narx.
    //    Savatdagi miqdor o'zgarganda (eski summadan yangisiga) animatsiya qoladi.
    function wrapPrice() {
        var o = window.animatePrice;
        if (typeof o !== 'function' || o.__a1p) return;
        var w = function (id, end) {
            try {
                if (id === 'pm-price' || id === 'cart-total-sum') {
                    var el = document.getElementById(id);
                    var cur = el ? (parseInt(String(el.innerText).replace(/[^0-9]/g, ''), 10) || 0) : 1;
                    if (el && cur === 0) {
                        var v = Math.round(Number(end) || 0);
                        if (id === 'cart-total-sum' && typeof window._cartTotal === 'number') v = Math.round(window._cartTotal);
                        el.innerText = String(v);   // boshlanish = oxiri → darhol yakuniy ko'rinish
                    }
                }
            } catch (e) {}
            return o.apply(this, arguments);
        };
        w.__a1p = true;
        window.animatePrice = w;
    }

    // B) Tovar oynasi rasmi: karta rasmidan vaqtinchalik ko'rinish
    function heroPlaceholder(id) {
        var tries = 0;
        (function tick() {
            var sl = document.getElementById('pm-slider-wrapper');
            var slide = sl && sl.querySelector('.a7-slide');
            var big = slide && slide.querySelector('img:not(.a1-ph)');
            if (!big) { if (++tries < 12) setTimeout(tick, 25); return; }
            if (slide.__a1ph === big) return;
            slide.__a1ph = big;
            slide.querySelectorAll('img.a1-ph').forEach(function (x) { x.remove(); });
            big.classList.remove('a1-ph-main', 'a1-in');
            if (big.complete && big.naturalWidth > 0) return;           // allaqachon tayyor
            var card = document.querySelector('.luxury-card[data-pid="' + String(id).replace(/"/g, '') + '"] img');
            if (!card || !card.complete || !card.naturalWidth) return;
            var src = card.currentSrc || card.src;
            var ph = document.createElement('img');
            ph.className = 'a1-ph'; ph.alt = ''; ph.setAttribute('aria-hidden', 'true'); ph.src = src;
            slide.insertBefore(ph, big);
            var blur = slide.querySelector('.a7-blur');
            if (blur && !blur.__a1ph) { blur.__a1ph = 1; blur.style.backgroundImage = blur.style.backgroundImage + ', url("' + src.replace(/"/g, '%22') + '")'; }
            big.classList.add('a1-ph-main');
            var done = function () {
                big.classList.add('a1-in');
                setTimeout(function () { if (ph.parentNode) ph.remove(); big.classList.remove('a1-ph-main', 'a1-in'); }, 320);
            };
            big.addEventListener('load', done, { once: true });
            big.addEventListener('error', function () { big.classList.remove('a1-ph-main'); }, { once: true });
        })();
    }
    function wrapOpen() {
        var o = window.openProduct;
        if (typeof o !== 'function' || o.__a1h) return;
        var w = function (id) {
            var r = o.apply(this, arguments);
            try { heroPlaceholder(id); } catch (e) {}
            return r;
        };
        w.__a1h = true;
        window.openProduct = w;
    }

    // C) Tepadagi scroll-edge
    function edge() {
        if (document.getElementById('a1-top-edge') || !document.body) return;
        var e = document.createElement('div'); e.id = 'a1-top-edge'; e.setAttribute('aria-hidden', 'true');
        document.body.appendChild(e);
        var raf = 0;
        document.addEventListener('scroll', function (ev) {
            if (raf) return;
            raf = requestAnimationFrame(function () {
                raf = 0;
                var t = ev.target, y = 0;
                if (t === document || t === document.documentElement || t === document.body) y = window.scrollY || 0;
                else if (t && t.classList && t.classList.contains('container')) y = t.scrollTop;
                else return;   // modal/ichki ro'yxatlar skrolli hisobga olinmaydi
                document.body.classList.toggle('a1-scrolled', y > 24);
            });
        }, { passive: true, capture: true });
    }

    function all() { wrapPrice(); wrapOpen(); edge(); }
    all();
    document.addEventListener('DOMContentLoaded', all);
    window.addEventListener('a1-ready', all);
})();
