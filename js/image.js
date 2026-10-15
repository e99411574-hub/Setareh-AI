// ===== js/image.js — ساخت عکس با هوش مصنوعی =====

var IMAGE = {
  _lastUrl: null,

  init: function() {
    var btn = document.getElementById('imageBtn');
    if (btn) {
      btn.addEventListener('click', this.generate.bind(this));
    }

    // Enter برای ساخت (Shift+Enter = خط جدید)
    var prompt = document.getElementById('imagePrompt');
    if (prompt) {
      prompt.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          IMAGE.generate();
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
      APP.toast('❌ اول چیزی بنویس');
      APP.vibrate(30);
      return;
    }

    // چک Puter
    if (typeof puter === 'undefined' || !puter.ai) {
      APP.toast('❌ Puter.js لود نشده');
      return;
    }

    // غیرفعال کردن دکمه
    btn.disabled = true;
    APP.vibrate(20);

    // نمایش لودینگ
    result.innerHTML = '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<div>🎨 در حال ساخت عکس...</div>' +
      '<div style="font-size:11px;opacity:.6;">ممکنه ۱۰ تا ۳۰ ثانیه طول بکشه</div>' +
      '</div>';

    try {
      // ============ درخواست به Puter ============
      var imageElement = await puter.ai.txt2img(text);

      // استخراج URL
      var url = null;
      if (typeof imageElement === 'string') {
        url = imageElement;
      } else if (imageElement && imageElement.src) {
        url = imageElement.src;
      } else if (imageElement && imageElement.querySelector) {
        var img = imageElement.querySelector('img');
        if (img) url = img.src;
      }

      if (!url) {
        throw new Error('عکسی تولید نشد');
      }

      this._lastUrl = url;

      // نمایش نتیجه
      result.innerHTML = '';
      var img = document.createElement('img');
      img.src = url;
      img.alt = text;
      img.loading = 'eager';
      result.appendChild(img);

      // دکمه‌های عملیات
      var actions = document.createElement('div');
      actions.className = 'result-actions';
      actions.innerHTML =
        '<button class="result-btn" onclick="IMAGE.download()">' +
          '<span>💾</span><span>دانلود</span>' +
        '</button>' +
        '<button class="result-btn" onclick="IMAGE.copy()">' +
          '<span>🔗</span><span>کپی لینک</span>' +
        '</button>' +
        '<button class="result-btn" onclick="IMAGE.again()">' +
          '<span>🔄</span><span>دوباره</span>' +
        '</button>';
      result.appendChild(actions);

      APP.toast('✅ عکس ساخته شد!');
      APP.vibrate(30);

    } catch (err) {
      console.error('image error:', err);
      var msg = err.message || 'خطای ناشناخته';
      if (msg.length > 80) msg = msg.substring(0, 80) + '...';
      APP.showError('imageResult', 'خطا در ساخت عکس: ' + msg);
      APP.toast('❌ خطا در ساخت');
      APP.vibrate(50);
    } finally {
      btn.disabled = false;
    }
  },

  // ============ دانلود ============
  download: async function() {
    if (!this._lastUrl) return;
    try {
      // ساخت نام فایل از پرامپت
      var prompt = document.getElementById('imagePrompt');
      var text = (prompt.value || 'setareh').substring(0, 30).replace(/[^آ-یa-zA-Z0-9]/g, '_');
      APP.downloadFile(this._lastUrl, text + '.png');
      APP.vibrate(20);
    } catch(e) {
      APP.toast('❌ خطا در دانلود');
    }
  },

  // ============ کپی لینک ============
  copy: function() {
    if (!this._lastUrl) return;
    APP.copyUrl(this._lastUrl);
    APP.vibrate(20);
  },

  // ============ دوباره ============
  again: function() {
    this.generate();
  }
};

window.IMAGE = IMAGE;
