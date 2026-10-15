// ===== js/router.js — جابجایی بین پنل‌ها =====

var ROUTER = {
  current: 'chat',

  init: function() {
    var self = this;

    // دکمه‌های نوار پایین
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var view = this.getAttribute('data-view');
        if (view) self.go(view);
      });
    });

    // منوی کناری
    document.querySelectorAll('.side-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var go = this.getAttribute('data-go');
        if (go) self.go(go);
        self.closeSideMenu();
      });
    });

    // دکمهٔ منو
    var menuBtn = document.getElementById('menuBtn');
    var sideMenu = document.getElementById('sideMenu');
    var sideOverlay = document.getElementById('sideOverlay');
    var closeMenuBtn = document.getElementById('closeMenuBtn');

    if (menuBtn) {
      menuBtn.addEventListener('click', function() {
        if (sideMenu) sideMenu.classList.add('open');
        if (sideOverlay) sideOverlay.classList.add('open');
      });
    }

    if (closeMenuBtn) {
      closeMenuBtn.addEventListener('click', function() {
        self.closeSideMenu();
      });
    }

    if (sideOverlay) {
      sideOverlay.addEventListener('click', function() {
        self.closeSideMenu();
      });
    }

    // hash
    if (window.location.hash) {
      var hash = window.location.hash.replace('#', '');
      if (document.getElementById('view-' + hash)) {
        this.go(hash);
      }
    }

    console.log('🧭 ROUTER: آماده');
  },

  closeSideMenu: function() {
    var sideMenu = document.getElementById('sideMenu');
    var sideOverlay = document.getElementById('sideOverlay');
    if (sideMenu) sideMenu.classList.remove('open');
    if (sideOverlay) sideOverlay.classList.remove('open');
  },

  go: function(view) {
    if (!view) return;
    var target = document.getElementById('view-' + view);
    if (!target) {
      console.warn('ROUTER: view پیدا نشد:', view);
      return;
    }

    // مخفی کردن همه
    document.querySelectorAll('.view').forEach(function(v) {
      v.classList.remove('active');
    });

    // نمایش جدید
    target.classList.add('active');

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

    // افکت لرزش
    if (typeof APP !== 'undefined' && APP.vibrate) APP.vibrate(15);
  }
};

window.ROUTER = ROUTER;
