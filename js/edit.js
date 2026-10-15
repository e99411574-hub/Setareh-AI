// ===== js/edit.js — اصلاح عکس با هوش مصنوعی =====

var EDIT = {
  _file: null,
  _lastUrl: null,

  init: function() {
    var input = document.getElementById('editImageInput');
    if (input) {
      input.addEventListener('change', this.onFileSelect.bind(this));
    }

    var btn = document.getElementById('editBtn');
    if (btn) {
      btn.addEventListener('click', this.generate.bind(this));
    }

    // Enter
    var prompt = document.getElementById('editPrompt');
    if (prompt) {
      prompt.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          EDIT.generate();
        }
      });
    }

    console.log('✏️ EDIT: آماده');
  },

  // ============ انتخاب عکس ============
  onFileSelect: function(e) {
    var file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      APP.toast('❌ عکس بزرگه (حداکثر ۱۰MB)');
      return;
    }

    if (!file.type.startsWith('image/')) {
      APP.toast('❌ فقط عکس مجازه');
      return;
    }

    this._file = file;

    // پیش‌نمایش
    var preview = document.getElementById('editImagePreview');
    var reader = new FileReader();
    reader.onload = function(ev) {
      preview.innerHTML = '<img src="' + ev.target.result + '" alt="preview">';
    };
    reader.readAsDataURL(file);

    APP.vibrate(20);
  },

  // ============ اصلاح ============
  generate: async function() {
    var result = document.getElementById('editResult');
    var btn = document.getElementById('editBtn');

    if (!this._file) {
      APP.toast('❌ اول یه عکس انتخاب کن');
      APP.vibrate(30);
      return;
    }

    var prompt = (document.getElementById('editPrompt') || {}).value || '';
    prompt = prompt.trim();
    if (!prompt) {
      APP.toast('❌ توضیح بده چیکار کنه');
      APP.vibrate(30);
      return;
    }

    // چک Puter
    if (typeof puter === 'undefined' || !puter.ai) {
      APP.toast('❌ Puter.js لود نشده');
      return;
    }

    btn.disabled = true;
    APP.vibrate(20);

    result.innerHTML = '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<div>✏️ در حال ویرایش عکس...</div>' +
      '<div style="font-size:11px;opacity:.6;">ممکنه ۲۰ تا ۶۰ ثانیه طول بکشه</div>' +
      '</div>';

    try {
      // ============ ارسال به Puter ============
      var imageElement;

      // اگه img2img داشت
      if (puter.ai.img2img) {
        imageElement = await puter.ai.img2img(this._file, prompt);
      } else {
        // راه جایگزین: آپلود و استفاده از txt2img
        throw new Error('ویرایش عکس هنوز پشتیبانی نمیشه');
      }

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
        throw new Error('عکس ویرایش‌شده تولید نشد');
      }

      this._lastUrl = url;

      // نمایش
      result.innerHTML = '';
      var img = document.createElement('img');
      img.src = url;
      img.alt = prompt;
      result.appendChild(img);

      // دکمه‌ها
      var actions = document.createElement('div');
      actions.className = 'result-actions';
      actions.innerHTML =
        '<button class="result-btn" onclick="EDIT.download()">' +
          '<span>💾</span><span>دانلود</span>' +
        '</button>' +
        '<button class="result-btn" onclick="EDIT.copy()">' +
          '<span>🔗</span><span>کپی لینک</span>' +
        '</button>';
      result.appendChild(actions);

      APP.toast('✅ عکس ویرایش شد!');
      APP.vibrate(40);

    } catch (err) {
      console.error('edit error:', err);
      var msg = err.message || 'خطای ناشناخته';
      if (msg.length > 100) msg = msg.substring(0, 100) + '...';
      APP.showError('editResult', 'خطا در ویرایش: ' + msg);
      APP.toast('❌ خطا');
      APP.vibrate(50);
    } finally {
      btn.disabled = false;
    }
  },

  // ============ دانلود ============
  download: function() {
    if (!this._lastUrl) return;
    APP.downloadFile(this._lastUrl, 'setareh-edited-' + Date.now() + '.png');
    APP.vibrate(20);
  },

  // ============ کپی ============
  copy: function() {
    if (!this._lastUrl) return;
    APP.copyUrl(this._lastUrl);
    APP.vibrate(20);
  }
};

window.EDIT = EDIT;
