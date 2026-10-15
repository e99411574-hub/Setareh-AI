// ===== js/app.js — راه‌اندازی Setareh AI =====

var APP = {
  version: '1.0.0',

  init: function() {
    // راه‌اندازی روتر
    ROUTER.init();

    // حالت شب
    this.initTheme();

    // دکمهٔ حالت شب
    var themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', this.toggleTheme.bind(this));
    }

    // راه‌اندازی پنل‌ها
    if (typeof IMAGE !== 'undefined' && IMAGE.init) IMAGE.init();
    if (typeof VIDEO !== 'undefined' && VIDEO.init) VIDEO.init();
    if (typeof MERGE !== 'undefined' && MERGE.init) MERGE.init();
    if (typeof CHAT !== 'undefined' && CHAT.init) CHAT.init();
    if (typeof EDIT !== 'undefined' && EDIT.init) EDIT.init();

    console.log('⭐ Setareh AI آماده — نسخه', this.version);
  },

  // ============ حالت شب ============
  initTheme: function() {
    var saved = localStorage.getItem('setareh_dark');
    if (saved === '1') {
      document.body.classList.add('dark-mode');
      this.updateThemeBtn(true);
    } else {
      this.updateThemeBtn(false);
    }
  },

  toggleTheme: function() {
    var isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('setareh_dark', isDark ? '1' : '0');
    this.updateThemeBtn(isDark);
    this.vibrate(15);
  },

  updateThemeBtn: function(isDark) {
    var btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
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

  // ============ لودینگ ============
  showLoading: function(containerId, text) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<div>' + (text || 'در حال ساخت...') + '</div>' +
      '</div>';
  },

  // ============ خطا ============
  showError: function(containerId, text) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div style="padding:20px;text-align:center;color:#e74c3c;font-weight:700;">❌ ' + text + '</div>';
  },

  // ============ دانلود ============
  downloadFile: function(url, filename) {
    try {
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || 'setareh-' + Date.now();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.toast('✅ دانلود شروع شد');
    } catch(e) {
      console.error('download error:', e);
      this.toast('❌ خطا در دانلود');
    }
  },

  // ============ کپی URL ============
  copyUrl: function(url) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function() {
        APP.toast('✅ لینک کپی شد');
      }).catch(function() {
        APP.toast('❌ خطا در کپی');
      });
    } else {
      this.toast('❌ مرورگر پشتیبانی نمی‌کند');
    }
  },

  // ============ Escape ============
  esc: function(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
};

// ============ راه‌اندازی خودکار ============
window.addEventListener('DOMContentLoaded', function() {
  try { APP.init(); } catch (e) { console.error('APP init error:', e); }
});

window.APP = APP;
