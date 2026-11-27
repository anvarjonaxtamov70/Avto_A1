
(function sheetScrollFix() {
    'use strict';
    /* Ichki skrollerlar hujjat darajasidagi `touchmove` ruxsat ro'yxatiga
     * (6954-qator) qo'shildi — shuning uchun bu yerda qo'shimcha handler
     * KERAK EMAS. Ro'yxat: #story-composer-body, #customer-detail-body,
     * #ai-bulk-content, #ai-neural-loader. */
    var SCROLLERS = '#story-composer-body, #customer-detail-body, #ai-bulk-content, #ai-neural-loader';

    /* ------------------------------------------------------------------
     * Oyna har ochilganda skrollni tepaga qaytaramiz. Ilgari oyna
     * o'zi skroll qilgani uchun eski holat saqlanib qolib, sarlavha
     * "yarim surilgan" holatda ko'rinardi.
     * ------------------------------------------------------------------ */
    function resetScroll(id) {
        var m = document.getElementById(id);
        if (m) m.scrollTop = 0;
        var inner = m ? m.querySelectorAll(SCROLLERS) : [];
        Array.prototype.forEach.call(inner, function (n) { n.scrollTop = 0; });
    }
    window._sheetResetScroll = resetScroll;

    function wrap() {
        if (typeof window.openModal !== 'function' || window._sheetWrapped) return;
        window._sheetWrapped = true;
        var orig = window.openModal;
        window.openModal = function (id) {
            var r = orig.apply(this, arguments);
            if (id === 'aiBulkModal' || id === 'storyComposerModal' || id === 'customerDetailModal') {
                setTimeout(function () { resetScroll(id); }, 20);
            }
            return r;
        };
    }
    wrap();
    setTimeout(wrap, 1200);
    setTimeout(wrap, 3000);
})();
