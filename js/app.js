// ===== js/app.js — Setareh AI =====

var APP = {
  version: '2.0.0',

  // ============ راه‌اندازی ============
  init: function() {
    console.log('🚀 APP.init شروع');

    // تم
    this.initTheme();

    // دکمهٔ تم
    var themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', this.toggleTheme.bind(this));
      console.log('✅ دکمهٔ تم');
    }

    // دکمهٔ منو
    var menuBtn = document.getElementById('menuBtn');
    if (menuBtn) {
      menuBtn.addEventListener('click', function() {
        var sidebar = document.getElementById('sidebar');
        var overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('open');
        if (typeof CHAT !== 'undefined' && CHAT.renderSidebar) {
          CHAT.renderSidebar();
        }
      });
      console.log('✅ دکمهٔ منو');
    }

    // overlay منو
    var overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
      overlay.addEventListener('click', function() {
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
        overlay.classList.remove('open');
      });
      console.log('✅ overlay');
    }

    console.log('✅ APP.init تموم شد');
  },

  // ============ تم ============
  initTheme: function() {
    var saved = localStorage.getItem('setareh_theme') || 'dark';
    document.body.setAttribute('data-theme', saved);
    this.updateThemeIcon(saved);
  },

  toggleTheme: function() {
    var current = document.body.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('setareh_theme', next);
    this.updateThemeIcon(next);
    this.vibrate(15);
  },

  updateThemeIcon: function(theme) {
    var btn = document.getElementById('themeBtn');
    if (!btn) return;
    if (theme === 'dark') {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
  },

  // ============ Toast ============
  toast: function(msg, ms) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(function() {
      el.classList.remove('on');
    }, ms || 3000);
  },

  // ============ لرزش ============
  vibrate: function(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms || 20); } catch(e) {}
    }
  },

  // ============ دانلود ============
  downloadFile: function(url, filename) {
    try {
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || 'setareh-' + Date.now();
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.toast('✅ دانلود شروع شد');
      this.vibrate(20);
    } catch(e) {
      console.error('download error:', e);
      this.toast('❌ خطا در دانلود');
    }
  },

  // ============ escape ============
  esc: function(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
};

window.APP = APP;

// ============ راه‌اندازی خودکار ============
window.addEventListener('DOMContentLoaded', function() {
  // ۱. APP
  try { APP.init(); } catch(e) { console.error('❌ APP.init:', e); }

  // ۲. CHAT (جدا، بعد از APP)
  try {
    if (typeof CHAT !== 'undefined' && CHAT.init) {
      CHAT.init();
      console.log('✅ CHAT.init صدا زده شد');
    } else {
      console.warn('⚠️ CHAT پیدا نشد');
    }
  } catch(e) {
    console.error('❌ CHAT.init:', e);
    console.error('Stack:', e.stack);
  }

  // ۳. نمایش welcome یا history
  setTimeout(function() {
    try {
      if (typeof CHAT === 'undefined') return;
      if (CHAT._history && CHAT._history.length > 0) {
        CHAT.renderHistory();
      } else if (CHAT._showWelcome) {
        CHAT._showWelcome();
      }
    } catch(e) {
      console.error('❌ render:', e);
    }
  }, 300);
});
