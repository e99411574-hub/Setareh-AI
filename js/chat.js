// ===== js/chat.js — چت با هوش مصنوعی + ارتقاء =====

var CHAT = {
  _busy: false,
  _history: [],
  _attachments: [],
  _recognition: null,
  _recording: false,
  _voiceActive: false,

  // کلمات کلیدی برای تشخیص درخواست ساخت عکس
  _imageKeywords: [
    'عکس بساز', 'تصویر بساز', 'بکش', 'نقاشی کن', 'بساز عکس',
    'یه عکس', 'یک عکس', 'یه تصویر', 'یک تصویر',
    'draw', 'generate image', 'create image', 'make an image',
    'picture', 'paint'
  ],

  init: function() {
    var self = this;

    var sendBtn = document.getElementById('chatSendBtn');
    if (sendBtn) sendBtn.addEventListener('click', function() { self.send(); });

    var input = document.getElementById('chatInput');
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          self.send();
        }
      });
    }

    var attachBtn = document.getElementById('chatAttachBtn');
    var fileInput = document.getElementById('chatFileInput');
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', function() { fileInput.click(); });
      fileInput.addEventListener('change', function(e) { self.onFiles(e); });
    }

    var voiceBtn = document.getElementById('chatVoiceBtn');
    if (voiceBtn) voiceBtn.addEventListener('click', function() { self.toggleVoice(); });

    var voiceStopBtn = document.getElementById('voiceStopBtn');
    if (voiceStopBtn) voiceStopBtn.addEventListener('click', function() { self.stopVoice(); });

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

    var clearBtn = document.getElementById('chatClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', function() { self.clear(); });

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
      APP.toast('اتصال برقرار نیست');
      return;
    }

    this._busy = true;
    input.value = '';
    this._attachments = [];
    this.renderAttachments();

    var welcome = document.getElementById('chatWelcome');
    if (welcome) welcome.remove();

    // تشخیص درخواست ساخت عکس
    var isImageRequest = this._detectImageRequest(text);

    this.appendMessage('user', text, attachments, this._history.length);

    var userMsg = { role: 'user', content: text, attachments: attachments, time: Date.now() };
    this._history.push(userMsg);
    this.saveHistory();

    // اگه درخواست ساخت عکس بود، پیشنهاد بده
    if (isImageRequest && !attachments.length) {
      var suggestion = '🎨 به نظر می‌رسه می‌خوای یه عکس بسازی!\n\n' +
        'بذار کمکت کنم — می‌تونی:\n\n' +
        '**۱.** از پنل **ساخت عکس** استفاده کنی (دقیق‌تر و سریع‌تره)\n' +
        '**۲.** یا همین‌جا توضیح بدی تا راهنماییت کنم\n\n' +
        'اگه می‌خوای عکس بسازی، روی دکمهٔ پایین بزن 👇';

      this.appendMessage('ai', suggestion, null, this._history.length, {
        action: { label: '🎨 رفتن به ساخت عکس', handler: 'CHAT.goToImage' }
      });

      this._history.push({ role: 'assistant', content: suggestion, time: Date.now() });
      this.saveHistory();

      this._busy = false;
      return;
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
      var puterPrompt = text;
      if (attachments.length) {
        var fileInfo = attachments.map(function(a) {
          return '[' + a.type + ': ' + a.name + ']';
        }).join(', ');
        puterPrompt = text + ' (' + fileInfo + ')';
      }

      var response = await puter.ai.chat(puterPrompt);

      var l = document.getElementById(loadingId);
      if (l) l.remove();

      var aiText = this._extractText(response);
      if (!aiText) aiText = 'متأسفانه نتونستم جواب بدم.';

      this.appendMessage('ai', aiText, null, this._history.length);

      this._history.push({ role: 'assistant', content: aiText, time: Date.now() });
      this.saveHistory();

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

  // ============ تشخیص درخواست ساخت عکس ============
  _detectImageRequest: function(text) {
    if (!text) return false;
    var t = text.toLowerCase();
    for (var i = 0; i < this._imageKeywords.length; i++) {
      if (t.indexOf(this._imageKeywords[i].toLowerCase()) >= 0) return true;
    }
    return false;
  },

  // ============ رفتن به پنل عکس ============
  goToImage: function() {
    if (typeof ROUTER !== 'undefined' && ROUTER.go) {
      ROUTER.go('image');
    }
  },

  // ============ رفتن به پنل ویدیو ============
  goToVideo: function() {
    if (typeof ROUTER !== 'undefined' && ROUTER.go) {
      ROUTER.go('video');
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
  appendMessage: function(type, text, attachments, msgIndex, opts) {
    var area = document.getElementById('chatArea');
    if (!area) return;

    opts = opts || {};

    var wrap = document.createElement('div');
    wrap.className = 'chat-msg ' + type;
    if (typeof msgIndex === 'number') {
      wrap.setAttribute('data-idx', msgIndex);
    }

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    var content = '';
    if (text) {
      content += this._formatText(text);
    }

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

    // اکشن‌ها (کپی + ادیت)
    var actions = this._buildActions(type, text, msgIndex, opts);
    if (actions) wrap.appendChild(actions);

    area.appendChild(wrap);

    setTimeout(function() {
      area.scrollTop = area.scrollHeight;
    }, 50);
  },

  // ============ ساخت دکمه‌های اکشن ============
  _buildActions: function(type, text, msgIndex, opts) {
    var actions = document.createElement('div');
    actions.className = 'chat-actions';

    var self = this;
    var safeText = text || '';
    var hasText = safeText.length > 0;

    // دکمهٔ کپی
    if (hasText) {
      var copyBtn = document.createElement('button');
      copyBtn.className = 'chat-action-btn';
      copyBtn.title = 'کپی';
      copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      copyBtn.onclick = function(e) {
        e.stopPropagation();
        self._copyText(safeText);
      };
      actions.appendChild(copyBtn);
    }

    // برای پیام کاربر: ادیت (بازگشت به input)
    if (type === 'user' && hasText) {
      var editBtn = document.createElement('button');
      editBtn.className = 'chat-action-btn';
      editBtn.title = 'ویرایش';
      editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      editBtn.onclick = function(e) {
        e.stopPropagation();
        self._editMessage(msgIndex, safeText);
      };
      actions.appendChild(editBtn);
    }

    // برای پیام AI: دکمهٔ کپی + بازتولید
    if (type === 'ai') {
      // دکمهٔ بازتولید
      var regenBtn = document.createElement('button');
      regenBtn.className = 'chat-action-btn';
      regenBtn.title = 'پاسخ جدید';
      regenBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
      regenBtn.onclick = function(e) {
        e.stopPropagation();
        self._regenerate(msgIndex);
      };
      actions.appendChild(regenBtn);
    }

    // دکمه‌های سفارشی (مثل «برو به عکس»)
    if (opts.action) {
      var custom = document.createElement('button');
      custom.className = 'chat-action-btn chat-action-custom';
      custom.textContent = opts.action.label;
      custom.onclick = function(e) {
        e.stopPropagation();
        try { eval(opts.action.handler + '()'); } catch(err) { console.warn(err); }
      };
      actions.appendChild(custom);
    }

    return actions.children.length ? actions : null;
  },

  // ============ کپی متن ============
  _copyText: function(text) {
    var self = this;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        APP.toast('✅ کپی شد');
        APP.vibrate(15);
      }).catch(function() {
        self._fallbackCopy(text);
      });
    } else {
      this._fallbackCopy(text);
    }
  },

  _fallbackCopy: function(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      APP.toast('✅ کپی شد');
    } catch(e) {
      APP.toast('❌ خطا در کپی');
    }
  },

  // ============ ادیت پیام کاربر ============
  _editMessage: function(msgIndex, text) {
    var input = document.getElementById('chatInput');
    if (!input) return;
    input.value = text;
    input.focus();
    // اسکرول به input
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    APP.toast('✏️ پیام برای ویرایش آماده شد');
    APP.vibrate(15);
  },

  // ============ بازتولید پاسخ AI ============
  _regenerate: async function(msgIndex) {
    if (this._busy) return;
    if (typeof msgIndex !== 'number') return;

    // پیام کاربر قبلش رو بگیر
    var userMsg = null;
    for (var i = msgIndex - 1; i >= 0; i--) {
      if (this._history[i] && this._history[i].role === 'user') {
        userMsg = this._history[i];
        break;
      }
    }

    if (!userMsg) {
      APP.toast('❌ پیام کاربر پیدا نشد');
      return;
    }

    // حذف پاسخ‌های بعدی
    this._history = this._history.slice(0, msgIndex);

    // پاک کردن UI بعد از این پیام
    var area = document.getElementById('chatArea');
    var allMsgs = area.querySelectorAll('.chat-msg');
    allMsgs.forEach(function(el, idx) {
      if (idx >= msgIndex) el.remove();
    });

    // ارسال مجدد
    this._busy = true;
    APP.vibrate(20);

    var input = document.getElementById('chatInput');
    var originalVal = input ? input.value : '';
    if (input) input.value = userMsg.content;
    if (input) input.value = originalVal;

    // مستقیم درخواست جدید
    try {
      var response = await puter.ai.chat(userMsg.content);
      var aiText = this._extractText(response);
      if (!aiText) aiText = 'متأسفانه نتونستم جواب بدم.';

      this.appendMessage('ai', aiText, null, this._history.length);
      this._history.push({ role: 'assistant', content: aiText, time: Date.now() });
      this.saveHistory();
      APP.toast('✅ پاسخ جدید');
    } catch (err) {
      console.error(err);
      APP.toast('❌ خطا');
    } finally {
      this._busy = false;
    }
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

    var input = document.getElementById('chatInput');
    if (input && input.value.trim()) {
      this.send();
    }
  },

  // ============ جستجو ============
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
    results.forEach(function(m, i) {
      self.appendMessage(m.role === 'user' ? 'user' : 'ai', m.content, m.attachments, i);
    });
  },

  renderHistory: function() {
    var area = document.getElementById('chatArea');
    if (!area) return;

    if (!this._history.length) {
      area.innerHTML = '<div class="chat-welcome" id="chatWelcome">' +
        '<div class="welcome-logo">Setareh AI</div>' +
        '<div class="welcome-sub">چطور می‌تونم کمکت کنم؟</div>' +
        '<div class="welcome-chips">' +
          '<button class="chip" data-prompt="یه شعر کوتاه درباره بهار بنویس">شعر بگو</button>' +
                  '<button class="chip" data-prompt="یه سوال ریاضی رو برام توضیح بده">کمک درسی</button>' +
        '</div>' +
      '</div>';

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
    this._history.forEach(function(m, i) {
      self.appendMessage(m.role === 'user' ? 'user' : 'ai', m.content, m.attachments, i);
    });
  },

  saveHistory: function() {
    try {
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

window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (typeof CHAT !== 'undefined') {
      CHAT.loadHistory();
      if (CHAT._history.length) CHAT.renderHistory();
    }
  }, 100);
});
