// ===== js/tts.js — تبدیل متن به صدا (Puter + Web Speech) =====

var TTS = {
  _voice: 'nova',
  _speaking: false,
  _audioEl: null,
  _loading: false,

  init: function() {
    var self = this;

    document.querySelectorAll('.voice-opt').forEach(function(opt) {
      opt.addEventListener('click', function() {
        var voice = this.getAttribute('data-voice');
        self.setVoice(voice);
      });
    });

    var btn = document.getElementById('ttsBtn');
    if (btn) btn.addEventListener('click', function() { self.generate(); });

    // پیش‌لود صداهای Web Speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = function() {
        window.speechSynthesis.getVoices();
      };
    }

    console.log('🎵 TTS: آماده');
  },

  setVoice: function(voice) {
    this._voice = voice;
    document.querySelectorAll('.voice-opt').forEach(function(opt) {
      if (opt.getAttribute('data-voice') === voice) opt.classList.add('active');
      else opt.classList.remove('active');
    });
    APP.vibrate(15);
  },

  generate: async function() {
    var result = document.getElementById('ttsResult');
    var btn = document.getElementById('ttsBtn');
    var text = (document.getElementById('ttsText') || {}).value || '';
    text = text.trim();

    if (!text) {
      APP.toast('اول متن رو بنویس');
      APP.vibrate(30);
      return;
    }

    if (this._loading) return;
    this._loading = true;
    btn.disabled = true;
    APP.vibrate(20);

    // قطع پخش قبلی
    this._stopAll();

    // نمایش لودینگ
    result.innerHTML =
      '<div style="padding:24px 20px;text-align:center;">' +
        '<div class="loading-dots" style="margin-bottom:16px;">' +
          '<span></span><span></span><span></span><span></span>' +
        '</div>' +
        '<div style="color:var(--text);font-weight:700;font-size:14px;">' +
          'در حال ساخت صدا...' +
        '</div>' +
      '</div>';

    try {
      // ============ تلاش با Puter (کیفیت بالا) ============
      if (typeof puter !== 'undefined' && puter.ai && puter.ai.txt2speech) {
        try {
          var audioElement = await puter.ai.txt2speech(text, {
            voice: this._voice,
            engine: 'neural'
          });

          var url = null;
          if (typeof audioElement === 'string') url = audioElement;
          else if (audioElement && audioElement.src) url = audioElement.src;
          else if (audioElement && audioElement.url) url = audioElement.url;

          if (url) {
            this._showPuterAudio(result, url, text);
            APP.toast('صدا ساخته شد');
            APP.vibrate(30);
            return;
          }
        } catch (e) {
          console.warn('Puter TTS failed:', e);
          // برو به Web Speech
        }
      }

      // ============ Fallback: Web Speech API ============
      this._webSpeech(result, text);

    } catch (err) {
      console.error('tts error:', err);
      APP.showError('ttsResult', 'خطا در ساخت صدا');
      APP.toast('خطا');
    } finally {
      btn.disabled = false;
      this._loading = false;
    }
  },

  // ============ نمایش صدا Puter ============
  _showPuterAudio: function(result, url, text) {
    var self = this;

    result.innerHTML =
      '<div style="padding:20px;text-align:center;">' +
        '<div style="font-size:56px;margin-bottom:16px;">🔊</div>' +
        '<div style="color:var(--text);font-weight:800;font-size:15px;margin-bottom:20px;">' +
          'آماده پخش' +
        '</div>' +
        '<div id="ttsAudioWrap" style="margin-bottom:20px;"></div>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
          '<button class="result-btn" id="ttsPlayBtn" style="flex:0 0 auto;padding:12px 20px;">پخش</button>' +
          '<button class="result-btn" id="ttsDlBtn" style="flex:0 0 auto;padding:12px 20px;">دانلود</button>' +
          '<button class="result-btn" id="ttsAgainBtn" style="flex:0 0 auto;padding:12px 20px;">دوباره</button>' +
        '</div>' +
      '</div>';

    // Audio player (مخفی)
    var audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    self._audioEl = audio;

    // پخش اتوماتیک
    var playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(function(err) {
        console.warn('autoplay blocked:', err);
        APP.toast('برای پخش، دکمهٔ پخش رو بزن');
      });
    }

    // دکمه‌ها
    setTimeout(function() {
      var playBtn = document.getElementById('ttsPlayBtn');
      var dlBtn = document.getElementById('ttsDlBtn');
      var againBtn = document.getElementById('ttsAgainBtn');

      if (playBtn) {
        playBtn.onclick = function() {
          if (audio.paused) {
            audio.play();
            playBtn.textContent = 'توقف';
          } else {
            audio.pause();
            playBtn.textContent = 'پخش';
          }
        };
      }

      if (dlBtn) {
        dlBtn.onclick = function() {
          APP.downloadFile(url, 'setareh-voice-' + Date.now() + '.mp3');
        };
      }

      if (againBtn) {
        againBtn.onclick = function() {
          self.generate();
        };
      }
    }, 100);
  },

  // ============ Web Speech API ============
  _webSpeech: function(result, text) {
    if (!('speechSynthesis' in window)) {
      APP.showError('ttsResult', 'مرورگرت پشتیبانی نمی‌کنه');
      APP.toast('خطا');
      return;
    }

    var self = this;
    var cfg = this._getConfig();

    result.innerHTML =
      '<div style="padding:24px 20px;text-align:center;">' +
        '<div style="font-size:56px;margin-bottom:16px;animation:float 2s ease-in-out infinite;">🔊</div>' +
        '<div style="color:var(--text);font-weight:800;font-size:15px;margin-bottom:6px;">' +
          'در حال پخش (صدای مرورگر)...' +
        '</div>' +
        '<div style="color:var(--text-3);font-size:12px;margin-bottom:20px;">' +
          'صدا: ' + this._voiceName(this._voice) +
        '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;">' +
          '<button class="result-btn" id="ttsStopBtn" style="flex:0 0 auto;padding:12px 24px;">توقف</button>' +
          '<button class="result-btn" id="ttsAgainBtn" style="flex:0 0 auto;padding:12px 24px;">دوباره</button>' +
        '</div>' +
      '</div>';

    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'fa-IR';
    u.rate = cfg.rate;
    u.pitch = cfg.pitch;

    // انتخاب صدا
    var voices = window.speechSynthesis.getVoices();
    var faVoice = voices.find(function(v) { return v.lang && v.lang.indexOf('fa') === 0; });
    if (faVoice) {
      u.voice = faVoice;
    } else {
      var enVoice = voices.find(function(v) {
        var n = (v.name || '').toLowerCase();
        if (cfg.gender === 'female') {
          return n.indexOf('female') >= 0 || n.indexOf('zira') >= 0 || n.indexOf('samantha') >= 0;
        } else {
          return n.indexOf('male') >= 0 || n.indexOf('david') >= 0 || n.indexOf('mark') >= 0;
        }
      });
      if (enVoice) u.voice = enVoice;
    }

    u.onstart = function() {
      self._speaking = true;
      APP.toast('پخش شد');
    };

    u.onend = function() {
      self._speaking = false;
      var stopBtn = document.getElementById('ttsStopBtn');
      if (stopBtn) stopBtn.textContent = 'پایان';
    };

    u.onerror = function(e) {
      console.warn('speech error:', e);
      self._speaking = false;
    };

    try {
      window.speechSynthesis.cancel();
      setTimeout(function() {
        window.speechSynthesis.speak(u);
      }, 100);
    } catch(e) {
      console.error(e);
      APP.toast('خطا در پخش');
      return;
    }

    APP.vibrate(30);

    setTimeout(function() {
      var stopBtn = document.getElementById('ttsStopBtn');
      var againBtn = document.getElementById('ttsAgainBtn');

      if (stopBtn) {
        stopBtn.onclick = function() {
          try { window.speechSynthesis.cancel(); } catch(e) {}
          self._speaking = false;
          stopBtn.textContent = 'متوقف شد';
        };
      }

      if (againBtn) {
        againBtn.onclick = function() {
          self.generate();
        };
      }
    }, 100);
  },

  _stopAll: function() {
    try { window.speechSynthesis.cancel(); } catch(e) {}
    if (this._audioEl) {
      try { this._audioEl.pause(); } catch(e) {}
      this._audioEl = null;
    }
    this._speaking = false;
  },

  _getConfig: function() {
    var configs = {
      'alloy':   { rate: 0.95, pitch: 1.0, gender: 'male' },
      'echo':    { rate: 1.0,  pitch: 0.9, gender: 'male' },
      'fable':   { rate: 1.05, pitch: 1.1, gender: 'male' },
      'onyx':    { rate: 0.9,  pitch: 0.8, gender: 'male' },
      'nova':    { rate: 1.0,  pitch: 1.2, gender: 'female' },
      'shimmer': { rate: 1.05, pitch: 1.3, gender: 'female' }
    };
    return configs[this._voice] || configs['nova'];
  },

  _voiceName: function(v) {
    var names = {
      'alloy': 'آلوی', 'echo': 'اکو', 'fable': 'فابل',
      'onyx': 'اونیکس', 'nova': 'نوا', 'shimmer': 'شیمر'
    };
    return names[v] || v;
  }
};

window.TTS = TTS;
