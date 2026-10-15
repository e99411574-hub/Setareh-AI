// ===== js/tts.js — Microsoft Edge TTS (کیفیت عالی فارسی) =====

var TTS = {
  _audio: null,
  _playing: false,
  _ws: null,
  _pendingResolve: null,

  // صداهای فارسی
  VOICES: {
    'fa-female': 'fa-IR-DilaraNeural',
    'fa-male':   'fa-IR-FaridNeural'
  },

  _currentVoice: 'fa-IR-DilaraNeural',

  init: function() {
    var self = this;
    var btn = document.getElementById('ttsBtn');
    if (btn) btn.addEventListener('click', function() { self._onClick(); });

    console.log('🔊 TTS: آماده (Edge TTS)');
  },

  _onClick: function() {
    var text = (document.getElementById('ttsText') || {}).value || '';
    text = text.trim();

    if (!text) {
      APP.toast('اول متن رو بنویس');
      APP.vibrate(30);
      return;
    }

    if (text.length > 3000) {
      APP.toast('متن طولانیه (حداکثر ۳۰۰۰ کاراکتر)');
      return;
    }

    this._stop();
    APP.vibrate(20);

    var result = document.getElementById('ttsResult');
    result.innerHTML = this._loadingUI();

    this._synthesize(text, result);
  },

  // ============ Edge TTS ============
  _synthesize: async function(text, result) {
    var self = this;

    try {
      var audioBlob = await this._generateAudio(text);

      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('صدایی تولید نشد');
      }

      var url = URL.createObjectURL(audioBlob);

      // پخش
      this._audio = new Audio(url);
      this._playing = true;

      result.innerHTML = this._playingUI();

      var stopBtn = document.getElementById('ttsStopBtn');
      if (stopBtn) {
        stopBtn.onclick = function() {
          self._stop();
          self._idleUI(result);
        };
      }

      this._audio.onended = function() {
        self._playing = false;
        self._idleUI(result);
        APP.toast('✅ پخش تمام شد');
      };

      this._audio.onerror = function() {
        self._playing = false;
        APP.showError('ttsResult', 'خطا در پخش صدا');
      };

      try {
        await this._audio.play();
        APP.toast('🔊 در حال پخش');
      } catch (err) {
        console.warn('play error:', err);
        // اگه autoplay block شده، دکمه بذار
        result.innerHTML = this._playingUI('برای پخش، دکمه رو بزن') +
          '<button onclick="this.parentElement.querySelector(\'audio\')?.play()" style="display:none">play</button>';
        result.innerHTML = '<div style="padding:24px;text-align:center;">' +
          '<div style="font-size:56px;margin-bottom:12px;">🔊</div>' +
          '<div style="color:var(--text);font-weight:700;margin-bottom:16px;">آماده پخش</div>' +
          '<button id="ttsPlayBtn" class="result-btn" style="flex:0 0 auto;padding:14px 32px;margin:0 auto;display:inline-flex;background:var(--accent-grad);color:#fff;border:none;">▶ پخش</button>' +
          '</div>';
        var pb = document.getElementById('ttsPlayBtn');
        if (pb) {
          pb.onclick = function() { self._audio.play(); };
        }
      }

    } catch (err) {
      console.error('Edge TTS error:', err);
      var msg = err.message || 'خطا';
      if (msg.length > 100) msg = msg.substring(0, 100);

      // تلاش با Web Speech
      APP.showError('ttsResult', '⚠️ ' + msg + '\n\nاز Web Speech استفاده می‌کنم...');
      setTimeout(function() { self._fallbackWebSpeech(text, result); }, 1000);
    }
  },

  // ============ WebSocket به Edge TTS ============
  _generateAudio: function(text) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var timeout = setTimeout(function() {
        reject(new Error('زمان انتظار تموم شد'));
      }, 20000);

      var ws;
      try {
        ws = new WebSocket(
          'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4'
        );
      } catch(e) {
        clearTimeout(timeout);
        reject(new Error('WebSocket باز نشد'));
        return;
      }

      var audioChunks = [];
      var textSent = false;
      var connectionId = self._uuid();

      var fail = function(err) {
        clearTimeout(timeout);
        try { ws.close(); } catch(e) {}
        reject(err);
      };

      var succeed = function() {
        clearTimeout(timeout);
        try { ws.close(); } catch(e) {}
        resolve(new Blob(audioChunks, { type: 'audio/mpeg' }));
      };

      ws.binaryType = 'arraybuffer';

      ws.onopen = function() {
        // ۱. ارسال config
        var configMsg =
          'Content-Type:application/json; charset=utf-8\r\n' +
          'Path:speech.config\r\n\r\n' +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: {
                    sentenceBoundaryEnabled: false,
                    wordBoundaryEnabled: false
                  },
                  outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
                }
              }
            }
          });

        try {
          ws.send(configMsg);
        } catch(e) {
          fail(new Error('خطا در ارسال config'));
          return;
        }

        // ۲. ارسال متن
        var ssmlMsg =
          'X-RequestId:' + connectionId + '\r\n' +
          'Content-Type:application/ssml+xml\r\n' +
          'Path:ssml\r\n\r\n' +
          '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fa-IR">' +
            '<voice name="' + self._currentVoice + '">' +
              '<prosody rate="0%" pitch="0%">' +
                self._escapeXml(text) +
              '</prosody>' +
            '</voice>' +
          '</speak>';

        try {
          ws.send(ssmlMsg);
          textSent = true;
        } catch(e) {
          fail(new Error('خطا در ارسال متن'));
          return;
        }
      };

      ws.onmessage = function(event) {
        if (typeof event.data === 'string') {
          // پیام متنی — چک کن تموم شده؟
          if (event.data.indexOf('Path:turn.end') >= 0) {
            if (audioChunks.length > 0) {
              succeed();
            } else {
              fail(new Error('صدایی دریافت نشد'));
            }
          }
        } else {
          // پیام دودویی — جدا کردن صدا
          var buffer = event.data;
          var dataView = new DataView(buffer);

          // هدر ۲ بایت اول، طول هدر
          var headerLength = dataView.getUint16(0, false);

          // اگه هدر کافی بود
          if (buffer.byteLength > headerLength + 2) {
            var audioData = buffer.slice(headerLength + 2);
            if (audioData.byteLength > 0) {
              audioChunks.push(audioData);
            }
          }
        }
      };

      ws.onerror = function(e) {
        console.warn('ws error:', e);
        if (audioChunks.length > 0) {
          succeed();
        } else {
          fail(new Error('خطا در اتصال به Edge TTS'));
        }
      };

      ws.onclose = function() {
        if (audioChunks.length > 0) {
          succeed();
        }
      };
    });
  },

  _uuid: function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  _escapeXml: function(s) {
    if (!s) return '';
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },

  // ============ Fallback: Web Speech ============
  _fallbackWebSpeech: function(text, result) {
    if (!('speechSynthesis' in window)) {
      APP.showError('ttsResult', 'مرورگرت پشتیبانی نمی‌کنه');
      return;
    }

    var self = this;
    this._playing = true;

    result.innerHTML = self._playingUI('پخش (Web Speech)');

    var stopBtn = document.getElementById('ttsStopBtn');
    if (stopBtn) {
      stopBtn.onclick = function() {
        try { speechSynthesis.cancel(); } catch(e) {}
        self._playing = false;
        self._idleUI(result);
      };
    }

    try { speechSynthesis.cancel(); } catch(e) {}

    var voices = window.speechSynthesis.getVoices();
    var faVoice = voices.find(function(v) {
      return v.lang && v.lang.toLowerCase().indexOf('fa') === 0;
    });

    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'fa-IR';
    u.rate = 0.95;
    u.pitch = 1;
    if (faVoice) u.voice = faVoice;

    u.onend = function() {
      self._playing = false;
      self._idleUI(result);
    };

    u.onerror = function() {
      self._playing = false;
      APP.showError('ttsResult', 'پخش ممکن نشد');
    };

    try {
      speechSynthesis.speak(u);
    } catch(e) {
      APP.showError('ttsResult', 'خطا در پخش');
    }
  },

  // ============ UI ============
  _loadingUI: function() {
    return '<div style="padding:24px;text-align:center;">' +
      '<div class="loading-dots" style="margin-bottom:12px;">' +
        '<span></span><span></span><span></span><span></span>' +
      '</div>' +
      '<div style="color:var(--text);font-weight:700;font-size:14px;">در حال ساخت صدا...</div>' +
      '<div style="color:var(--text-3);font-size:11px;margin-top:8px;">کیفیت عالی فارسی</div>' +
      '</div>';
  },

  _playingUI: function(title) {
    return '<div style="padding:24px 20px;text-align:center;">' +
      '<div style="font-size:56px;margin-bottom:12px;animation:float 2s ease-in-out infinite;">🔊</div>' +
      '<div style="color:var(--text);font-weight:800;font-size:16px;margin-bottom:20px;">' +
        (title || 'در حال پخش...') +
      '</div>' +
      '<button id="ttsStopBtn" class="result-btn" style="flex:0 0 auto;padding:12px 32px;margin:0 auto;display:inline-flex;">⏹ توقف</button>' +
      '</div>';
  },

  _idleUI: function(result) {
    result.innerHTML = '<div style="padding:20px;text-align:center;">' +
      '<div style="font-size:48px;margin-bottom:10px;">✅</div>' +
      '<div style="color:var(--text-2);font-size:13px;">برای پخش دوباره، روی دکمه بزن</div>' +
      '</div>';
  },

  _stop: function() {
    this._playing = false;
    if (this._audio) {
      try { this._audio.pause(); this._audio.src = ''; } catch(e) {}
      this._audio = null;
    }
    if (this._ws) {
      try { this._ws.close(); } catch(e) {}
      this._ws = null;
    }
    try { speechSynthesis.cancel(); } catch(e) {}
  }
};

window.TTS = TTS;
