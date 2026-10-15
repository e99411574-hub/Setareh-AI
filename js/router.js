// ===== js/router.js — جابجایی بین پنل‌ها =====

var ROUTER = {
  current: 'image',

  init: function() {
    var self = this;

    // دکمه‌های نوار پایین
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var view = this.getAttribute('data-view');
        if (view) self.go(view);
      });
    });

    // پشتیبانی از hash
    if (window.location.hash) {
      var hash = window.location.hash.replace('#', '');
      if (document.getElementById('view-' + hash)) {
        this.go(hash);
      }
    }

    console.log('🧭 ROUTER: آماده');
  },

  go: function(view) {
    if (!view) return;
    if (!document.getElementById('view-' + view)) {
      console.warn('ROUTER: view پیدا نشد:', view);
      return;
    }

    // پنهان کردن همه
    document.querySelectorAll('.view').forEach(function(v) {
      v.classList.remove('active');
    });

    // نمایش جدید
    var target = document.getElementById('view-' + view);
    if (target) {
      target.classList.add('active');
    }

    // آپدیت نوار پایین
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      if (btn.getAttribute('data-view') === view) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // آپدیت URL
    try {
      history.replaceState(null, '', '#' + view);
    } catch(e) {}

    // اسکرول بالا
    window.scrollTo(0, 0);

    this.current = view;

    // افکت صوتی (اختیاری)
    if (typeof APP !== 'undefined' && APP.vibrate) APP.vibrate(20);
  }
};

window.ROUTER = ROUTER;
