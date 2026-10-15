// ===== js/chat.js — چت با میکروفون + ضبط صدا + AI صوتی =====

var CHAT = {
  _busy: false,
  _history: [],
  _attachments: [],
  _recognition: null,
  _recording: false,
  _voiceActive: false,

  init: function() {
    var self = this;

    // دکمهٔ ارسال
    var sendBtn = document.getElementById('chatSendBtn');
    if (sendBtn) sendBtn.addEventListener('click', function() { self.send(); });

    // Enter در input
    var input = document.getElementById('chatInput');
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          self.send();
        }
      });
    }

    // دکمهٔ آپلود
    var attachBtn = document.getElementById('chatAttachBtn');
    var fileInput = document.getElementById('chatFileInput');
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', function() { fileInput.click(); });
      fileInput.addEventListener('change', function(e) { self.onFiles(e); });
    }

    // دکمهٔ میکروفون
    var voiceBtn = document.getElementById('chatVoiceBtn');
    if (voiceBtn) voiceBtn.addEventListener('click', function() { self.toggleVoice(); });

    // دکمهٔ توقف ضبط
    var voiceStopBtn = document.getElementById('voiceStopBtn');
    if (voiceStopBtn) voiceStopBtn.addEventListener('click', function() { self.stopVoice(); });

    // سرچ
    var searchBtn = document.getElementById('chatSearchBtn');
    var searchBar = document.getElementById('chatSearchBar');
    var searchInput = document.getElementById('chatSearchInput');
    var closeSearchBtn = document.getElementById('closeSearchBtn');

    if (searchBtn && searchBar) {
      searchBtn.addEventListener('click', function() {
        if (searchBar.style.display === 'none') {
          searchBar.style.display = 'flex';
          if (searchInput) searchInput.focus();
        } else {
          searchBar.style.display = 'none';
        }
      });
    }

    if (closeSearchBtn && searchBar) {
      closeSearchBtn.addEventListener('click', function() {
        searchBar.style.display = 'none';
        if (searchInput) searchInput.value = '';
        self.renderHistory();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        self.searchHistory(e.target.value);
      });
    }

    // پاک کردن
    var clearBtn = document.getElementById('chatClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', function() { self.clear(); });

    // چیپ‌های پیشنهادی
    document.querySelectorAll('.chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var prompt = this.getAttribute('data-prompt');
        if (prompt && input) {
          input.value = prompt;
          self.send();
        }
      });
    });

    console.log('💬 CHAT: آماده');
  },

  // ============ ارسال پیام ============
  send: async function() {
    if (this._busy) return;

    var input = document.getElementById('chatInput');
    if (!input) return;

    var text = (input.value || '').trim();
    var attachments = this._attachments.slice();

    if (!text && !attachments.length) return;
    if (typeof puter === 'undefined' || !puter.ai) {
      APP.toast('❌ اتصال برقرار نیست');
      return;
    }

    this._busy = true;
    input.value = '';
    this._attachments = [];
    this.renderAttachments();

    // حذف welcome
    var welcome = document.getElementById('chatWelcome');
    if (welcome) welcome.remove();

    // نمایش پیام کاربر
    this.appendMessage('user', text, attachments);

    // ذخیره تاریخچه
    var userMsg = { role: 'user', content: text, attachments: attachments, time: Date.now() };
    this._history.push(userMsg);
    this.saveHistory();

    // ذخیره پرامپت برای Puter
    var puterPrompt = text;
    if (attachments.length) {
      // اگه فایل داشت، آدرسش رو ضمیمه کن
      var fileInfo = attachments.map(function(a) {
        return '[' + a.type + ': ' + a.name + ']';
      }).join(', ');
      puterPrompt = text + ' (' + fileInfo + ')';
    }

    // لودینگ
    var loadingId = 'typing-' + Date.now();
    var area = document.getElementById('chatArea');
    var loadingEl = document.createElement('div');
    loadingEl.className = 'chat-msg ai';
    loadingEl.id = loadingId;
    loadingEl.innerHTML = '<div class="chat-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
    if (area) {
      area.appendChild(loadingEl);
      area.scrollTop = area.scrollHeight;
    }

    try {
      // ============ درخواست به Puter ============
      var response = await puter.ai.chat(puterPrompt);

      var l = document.getElementById(loadingId);
      if (l) l.remove();

      var aiText = this._extractText(response);
      if (!aiText) aiText = 'متأسفانه نتونستم جواب بدم.';

      // نمایش پیام AI
      this.appendMessage('ai', aiText);

      // ذخیره
      this._history.push({ role: 'assistant', content: aiText, time: Date.now() });
      this.saveHistory();

      // پخش صوتی
      this.speak(aiText);
      APP.vibrate(15);

    } catch (err) {
      console.error('chat error:', err);
      var l = document.getElementById(loadingId);
      if (l) l.remove();
      var msg = err.message || 'خطای ناشناخته';
      if (msg.length > 80) msg = msg.substring(0, 80) + '...';
      this.appendMessage('ai', '❌ خطا: ' + msg);
      APP.toast('❌ خطا در پاسخ');
      APP.vibrate(50);
    } finally {
      this._busy = false;
    }
  },

  // ============ استخراج متن ============
  _extractText: function(response) {
    if (!response) return '';
    if (typeof response === 'string') return response;
    if (response.message && response.message.content) {
      var c = response.message.content;
      if (Array.isArray(c)) {
        return c.map(function(x) { return x.text || x; }).join('\n');
      }
      return c;
    }
    if (response.text) return response.text;
    if (response.toString && typeof response.toString === 'function') {
      var s = response.toString();
      if (s !== '[object Object]') return s;
    }
    return '';
  },

  // ============ اضافه کردن پیام ============
  appendMessage: function(type, text, attachments) {
    var area = document.getElementById('chatArea');
    if (!area) return;

    var wrap = document.createElement('div');
    wrap.className = 'chat-msg ' + type;

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    var content = '';
    if (text) {
      content += this._formatText(text);
    }

    // پیوست‌ها
    if (attachments && attachments.length) {
      attachments.forEach(function(a) {
        if (a.type === 'image') {
          content += '<br><img src="' + a.url + '" alt="">';
        } else if (a.type === 'video') {
          content += '<br><video src="' + a.url + '" controls playsinline></video>';
        }
      });
    }

    bubble.innerHTML = content;
    wrap.appendChild(bubble);
    area.appendChild(wrap);

    setTimeout(function() {
      area.scrollTop = area.scrollHeight;
    }, 50);
  },

  // ============ فرمت متن ============
  _formatText: function(text) {
    if (!text) return '';
    var s = String(text);
    s = s.replace(/[&<>]/g, function(c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;' }[c];
    });
    s = s.replace(/\n/g, '<br>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`(.+?)`/g, '<code style="background:rgba(108,92,231,.15);padding:2px 6px;border-radius:6px;font-family:monospace;font-size:12px;">$1</code>');
    return s;
  },

  // ============ آپلود فایل ============
  onFiles: function(e) {
    var files = Array.from(e.target.files || []);
    var self = this;

    files.forEach(function(file) {
      var type = file.type.startsWith('image/') ? 'image' :
                 file.type.startsWith('video/') ? 'video' : null;
      if (!type) return;

      if (file.size > 20 * 1024 * 1024) {
        APP.toast('❌ فایل بزرگه');
        return;
      }

      var url = URL.createObjectURL(file);
      self._attachments.push({ type: type, url: url, name: file.name, file: file });
    });

    this.renderAttachments();
    e.target.value = '';
    APP.vibrate(15);
  },

  // ============ نمایش پیوست‌ها ============
  renderAttachments: function() {
    var box = document.getElementById('chatAttachments');
    if (!box) return;

    if (!this._attachments.length) {
      box.innerHTML = '';
      return;
    }

    var self = this;
    box.innerHTML = '';
    this._attachments.forEach(function(a, idx) {
      var item = document.createElement('div');
      item.className = 'attachment-item';

      if (a.type === 'image') {
        var img = document.createElement('img');
        img.src = a.url;
        item.appendChild(img);
      } else {
        var v = document.createElement('video');
        v.src = a.url;
        v.muted = true;
        item.appendChild(v);
      }

      var rm = document.createElement('button');
      rm.className = 'rm-att';
      rm.textContent = '✕';
      rm.onclick = function() {
        self._attachments.splice(idx, 1);
        self.renderAttachments();
      };
      item.appendChild(rm);

      box.appendChild(item);
    });
  },

  // ============ ضبط صدا ============
  toggleVoice: function() {
    if (this._recording) {
      this.stopVoice();
    } else {
      this.startVoice();
    }
  },

  startVoice: function() {
    var self = this;

    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      APP.toast('❌ مرورگرت پشتیبانی نمی‌کند');
      return;
    }

    try {
      var rec = new SR();
      rec.lang = 'fa-IR';
      rec.continuous = false;
      rec.interimResults = true;

      var indicator = document.getElementById('voiceIndicator');
      var voiceText = document.getElementById('voiceText');
      var voiceBtn = document.getElementById('chatVoiceBtn');

      if (indicator) indicator.style.display = 'flex';
      if (voiceBtn) voiceBtn.classList.add('recording');

      rec.onresult = function(e) {
        var interim = '';
        var final = '';
        for (var i = e.resultIndex; i < e.results.length; i++) {
          var t = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += t;
          else interim += t;
        }
        var text = final || interim;
        if (voiceText) voiceText.textContent = text || 'در حال شنیدن...';
        if (final) {
          var input = document.getElementById('chatInput');
          if (input) input.value = final;
        }
      };

      rec.onerror = function(ev) {
        console.warn('voice error:', ev.error);
        if (ev.error === 'not-allowed') {
          APP.toast('❌ دسترسی به میکروفون داده نشد');
        } else if (ev.error === 'no-speech') {
          APP.toast('🔇 صدایی شنیده نشد');
        }
        self.stopVoice();
      };

      rec.onend = function() {
        self.stopVoice();
      };

      rec.start();
      this._recognition = rec;
      this._recording = true;
      APP.vibrate(30);

    } catch (err) {
      console.error('voice start error:', err);
      APP.toast('❌ خطا در شروع ضبط');
    }
  },

  stopVoice: function() {
    if (this._recognition) {
      try { this._recognition.stop(); } catch(e) {}
      this._recognition = null;
    }
    this._recording = false;

    var indicator = document.getElementById('voiceIndicator');
    var voiceBtn = document.getElementById('chatVoiceBtn');
    if (indicator) indicator.style.display = 'none';
    if (voiceBtn) voiceBtn.classList.remove('recording');

    // اگه متن داشت، ارسال کن
    var input = document.getElementById('chatInput');
    if (input && input.value.trim()) {
      this.send();
    }
  },

  // ============ پخش صوتی AI ============
  speak: function(text) {
    if (!text) return;
    if (!('speechSynthesis' in window)) return;

    // قطع پخش قبلی
    try { window.speechSynthesis.cancel(); } catch(e) {}

    // فقط ۲۰۰ کاراکتر اول
    var clean = text.replace(/[*`#_]/g, '').substring(0, 200);
    var u = new SpeechSynthesisUtterance(clean);
    u.lang = 'fa-IR';
    u.rate = 1;
    u.pitch = 1;

    // انتخاب صدا فارسی اگه بود
    var voices = window.speechSynthesis.getVoices();
    var faVoice = voices.find(function(v) { return v.lang && v.lang.indexOf('fa') === 0; });
    if (faVoice) u.voice = faVoice;

    try {
      window.speechSynthesis.speak(u);
    } catch(e) {
      console.warn('speak error:', e);
    }
  },

  // ============ جستجو در تاریخچه ============
  searchHistory: function(q) {
    var area = document.getElementById('chatArea');
    if (!area) return;

    q = (q || '').toLowerCase().trim();

    if (!q) {
      this.renderHistory();
      return;
    }

    var results = this._history.filter(function(m) {
      return (m.content || '').toLowerCase().includes(q);
    });

    if (!results.length) {
      area.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-3);">نتیجه‌ای پیدا نشد</div>';
      return;
    }

    area.innerHTML = '';
    var self = this;
    results.forEach(function(m) {
      self.appendMessage(m.role === 'user' ? 'user' : 'ai', m.content, m.attachments);
    });
  },

  // ============ رندر تاریخچه ============
  renderHistory: function() {
    var area = document.getElementById('chatArea');
    if (!area) return;

    if (!this._history.length) {
      area.innerHTML = '<div class="chat-welcome" id="chatWelcome">' +
        '<div class="welcome-logo">Setareh AI</div>' +
        '<div class="welcome-sub">چطور می‌تونم کمکت کنم؟</div>' +
        '<div class="welcome-chips">' +
          '<button class="chip" data-prompt="یه شعر کوتاه درباره بهار بنویس">شعر بگو</button>' +
          '<button class="chip" data-prompt="یه ایده برای یه اپلیکیشن جدید بده">ایده بده</button>' +
          '<button class="chip" data-prompt="یه سوال ریاضی رو برام توضیح بده">کمک درسی</button>' +
        '</div>' +
      '</div>';

      // اتصال چیپ‌ها
      var self = this;
      area.querySelectorAll('.chip').forEach(function(chip) {
        chip.addEventListener('click', function() {
          var prompt = this.getAttribute('data-prompt');
          var input = document.getElementById('chatInput');
          if (prompt && input) {
            input.value = prompt;
            self.send();
          }
        });
      });
      return;
    }

    area.innerHTML = '';
    var self = this;
    this._history.forEach(function(m) {
      self.appendMessage(m.role === 'user' ? 'user' : 'ai', m.content, m.attachments);
    });
  },

  // ============ ذخیره تاریخچه ============
  saveHistory: function() {
    try {
      // فقط ۵۰ پیام آخر
      var h = this._history.slice(-50);
      localStorage.setItem('setareh_chat_history', JSON.stringify(h));
    } catch(e) {}
  },

  loadHistory: function() {
    try {
      var saved = localStorage.getItem('setareh_chat_history');
      if (saved) {
        this._history = JSON.parse(saved) || [];
      }
    } catch(e) {
      this._history = [];
    }
  },

  // ============ پاک کردن ============
  clear: function() {
    if (!confirm('مطمئنی می‌خوای چت رو پاک کنی؟')) return;
    this._history = [];
    this._attachments = [];
    try { localStorage.removeItem('setareh_chat_history'); } catch(e) {}
    this.renderAttachments();
    this.renderHistory();
    APP.toast('🗑️ چت پاک شد');
    APP.vibrate(20);
  }
};

window.CHAT = CHAT;

// لود تاریخچه در start
window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (typeof CHAT !== 'undefined') {
      CHAT.loadHistory();
      if (CHAT._history.length) CHAT.renderHistory();
    }
  }, 100);
});
