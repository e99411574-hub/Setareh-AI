// ===== js/tts.js — تبدیل متن به صدا (Web Speech API) =====

var TTS = {
  _voice: 'nova',
  _speaking: false,

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

    // لود کردن صداها
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

  generate: function() {
    var result = document.getElementById('ttsResult');
    var text = (document.getElementById('ttsText') || {}).value || '';
    text = text.trim();

    if (!text) {
      APP.toast('اول متن رو بنویس');
      APP.vibrate(30);
      return;
    }

    if (!('speechSynthesis' in window)) {
      APP.toast('مرورگرت پشتیبانی نمی‌کنه');
      return;
    }

    // قطع پخش قبلی
    try { window.speechSynthesis.cancel(); } catch(e) {}

    APP.vibrate(20);

    var self = this;

    // UI
    result.innerHTML =
      '<div style="padding:24px 20px;text-align:center;">' +
        '<div style="font-size:56px;margin-bottom:16px;animation:float 2s ease-in-out infinite;">🔊</div>' +
        '<div style="color:var(--text);font-weight:800;font-size:16px;margin-bottom:6px;">' +
          'در حال پخش...' +
        '</div>' +
        '<div style="color:var(--text-3);font-size:12px;margin-bottom:24px;">' +
          'صدا: ' + this._voiceName(this._voice) +
        '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;">' +
          '<button class="result-btn" id="ttsStopBtn" style="flex:0 0 auto;padding:12px 24px;">' +
            'توقف' +
          '</button>' +
          '<button class="result-btn" id="ttsAgainBtn" style="flex:0 0 auto;padding:12px 24px;">' +
            'پخش دوباره' +
          '</button>' +
        '</div>' +
      '</div>';

    // ساخت utterance
    var cfg = this._getConfig();
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
      // صدا انگلیسی با جنسیت مناسب
      var enVoice = voices.find(function(v) {
        var n = (v.name || '').toLowerCase();
        if (cfg.gender === 'female') {
          return n.indexOf('female') >= 0 || n.indexOf('zira') >= 0 ||
                 n.indexOf('samantha') >= 0 || n.indexOf('google uk english female') >= 0;
        } else {
          return n.indexOf('male') >= 0 || n.indexOf('david') >= 0 ||
                 n.indexOf('mark') >= 0 || n.indexOf('google uk english male') >= 0;
        }
      });
      if (enVoice) u.voice = enVoice;
    }

    u.onstart = function() {
      self._speaking = true;
    };

    u.onend = function() {
      self._speaking = false;
      var stopBtn = document.getElementById('ttsStopBtn');
      if (stopBtn) stopBtn.textContent = 'پایان';
    };

    u.onerror = function(e) {
      console.warn('tts error:', e);
      self._speaking = false;
    };

    // پخش
    try {
      window.speechSynthesis.speak(u);
      APP.toast('پخش شد');
      APP.vibrate(30);
    } catch(e) {
      console.error(e);
      APP.toast('خطا در پخش');
      return;
    }

    // دکمه‌ها
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

  _voiceName: function(v) {
    var names = {
      'alloy': 'آلوی', 'echo': 'اکو', 'fable': 'فابل',
      'onyx': 'اونیکس', 'nova': 'نوا', 'shimmer': 'شیمر'
    };
    return names[v] || v;
  }
};

window.TTS = TTS;
