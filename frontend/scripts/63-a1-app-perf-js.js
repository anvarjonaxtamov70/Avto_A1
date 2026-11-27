
/* 📱 Ilova rejimi — silliqlik (JS qismi) */
(function () {
    'use strict';
    var root = document.documentElement;
    if (!root.classList.contains('a1-app')) return;

    // Shisha effektlari saqlanadi; CSSOM o'zgartirilmaydi.

    /* 2) Rasmlar asosiy oqimni to'xtatmasdan (fon oqimida) dekodlansin */
    function fixImg(img) { try { if (img.decoding !== 'async') img.decoding = 'async'; } catch (e) {} }

    function scan(node) {
        if (!node || node.nodeType !== 1) return;
        if (node.tagName === 'IMG') fixImg(node);

        if (node.querySelectorAll) {
            var im = node.querySelectorAll('img'); for (var i = 0; i < im.length; i++) fixImg(im[i]);
        }
    }
    /* 3) Bezak uchun cheksiz animatsiyalar (kartadagi yaltiroq, storis halqasi,
          tebranish, AI tugmasi orbitasi …) ishlaydi, faqat SKROLL paytida bir
          lahzaga to'xtab turadi — barmoq qo'yib yuborilgach ~0.2s da davom etadi.
          Shunda ro'yxat silliq aylanadi, tinch turganda esa hammasi «tirik».
          Yuklanish belgilari (spinner, skelet, shesterna) hech qachon to'xtamaydi. */
    var KEEP = /^(wlGearIdle|wlGearIn|gearSpin|wlIndet|wlLoad|skeleton-loading|skelShimmer|shimmerSlide|p2Shimmer|gold-loading|hourglass-anim|pulse-text|dotPulse|sgDot|a1Spin|aibSpin|aoSpin|mpSpin|ordlSpin|ordlSpinR|rvSpin|mapLocateSpin)$/;
    var held = null, resumeT = 0;
    function holdAnimations() {
        if (held || !document.getAnimations) return;
        held = [];
        try {
            document.getAnimations().forEach(function (a) {
                var n = a.animationName; if (!n || KEEP.test(n) || a.playState !== 'running') return;
                var t = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
                if (!t || t.iterations !== Infinity) return;
                a.pause(); held.push(a);
            });
        } catch (e) {}
    }
    function releaseAnimations() {
        var list = held; held = null;
        if (list) list.forEach(function (a) { try { if (a.playState === 'paused') a.play(); } catch (e) {} });
    }
    document.addEventListener('scroll', function () {
        holdAnimations();
        clearTimeout(resumeT);
        resumeT = setTimeout(releaseAnimations, 220);
    }, { passive: true, capture: true });
    scan(document.body);
    try {
        new MutationObserver(function (ms) {
            for (var i = 0; i < ms.length; i++) { var a = ms[i].addedNodes; for (var k = 0; k < a.length; k++) scan(a[k]); }
        }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
})();
