// ===== js/tts.js — تبدیل متن به صدا (Google TTS + Web Speech) =====

var TTS = {
  _audios: [],
  _playing: false,
  _voicesReady: false,
  _cachedVoices: [],

  MAX_CHUNK: 180,

  init: function() {
    var self = this;

    var btn = document.getElementById('ttsBtn');
    if (btn) btn.addEventListener('click', function() { self._onClick(); });

    if ('speechSynthesis' in window) {
      this._loadVoices();
      window.speechSynthesis.onvoiceschanged = function() { self._loadVoices(); };
    }

    console.log('🔊 TTS: آماده');
  },

  _loadVoices: function() {
    try {
      this._cachedVoices = window.speechSynthesis.getVoices() || [];
      this._voicesReady = this._cachedVoices.length > 0;
    } catch(e) {}
  },

  _onClick: function() {
    var text = (document.getElementById('ttsText') || {}).value || '';
    text = text.trim();

    if (!text) {
      APP.toast('اول متن رو بنویس');
      APP.vibrate(30);
      return;
    }

    if (text.length > 2000) {
      APP.toast('متن طولانیه (حداکثر ۲۰۰۰ کاراکتر)');
      return;
    }

    this._stopAll();
    APP.vibrate(20);

    var result = document.getElementById('ttsResult');
    var chunks = this._splitText(text);

    result.innerHTML = '<div style="padding:24px;text-align:center;">' +
      '<div class="loading-dots" style="margin-bottom:12px;">' +
        '<span></span><span></span><span></span><span></span>' +
      '</div>' +
      '<div style="color:var(--text);font-weight:700;font-size:14px;">در حال آماده‌سازی...</div>' +
      '</div>';

    this._playGoogle(chunks, result);
  },

  // ============ Google Translate TTS ============
  _playGoogle: function(chunks, result) {
    var self = this;
    var urls = chunks.map(function(c) { return self._buildUrl(c); });

    this._testUrl(urls[0]).then(function(ok) {
      if (!ok) {
        self._playWebSpeech(chunks, result);
        return;
      }
      self._startPlayback(urls, result);
    }).catch(function() {
      self._playWebSpeech(chunks, result);
    });
  },

  _buildUrl: function(text) {
    return 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fa&q=' +
      encodeURIComponent(text);
  },

  _testUrl: function(url) {
    return new Promise(function(resolve) {
      var audio = new Audio();
      audio.preload = 'auto';
      var resolved = false;

      var done = function(ok) {
        if (resolved) return;
        resolved = true;
        resolve(ok);
      };

      var timer = setTimeout(function() { done(false); }, 4000);

      audio.oncanplaythrough = function() {
        clearTimeout(timer);
        done(true);
      };

      audio.onerror = function() {
        clearTimeout(timer);
        done(false);
      };

      try {
        audio.src = url;
        audio.load();
      } catch(e) {
        done(false);
      }
    });
  },

  _startPlayback: function(urls, result) {
    var self = this;
    self._playing = true;
    self._audios = [];

    result.innerHTML = self._playingUI('پخش صدا');

    var stopBtn = document.getElementById('ttsStopBtn');
    if (stopBtn) {
      stopBtn.onclick = function() { self._stopAll(); self._idleUI(result); };
    }

    var i = 0;
    var next = function() {
      if (!self._playing) return;
      if (i >= urls.length) {
        self._playing = false;
        self._idleUI(result);
        APP.toast('✅ پخش تمام شد');
        return;
      }

      var audio = new Audio(urls[i]);
      self._audios.push(audio);

      audio.onended = function() {
        i++;
        next();
      };

      audio.onerror = function() {
        i++;
        next();
      };

      audio.play().catch(function(err) {
        console.warn('play error:', err);
        i++;
        next();
      });
    };

    next();
  },

  _playingUI: function(title) {
    return '<div style="padding:24px 20px;text-align:center;">' +
      '<div style="font-size:56px;margin-bottom:12px;animation:float 2s ease-in-out infinite;">🔊</div>' +
      '<div style="color:var(--text);font-weight:800;font-size:16px;margin-bottom:20px;">' +
        title +
      '</div>' +
      '<button id="ttsStopBtn" class="result-btn" style="flex:0 0 auto;padding:12px 32px;margin:0 auto;display:inline-flex;">' +
        '⏹ توقف' +
      '</button>' +
      '</div>';
  },

  _idleUI: function(result) {
    result.innerHTML = '<div style="padding:20px;text-align:center;">' +
      '<div style="font-size:48px;margin-bottom:10px;">✅</div>' +
      '<div style="color:var(--text-2);font-size:13px;">برای پخش دوباره، روی دکمه بزن</div>' +
      '</div>';
  },

  // ============ Web Speech (Fallback) ============
  _playWebSpeech: function(chunks, result) {
    if (!('speechSynthesis' in window)) {
      APP.showError('ttsResult', 'مرورگرت پشتیبانی نمی‌کنه');
      return;
    }

    var self = this;
    this._playing = true;

    if (!this._voicesReady) this._loadVoices();

    var faVoice = this._cachedVoices.find(function(v) {
      return v.lang && v.lang.toLowerCase().indexOf('fa') === 0;
    });

    result.innerHTML = this._playingUI('پخش (Web Speech)') +
      (faVoice ? '' : '<div style="color:var(--text-3);font-size:11px;margin-top:8px;">صدای فارسی نبود — از صدای انگلیسی استفاده می‌شه</div>');

    var stopBtn = document.getElementById('ttsStopBtn');
    if (stopBtn) {
      stopBtn.onclick = function() {
        self._stopAll();
        self._idleUI(result);
      };
    }

    try { speechSynthesis.cancel(); } catch(e) {}

    var i = 0;
    var next = function() {
      if (!self._playing) return;
      if (i >= chunks.length) {
        self._playing = false;
        self._idleUI(result);
        APP.toast('✅ پخش تمام شد');
        return;
      }

      var u = new SpeechSynthesisUtterance(chunks[i]);
      u.lang = 'fa-IR';
      u.rate = 0.95;
      u.pitch = 1;

      if (faVoice) u.voice = faVoice;

      u.onend = function() { i++; next(); };
      u.onerror = function() { i++; next(); };

      try {
        speechSynthesis.speak(u);
      } catch(e) {
        i++;
        next();
      }
    };

    setTimeout(next, 150);
  },

  _stopAll: function() {
    this._playing = false;

    if (this._audios) {
      this._audios.forEach(function(a) {
        try { a.pause(); a.src = ''; } catch(e) {}
      });
      this._audios = [];
    }

    try { speechSynthesis.cancel(); } catch(e) {}
  },

  _splitText: function(text) {
    var parts = text.match(/[^.!?؟،\n]+[.!?؟،\n]?/g) || [text];
    var chunks = [];
    var current = '';

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;

      if ((current + ' ' + p).length <= this.MAX_CHUNK) {
        current = current ? (current + ' ' + p) : p;
      } else {
        if (current) chunks.push(current);

        if (p.length <= this.MAX_CHUNK) {
          current = p;
        } else {
          for (var j = 0; j < p.length; j += this.MAX_CHUNK) {
            chunks.push(p.substring(j, j + this.MAX_CHUNK));
          }
          current = '';
        }
      }
    }

    if (current) chunks.push(current);
    return chunks.length ? chunks : [text.substring(0, this.MAX_CHUNK)];
  }
};

window.TTS = TTS;
