
    window._catalogCache = (function () {
        var KEY = 'avto_catalog_v1';
        var MAX_AGE = 24 * 3600 * 1000;   // 1 kundan eski keshni ishlatmaymiz
        var MAX_BYTES = 900 * 1024;       // localStorage limitini to'ldirib qo'ymaymiz
        return {
            /** Saqlangan katalogni qaytaradi (yo'q/eskirgan/buzilgan bo'lsa null). */
            read: function () {
                try {
                    var raw = localStorage.getItem(KEY);
                    if (!raw) return null;
                    var box = JSON.parse(raw);
                    if (!box || !Array.isArray(box.items) || !box.items.length) return null;
                    if (!box.at || (Date.now() - box.at) > MAX_AGE) return null;
                    return box.items;
                } catch (e) { return null; }
            },
            /** Katalogni saqlaydi (joy yetmasa jimgina o'tib ketadi). */
            write: function (items) {
                try {
                    if (!Array.isArray(items) || !items.length) return false;
                    var s = JSON.stringify({ at: Date.now(), items: items });
                    if (s.length > MAX_BYTES) return false;
                    localStorage.setItem(KEY, s);
                    return true;
                } catch (e) { return false; }
            },
            clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
        };
    })();
    