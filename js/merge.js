// ===== js/merge.js — ترکیب ویدیوها =====

var MERGE = {
  _files: [],       // ویدیوهای انتخاب‌شده
  _lastUrl: null,
  _blob: null,

  init: function() {
    var input = document.getElementById('mergeInput');
    if (input) {
      input.addEventListener('change', this.onFilesSelect.bind(this));
    }

    var btn = document.getElementById('mergeBtn');
    if (btn) {
      btn.addEventListener('click', this.merge.bind(this));
    }

    console.log('🎞️ MERGE: آماده');
  },

  // ============ انتخاب فایل‌ها ============
  onFilesSelect: function(e) {
    var files = Array.from(e.target.files || []);
    if (!files.length) return;

    var self = this;
    files.forEach(function(f) {
      // چک کن ویدیو باشه
      if (!f.type.startsWith('video/')) return;
      // چک کن تکراری نباشه
      if (self._files.find(function(x) { return x.name === f.name && x.size === f.size; })) return;
      self._files.push(f);
    });

    this.renderList();
    APP.vibrate(20);
  },

  // ============ رندر لیست ============
  renderList: function() {
    var box = document.getElementById('mergePreview');
    if (!box) return;

    if (!this._files.length) {
      box.innerHTML = '';
      return;
    }

    var self = this;
    box.innerHTML = '';
    this._files.forEach(function(f, idx) {
      var item = document.createElement('div');
      item.className = 'merge-item';

      var video = document.createElement('video');
      video.src = URL.createObjectURL(f);
      video.muted = true;
      video.playsInline = true;
      item.appendChild(video);

      var rm = document.createElement('button');
      rm.className = 'rm-btn';
      rm.textContent = '✕';
      rm.onclick = function() {
        self.removeFile(idx);
      };
      item.appendChild(rm);

      box.appendChild(item);
    });
  },

  // ============ حذف فایل ============
  removeFile: function(idx) {
    this._files.splice(idx, 1);
    this.renderList();
    APP.vibrate(15);
  },

  // ============ ترکیب ============
  merge: async function() {
    if (this._files.length < 2) {
      APP.toast('❌ حداقل ۲ ویدیو انتخاب کن');
      APP.vibrate(30);
      return;
    }

    var btn = document.getElementById('mergeBtn');
    var result = document.getElementById('mergeResult');

    btn.disabled = true;
    APP.vibrate(20);

    result.innerHTML = '<div class="loading">' +
      '<div class="spinner"></div>' +
      '<div>🎞️ در حال ترکیب...</div>' +
      '<div style="font-size:11px;opacity:.6;">ممکنه چند دقیقه طول بکشه</div>' +
      '</div>';

    try {
      var self = this;

      // ساخت ویدیوهای قابل پخش
      var videos = await this._loadVideos(this._files);

      // ابعاد بر اساس اولین ویدیو
      var W = videos[0].videoWidth || 640;
      var H = videos[0].videoHeight || 360;

      // ساخت canvas
      var canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');

      // ضبط از canvas
      var stream = canvas.captureStream(30);

      // اضافه کردن صدا
      var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var audioDest = audioCtx.createMediaStreamDestination();

      // اگه مرورگر از صدا پشتیبانی کنه
      try {
        videos.forEach(function(v) {
          try {
            var src = audioCtx.createMediaElementSource(v);
            src.connect(audioDest);
          } catch(e) {}
        });

        if (audioDest.stream.getAudioTracks().length) {
          audioDest.stream.getAudioTracks().forEach(function(track) {
            stream.addTrack(track);
          });
        }
      } catch(e) {
        console.warn('audio merge skipped:', e);
      }

      // فرمت
      var mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      var recorder = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: 2500000 });
      var chunks = [];

      recorder.ondataavailable = function(e) {
        if (e.data.size > 0) chunks.push(e.data);
      };

      var donePromise = new Promise(function(resolve) {
        recorder.onstop = function() { resolve(); };
      });

      recorder.start(100);

      // پخش و رکورد هر ویدیو
      for (var i = 0; i < videos.length; i++) {
        await this._playAndRecord(videos[i], ctx, W, H);
      }

      recorder.stop();
      await donePromise;

      // ساخت blob
      var blob = new Blob(chunks, { type: 'video/webm' });
      this._blob = blob;
      var url = URL.createObjectURL(blob);
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

      var actions = document.createElement('div');
      actions.className = 'result-actions';
      actions.innerHTML =
        '<button class="result-btn" onclick="MERGE.download()">' +
          '<span>💾</span><span>دانلود</span>' +
        '</button>' +
        '<button class="result-btn" onclick="MERGE.clear()">' +
          '<span>🗑️</span><span>پاک کردن</span>' +
        '</button>';
      result.appendChild(actions);

      // پاک کردن لیست
      this._files = [];
      this.renderList();

      APP.toast('✅ ترکیب انجام شد!');
      APP.vibrate(50);

    } catch (err) {
      console.error('merge error:', err);
      var msg = err.message || 'خطای ناشناخته';
      APP.showError('mergeResult', 'خطا در ترکیب: ' + msg);
      APP.toast('❌ خطا');
      APP.vibrate(50);
    } finally {
      btn.disabled = false;
    }
  },

  // ============ لود ویدیوها ============
  _loadVideos: function(files) {
    return Promise.all(files.map(function(f) {
      return new Promise(function(resolve, reject) {
        var v = document.createElement('video');
        v.src = URL.createObjectURL(f);
        v.muted = false;
        v.playsInline = true;
        v.preload = 'auto';

        var timeout = setTimeout(function() {
          reject(new Error('لود ویدیو طول کشید'));
        }, 15000);

        v.onloadedmetadata = function() {
          clearTimeout(timeout);
          resolve(v);
        };
        v.onerror = function() {
          clearTimeout(timeout);
          reject(new Error('خطا در لود ویدیو'));
        };
      });
    }));
  },

  // ============ پخش و رکورد یه ویدیو ============
  _playAndRecord: function(video, ctx, W, H) {
    return new Promise(function(resolve) {
      video.currentTime = 0;
      video.muted = false;

      var drawLoop = function() {
        if (video.paused || video.ended) return;
        try {
          ctx.drawImage(video, 0, 0, W, H);
        } catch(e) {}
        requestAnimationFrame(drawLoop);
      };

      video.onplay = function() { drawLoop(); };
      video.onended = function() {
        // آخرین فریم
        try { ctx.drawImage(video, 0, 0, W, H); } catch(e) {}
        resolve();
      };

      video.play().catch(function(err) {
        console.warn('play error:', err);
        resolve();
      });
    });
  },

  // ============ دانلود ============
  download: function() {
    if (!this._blob) return;
    var url = URL.createObjectURL(this._blob);
    APP.downloadFile(url, 'setareh-merged-' + Date.now() + '.webm');
    APP.vibrate(20);
    setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
  },

  // ============ پاک کردن ============
  clear: function() {
    this._files = [];
    this._lastUrl = null;
    this._blob = null;
    this.renderList();
    var result = document.getElementById('mergeResult');
    if (result) result.innerHTML = '';
    var input = document.getElementById('mergeInput');
    if (input) input.value = '';
    APP.vibrate(15);
  }
};

window.MERGE = MERGE;
