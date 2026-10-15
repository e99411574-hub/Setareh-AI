// ===== js/video.js — ساخت ویدیو با هوش مصنوعی =====

var VIDEO = {
  _mode: 'text',      // 'text' | 'image'
  _file: null,        // عکس انتخاب‌شده
  _lastUrl: null,

  init: function() {
    var self = this;

    // تب‌ها
    document.querySelectorAll('.tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var mode = this.getAttribute('data-mode');
        self.setMode(mode);
      });
    });

    // دکمهٔ ساخت
    var btn = document.getElementById('videoBtn');
    if (btn) btn.addEventListener('click', this.generate.bind(this));

    // آپلود عکس
    var fileInput = document.getElementById('videoImageInput');
    if (fileInput) {
      fileInput.addEventListener('change', this.onFileSelect.bind(this));
    }

    // Enter در textarea
    var prompt = document.getElementById('videoPrompt');
    if (prompt) {
      prompt.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          VIDEO.generate();
        }
      });
    }

    console.log('🎬 VIDEO: آماده');
  },

  // ============ تغییر تب ============
  setMode: function(mode) {
    this._mode = mode;

    document.querySelectorAll('.tab').forEach(function(t) {
      if (t.getAttribute('data-mode') === mode) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    var textMode = document.getElementById('videoTextMode');
    var imageMode = document.getElementById('videoImageMode');

    if (mode === 'text') {
      if (textMode) textMode.style.display = 'block';
      if (imageMode) imageMode.style.display = 'none';
    } else {
      if (textMode) textMode.style.display = 'none';
      if (imageMode) imageMode.style.display = 'block';
    }

    APP.vibrate(15);
  },

  // ============ انتخاب عکس ============
  onFileSelect: function(e) {
    var file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      APP.toast('❌ عکس بزرگه (حداکثر ۱۰MB)');
      return;
    }

    this._file = file;

    // پیش‌نمایش
    var preview = document.getElementById('videoImagePreview');
    var reader = new FileReader();
    reader.onload = function(ev) {
      preview.innerHTML = '<img src="' + ev.target.result + '" alt="preview">';
    };
    reader.readAsDataURL(file);

    APP.vibrate(20);
  },

  // ============ ساخت ویدیو ============
  generate: async function() {
    var result = document.getElementById('videoResult');
    var btn = document.getElementById('videoBtn');

    // چک Puter
    if (typeof puter === 'undefined' || !puter.ai) {
      APP.toast('❌ Puter.js لود نشده');
      return;
    }

    // جمع‌آوری ورودی
    var promptText = '';
    var imageFile = null;

    if (this._mode === 'text') {
      promptText = (document.getElementById('videoPrompt') || {}).value || '';
      promptText = promptText.trim();
      if (!promptText) {
        APP.toast('❌ اول متن رو بنویس');
        APP.vibrate(30);
        return;
      }
    } else {
      if (!this._file) {
        APP.toast('❌ اول یه عکس انتخاب کن');
        APP.vibrate(30);
        return;
      }
      imageFile = this._file;
      promptText = (document.getElementById('videoImagePrompt') || {}).value || '';
      promptText = promptText.trim();
    }

    // غیرفعال کردن دکمه
    btn.disabled = true;
    APP.vibrate(20);

    // لودینگ
    result.innerHTML = '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<div>🎬 در حال ساخت ویدیو...</div>' +
      '<div style="font-size:11px;opacity:.6;">ممکنه ۳۰ تا ۹۰ ثانیه طول بکشه</div>' +
      '</div>';

    try {
      var videoElement;

      if (this._mode === 'text') {
        // ============ از متن ============
        videoElement = await puter.ai.txt2vid(promptText);
      } else {
        // ============ از عکس ============
        // Puter از img2vid پشتیبانی می‌کنه (در صورت موجود بودن)
        if (puter.ai.img2vid) {
          videoElement = await puter.ai.img2vid(imageFile, promptText || 'animate this image');
        } else {
          // اگه img2vid نبود، از txt2vid با توضیح عکس استفاده کن
          throw new Error('ساخت ویدیو از عکس هنوز پشتیبانی نمیشه');
        }
      }

      // استخراج URL
      var url = null;
      if (typeof videoElement === 'string') {
        url = videoElement;
      } else if (videoElement && videoElement.src) {
        url = videoElement.src;
      } else if (videoElement && videoElement.querySelector) {
        var v = videoElement.querySelector('video');
        if (v) url = v.src;
        var s = videoElement.querySelector('source');
        if (!url && s) url = s.src;
      }

      if (!url) {
        throw new Error('ویدیویی تولید نشد');
      }

      this._lastUrl = url;

      // نمایش
      result.innerHTML = '';
      var video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      result.appendChild(video);

      // دکمه‌ها
      var actions = document.createElement('div');
      actions.className = 'result-actions';
      actions.innerHTML =
        '<button class="result-btn" onclick="VIDEO.download()">' +
          '<span>💾</span><span>دانلود</span>' +
        '</button>' +
        '<button class="result-btn" onclick="VIDEO.copy()">' +
          '<span>🔗</span><span>کپی لینک</span>' +
        '</button>';
      result.appendChild(actions);

      APP.toast('✅ ویدیو ساخته شد!');
      APP.vibrate(40);

    } catch (err) {
      console.error('video error:', err);
      var msg = err.message || 'خطای ناشناخته';
      if (msg.length > 100) msg = msg.substring(0, 100) + '...';
      APP.showError('videoResult', 'خطا در ساخت ویدیو: ' + msg);
      APP.toast('❌ خطا');
      APP.vibrate(50);
    } finally {
      btn.disabled = false;
    }
  },

  // ============ دانلود ============
  download: function() {
    if (!this._lastUrl) return;
    APP.downloadFile(this._lastUrl, 'setareh-video-' + Date.now() + '.mp4');
    APP.vibrate(20);
  },

  // ============ کپی ============
  copy: function() {
    if (!this._lastUrl) return;
    APP.copyUrl(this._lastUrl);
    APP.vibrate(20);
  }
};

window.VIDEO = VIDEO;
