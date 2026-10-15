// ===== js/chat.js — چت با هوش مصنوعی =====

var CHAT = {
  _history: [],   // تاریخچهٔ چت
  _busy: false,

  init: function() {
    console.log('💬 CHAT: آماده');
  },

  // ============ ارسال پیام ============
  sendChat: async function() {
    if (this._busy) return;

    var input = document.getElementById('chatInput');
    var area = document.getElementById('chatArea');
    if (!input || !area) return;

    var text = (input.value || '').trim();
    if (!text) return;

    // چک Puter
    if (typeof puter === 'undefined' || !puter.ai) {
      APP.toast('❌ Puter.js لود نشده');
      return;
    }

    this._busy = true;
    input.value = '';
    APP.vibrate(20);

    // پیام کاربر
    this._appendMessage('user', text);

    // ذخیره در تاریخچه
    this._history.push({ role: 'user', content: text });

    // نمایش لودینگ
    var loadingId = 'chat-loading-' + Date.now();
    var loading = document.createElement('div');
    loading.className = 'chat-msg ai';
    loading.id = loadingId;
    loading.innerHTML = '<div class="chat-bubble">' +
      '<span style="display:inline-block;animation:pulse 1s infinite;">✍️ در حال نوشتن...</span>' +
      '</div>';
    area.appendChild(loading);
    area.scrollTop = area.scrollHeight;

    try {
      // ============ درخواست به Puter ============
      var response = await puter.ai.chat(text);

      // حذف لودینگ
      var l = document.getElementById(loadingId);
      if (l) l.remove();

      // استخراج متن
      var aiText = '';
      if (typeof response === 'string') {
        aiText = response;
      } else if (response && response.message && response.message.content) {
        aiText = response.message.content;
      } else if (response && response.text) {
        aiText = response.text;
      } else if (response && response.toString) {
        aiText = response.toString();
      } else {
        aiText = 'متأسفانه نتونستم جواب بدم. دوباره امتحان کن.';
      }

      // اگه آرایه بود
      if (Array.isArray(aiText)) {
        aiText = aiText.map(function(x) { return x.text || x; }).join('\n');
      }

      // ذخیره در تاریخچه
      this._history.push({ role: 'assistant', content: aiText });

      // نمایش
      this._appendMessage('ai', aiText);
      APP.vibrate(20);

    } catch (err) {
      console.error('chat error:', err);
      var l = document.getElementById(loadingId);
      if (l) l.remove();

      var msg = err.message || 'خطای ناشناخته';
      this._appendMessage('ai', '❌ خطا: ' + msg);
      APP.toast('❌ خطا در پاسخ');
      APP.vibrate(50);
    } finally {
      this._busy = false;
    }
  },

  // ============ اضافه کردن پیام ============
  _appendMessage: function(type, text) {
    var area = document.getElementById('chatArea');
    if (!area) return;

    var wrap = document.createElement('div');
    wrap.className = 'chat-msg ' + type;

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = this._formatText(text);

    wrap.appendChild(bubble);
    area.appendChild(wrap);

    // اسکرول به پایین
    setTimeout(function() {
      area.scrollTop = area.scrollHeight;
    }, 50);
  },

  // ============ فرمت متن ============
  _formatText: function(text) {
    if (!text) return '';
    var s = String(text);

    // Escape
    s = s.replace(/[&<>]/g, function(c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;' }[c];
    });

    // خط جدید
    s = s.replace(/\n/g, '<br>');

    // بولد **text**
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // کد `text`
    s = s.replace(/`(.+?)`/g, '<code style="background:rgba(108,92,231,.15);padding:2px 6px;border-radius:6px;font-family:monospace;font-size:12px;">$1</code>');

    return s;
  },

  // ============ پاک کردن چت ============
  clear: function() {
    if (!confirm('مطمئنی می‌خوای چت رو پاک کنی؟')) return;
    this._history = [];
    var area = document.getElementById('chatArea');
    if (area) {
      area.innerHTML = '<div class="chat-msg ai">' +
        '<div class="chat-bubble">' +
        'سلام! 👋 من ستاره‌ام، دستیار هوشمندت.<br>' +
        'هر سوالی داری بپرس، کمکت می‌کنم! ✨' +
        '</div>' +
        '</div>';
    }
    APP.toast('🗑️ چت پاک شد');
    APP.vibrate(20);
  }
};

window.CHAT = CHAT;
