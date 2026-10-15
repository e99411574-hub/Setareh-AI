// ===== js/merge.js — ترکیب ویدیوها =====

var MERGE = {
  _files: [],
  _lastUrl: null,
  _blob: null,
  _loader: null,

  init: function() {
    var self = this;

    var input = document.getElementById('mergeInput');
    if (input) input.addEventListener('change', function(e) { self.onFilesSelect(e); });

    var btn = document.getElementById('mergeBtn');
    if (btn) btn.addEventListener('click', function() { self.merge(); });

    console.log('🎞️ MERGE: آماده');
  },

  onFilesSelect: function(e) {
    var files = Array.from(e.target.files || []);
    if (!files.length) return;
    var self = this;
    files.forEach(function(f) {
      if (!f.type.startsWith('video/')) return;
      if (self._files.find(function(x) { return x.name === f.name && x.size === f.size; })) return;
      self._files.push(f);
    });
    this.renderList();
    APP.vibrate(20);
  },

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

      var v = document.createElement('video');
      v.src = URL.createObjectURL(f);
      v.muted = true;
      v.playsInline = true;
      item.appendChild(v);

      var rm = document.createElement('button');
      rm.className = 'rm-btn';
      rm.textContent = '✕';
      rm.onclick = function() { self.removeFile(idx); };
      item.appendChild(rm);

      box.appendChild(item);
    });
  },

  removeFile: function(idx) {
    this._files.splice(idx, 1);
    this.renderList();
    APP.vibrate(15);
  },

  merge: async function() {
    if (this._files.length < 2) {
      APP.toast('حداقل ۲ ویدیو انتخاب کن');
      APP.vibrate(30);
      return;
    }

    var btn = document.getElementById('mergeBtn');
    var result = document.getElementById('mergeResult');

    btn.disabled = true;
    APP.vibrate(20);

    this._loader = APP.startLoading('mergeResult', {
      title: 'در حال ترکیب...',
      sub: 'ممکنه چند دقیقه طول بکشه',
      duration: 120000
    });

    try {
      var videos = await this._loadVideos(this._files);
      if (this._loader) this._loader.setProgress(20);

      var W = videos[0].videoWidth || 640;
      var H = videos[0].videoHeight || 360;

      var canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');

      var stream = canvas.captureStream(30);

      var audioCtx = null;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var audioDest = audioCtx.createMediaStreamDestination();
        videos.forEach(function(v) {
          try {
            var src = audioCtx.createMediaElementSource(v);
            src.connect(audioDest);
          } catch(e) {}
        });
        if (audioDest.stream.getAudioTracks().length) {
          audioDest.stream.getAudioTracks().forEach(function(t) {
            stream.addTrack(t);
          });
        }
      } catch(e) { console.warn('audio merge skipped:', e); }

      var mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

      var recorder = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: 2500000 });
      var chunks = [];
      recorder.ondataavailable = function(e) {
        if (e.data.size > 0) chunks.push(e.data);
      };
      var donePromise = new Promise(function(resolve) { recorder.onstop = resolve; });
      recorder.start(100);

      var total = videos.length;
      for (var i = 0; i < total; i++) {
        if (this._loader) {
          this._loader.setProgress(20 + ((i / total) * 70));
          this._loader.setTitle('ترکیب ویدیو ' + (i + 1) + ' از ' + total + '...');
        }
        await this._playAndRecord(videos[i], ctx, W, H);
      }

      recorder.stop();
      await donePromise;

      if (this._loader) this._loader.setProgress(95);

      var blob = new Blob(chunks, { type: 'video/webm' });
      this._blob = blob;
      var url = URL.createObjectURL(blob);
      this._lastUrl = url;

      if (this._loader) {
        this._loader.setTitle('تمام شد!');
        this._loader.finish();
      }
      await this._delay(400);

      // نمایش
      result.innerHTML = '';
      var v = document.createElement('video');
      v.src = url;
      v.controls = true;
      v.autoplay = true;
      v.loop = true;
      v.playsInline = true;
      result.appendChild(v);

      var actions = document.createElement('div');
      actions.className = 'result-actions';

      var dl = document.createElement('button');
      dl.className = 'result-btn';
      dl.textContent = 'دانلود';
      dl.onclick = function() { MERGE.download(); };
      actions.appendChild(dl);

      var cl = document.createElement('button');
      cl.className = 'result-btn';
      cl.textContent = 'پاک کردن';
      cl.onclick = function() { MERGE.clear(); };
      actions.appendChild(cl);

      result.appendChild(actions);

      this._files = [];
      this.renderList();

      APP.toast('ترکیب انجام شد');
      APP.vibrate(50);

    } catch (err) {
      console.error('merge error:', err);
      if (this._loader) this._loader.stop();
      var msg = err.message || 'خطای ناشناخته';
      APP.showError('mergeResult', 'خطا در ترکیب: ' + msg);
      APP.toast('خطا');
      APP.vibrate(50);
    } finally {
      btn.disabled = false;
      this._loader = null;
    }
  },

  _loadVideos: function(files) {
    return Promise.all(files.map(function(f) {
      return new Promise(function(resolve, reject) {
        var v = document.createElement('video');
        v.src = URL.createObjectURL(f);
        v.muted = false;
        v.playsInline = true;
        v.preload = 'auto';

        var timeout = setTimeout(function() { reject(new Error('لود طول کشید')); }, 15000);
        v.onloadedmetadata = function() { clearTimeout(timeout); resolve(v); };
        v.onerror = function() { clearTimeout(timeout); reject(new Error('خطا در لود ویدیو')); };
      });
    }));
  },

  _playAndRecord: function(video, ctx, W, H) {
    return new Promise(function(resolve) {
      video.currentTime = 0;
      video.muted = false;
      var drawLoop = function() {
        if (video.paused || video.ended) return;
        try { ctx.drawImage(video, 0, 0, W, H); } catch(e) {}
        requestAnimationFrame(drawLoop);
      };
      video.onplay = function() { drawLoop(); };
      video.onended = function() {
        try { ctx.drawImage(video, 0, 0, W, H); } catch(e) {}
        resolve();
      };
      video.play().catch(function(err) { console.warn('play:', err); resolve(); });
    });
  },

  download: function() {
    if (!this._blob) return;
    var url = URL.createObjectURL(this._blob);
    APP.downloadFile(url, 'setareh-merged-' + Date.now() + '.webm');
    setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
  },

  clear: function() {
    this._files = [];
    this._lastUrl = null;
    this._blob = null;
    this.renderList();
    var r = document.getElementById('mergeResult');
    if (r) r.innerHTML = '';
    var inp = document.getElementById('mergeInput');
    if (inp) inp.value = '';
    APP.vibrate(15);
  },

  _delay: function(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }
};

window.MERGE = MERGE;
