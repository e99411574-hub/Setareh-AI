// ===== js/chat.js — چت با هوش مصنوعی + چند چت =====

var CHAT = {
  _busy: false,
  _history: [],
  _attachments: [],
  _recognition: null,
  _recording: false,

  // سیستم چند چت
  _sessions: [],
  _currentSessionId: null,

  // کلیدواژه‌های تشخیص
  _triggers: {
    image: ['عکس بساز', 'تصویر بساز', 'نقاشی کن', 'بکش', 'بساز عکس', 'یه عکس', 'یک عکس', 'یه تصویر', 'یک تصویر', 'draw', 'generate image', 'create image', 'make an image'],
    video: ['ویدیو بساز', 'فیلم بساز', 'انیمیشن بساز', 'یه ویدیو', 'یک ویدیو', 'make video', 'create video', 'generate video'],
    edit: ['اصلاح کن', 'ویرایش کن', 'ادیت کن', 'تغییر بده', 'edit image', 'modify image'],
    tts: ['صدا بساز', 'تبدیل به صدا', 'به صدا تبدیل', 'text to speech', 'tts']
  },

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

    // دکمهٔ چت جدید
    var newBtn = document.getElementById('chatNewBtn');
    if (newBtn) newBtn.addEventListener('click', function() { self.newChat(); });

    // دکمهٔ تاریخچه
    var historyBtn = document.getElementById('chatHistoryBtn');
    if (historyBtn) historyBtn.addEventListener('click', function() { self.showHistoryMenu(); });

    // دکمهٔ پاک کردن
    var clearBtn = document.getElementById('chatClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', function() { self.clearCurrent(); });

    document.querySelectorAll('.chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var prompt = this.getAttribute('data-prompt');
        if (prompt && input) {
          input.value = prompt;
          self.send();
        }
      });
    });

    // لود کردن سشن‌ها
    this.loadSessions();

    console.log('💬 CHAT: آماده');
  },

  // ============ سشن‌ها ============
  loadSessions: function() {
    try {
      var saved = localStorage.getItem('setareh_sessions');
      var currentId = localStorage.getItem('setareh_current_session');
      this._sessions = saved ? JSON.parse(saved) : [];
      this._currentSessionId = currentId || null;

      // اگه سشنی نیست، یکی بساز
      if (!this._sessions.length) {
        this.createNewSession();
      } else {
        // اگه currentId درست نیست
        var found = this._sessions.find(function(s) { return s.id === this._currentSessionId; }.bind(this));
        if (!found) {
          this._currentSessionId = this._sessions[0].id;
        }
        // بارگذاری پیام‌های سشن فعلی
        this._loadCurrentMessages();
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
    if (s) {
      this._history = s.messages || [];
    } else {
      this._history = [];
    }
  },

  createNewSession: function() {
    var id = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    var session = {
      id: id,
      title: 'چت جدید',
      messages: [],
      createdAt: Date.now()
    };
    this._sessions.unshift(session);
    this._currentSessionId = id;
    this._history = [];
    this.saveSessions();
    return id;
  },

  newChat: function() {
    if (this._history.length > 0) {
      // فقط اگه چت فعلی پیام داره، چت جدید بساز
    }
    this.createNewSession();
    this._attachments = [];
    this.renderAttachments();
    this.renderHistory();
    APP.toast('✨ چت جدید');
    APP.vibrate(20);
  },

  switchSession: function(id) {
    this._currentSessionId = id;
    this._loadCurrentMessages();
    this.saveSessions();
    this.renderHistory();
    this.closeHistoryMenu();
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
    this.renderHistory();
    this.closeHistoryMenu();
    APP.toast('🗑️ حذف شد');
  },

  _updateCurrentSessionTitle: function() {
    var s = this._sessions.find(function(x) { return x.id === this._currentSessionId; }.bind(this));
    if (!s) return;
    if (s.messages && s.messages.length > 0 && s.title === 'چت جدید') {
      // اولین پیام کاربر رو به عنوان عنوان بگیر
      var first = s.messages.find(function(m) { return m.role === 'user'; });
      if (first) {
        s.title = (first.content || '').substring(0, 30);
      }
    }
  },

  // ============ منوی تاریخچه ============
  showHistoryMenu: function() {
    var self = this;
    var overlay = document.createElement('div');
    overlay.className = 'chat-history-overlay';
    overlay.id = 'chatHistoryOverlay';
    overlay.onclick = function(e) { if (e.target === overlay) self.closeHistoryMenu(); };

    var html = '<div class="chat-history-box">';
    html += '<div class="chat-history-head">';
    html += '<div class="chat-history-title">تاریخچهٔ چت‌ها</div>';
    html += '<button class="chat-history-close" onclick="CHAT.closeHistoryMenu()">✕</button>';
    html += '</div>';

    html += '<button class="chat-history-new" onclick="CHAT.newChat(); CHAT.closeHistoryMenu();">';
    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    html += '<span>چت جدید</span>';
    html += '</button>';

    html += '<div class="chat-history-list">';

    if (!this._sessions.length) {
      html += '<div class="chat-history-empty">هنوز چتی نداری</div>';
    } else {
      this._sessions.forEach(function(s) {
        var active = s.id === self._currentSessionId ? ' active' : '';
        var msgCount = s.messages ? s.messages.length : 0;
        var preview = '';
        if (s.messages && s.messages.length) {
          var last = s.messages[s.messages.length - 1];
          preview = (last.content || '').substring(0, 40);
        } else {
          preview = 'خالی';
        }
        var timeStr = self._formatTimeAgo(s.createdAt);

        html += '<div class="chat-history-item' + active + '" onclick="CHAT.switchSession(\'' + s.id + '\')">';
        html += '<div class="chat-history-item-body">';
        html += '<div class="chat-history-item-title">' + self._esc(s.title || 'چت جدید') + '</div>';
        html += '<div class="chat-history-item-preview">' + self._esc(preview) + '</div>';
        html += '<div class="chat-history-item-meta">' + msgCount + ' پیام · ' + timeStr + '</div>';
        html += '</div>';
        html += '<button class="chat-history-item-del" onclick="event.stopPropagation(); CHAT.deleteSession(\'' + s.id + '\')">';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>';
        html += '</button>';
        html += '</div>';
      });
    }

    html += '</div>';
    html += '</div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    setTimeout(function() {
      overlay.classList.add('open');
    }, 10);

    APP.vibrate(15);
  },

  closeHistoryMenu: function() {
    var el = document.getElementById('chatHistoryOverlay');
    if (el) {
      el.classList.remove('open');
      setTimeout(function() { el.remove(); }, 250);
    }
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

    // تشخیص نوع درخواست
    var detected = this._detectRequest(text);

    this.appendMessage('user', text, attachments, this._history.length);

    var userMsg = { role: 'user', content: text, attachments: attachments, time: Date.now() };
    this._history.push(userMsg);
    this._saveCurrentSession();
    this._updateCurrentSessionTitle();

    // اگه درخواست خاص بود، پیشنهاد بده
    if (detected && !attachments.length) {
      this._showRedirectSuggestion(detected);
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
      this._saveCurrentSession();
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

  // ============ تشخیص ============
  _detectRequest: function(text) {
    if (!text) return null;
    var t = text.toLowerCase();

    for (var i = 0; i < this._triggers.image.length; i++) {
      if (t.indexOf(this._triggers.image[i].toLowerCase()) >= 0) return 'image';
    }
    for (var i = 0; i < this._triggers.video.length; i++) {
      if (t.indexOf(this._triggers.video[i].toLowerCase()) >= 0) return 'video';
    }
    for (var i = 0; i < this._triggers.edit.length; i++) {
      if (t.indexOf(this._triggers.edit[i].toLowerCase()) >= 0) return 'edit';
    }
    for (var i = 0; i < this._triggers.tts.length; i++) {
      if (t.indexOf(this._triggers.tts[i].toLowerCase()) >= 0) return 'tts';
    }
    return null;
  },

  // ============ پیشنهاد ریدایرکت ============
  _showRedirectSuggestion: function(type) {
    var config = {
      image: {
        icon: '🖼️',
        title: 'ساخت عکس',
        desc: 'برای ساخت عکس، پنل اختصاصی داریم که دقیق‌تر و سریع‌تره.',
        btnLabel: '🖼️ رفتن به ساخت عکس',
        handler: 'CHAT.goToImage'
      },
      video: {
        icon: '🎬',
        title: 'ساخت ویدیو',
        desc: 'برای ساخت ویدیو، پنل اختصاصی داریم که دقیق‌تر و سریع‌تره.',
        btnLabel: '🎬 رفتن به ساخت ویدیو',
        handler: 'CHAT.goToVideo'
      },
      edit: {
        icon: '✏️',
        title: 'ویرایش عکس',
        desc: 'برای ویرایش عکس، پنل اختصاصی داریم. عکست رو آپلود کن و توضیح بده.',
        btnLabel: '✏️ رفتن به ویرایش عکس',
        handler: 'CHAT.goToEdit'
      },
      tts: {
        icon: '🔊',
        title: 'تبدیل متن به صدا',
        desc: 'برای تبدیل متن به صدا، پنل اختصاصی داریم.',
        btnLabel: '🔊 رفتن به پنل صدا',
        handler: 'CHAT.goToTts'
      }
    };

    var c = config[type];
    if (!c) return;

    var text = c.icon + ' به نظر می‌رسه می‌خوای **' + c.title + '** انجام بدی!\n\n' +
      c.desc + '\n\n' +
      'می‌تونی روی دکمهٔ پایین بزنی تا مستقیم بری 👇';

    this.appendMessage('ai', text, null, this._history.length, {
      action: { label: c.btnLabel, handler: c.handler }
    });

    this._history.push({ role: 'assistant', content: text, time: Date.now() });
    this._saveCurrentSession();
  },

  // ============ رفتن به پنل‌ها ============
  goToImage: function() {
    if (typeof ROUTER !== 'undefined' && ROUTER.go) ROUTER.go('image');
  },
  goToVideo: function() {
    if (typeof ROUTER !== 'undefined' && ROUTER.go) ROUTER.go('video');
  },
  goToEdit: function() {
    if (typeof ROUTER !== 'undefined' && ROUTER.go) ROUTER.go('edit');
  },
  goToTts: function() {
    if (typeof ROUTER !== 'undefined' && ROUTER.go) ROUTER.go('tts');
  },

  // ============ ذخیره سشن فعلی ============
  _saveCurrentSession: function() {
    var s = this._sessions.find(function(x) { return x.id === this._currentSessionId; }.bind(this));
    if (s) {
      s.messages = this._history.slice(-100);
    }
    this.saveSessions();
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
    if (text) content += this._formatText(text);

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

    if (type === 'ai' && !opts.action) {
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

  // ============ ادیت پیام ============
  _editMessage: function(msgIndex, text) {
    var input = document.getElementById('chatInput');
    if (!input) return;
    input.value = text;
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    APP.toast('✏️ پیام آماده ویرایش');
    APP.vibrate(15);
  },

  // ============ بازتولید ============
  _regenerate: async function(msgIndex) {
    if (this._busy) return;
    if (typeof msgIndex !== 'number') return;

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

    this._history = this._history.slice(0, msgIndex);

    var area = document.getElementById('chatArea');
    var allMsgs = area.querySelectorAll('.chat-msg');
    allMsgs.forEach(function(el, idx) {
      if (idx >= msgIndex) el.remove();
    });

    this._busy = true;
    APP.vibrate(20);

    var loadingId = 'typing-' + Date.now();
    var loadingEl = document.createElement('div');
    loadingEl.className = 'chat-msg ai';
    loadingEl.id = loadingId;
    loadingEl.innerHTML = '<div class="chat-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
    area.appendChild(loadingEl);

    try {
      var response = await puter.ai.chat(userMsg.content);
      var aiText = this._extractText(response);
      if (!aiText) aiText = 'متأسفانه نتونستم جواب بدم.';

      var l = document.getElementById(loadingId);
      if (l) l.remove();

      this.appendMessage('ai', aiText, null, this._history.length);
      this._history.push({ role: 'assistant', content: aiText, time: Date.now() });
      this._saveCurrentSession();
      APP.toast('✅ پاسخ جدید');
    } catch (err) {
      console.error(err);
      var l = document.getElementById(loadingId);
      if (l) l.remove();
      APP.toast('❌ خطا');
    } finally {
      this._busy = false;
    }
  },

  // ============ فرمت ============
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

  _esc: function(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  },

  _formatTimeAgo: function(ts) {
    if (!ts) return '';
    var diff = Date.now() - ts;
    var mins = Math.floor(diff / 60000);
    var hours = Math.floor(diff / 3600000);
    var days = Math.floor(diff / 86400000);
    if (mins < 1) return 'همین الان';
    if (mins < 60) return mins + ' دقیقه پیش';
    if (hours < 24) return hours + ' ساعت پیش';
    if (days < 7) return days + ' روز پیش';
    return Math.floor(days / 7) + ' هفته پیش';
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
    if (this._recording) this.stopVoice();
    else this.startVoice();
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
        if (ev.error === 'not-allowed') APP.toast('❌ دسترسی به میکروفون داده نشد');
        else if (ev.error === 'no-speech') APP.toast('🔇 صدایی شنیده نشد');
        self.stopVoice();
      };

      rec.onend = function() { self.stopVoice(); };

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
    if (input && input.value.trim()) this.send();
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
          '<button class="chip" data-prompt="یه ایده برای یه اپلیکیشن جدید بده">ایده بده</button>' +
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

  clearCurrent: function() {
    if (!confirm('این چت پاک بشه؟')) return;
    this._history = [];
    this._attachments = [];
    var s = this._sessions.find(function(x) { return x.id === this._currentSessionId; }.bind(this));
    if (s) {
      s.messages = [];
      s.title = 'چت جدید';
    }
    this.saveSessions();
    this.renderAttachments();
    this.renderHistory();
    APP.toast('🗑️ پاک شد');
    APP.vibrate(20);
  }
};

window.CHAT = CHAT;

window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (typeof CHAT !== 'undefined') {
      CHAT.loadSessions();
      CHAT.renderHistory();
    }
  }, 100);
});
