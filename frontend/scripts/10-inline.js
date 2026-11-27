
        // ⚡ Mavzuni bo'yashdan oldin qo'llaymiz (xira "flash" bo'lmasligi uchun)
        (function(){ try { var s = JSON.parse(localStorage.getItem('avto_phase2')||'{}'); document.documentElement.setAttribute('data-theme', s.theme === 'light' ? 'light' : 'dark'); } catch(e){ document.documentElement.setAttribute('data-theme','dark'); } })();
    