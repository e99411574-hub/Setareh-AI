/* ═══════════════════════════════════════════════════
   Setareh AI — app.js
   Splash، تم، سایدبار، Overlay
   ═══════════════════════════════════════════════════ */

window.APP = {

  init() {
    this.hideSplash();
    this.initTheme();
    this.initSidebar();
    this.initOverlay();
    this.initSuggestions();
    console.log('[APP] ✅ initialized');
  },

  hideSplash() {
    const splash = document.getElementById('splash');
    if (!splash) return;

    const seen = sessionStorage.getItem('setareh_splash_seen');
    const delay = seen ? 200 : 1400;

    setTimeout(() => {
      splash.classList.add('hide');
      sessionStorage.setItem('setareh_splash_seen', '1');
      setTimeout(() => {
        splash.style.display = 'none';
      }, 600);
    }, delay);
  },

  initTheme() {
    const btn = document.getElementById('themeBtn');
    if (!btn) return;

    let theme = localStorage.getItem('setareh_theme');

    if (!theme) {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      theme = prefersLight ? 'light' : 'dark';
    }

    this.applyTheme(theme);

    btn.onclick = () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      this.applyTheme(next);
      localStorage.setItem('setareh_theme', next);
      this.toast(next === 'dark' ? '🌙 حالت شب' : '☀️ حالت روز');
    };

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
      if (!localStorage.getItem('setareh_theme')) {
        this.applyTheme(e.matches ? 'light' : 'dark');
      }
    });
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'light' ? '#f5f6fa' : '#0e0e12');
    }
  },

  initSidebar() {
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (!toggle || !sidebar) return;

    toggle.onclick = () => {
      const isOpen = sidebar.classList.contains('open');
      if (isOpen) {
        sidebar.classList.remove('open');
        overlay?.classList.remove('show');
      } else {
        sidebar.classList.add('open');
        overlay?.classList.add('show');
      }
    };
  },

  initOverlay() {
    const overlay = document.getElementById('overlay');
    if (!overlay) return;

    overlay.onclick = () => {
      const sidebar = document.getElementById('sidebar');
      sidebar?.classList.remove('open');
      overlay.classList.remove('show');

      document.querySelectorAll('.modal.show').forEach(m => {
        m.classList.remove('show');
      });
    };
  },

  initSuggestions() {
    const cards = document.querySelectorAll('.suggestion-card');
    if (!cards.length) return;

    cards.forEach(card => {
      card.onclick = () => {
        const prompt = card.dataset.prompt;
        if (!prompt) return;

        const input = document.getElementById('inputBox');
        if (input && window.CHAT) {
          input.value = prompt;
          CHAT.autoResize?.();
          CHAT.updateSendState?.();
          input.focus();

          setTimeout(() => {
            CHAT.handleSend?.();
          }, 250);
        }
      };
    });
  },

  toast(msg) {
    if (window.CHAT && typeof CHAT.toast === 'function') {
      return CHAT.toast(msg);
    }
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._t);
    this._t = setTimeout(() => t.classList.remove('show'), 2200);
  },
};

/* ─── راه‌اندازی APP ─── */
window.addEventListener('DOMContentLoaded', () => {
  try {
    APP.init();
  } catch (err) {
    console.error('[APP] init failed:', err);
    const splash = document.getElementById('splash');
    if (splash) splash.style.display = 'none';
  }
});
