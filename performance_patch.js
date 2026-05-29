/**
 * 🚀 AVTO A1 PERFORMANCE OPTIMIZATION PATCH
 * ==========================================
 * Bu fayl botning barcha muammolarini hal qiladi:
 * 1. Lazy Loading (rasmlar)
 * 2. Firebase Cache
 * 3. Event Listener Cleanup
 * 4. Smooth Animations
 * 5. Memory Management
 * 
 * ISHLATISH: index.html ga qo'shing:
 * <script src="performance_patch.js" defer></script>
 */

(function() {
    'use strict';
    
    console.log('🚀 Avto A1 Performance Patch yuklandi');
    
    // ============================================
    // 1. LAZY LOADING (RASMLAR UCHUN)
    // ============================================
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.dataset.src || img.src;
                
                if (img.dataset.src) {
                    img.src = src;
                    img.onload = () => {
                        img.style.opacity = '1';
                        img.classList.add('loaded');
                    };
                    delete img.dataset.src;
                }
                
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px', // 50px oldinroq yuklaydi
        threshold: 0.01
    });
    
    // Barcha rasmlarni kuzatish
    function observeImages() {
        document.querySelectorAll('img[data-src], img:not(.loaded)').forEach(img => {
            if (!img.complete || img.naturalHeight === 0) {
                imageObserver.observe(img);
            } else {
                img.style.opacity = '1';
                img.classList.add('loaded');
            }
        });
    }
    
    // Dastlabki yuklash
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observeImages);
    } else {
        observeImages();
    }
    
    // Yangi rasmlar qo'shilganda ham kuzatish
    const contentObserver = new MutationObserver(() => {
        observeImages();
    });
    
    contentObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // ============================================
    // 2. FIREBASE CACHE TIZIMI
    // ============================================
    window.FirebaseCache = {
        cache: {},
        ttl: 5 * 60 * 1000, // 5 minut
        
        get(key) {
            const item = this.cache[key];
            if (!item) return null;
            
            if (Date.now() - item.timestamp > this.ttl) {
                delete this.cache[key];
                return null;
            }
            
            return item.data;
        },
        
        set(key, data) {
            this.cache[key] = {
                data: data,
                timestamp: Date.now()
            };
        },
        
        clear() {
            this.cache = {};
        }
    };
    
    // ============================================
    // 3. EVENT LISTENER CLEANUP
    // ============================================
    window.EventManager = {
        listeners: [],
        
        add(element, event, handler, options) {
            element.addEventListener(event, handler, options);
            this.listeners.push({ element, event, handler, options });
        },
        
        remove(element, event, handler) {
            element.removeEventListener(event, handler);
            this.listeners = this.listeners.filter(l => 
                !(l.element === element && l.event === event && l.handler === handler)
            );
        },
        
        cleanup() {
            this.listeners.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
            this.listeners = [];
        }
    };
    
    // ============================================
    // 4. DEBOUNCE (QIDIRUV UCHUN)
    // ============================================
    window.debounce = function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };
    
    // ============================================
    // 5. SMOOTH SCROLL OPTIMIZATION
    // ============================================
    let scrollTimer;
    let isScrolling = false;
    
    window.addEventListener('scroll', () => {
        if (!isScrolling) {
            isScrolling = true;
            document.body.classList.add('is-scrolling');
        }
        
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            isScrolling = false;
            document.body.classList.remove('is-scrolling');
        }, 150);
    }, { passive: true });
    
    // ============================================
    // 6. GPU ACCELERATION (ANIMATSIYALAR)
    // ============================================
    function enableGPU(element) {
        element.style.willChange = 'transform, opacity';
        element.style.transform = 'translateZ(0)';
    }
    
    // Barcha modal va kartalar uchun
    document.querySelectorAll('.modal-standard, .luxury-card, .btn-add-cart').forEach(enableGPU);
    
    // ============================================
    // 7. MEMORY LEAK PREVENTION
    // ============================================
    window.addEventListener('beforeunload', () => {
        EventManager.cleanup();
        FirebaseCache.clear();
        contentObserver.disconnect();
        imageObserver.disconnect();
    });
    
    // ============================================
    // 8. MODAL SCROLL LOCK
    // ============================================
    window.lockScroll = function() {
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
    };
    
    window.unlockScroll = function() {
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
    };
    
    // ============================================
    // 9. PERFORMANCE MONITOR (DEBUG)
    // ============================================
    if (window.location.hostname === 'localhost' || window.location.search.includes('debug=1')) {
        let frameCount = 0;
        let lastTime = performance.now();
        
        function measureFPS() {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime >= lastTime + 1000) {
                console.log(`📊 FPS: ${frameCount}`);
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(measureFPS);
        }
        
        requestAnimationFrame(measureFPS);
    }
    
    // ============================================
    // 10. RASMLARNI OPTIMALLASH
    // ============================================
    window.optimizeImage = function(url) {
        // Postimg.cc rasmlarini optimallash
        if (url.includes('postimg.cc')) {
            return url.replace(/\.png$/, '_thumb.png').replace(/\.jpg$/, '_thumb.jpg');
        }
        return url;
    };
    
    console.log('✅ Performance Patch muvaffaqiyatli yuklandi!');
    console.log('📈 Lazy loading: AKTIV');
    console.log('💾 Firebase cache: AKTIV');
    console.log('🧹 Memory management: AKTIV');
    console.log('🚀 GPU acceleration: AKTIV');
    
})();
