// ===== js/video.js — ساخت ویدیو از عکس‌های AI =====

var VIDEO = {
  _lastBlob: null,
  _lastUrl: null,
  _loader: null,
  _cancelled: false,

  STYLE: 'cinematic, photorealistic, highly detailed, 4k, dramatic lighting, film grain',

  VARIATIONS: [
    'cinematic wide establishing shot',
    'extreme close-up detail shot',
    'dramatic low angle shot',
    'aerial drone view from above',
    'atmospheric medium shot',
    'artistic bokeh shot'
  ],

  DIRECTIONS: ['zoom-in', 'pan-right', 'zoom-out', 'pan-left', 'zoom-in', 'pan-up'],

  IMAGE_COUNT: 6,
  IMAGE_DURATION: 3000,

  init: function() {
    var self = this;
    var btn = document.getElementById('videoBtn');
    if (btn) btn.addEventListener('click', function() { self.generate(); });

    var prompt = document.getElementById('videoPrompt');
    if (prompt) {
      prompt.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          self.generate();
        }
      });
    }

    document.querySelectorAll('.tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        APP.toast('فعلاً فقط از متن');
      });
    });

    console.log('🎬 VIDEO: آماده');
  },

  generate: async function() {
    if (this._cancelled) return;

    var prompt = (document.getElementById('videoPrompt') || {}).value || '';
    prompt = prompt.trim();

    if (!prompt) {
      APP.toast('اول متن رو بنویس');
      APP.vibrate(30);
      return;
    }

    if (typeof puter === 'undefined' || !puter.ai) {
      APP.toast('اتصال برقرار نیست');
      return;
    }

    var btn = document.getElementById('videoBtn');
    var result = document.getElementById('videoResult');

    btn.disabled = true;
    this._cancelled = false;
    this._lastBlob = null;
    this._lastUrl = null;
    APP.vibrate(20);

    setTimeout(function() {
      if (result) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    this._loader = APP.startLoading('videoResult', {
      title: 'در حال ساخت عکس‌ها...',
      sub: 'چند تا عکس با زوایای مختلف می‌سازیم',
      duration: 120000,
      maxReal: 50
    });

    try {
      var imageUrls = await this._generateImages(prompt);
      if (this._cancelled) return;
      if (!imageUrls.length) throw new Error('هیچ عکسی ساخته نشد. دوباره امتحان کن.');

      if (this._loader) {
        this._loader.setTitle('در حال ساخت ویدیو...');
        this._loader.setSub('عکس‌ها به هم چسبانده می‌شن');
        this._loader.setProgress(55);
      }

      var blob = await this._createVideo(imageUrls);
      if (this._cancelled) return;
      if (!blob) throw new Error('ویدیو ساخته نشد');

      this._lastBlob = blob;
      this._lastUrl = URL.createObjectURL(blob);

      if (this._loader) {
        this._loader.setTitle('تمام شد!');
        this._loader.finish();
      }
      await this._delay(500);

      this._showResult(this._lastUrl);

      APP.toast('✅ ویدیو ساخته شد!');
      APP.vibrate(50);

    } catch (err) {
      console.error('video error:', err);
      if (this._loader) this._loader.stop();
      var msg = err.message || 'خطای ناشناخته';
      if (msg.length > 100) msg = msg.substring(0, 100) + '...';
      APP.showError('videoResult', '❌ ' + msg);
      APP.toast('خطا');
      APP.vibrate(50);
    } finally {
      btn.disabled = false;
      this._loader = null;
    }
  },

  _generateImages: async function(userPrompt) {
    var urls = [];
    var total = this.IMAGE_COUNT;

    for (var i = 0; i < total; i++) {
      if (this._cancelled) break;

      if (this._loader) {
        this._loader.setTitle('ساخت عکس ' + (i + 1) + ' از ' + total);
        this._loader.setSub(this.VARIATIONS[i % this.VARIATIONS.length]);
        var p = (i / total) * 50;
        this._loader.setProgress(p);
      }

      var fullPrompt = this.VARIATIONS[i % this.VARIATIONS.length] +
        ' of ' + userPrompt + ', ' + this.STYLE;

      try {
        var el = await puter.ai.txt2img(fullPrompt);
        var url = this._extractUrl(el);
        if (url) urls.push(url);
      } catch(e) {
        console.warn('image ' + (i+1) + ' failed:', e);
      }
    }

    return urls;
  },

  _createVideo: async function(imageUrls) {
    var images = [];
    for (var i = 0; i < imageUrls.length; i++) {
      if (this._cancelled) break;
      try {
        var img = await this._loadImage(imageUrls[i]);
        images.push(img);
      } catch(e) {
        console.warn('load image failed:', e);
      }
    }

    if (!images.length) throw new Error('عکس‌ها لود نشدند');

    var W = 1280, H = 720;
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');

    var stream = canvas.captureStream(30);

    var mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

    var recorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 4000000
    });

    var chunks = [];
    recorder.ondataavailable = function(e) {
      if (e.data.size > 0) chunks.push(e.data);
    };

    var donePromise = new Promise(function(resolve) {
      recorder.onstop = resolve;
    });

    recorder.start(100);

    var total = images.length;
    for (var j = 0; j < total; j++) {
      if (this._cancelled) break;
      var img = images[j];
      var direction = this.DIRECTIONS[j % this.DIRECTIONS.length];
      await this._animateKenBurns(ctx, img, W, H, this.IMAGE_DURATION, direction);
      var p = 55 + ((j + 1) / total) * 40;
      if (this._loader) this._loader.setProgress(p);
    }

    await this._delay(300);

    recorder.stop();
    await donePromise;

    return new Blob(chunks, { type: 'video/webm' });
  },

  _loadImage: function(url) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      var timeout = setTimeout(function() {
        reject(new Error('زمان لود عکس تموم شد'));
      }, 15000);
      img.onload = function() {
        clearTimeout(timeout);
        resolve(img);
      };
      img.onerror = function() {
        clearTimeout(timeout);
        reject(new Error('خطا در لود عکس'));
      };
      img.src = url;
    });
  },

  _animateKenBurns: function(ctx, img, W, H, duration, direction) {
    var self = this;
    return new Promise(function(resolve) {
      var startTime = performance.now();
      var baseScale = Math.max(W / img.width, H / img.height);

      var zoomFrom = 1.0, zoomTo = 1.0;
      var panXFrom = 0, panXTo = 0;
      var panYFrom = 0, panYTo = 0;

      if (direction === 'zoom-in') { zoomFrom = 1.0; zoomTo = 1.22; }
      else if (direction === 'zoom-out') { zoomFrom = 1.22; zoomTo = 1.0; }
      else if (direction === 'pan-left') { zoomFrom = 1.18; zoomTo = 1.18; panXFrom = 0.7; panXTo = -0.7; }
      else if (direction === 'pan-right') { zoomFrom = 1.18; zoomTo = 1.18; panXFrom = -0.7; panXTo = 0.7; }
      else if (direction === 'pan-up') { zoomFrom = 1.18; zoomTo = 1.18; panYFrom = 0.7; panYTo = -0.7; }
      else if (direction === 'pan-down') { zoomFrom = 1.18; zoomTo = 1.18; panYFrom = -0.7; panYTo = 0.7; }

      var draw = function() {
        if (self._cancelled) { resolve(); return; }

        var elapsed = performance.now() - startTime;
        var t = Math.min(1, elapsed / duration);
        var st = t * t * (3 - 2 * t);

        var zoom = zoomFrom + (zoomTo - zoomFrom) * st;
        var scale = baseScale * zoom;

        var drawW = img.width * scale;
        var drawH = img.height * scale;

        var maxPanX = Math.max(0, (drawW - W) / 2);
        var maxPanY = Math.max(0, (drawH - H) / 2);

        var panX = (panXFrom + (panXTo - panXFrom) * st) * maxPanX;
        var panY = (panYFrom + (panYTo - panYFrom) * st) * maxPanY;

        var x = (W - drawW) / 2 + panX;
        var y = (H - drawH) / 2 + panY;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        try {
          ctx.drawImage(img, x, y, drawW, drawH);
        } catch(e) {
          console.warn('draw error:', e);
        }

        if (elapsed < duration) {
          requestAnimationFrame(draw);
        } else {
          resolve();
        }
      };

      draw();
    });
  },

  _showResult: function(url) {
    var container = document.getElementById('videoResult');
    if (!container) return;

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

    var ag = document.createElement('button');
    ag.className = 'result-btn';
    ag.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> دوباره';
    ag.onclick = function() { VIDEO.generate(); };
    actions.appendChild(ag);

    container.appendChild(actions);

    setTimeout(function() {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  },

  _extractUrl: function(el) {
    if (!el) return null;
    if (typeof el === 'string') return el;
    if (el.src) return el.src;
    if (el.url) return el.url;
    if (el.querySelector) {
      var img = el.querySelector('img');
      if (img) return img.src;
    }
    return null;
  },

  download: function() {
    if (!this._lastBlob) return;
    var url = URL.createObjectURL(this._lastBlob);
    APP.downloadFile(url, 'setareh-video-' + Date.now() + '.webm');
    setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
  },

  _delay: function(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }
};

window.VIDEO = VIDEO;
