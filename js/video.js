// ===== js/video.js — ساخت ویدیو با Agnes AI =====

var VIDEO = {
  _mode: 'text',
  _file: null,
  _lastUrl: null,
  _loader: null,
  _apiKey: '',
  _pollTimer: null,
  _videoId: null,

  API_BASE: 'https://apihub.agnes-ai.com/v1',
  MODEL: 'agnes-video-v2.0',

  init: function() {
    var self = this;

    this._apiKey = localStorage.getItem('agnes_api_key') || '';

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

    if (!this._apiKey) {
      this._showApiKeyForm();
    }

    console.log('🎬 VIDEO: آماده (Agnes AI)');
  },

  // ============ فرم API Key ============
  _showApiKeyForm: function() {
    var result = document.getElementById('videoResult');
    if (!result) return;

    result.innerHTML =
      '<div style="padding:20px;background:var(--bg-2);border:1px solid var(--border);border-radius:16px;">' +
        '<div style="font-weight:800;font-size:15px;color:var(--text);margin-bottom:8px;">🔑 تنظیم API Key</div>' +
        '<div style="font-size:13px;color:var(--text-2);line-height:1.7;margin-bottom:12px;">' +
          'برای ساخت ویدیو، اول یه API Key رایگان از Agnes AI بگیر:' +
        '</div>' +
        '<div style="background:var(--bg-3);padding:10px;border-radius:10px;margin-bottom:10px;font-size:11px;color:var(--text-3);line-height:1.6;">' +
          '⚠️ برای دسترسی به Agnes باید VPN روشن باشه' +
        '</div>' +
        '<a href="https://platform.agnes-ai.com" target="_blank" style="display:block;text-align:center;padding:10px;background:var(--accent-grad);color:#fff;border-radius:12px;text-decoration:none;font-weight:700;font-size:13px;margin-bottom:10px;">' +
          '🔗 رفتن به Agnes AI' +
        '</a>' +
        '<input type="text" id="agnesKeyInput" placeholder="API Key رو اینجا پیست کن (sk-...)" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--bg-3);color:var(--text);font-family:monospace;font-size:11px;margin-bottom:10px;direction:ltr;text-align:center;box-sizing:border-box;" value="' + (this._apiKey || '') + '">' +
        '<button onclick="VIDEO.saveApiKey()" style="width:100%;padding:12px;background:var(--accent-grad);color:#fff;border:none;border-radius:12px;font-family:inherit;font-weight:700;font-size:14px;cursor:pointer;">' +
          'ذخیره' +
        '</button>' +
      '</div>';
  },

  saveApiKey: function() {
    var input = document.getElementById('agnesKeyInput');
    if (!input) return;
    var key = (input.value || '').trim();
    if (!key || key.length < 10) {
      APP.toast('❌ API Key معتبر نیست');
      return;
    }
    localStorage.setItem('agnes_api_key', key);
    this._apiKey = key;
    APP.toast('✅ ذخیره شد');
    APP.vibrate(30);
    var result = document.getElementById('videoResult');
    if (result) result.innerHTML = '';
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
      APP.toast('عکس بزرگه');
      return;
    }
    this._file = file;
    var preview = document.getElementById('videoImagePreview');
    var reader = new FileReader();
    reader.onload = function(ev) {
      preview.innerHTML = '<img src="' + ev.target.result + '" alt="preview">';
    };
    reader.readAsDataURL(file);
  },

  generate: async function() {
    var result = document.getElementById('videoResult');
    var btn = document.getElementById('videoBtn');

    if (!this._apiKey) {
      this._showApiKeyForm();
      APP.toast('اول API Key رو وارد کن');
      return;
    }

    var promptText = (document.getElementById('videoPrompt') || {}).value || '';
    promptText = promptText.trim();

    if (!promptText) {
      APP.toast('اول متن رو بنویس');
      APP.vibrate(30);
      return;
    }

    btn.disabled = true;
    APP.vibrate(20);

    setTimeout(function() {
      if (result) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    this._loader = APP.startLoading('videoResult', {
      title: 'در حال ارسال درخواست...',
      sub: 'ممکنه ۱ تا ۳ دقیقه طول بکشه',
      duration: 180000,
      maxReal: 90
    });

    try {
      // ============ ۱. ایجاد درخواست ============
      var createRes = await fetch(this.API_BASE + '/videos/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this._apiKey
        },
        body: JSON.stringify({
          model: this.MODEL,
          prompt: promptText,
          duration: 5,
          aspect_ratio: '16:9'
        })
      });

      if (!createRes.ok) {
        var errData = await createRes.json().catch(function() { return {}; });
        var errMsg = 'خطا ' + createRes.status;
        if (errData && errData.error) {
          errMsg = errData.error.message || errData.error;
        } else if (errData && errData.message) {
          errMsg = errData.message;
        }
        throw new Error(errMsg);
      }

      var createData = await createRes.json();
      console.log('Task created:', createData);

      var videoId = createData.id || createData.video_id || createData.task_id || (createData.data && createData.data.id);
      if (!videoId) throw new Error('شناسهٔ ویدیو دریافت نشد');

      this._videoId = videoId;

      if (this._loader) {
        this._loader.setTitle('در حال پردازش...');
        this._loader.setSub('ممکنه ۱ تا ۳ دقیقه طول بکشه');
        this._loader.setProgress(20);
      }

      // ============ ۲. Polling ============
      var videoUrl = await this._pollVideoStatus(videoId);

      if (!videoUrl) throw new Error('ویدیو آماده نشد');

      this._lastUrl = videoUrl;

      if (this._loader) {
        this._loader.setTitle('تمام شد!');
        this._loader.finish();
      }
      await this._delay(500);

      this._showResult(result, videoUrl);

      APP.toast('ویدیو ساخته شد');
      APP.vibrate(40);

    } catch (err) {
      console.error('video error:', err);
      if (this._loader) this._loader.stop();
      var msg = err.message || 'خطای ناشناخته';
      if (msg.length > 120) msg = msg.substring(0, 120) + '...';
      APP.showError('videoResult',
        '⚠️ ' + msg + '\n\n' +
        'راه‌حل:\n' +
        '• VPN رو روشن کن\n' +
        '• API Key رو چک کن\n' +
        '• بعداً دوباره امتحان کن');
      APP.toast('خطا');
      APP.vibrate(50);
    } finally {
      btn.disabled = false;
      this._loader = null;
      this._clearTimers();
    }
  },

  _pollVideoStatus: async function(videoId) {
    var self = this;
    var maxAttempts = 40;
    var attempt = 0;

    return new Promise(function(resolve, reject) {
      var poll = async function() {
        attempt++;

        if (attempt > maxAttempts) {
          reject(new Error('زمان ساخت ویدیو تموم شد'));
          return;
        }

        try {
          var res = await fetch(self.API_BASE + '/videos/generations/' + videoId, {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer ' + self._apiKey
            }
          });

          if (!res.ok) {
            if (res.status === 404 || res.status === 400) {
              self._pollTimer = setTimeout(poll, 5000);
              return;
            }
            throw new Error('خطا در بررسی وضعیت');
          }

          var data = await res.json();
          console.log('Poll #' + attempt + ':', data.status || data.state);

          var progress = 20 + Math.min(65, (attempt / maxAttempts) * 65);
          if (self._loader) {
            self._loader.setProgress(progress);
            self._loader.setTitle('در حال پردازش...');
            self._loader.setSub('ممکنه ۱ تا ۳ دقیقه طول بکشه');
          }

          var status = data.status || data.state;

          if (status === 'completed' || status === 'succeeded' || status === 'success') {
            var url = data.video_url || data.url || (data.output && data.output[0]) || (data.data && data.data[0] && data.data[0].url);
            if (url) {
              resolve(url);
              return;
            }
          }

          if (status === 'failed' || status === 'error') {
            var errMsg = data.error || (data.error_message) || 'ساخت ویدیو شکست خورد';
            reject(new Error(errMsg));
            return;
          }

          self._pollTimer = setTimeout(poll, 5000);

        } catch (err) {
          console.warn('Poll error:', err);
          self._pollTimer = setTimeout(poll, 5000);
        }
      };

      poll();
    });
  },

  _clearTimers: function() {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
  },

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

    setTimeout(function() {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
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
