// ===== js/video.js — ساخت ویدیو با هوش مصنوعی =====

var VIDEO = {
  _mode: 'text',
  _file: null,
  _lastUrl: null,
  _loader: null,

  init: function() {
    var self = this;

    // تب‌ها
    document.querySelectorAll('.tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var mode = this.getAttribute('data-mode');
        self.setMode(mode);
      });
    });

    var btn = document.getElementById('videoBtn');
    if (btn) btn.addEventListener('click', function() { self.generate(); });

    var fileInput = document.getElementById('videoImageInput');
    if (fileInput) {
      fileInput.addEventListener('change', function(e) { self.onFileSelect(e); });
    }

    var prompt = document.getElementById('videoPrompt');
    if (prompt) {
      prompt.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          self.generate();
        }
      });
    }

    console.log('🎬 VIDEO: آماده');
  },

  setMode: function(mode) {
    this._mode = mode;

    document.querySelectorAll('.tab').forEach(function(t) {
      if (t.getAttribute('data-mode') === mode) t.classList.add('active');
      else t.classList.remove('active');
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

  onFileSelect: function(e) {
    var file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      APP.toast('عکس بزرگه (حداکثر ۱۰MB)');
      return;
    }

    this._file = file;

    var preview = document.getElementById('videoImagePreview');
    var reader = new FileReader();
    reader.onload = function(ev) {
      preview.innerHTML = '<img src="' + ev.target.result + '" alt="preview">';
    };
    reader.readAsDataURL(file);

    APP.vibrate(20);
  },

  generate: async function() {
    var result = document.getElementById('videoResult');
    var btn = document.getElementById('videoBtn');

    if (typeof puter === 'undefined' || !puter.ai) {
      APP.toast('اتصال برقرار نیست');
      return;
    }

    var promptText = '';
    var imageFile = null;

    if (this._mode === 'text') {
      promptText = (document.getElementById('videoPrompt') || {}).value || '';
      promptText = promptText.trim();
      if (!promptText) {
        APP.toast('اول متن رو بنویس');
        APP.vibrate(30);
        return;
      }
    } else {
      if (!this._file) {
        APP.toast('اول یه عکس انتخاب کن');
        APP.vibrate(30);
        return;
      }
      imageFile = this._file;
      promptText = (document.getElementById('videoImagePrompt') || {}).value || '';
      promptText = promptText.trim();
    }

    btn.disabled = true;
    APP.vibrate(20);

    // لودینگ پویا
    this._loader = APP.startLoading('videoResult', {
      title: imageFile ? 'در حال تحلیل عکس...' : 'در حال ساخت ویدیو...',
      sub: 'ممکنه ۳۰ تا ۹۰ ثانیه طول بکشه',
      duration: 70000
    });

    try {
      var finalPrompt = promptText;

      // اگه عکس داشتیم، اول توصیفش کن
      if (imageFile) {
        try {
          if (this._loader) this._loader.setProgress(15);
          var description = await this._describeImage(imageFile);
          if (description) {
            finalPrompt = description;
            if (promptText) finalPrompt += '. ' + promptText;
            console.log('توصیف عکس:', description);
          }
        } catch(descErr) {
          console.warn('vision error:', descErr);
          finalPrompt = promptText || 'animated scene from this image';
        }

        if (this._loader) {
          this._loader.setTitle('در حال ساخت ویدیو...');
          this._loader.setSub('ممکنه ۳۰ تا ۹۰ ثانیه طول بکشه');
          this._loader.setProgress(25);
        }
      }

      // درخواست ویدیو
      var videoElement = await puter.ai.txt2vid(finalPrompt);

      // استخراج URL
      var url = this._extractUrl(videoElement);
      if (!url) throw new Error('ویدیویی تولید نشد');

      this._lastUrl = url;

      // پایان لودینگ
      if (this._loader) {
        this._loader.setTitle('تمام شد!');
        this._loader.finish();
      }
      await this._delay(400);

      // نمایش
      this._showResult(result, url);

      APP.toast('ویدیو ساخته شد');
      APP.vibrate(40);

    } catch (err) {
      console.error('video error:', err);
      if (this._loader) this._loader.stop();
      var msg = err.message || 'خطای ناشناخته';
      if (msg.length > 100) msg = msg.substring(0, 100) + '...';
      APP.showError('videoResult', 'خطا در ساخت ویدیو: ' + msg);
      APP.toast('خطا در ساخت');
      APP.vibrate(50);
    } finally {
      btn.disabled = false;
      this._loader = null;
    }
  },

  // ============ توصیف عکس با Vision ============
  _describeImage: async function(file) {
    try {
      var base64 = await new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      var response = await puter.ai.chat(
        'Describe this image in detail, in English, in about 40 words. Focus on subject, colors, lighting, mood, environment. Only return the description.',
        base64
      );

      var text = '';
      if (typeof response === 'string') text = response;
      else if (response && response.message && response.message.content) {
        var c = response.message.content;
        text = Array.isArray(c) ? c.map(function(x) { return x.text || x; }).join(' ') : c;
      } else if (response && response.text) text = response.text;
      else if (response && response.toString) text = response.toString();

      return (text || '').trim().substring(0, 300);
    } catch (e) {
      console.warn('describeImage error:', e);
      return null;
    }
  },

  // ============ استخراج URL ============
  _extractUrl: function(el) {
    if (!el) return null;
    if (typeof el === 'string') return el;
    if (el.src) return el.src;
    if (el.url) return el.url;
    if (el.querySelector) {
      var v = el.querySelector('video');
      if (v) return v.src;
      var s = el.querySelector('source');
      if (s) return s.src;
    }
    return null;
  },

  // ============ نمایش نتیجه ============
  _showResult: function(container, url) {
    container.innerHTML = '';

    var video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    container.appendChild(video);

    var actions = document.createElement('div');
    actions.className = 'result-actions';

    var dl = document.createElement('button');
    dl.className = 'result-btn';
    dl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> دانلود';
    dl.onclick = function() { VIDEO.download(); };
    actions.appendChild(dl);

    var cp = document.createElement('button');
    cp.className = 'result-btn';
    cp.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> کپی لینک';
    cp.onclick = function() { APP.copyUrl(VIDEO._lastUrl); };
    actions.appendChild(cp);

    container.appendChild(actions);
  },

  download: function() {
    if (!this._lastUrl) return;
    APP.downloadFile(this._lastUrl, 'setareh-video-' + Date.now() + '.mp4');
  },

  _delay: function(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }
};

window.VIDEO = VIDEO;
