// ===== js/image.js — ساخت عکس با هوش مصنوعی =====

var IMAGE = {
  _lastUrl: null,
  _loader: null,

  init: function() {
    var self = this;

    var btn = document.getElementById('imageBtn');
    if (btn) btn.addEventListener('click', function() { self.generate(); });

    var prompt = document.getElementById('imagePrompt');
    if (prompt) {
      prompt.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          self.generate();
        }
      });
    }

    console.log('🖼️ IMAGE: آماده');
  },

  generate: async function() {
    var prompt = document.getElementById('imagePrompt');
    var result = document.getElementById('imageResult');
    var btn = document.getElementById('imageBtn');

    var text = (prompt.value || '').trim();
    if (!text) {
      APP.toast('اول چیزی بنویس');
      APP.vibrate(30);
      return;
    }

    if (typeof puter === 'undefined' || !puter.ai) {
      APP.toast('اتصال برقرار نیست');
      return;
    }

    btn.disabled = true;
    APP.vibrate(20);

    // شروع لودینگ پویا
    this._loader = APP.startLoading('imageResult', {
      title: 'در حال ساخت عکس...',
      sub: 'ممکنه ۱۰ تا ۳۰ ثانیه طول بکشه',
      duration: 25000
    });

    try {
      // درخواست به Puter
      var imageElement = await puter.ai.txt2img(text);

      // استخراج URL
      var url = this._extractUrl(imageElement);
      if (!url) throw new Error('عکسی تولید نشد');

      this._lastUrl = url;

      // پایان لودینگ
      if (this._loader) {
        this._loader.setTitle('تمام شد!');
        this._loader.finish();
      }

      // تاخیر کوتاه برای دیدن ۱۰۰٪
      await this._delay(400);

      // نمایش نتیجه
      this._showResult(result, url, text);

      APP.toast('عکس ساخته شد');
      APP.vibrate(30);

    } catch (err) {
      console.error('image error:', err);
      if (this._loader) this._loader.stop();
      var msg = err.message || 'خطای ناشناخته';
      if (msg.length > 80) msg = msg.substring(0, 80) + '...';
      APP.showError('imageResult', 'خطا در ساخت عکس: ' + msg);
      APP.toast('خطا در ساخت');
      APP.vibrate(50);
    } finally {
      btn.disabled = false;
      this._loader = null;
    }
  },

  // ============ استخراج URL ============
  _extractUrl: function(el) {
    if (!el) return null;
    if (typeof el === 'string') return el;
    if (el.src) return el.src;
    if (el.url) return el.url;
    if (el.querySelector) {
      var img = el.querySelector('img');
      if (img) return img.src;
      var v = el.querySelector('video');
      if (v) return v.src;
    }
    return null;
  },

  // ============ نمایش نتیجه ============
  _showResult: function(container, url, promptText) {
    container.innerHTML = '';

    var img = document.createElement('img');
    img.src = url;
    img.alt = promptText;
    img.loading = 'eager';
    container.appendChild(img);

    var actions = document.createElement('div');
    actions.className = 'result-actions';

    var dl = document.createElement('button');
    dl.className = 'result-btn';
    dl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> دانلود';
    dl.onclick = function() { IMAGE.download(promptText); };
    actions.appendChild(dl);

    var cp = document.createElement('button');
    cp.className = 'result-btn';
    cp.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> کپی لینک';
    cp.onclick = function() { APP.copyUrl(IMAGE._lastUrl); };
    actions.appendChild(cp);

    var ag = document.createElement('button');
    ag.className = 'result-btn';
    ag.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> دوباره';
    ag.onclick = function() { IMAGE.generate(); };
    actions.appendChild(ag);

    container.appendChild(actions);
  },

  // ============ دانلود ============
  download: async function(promptText) {
    if (!this._lastUrl) return;
    try {
      var name = (promptText || 'setareh').substring(0, 30).replace(/[^آ-یa-zA-Z0-9]/g, '_') + '.png';
      APP.downloadFile(this._lastUrl, name);
    } catch(e) {
      APP.toast('خطا در دانلود');
    }
  },

  // ============ تاخیر ============
  _delay: function(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }
};

window.IMAGE = IMAGE;
