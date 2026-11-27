
(function ordersAtomicWrites() {
    'use strict';

    /**
     * Firebase `orders` tugunini massivga aylantiradi.
     * RTDB ketma-ket raqamli kalitlarni massiv, "teshikli" bo'lsa obyekt
     * qilib qaytaradi — shuning uchun ikki shaklni ham qo'llab-quvvatlaymiz.
     */
    window._toOrdersArray = function (v) {
        if (!v) return [];
        if (Array.isArray(v)) return v.filter(Boolean);
        if (typeof v === 'object') {
            return Object.keys(v).map(function (k) { return v[k]; }).filter(Boolean);
        }
        return [];
    };

    function ordersRef(uid) {
        try { if (typeof db !== 'undefined' && db && db.ref) return db.ref('users/' + uid + '/orders'); } catch (e) {}
        try { if (window.firebase && firebase.database) return firebase.database().ref('users/' + uid + '/orders'); } catch (e) {}
        return null;
    }

    /**
     * Buyurtmalar ro'yxatini ATOMIK o'zgartiradi.
     * @param {string|number} uid
     * @param {function(Array): (Array|undefined)} mutate
     *        Massivni o'zgartirib QAYTARADI. `undefined` qaytarsa — bekor
     *        qilinadi (masalan buyurtma topilmadi) va hech narsa yozilmaydi.
     * @returns {Promise<{committed:boolean}|null>}
     */
    window._ordersTxn = function (uid, mutate) {
        if (!uid || typeof mutate !== 'function') return Promise.resolve(null);
        var ref = ordersRef(uid);
        if (!ref) return Promise.resolve(null);
        return ref.transaction(function (cur) {
            var arr = window._toOrdersArray(cur);
            var out;
            try { out = mutate(arr); } catch (e) { return undefined; }
            if (out === undefined || out === null) return undefined;   // bekor
            return out;
        });
    };

    if (window._dlog) window._dlog('%c[Qatlam 2026.15] Buyurtmalarga atomik yozish', 'color:#C9A84C;font-weight:bold;');
})();
