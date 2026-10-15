// ===== js/tts.js — تبدیل متن به صدا =====

var TTS = {
  _voice: 'nova',
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

    if (text.length > 4000) {
      APP.toast('متن خیلی طولانیه');
      return;
    }

    if (typeof puter === 'undefined' || !puter.ai) {
      APP.toast('اتصال برقرار نیست');
      return;
    }

    if (this._loading) return;
    this._loading = true;
    btn.disabled = true;
    APP.vibrate(20);

    result.innerHTML = '<div class="loading">' +
      '<div class="loading-dots"><span></span><span></span><span></span><span></span></div>' +
      '<div class="loading-text">در حال تبدیل...</div>' +
      '</div>';

    try {
      if (this._audioEl) {
        try { this._audioEl.pause(); } catch(e) {}
        this._audioEl = null;
      }

      var audioElement;

      if (puter.ai.txt2speech) {
        audioElement = await puter.ai.txt2speech(text, {
          voice: this._voice,
          engine: 'neural',
          language: 'en-US'
        });
      } else {
        throw new Error('TTS پشتیبانی نمیشه');
      }

      var url = null;
      if (typeof audioElement === 'string') url = audioElement;
      else if (audioElement && audioElement.src) url = audioElement.src;
      else if (audioElement && audioElement.url) url = audioElement.url;

      if (!url) throw new Error('صدایی تولید نشد');

      result.innerHTML = '';
      var audio = document.createElement('audio');
      audio.src = url;
      audio.controls = true;
      audio.autoplay = true;
      audio.style.width = '100%';
      result.appendChild(audio);

      this._audioEl = audio;

      var actions = document.createElement('div');
      actions.className = 'result-actions';

      var dl = document.createElement('button');
      dl.className = 'result-btn';
      dl.textContent = 'دانلود';
      dl.onclick = function() {
        APP.downloadFile(url, 'setareh-voice-' + Date.now() + '.mp3');
      };
      actions.appendChild(dl);

      var ag = document.createElement('button');
      ag.className = 'result-btn';
      ag.textContent = 'دوباره';
      ag.onclick = function() { TTS.generate(); };
      actions.appendChild(ag);

      result.appendChild(actions);

      APP.toast('صدا ساخته شد');
      APP.vibrate(30);

    } catch (err) {
      console.error('tts error:', err);
      var msg = err.message || 'خطای ناشناخته';

      // اگه Puter TTS کار نکرد، از Web Speech API
      if (window.speechSynthesis) {
        result.innerHTML = '<div style="padding:20px;text-align:center;">' +
          '<div style="font-size:32px;margin-bottom:12px;">🔊</div>' +
          '<div style="color:var(--text-2);font-size:13px;">Puter TTS در دسترس نیست — از صدای مرورگر استفاده می‌کنم</div>' +
        '</div>';

        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'fa-IR';
        u.rate = 1;
        u.pitch = 1;
        window.speechSynthesis.speak(u);
        APP.toast('پخش شد');
      } else {
        APP.showError('ttsResult', 'خطا: ' + msg);
      }
    } finally {
      btn.disabled = false;
      this._loading = false;
    }
  }
};

window.TTS = TTS;
