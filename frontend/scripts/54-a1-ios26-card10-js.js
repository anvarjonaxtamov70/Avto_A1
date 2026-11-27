
(function () {
    'use strict';
    // «Kattalashtirish» kapsulasi bosilganda — ko'rinib turgan rasm kattalashadi
    document.addEventListener('click', function (e) {
        var tip = e.target.closest && e.target.closest('#productModal .pmz-tip');
        if (!tip || typeof window.openZoom !== 'function') return;
        e.preventDefault(); e.stopPropagation();
        var slider = document.getElementById('pm-slider-wrapper');
        if (!slider) return;
        var imgs = slider.querySelectorAll('img');
        if (!imgs.length) return;
        var srcs = [];
        for (var i = 0; i < imgs.length; i++) srcs.push(imgs[i].getAttribute('data-full') || imgs[i].src);
        var idx = Math.round(slider.scrollLeft / (slider.clientWidth || 1));
        window.openZoom(srcs, Math.max(0, Math.min(srcs.length - 1, idx)));
    }, true);
})();
