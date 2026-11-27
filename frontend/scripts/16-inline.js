
    (function polishLayer() {
        function ready(fn) {
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
            else fn();
        }
        ready(function () {
            try {
                // 1) Grain qatlamini qo'shamiz (faqat bir marta)
                if (!document.getElementById('polish-grain')) {
                    var g = document.createElement('div');
                    g.id = 'polish-grain';
                    document.body.appendChild(g);
                }
                // 3) Scroll-progress chizig'i
                var bar = document.getElementById('polish-progress');
                if (!bar) {
                    bar = document.createElement('div');
                    bar.id = 'polish-progress';
                    document.body.appendChild(bar);
                }
                var ticking = false;
                function updateProgress() {
                    var doc = document.documentElement;
                    var st = window.pageYOffset || doc.scrollTop || 0;
                    var h = (doc.scrollHeight - doc.clientHeight) || 1;
                    var pct = Math.max(0, Math.min(100, (st / h) * 100));
                    bar.style.width = pct + '%';
                    bar.style.opacity = pct > 0.5 ? '1' : '0';
                    ticking = false;
                }
                window.addEventListener('scroll', function () {
                    if (!ticking) { window.requestAnimationFrame(updateProgress); ticking = true; }
                }, { passive: true });
                window.addEventListener('resize', updateProgress, { passive: true });
                updateProgress();
            } catch (e) { _dwarn('[polish] xato:', e); }
        });
    })();
