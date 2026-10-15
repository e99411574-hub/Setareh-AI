// ===== js/app.js — راه‌اندازی Setareh AI =====

var APP = {
  version: '1.0.0',

  init: function() {
    this.initTheme();
    ROUTER.init();

    // دکمهٔ تغییر تم
    var themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', this.toggleTheme.bind(this));
    }

    // راه‌اندازی پنل‌ها
    if (typeof CHAT !== 'undefined' && CHAT.init) CHAT.init();
    if (typeof IMAGE !== 'undefined' && IMAGE.init) IMAGE.init();
    if (typeof VIDEO !== 'undefined' && VIDEO.init) VIDEO.init();
    if (typeof MERGE !== 'undefined' && MERGE.init) MERGE.init();
    if (typeof EDIT !== 'undefined' && EDIT.init) EDIT.init();
    if (typeof TTS !== 'undefined' && TTS.init) TTS.init();

    console.log('⭐ Setareh AI آماده — نسخه', this.version);
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
    // آیکن خورشید برای تم روشن، ماه برای تم تیره
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

  // ============ لودینگ پویا با درصد ============
  startLoading: function(containerId, options) {
    options = options || {};
    var el = document.getElementById(containerId);
    if (!el) return null;

    var title = options.title || 'در حال ساخت...';
    var sub = options.sub || 'لطفاً صبر کن';
    var duration = options.duration || 30000; // مدت تقریبی به میلی‌ثانیه
    var startTime = Date.now();
    var percent = 0;
    var fake = 0;

    // ساخت HTML لودینگ
    el.innerHTML =
      '<div class="loading">' +
        '<div class="loading-dots">' +
          '<span></span><span></span><span></span><span></span>' +
        '</div>' +
        '<div class="loading-text" id="' + containerId + '-title">' + title + '</div>' +
        '<div class="loading-sub" id="' + containerId + '-sub">' + sub + '</div>' +
        '<div class="progress-wrap">' +
          '<div class="progress-bar">' +
            '<div class="progress-fill" id="' + containerId + '-fill" style="width:0%"></div>' +
          '</div>' +
          '<div style="text-align:center;">' +
            '<span class="progress-percent" id="' + containerId + '-pct">۰٪</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    var fillEl = document.getElementById(containerId + '-fill');
    var pctEl = document.getElementById(containerId + '-pct');
    var titleEl = document.getElementById(containerId + '-title');
    var subEl = document.getElementById(containerId + '-sub');

    // انیمیشن درصد
    var interval = setInterval(function() {
      var elapsed = Date.now() - startTime;
      var ratio = elapsed / duration;

      // درصد واقعی (۰-۹۵ بر اساس زمان)
      var target = Math.min(95, ratio * 95);

      // اگه fake بالاتر بود، از fake استفاده کن
      if (fake > target) target = fake;

      // انیمیشن نرم
      percent += (target - percent) * 0.15;
      if (percent > 99) percent = 99;

      var display = Math.round(percent);
      if (fillEl) fillEl.style.width = display + '%';
      if (pctEl) pctEl.textContent = APP.toFa(display) + '٪';
    }, 200);

    return {
      setTitle: function(t) { if (titleEl) titleEl.textContent = t; },
      setSub: function(s) { if (subEl) subEl.textContent = s; },
      setProgress: function(p) {
        fake = Math.max(fake, p);
        if (fake > 99) fake = 99;
      },
      finish: function() {
        clearInterval(interval);
        if (fillEl) fillEl.style.width = '100%';
        if (pctEl) pctEl.textContent = '۱۰۰٪';
      },
      stop: function() {
        clearInterval(interval);
      }
    };
  },

  // ============ نمایش خطا ============
  showError: function(containerId, text) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div style="padding:30px 20px;text-align:center;">' +
      '<div style="font-size:32px;margin-bottom:12px;">⚠️</div>' +
      '<div style="color:var(--danger);font-weight:700;font-size:15px;line-height:1.6;">' + text + '</div>' +
      '</div>';
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

  // ============ تبدیل عدد به فارسی ============
  toFa: function(n) {
    var fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    return String(n).replace(/\d/g, function(d) { return fa[+d]; });
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
