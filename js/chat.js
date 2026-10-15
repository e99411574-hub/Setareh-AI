// ===== js/chat.js — چت هوشمند + ساخت عکس (بخش ۱) =====

var CHAT = {
  _busy: false,
  _history: [],
  _attachments: [],
  _sessions: [],
  _currentSessionId: null,
  _recognition: null,
  _recording: false,

  // کلیدواژه‌های تشخیص ساخت عکس
  _imageTriggers: [
    'عکس بساز', 'تصویر بساز', 'نقاشی کن', 'بکش', 'بساز عکس',
    'یه عکس', 'یک عکس', 'یه تصویر', 'یک تصویر', 'عکس از',
    'draw', 'generate image', 'create image', 'make an image',
    'picture of', 'paint', 'image of'
  ],

  // ============ راه‌اندازی ============
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

    var attachBtn = document.getElementById('attachBtn');
    var fileInput = document.getElementById('chatFileInput');
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', function() { fileInput.click(); });
      fileInput.addEventListener('change', function(e) { self.onFiles(e); });
    }

    var voiceBtn = document.getElementById('chatVoiceBtn');
    if (voiceBtn) voiceBtn.addEventListener('click', function() { self.toggleVoice(); });

    var voiceStopBtn = document.getElementById('voiceStopBtn');
    if (voiceStopBtn) voiceStopBtn.addEventListener('click', function() { self.stopVoice(); });

    // منوی کشویی
    var menuBtn = document.getElementById('menuBtn');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (menuBtn && sidebar) {
      menuBtn.addEventListener('click', function() {
        sidebar.classList.add('open');
        if (overlay) overlay.classList.add('open');
        self.renderSidebar();
      });
    }
    if (overlay) {
      overlay.addEventListener('click', function() {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      });
    }

    // سشن‌ها
    this.loadSessions();

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

    // حذف welcome
    var welcome = document.getElementById('chatWelcome');
    if (welcome) welcome.remove();

    // نمایش پیام کاربر
    this.appendMessage('user', text, attachments, this._history.length);

    var userMsg = { role: 'user', content: text, attachments: attachments, time: Date.now() };
    this._history.push(userMsg);
    this._saveCurrentSession();
    this._updateTitle();

    // تشخیص درخواست ساخت عکس
    var isImageReq = this._detectImageRequest(text);

    // === Thinking indicator ===
    var thinkId = 'think-' + Date.now();
    var area = document.getElementById('chatArea');
    var thinkEl = document.createElement('div');
    thinkEl.className = 'msg ai';
    thinkEl.id = thinkId;
    thinkEl.innerHTML =
      '<div class="msg-avatar">✦</div>' +
      '<div class="msg-body">' +
        '<div class="thinking-box">' +
          '<div class="dots"><span></span><span></span><span></span></div>' +
          '<span class="thinking-text">در حال فکر کردن...</span>' +
        '</div>' +
      '</div>';
    if (area) {
      area.appendChild(thinkEl);
      area.scrollTop = area.scrollHeight;
    }

    try {
      if (isImageReq) {
        // === ساخت عکس ===
        await this._generateImageResponse(text, thinkId);
      } else {
        // === پاسخ متنی ===
        await this._generateTextResponse(text, attachments, thinkId);
      }
    } catch (err) {
      console.error('chat error:', err);
      var t = document.getElementById(thinkId);
      if (t) t.remove();
      var msg = err.message || 'خطای ناشناخته';
      if (msg.length > 100) msg = msg.substring(0, 100) + '...';
      this.appendMessage('ai', '❌ خطا: ' + msg);
      APP.toast('❌ خطا');
    } finally {
      this._busy = false;
    }
  },

  // ============ پاسخ متنی ============
  _generateTextResponse: async function(text, attachments, thinkId) {
    var puterPrompt = text;

    // راهنما برای فکر کردن + پاسخ کوتاه
    var systemPrompt =
      'تو "ستاره" هستی، یه دستیار هوشمند فارسی‌زبان. ' +
      'قوانین:\n' +
      '۱. اول خوب فکر کن، بعد جواب بده.\n' +
      '۲. جواب‌ها کوتاه، دقیق و مستقیم باشن.\n' +
      '۳. از ایموجی کم استفاده کن.\n' +
      '۴. فارسی روان بنویس.\n\n' +
      'سوال کاربر: ' + text;

    if (attachments && attachments.length) {
      var fileInfo = attachments.map(function(a) {
        return '[' + a.type + ': ' + a.name + ']';
      }).join(', ');
      puterPrompt = systemPrompt + '\n\nفایل‌های ضمیمه: ' + fileInfo;
    } else {
      puterPrompt = systemPrompt;
    }

    var response = await puter.ai.chat(puterPrompt);
    var aiText = this._extractText(response);
    if (!aiText) aiText = 'متأسفانه نتونستم جواب بدم.';

    var t = document.getElementById(thinkId);
    if (t) t.remove();

    this.appendMessage('ai', aiText, null, this._history.length);
    this._history.push({ role: 'assistant', content: aiText, time: Date.now() });
    this._saveCurrentSession();
  },

  // ============ پاسخ ساخت عکس ============
  _generateImageResponse: async function(text, thinkId) {
    // تمیز کردن پرامپت
    var prompt = this._cleanImagePrompt(text);

    // ساخت عکس
    var el = await puter.ai.txt2img(prompt);
    var url = this._extractUrl(el);

    var t = document.getElementById(thinkId);
    if (t) t.remove();

    if (!url) throw new Error('عکسی ساخته نشد');

    // ساخت پیام با عکس
    var area = document.getElementById('chatArea');
    var wrap = document.createElement('div');
    wrap.className = 'msg ai';

    var html = '';
    html += '<div class="msg-avatar">✦</div>';
    html += '<div class="msg-body">';
    html += '<div class="msg-content">';
    html += '<div style="margin-bottom:8px;color:var(--text-2);font-size:13px;">🎨 عکس ساخته شد:</div>';
    html += '<img src="' + url + '" alt="generated" onclick="window.open(\'' + url + '\',\'_blank\')" style="cursor:pointer;max-width:100%;border-radius:12px;">';
    html += '<div style="margin-top:10px;font-size:12px;color:var(--text-3);">' + APP.esc(prompt) + '</div>';
    html += '</div>';

    // دکمه‌های اکشن
    html += '<div class="msg-actions">';
    html += '<button class="action-btn" onclick="CHAT._copyText(\'' + url + '\')" title="کپی لینک">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
      '</button>';
    html += '<button class="action-btn" onclick="CHAT._downloadImage(\'' + url + '\')" title="دانلود">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
      '</button>';
    html += '<button class="action-btn" onclick="CHAT._regenerateImage(\'' + APP.esc(prompt) + '\')" title="دوباره">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' +
      '</button>';
    html += '</div>';

    html += '</div>';
    wrap.innerHTML = html;
    if (area) {
      area.appendChild(wrap);
      area.scrollTop = area.scrollHeight;
    }

    var aiMsg = { role: 'assistant', content: '🎨 عکس: ' + prompt, imageUrl: url, time: Date.now() };
    this._history.push(aiMsg);
    this._saveCurrentSession();
  },

  // ============ پاکسازی پرامپت ============
  _cleanImagePrompt: function(text) {
    var t = text;
    var removeWords = [
      'یه عکس از', 'یک عکس از', 'یه تصویر از', 'یک تصویر از',
      'عکس بساز از', 'تصویر بساز از', 'عکس بساز', 'تصویر بساز',
      'نقاشی کن', 'بکش', 'یه عکس', 'یک عکس',
      'draw', 'generate image of', 'generate image', 'create image of', 'create image',
      'make an image of', 'make an image', 'picture of', 'image of'
    ];
    removeWords.forEach(function(w) {
      var re = new RegExp(w, 'gi');
      t = t.replace(re, '');
    });
    t = t.trim().replace(/^[،,.:؛;\s]+/, '').trim();
    return t || text;
  },

  // ============ تشخیص درخواست عکس ============
  _detectImageRequest: function(text) {
    if (!text) return false;
    var t = text.toLowerCase();
    for (var i = 0; i < this._imageTriggers.length; i++) {
      if (t.indexOf(this._imageTriggers[i].toLowerCase()) >= 0) return true;
    }
    return false;
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

  // ============ استخراج URL ============
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

  // ============ دانلود عکس ============
  _downloadImage: function(url) {
    APP.downloadFile(url, 'setareh-image-' + Date.now() + '.png');
  },

  // ============ بازتولید عکس ============
  _regenerateImage: function(prompt) {
    var input = document.getElementById('chatInput');
    if (input) {
      input.value = 'یه عکس از ' + prompt;
      this.send();
    }
  }
};

window.CHAT = CHAT;
// ============ ادامهٔ توابع CHAT (بخش ۲) ============

Object.assign(CHAT, {

  // ============ اضافه کردن پیام ============
  appendMessage: function(type, text, attachments, msgIndex) {
    var area = document.getElementById('chatArea');
    if (!area) return;

    var wrap = document.createElement('div');
    wrap.className = 'msg ' + type;
    if (typeof msgIndex === 'number') wrap.setAttribute('data-idx', msgIndex);

    var avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = type === 'user' ? '👤' : '✦';
    wrap.appendChild(avatar);

    var body = document.createElement('div');
    body.className = 'msg-body';

    var content = document.createElement('div');
    content.className = 'msg-content';

    var html = '';
    if (text) html += this._formatText(text);
    if (attachments && attachments.length) {
      attachments.forEach(function(a) {
        if (a.type === 'image') html += '<br><img src="' + a.url + '" alt="">';
        else if (a.type === 'video') html += '<br><video src="' + a.url + '" controls playsinline></video>';
      });
    }
    content.innerHTML = html;
    body.appendChild(content);

    // دکمه‌های اکشن
    var actions = this._buildActions(type, text, msgIndex);
    if (actions) body.appendChild(actions);

    wrap.appendChild(body);
    area.appendChild(wrap);

    setTimeout(function() { area.scrollTop = area.scrollHeight; }, 50);
  },

  // ============ ساخت دکمه‌های اکشن ============
  _buildActions: function(type, text, msgIndex) {
    var actions = document.createElement('div');
    actions.className = 'msg-actions';

    var self = this;
    var hasText = text && text.length > 0;

    if (hasText) {
      var copyBtn = document.createElement('button');
      copyBtn.className = 'action-btn';
      copyBtn.title = 'کپی';
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      copyBtn.onclick = function(e) { e.stopPropagation(); self._copyText(text); };
      actions.appendChild(copyBtn);
    }

    if (type === 'user' && hasText) {
      var editBtn = document.createElement('button');
      editBtn.className = 'action-btn';
      editBtn.title = 'ویرایش';
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      editBtn.onclick = function(e) { e.stopPropagation(); self._editMessage(msgIndex, text); };
      actions.appendChild(editBtn);
    }

    if (type === 'ai') {
      var regenBtn = document.createElement('button');
      regenBtn.className = 'action-btn';
      regenBtn.title = 'پاسخ جدید';
      regenBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
      regenBtn.onclick = function(e) { e.stopPropagation(); self._regenerate(msgIndex); };
      actions.appendChild(regenBtn);
    }

    return actions.children.length ? actions : null;
  },

  // ============ کپی ============
  _copyText: function(text) {
    var self = this;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        APP.toast('✅ کپی شد');
        APP.vibrate(15);
      }).catch(function() { self._fallbackCopy(text); });
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
    } catch(e) { APP.toast('❌ خطا در کپی'); }
  },

  // ============ ویرایش پیام ============
  _editMessage: function(msgIndex, text) {
    var input = document.getElementById('chatInput');
    if (!input) return;
    input.value = text;
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    APP.toast('✏️ پیام آماده ویرایش');
    APP.vibrate(15);
  },

  // ============ بازتولید پاسخ ============
  _regenerate: async function(msgIndex) {
    if (this._busy) return;
    if (typeof msgIndex !== 'number') return;

    var userMsg = null;
    for (var i = msgIndex - 1; i >= 0; i--) {
      if (this._history[i] && this._history[i].role === 'user') { userMsg = this._history[i]; break; }
    }
    if (!userMsg) { APP.toast('❌ پیام پیدا نشد'); return; }

    this._history = this._history.slice(0, msgIndex);

    var area = document.getElementById('chatArea');
    var allMsgs = area.querySelectorAll('.msg');
    allMsgs.forEach(function(el, idx) { if (idx >= msgIndex) el.remove(); });

    this._busy = true;
    APP.vibrate(20);

    var thinkId = 'think-' + Date.now();
    var thinkEl = document.createElement('div');
    thinkEl.className = 'msg ai';
    thinkEl.id = thinkId;
    thinkEl.innerHTML =
      '<div class="msg-avatar">✦</div>' +
      '<div class="msg-body"><div class="thinking-box">' +
        '<div class="dots"><span></span><span></span><span></span></div>' +
        '<span class="thinking-text">در حال فکر کردن...</span>' +
      '</div></div>';
    area.appendChild(thinkEl);

    try {
      var response = await puter.ai.chat(userMsg.content);
      var aiText = this._extractText(response);
      if (!aiText) aiText = 'متأسفانه نتونستم جواب بدم.';

      var t = document.getElementById(thinkId);
      if (t) t.remove();

      this.appendMessage('ai', aiText, null, this._history.length);
      this._history.push({ role: 'assistant', content: aiText, time: Date.now() });
      this._saveCurrentSession();
      APP.toast('✅ پاسخ جدید');
    } catch (err) {
      console.error(err);
      var t = document.getElementById(thinkId);
      if (t) t.remove();
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
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`(.+?)`/g, '<code>$1</code>');
    s = s.replace(/\n/g, '<br>');
    return s;
  },

  _esc: function(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  },

  // ============ آپلود فایل ============
  onFiles: function(e) {
    var files = Array.from(e.target.files || []);
    var self = this;
    files.forEach(function(file) {
      var type = file.type.startsWith('image/') ? 'image' :
                 file.type.startsWith('video/') ? 'video' : null;
      if (!type) return;
      if (file.size > 20 * 1024 * 1024) { APP.toast('❌ فایل بزرگه'); return; }
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
    if (!this._attachments.length) { box.innerHTML = ''; return; }
    var self = this;
    box.innerHTML = '';
    this._attachments.forEach(function(a, idx) {
      var item = document.createElement('div');
      item.className = 'attachment-item';
      if (a.type === 'image') {
        var img = document.createElement('img'); img.src = a.url; item.appendChild(img);
      } else {
        var v = document.createElement('video'); v.src = a.url; v.muted = true; item.appendChild(v);
      }
      var rm = document.createElement('button');
      rm.className = 'rm-att';
      rm.textContent = '✕';
      rm.onclick = function() { self._attachments.splice(idx, 1); self.renderAttachments(); };
      item.appendChild(rm);
      box.appendChild(item);
    });
  },

  // ============ ضبط صدا ============
  toggleVoice: function() {
    if (this._recording) this.stopVoice();
    else this.startVoice();
  },

  startVoice: function() {
    var self = this;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { APP.toast('❌ مرورگرت پشتیبانی نمی‌کند'); return; }
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
        var interim = '', final = '';
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
        if (ev.error === 'not-allowed') APP.toast('❌ میکروفون داده نشد');
        else if (ev.error === 'no-speech') APP.toast('🔇 صدایی شنیده نشد');
        self.stopVoice();
      };
      rec.onend = function() { self.stopVoice(); };

      rec.start();
      this._recognition = rec;
      this._recording = true;
      APP.vibrate(30);
    } catch (err) { APP.toast('❌ خطا'); }
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
    if (input && input.value.trim()) this.send();
  },

  // ============ سشن‌ها ============
  loadSessions: function() {
    try {
      var saved = localStorage.getItem('setareh_sessions');
      var currentId = localStorage.getItem('setareh_current_session');
      this._sessions = saved ? JSON.parse(saved) : [];
      this._currentSessionId = currentId || null;

      if (!this._sessions.length) {
        this.createNewSession();
      } else {
        var found = this._sessions.find(function(s) { return s.id === this._currentSessionId; }.bind(this));
        if (!found) this._currentSessionId = this._sessions[0].id;
        this._loadCurrentMessages();
        this.renderHistory();
      }
    } catch(e) {
      this._sessions = [];
      this.createNewSession();
    }
  },

  saveSessions: function() {
    try {
      localStorage.setItem('setareh_sessions', JSON.stringify(this._sessions.slice(-30)));
      localStorage.setItem('setareh_current_session', this._currentSessionId || '');
    } catch(e) {}
  },

  _loadCurrentMessages: function() {
    var s = this._sessions.find(function(x) { return x.id === this._currentSessionId; }.bind(this));
    this._history = s ? (s.messages || []) : [];
  },

  createNewSession: function() {
    var id = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    var session = { id: id, title: 'چت جدید', messages: [], createdAt: Date.now() };
    this._sessions.unshift(session);
    this._currentSessionId = id;
    this._history = [];
    this.saveSessions();
    return id;
  },

  newChat: function() {
    this.createNewSession();
    this._attachments = [];
    this.renderAttachments();
    this.renderHistory();
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    APP.toast('✨ چت جدید');
    APP.vibrate(20);
  },

  switchSession: function(id) {
    this._currentSessionId = id;
    this._loadCurrentMessages();
    this.saveSessions();
    this.renderHistory();
    this.renderSidebar();
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    APP.vibrate(15);
  },

  deleteSession: function(id) {
    if (!confirm('این چت حذف بشه؟')) return;
    this._sessions = this._sessions.filter(function(s) { return s.id !== id; }.bind(this));
    if (this._currentSessionId === id) {
      if (this._sessions.length) {
        this._currentSessionId = this._sessions[0].id;
        this._loadCurrentMessages();
      } else {
        this.createNewSession();
      }
    }
    this.saveSessions();
    this.renderSidebar();
    this.renderHistory();
    APP.toast('🗑️ حذف شد');
  },

  _updateTitle: function() {
    var s = this._sessions.find(function(x) { return x.id === this._currentSessionId; }.bind(this));
    if (!s) return;
    if (s.messages && s.messages.length > 0 && s.title === 'چت جدید') {
      var first = s.messages.find(function(m) { return m.role === 'user'; });
      if (first && first.content) s.title = first.content.substring(0, 35);
    }
    this.saveSessions();
  },

  _saveCurrentSession: function() {
    var s = this._sessions.find(function(x) { return x.id === this._currentSessionId; }.bind(this));
    if (s) s.messages = this._history.slice(-100);
    this.saveSessions();
  },

  // ============ Sidebar ============
  renderSidebar: function() {
    var list = document.getElementById('sidebarList');
    if (!list) return;
    var self = this;

    if (!this._sessions.length) {
      list.innerHTML = '<div class="sidebar-empty">هنوز چتی نداری</div>';
      return;
    }

    list.innerHTML = '';
    this._sessions.forEach(function(s) {
      var item = document.createElement('div');
      item.className = 'sidebar-item' + (s.id === self._currentSessionId ? ' active' : '');
      item.onclick = function() { self.switchSession(s.id); };

      var title = document.createElement('div');
      title.className = 'sidebar-item-title';
      title.textContent = s.title || 'چت جدید';
      item.appendChild(title);

      var del = document.createElement('button');
      del.className = 'sidebar-item-del';
      del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>';
      del.onclick = function(e) { e.stopPropagation(); self.deleteSession(s.id); };
      item.appendChild(del);

      list.appendChild(item);
    });
  },

  // ============ رندر تاریخچه ============
  renderHistory: function() {
    var area = document.getElementById('chatArea');
    if (!area) return;

    if (!this._history.length) {
      this._showWelcome();
      return;
    }

    area.innerHTML = '';
    var self = this;
    this._history.forEach(function(m, i) {
      if (m.imageUrl) {
        self._renderImageMessage(m.imageUrl, m.content.replace('🎨 عکس: ', ''), i);
      } else {
        self.appendMessage(m.role === 'user' ? 'user' : 'ai', m.content, m.attachments, i);
      }
    });
  },

  _renderImageMessage: function(url, prompt, msgIndex) {
    var area = document.getElementById('chatArea');
    var wrap = document.createElement('div');
    wrap.className = 'msg ai';
    wrap.setAttribute('data-idx', msgIndex);

    var html = '';
    html += '<div class="msg-avatar">✦</div>';
    html += '<div class="msg-body">';
    html += '<div class="msg-content">';
    html += '<div style="margin-bottom:8px;color:var(--text-2);font-size:13px;">🎨 عکس ساخته شد:</div>';
    html += '<img src="' + url + '" alt="generated" onclick="window.open(\'' + url + '\',\'_blank\')" style="cursor:pointer;max-width:100%;border-radius:12px;">';
    html += '<div style="margin-top:10px;font-size:12px;color:var(--text-3);">' + this._esc(prompt) + '</div>';
    html += '</div>';
    html += '<div class="msg-actions">';
    html += '<button class="action-btn" onclick="CHAT._copyText(\'' + url + '\')" title="کپی">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
      '</button>';
    html += '</div>';
    html += '</div>';
    wrap.innerHTML = html;
    area.appendChild(wrap);
  },

  _showWelcome: function() {
    var area = document.getElementById('chatArea');
    if (!area) return;
    var self = this;

    area.innerHTML =
      '<div class="welcome" id="chatWelcome">' +
        '<div class="welcome-logo">' +
          '<div class="logo-orb"></div>' +
          '<div class="logo-rings"><span></span><span></span><span></span></div>' +
          '<div class="logo-star">✦</div>' +
        '</div>' +
        '<div class="welcome-title">سلام! من <span class="grad-text">ستاره</span> هستم</div>' +
        '<div class="welcome-sub">چطور می‌تونم امروز کمکت کنم؟</div>' +
        '<div class="suggestions">' +
          '<button class="sug-card" data-prompt="یه عکس از یه گربه فضانورد بساز">' +
            '<div class="sug-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>' +
            '<div class="sug-text"><div class="sug-title">ساخت عکس</div><div class="sug-desc">یه تصویر از تخیلت بساز</div></div>' +
          '</button>' +
          '<button class="sug-card" data-prompt="یه شعر کوتاه درباره پاییز بنویس">' +
            '<div class="sug-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>' +
            '<div class="sug-text"><div class="sug-title">نوشتن</div><div class="sug-desc">شعر، متن، ایمیل بنویس</div></div>' +
          '</button>' +
          '<button class="sug-card" data-prompt="کوانتوم رو خیلی ساده برام توضیح بده">' +
            '<div class="sug-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>' +
            '<div class="sug-text"><div class="sug-title">توضیح بده</div><div class="sug-desc">هر موضوعی رو ساده بفهم</div></div>' +
          '</button>' +
          '<button class="sug-card" data-prompt="چند تا ایده خلاقانه برای یه پروژه جدید بده">' +
            '<div class="sug-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/></svg></div>' +
            '<div class="sug-text"><div class="sug-title">ایده بده</div><div class="sug-desc">پروژه، کار، کسب‌وکار</div></div>' +
          '</button>' +
        '</div>' +
      '</div>';

    area.querySelectorAll('.sug-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var prompt = this.getAttribute('data-prompt');
        var input = document.getElementById('chatInput');
        if (prompt && input) { input.value = prompt; self.send(); }
      });
    });
  }
});
