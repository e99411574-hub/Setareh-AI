/* ═══════════════════════════════════════════════════
   Setareh AI — chat.js
   مدیریت چت، سشن‌ها، پیام‌ها و Puter.js
   ═══════════════════════════════════════════════════ */

window.CHAT = {
  /* ─── State ─── */
  sessions: [],
  currentId: null,
  isGenerating: false,
  searchQuery: '',
  attachments: [],

  /* ─── DOM ─── */
  el: {},

  /* ─── Init ─── */
  init() {
    this.cacheDom();
    this.loadSessions();

    if (this.sessions.length === 0) {
      this.createSession();
    } else {
      this.currentId = this.sessions[0].id;
      this.render();
    }

    this.bindEvents();
    console.log('[CHAT] ✅ initialized');
  },

  cacheDom() {
    this.el = {
      messages: document.getElementById('messages'),
      welcome: document.getElementById('welcome'),
      chatArea: document.getElementById('chatArea'),
      chatList: document.getElementById('chatList'),
      chatSearch: document.getElementById('chatSearch'),
      headerTitle: document.getElementById('headerTitle'),
      inputBox: document.getElementById('inputBox'),
      sendBtn: document.getElementById('sendBtn'),
      newChatBtn: document.getElementById('newChatBtn'),
      attachBtn: document.getElementById('attachBtn'),
      micBtn: document.getElementById('micBtn'),
      fileInput: document.getElementById('fileInput'),
      copyAllBtn: document.getElementById('copyAllBtn'),
      exportBtn: document.getElementById('exportBtn'),
    };
  },

  /* ═══════════════════════════════════════════════════
     سشن‌ها (Sessions)
     ═══════════════════════════════════════════════════ */

  createSession() {
    const session = {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: 'چت جدید',
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };

    this.sessions.unshift(session);
    this.currentId = session.id;
    this.saveSessions();
    this.render();
    return session;
  },

  getCurrentSession() {
    return this.sessions.find(s => s.id === this.currentId);
  },

  switchSession(id) {
    if (this.isGenerating) {
      this.toast('صبر کن، در حال پاسخ‌دهی...');
      return;
    }
    this.currentId = id;
    this.render();
    this.renderChatList();
    this.closeSidebar();
  },

  deleteSession(id) {
    const idx = this.sessions.findIndex(s => s.id === id);
    if (idx === -1) return;

    this.sessions.splice(idx, 1);

    if (this.currentId === id) {
      if (this.sessions.length === 0) {
        this.createSession();
        return;
      }
      this.currentId = this.sessions[0].id;
    }

    this.saveSessions();
    this.render();
    this.renderChatList();
  },

  togglePin(id) {
    const s = this.sessions.find(x => x.id === id);
    if (!s) return;
    s.pinned = !s.pinned;
    this.sortSessions();
    this.saveSessions();
    this.renderChatList();
    this.toast(s.pinned ? '📌 پین شد' : 'از پین خارج شد');
  },

  renameSession(id, newTitle) {
    const s = this.sessions.find(x => x.id === id);
    if (!s) return;
    s.title = (newTitle || 'بدون عنوان').trim().slice(0, 50);
    s.updatedAt = Date.now();
    this.saveSessions();
    this.renderChatList();
    this.updateHeaderTitle();
  },

  sortSessions() {
    this.sessions.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  },

  /* ═══════════════════════════════════════════════════
     localStorage
     ═══════════════════════════════════════════════════ */

  saveSessions() {
    try {
      localStorage.setItem('setareh_sessions', JSON.stringify(this.sessions));
      localStorage.setItem('setareh_current', this.currentId);
    } catch (e) {
      console.warn('[CHAT] save failed', e);
    }
  },

  loadSessions() {
    try {
      const raw = localStorage.getItem('setareh_sessions');
      if (raw) {
        this.sessions = JSON.parse(raw) || [];
        this.sortSessions();
      }
      const cur = localStorage.getItem('setareh_current');
      if (cur && this.sessions.some(s => s.id === cur)) {
        this.currentId = cur;
      }
    } catch (e) {
      console.warn('[CHAT] load failed', e);
      this.sessions = [];
    }
  },

  /* ═══════════════════════════════════════════════════
     Rendering
     ═══════════════════════════════════════════════════ */

  render() {
    this.renderMessages();
    this.renderChatList();
    this.updateHeaderTitle();
    this.updateWelcomeVisibility();
  },

  renderMessages() {
    const s = this.getCurrentSession();
    const box = this.el.messages;
    if (!box) return;

    box.innerHTML = '';

    if (!s || s.messages.length === 0) return;

    s.messages.forEach(msg => {
      box.appendChild(this.buildMessageEl(msg));
    });

    this.scrollToBottom(false);
  },

  buildMessageEl(msg) {
    const isUser = msg.role === 'user';
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + (isUser ? 'user' : 'ai');
    wrap.dataset.id = msg.id;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = isUser ? '👤' : 'س';

    const body = document.createElement('div');
    body.className = 'msg-body';

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    const name = document.createElement('span');
    name.className = 'msg-name';
    name.textContent = isUser ? 'تو' : 'ستاره';
    const time = document.createElement('span');
    time.textContent = this.formatTime(msg.time);
    meta.appendChild(name);
    meta.appendChild(time);

    const content = document.createElement('div');
    content.className = 'msg-content';
    this.renderContent(content, msg);

    body.appendChild(meta);
    body.appendChild(content);

    if (!msg.pending) {
      body.appendChild(this.buildActions(msg));
    }

    wrap.appendChild(avatar);
    wrap.appendChild(body);
    return wrap;
  },

  renderContent(container, msg) {
    container.innerHTML = '';

    if (msg.image) {
      const img = document.createElement('img');
      img.src = msg.image;
      img.alt = 'تصویر ساخته‌شده';
      img.loading = 'lazy';
      container.appendChild(img);
    }

    if (msg.attachment) {
      if (msg.attachment.type === 'image') {
        const img = document.createElement('img');
        img.src = msg.attachment.url;
        img.alt = 'پیوست';
        container.appendChild(img);
      } else if (msg.attachment.type === 'video') {
        const vid = document.createElement('video');
        vid.src = msg.attachment.url;
        vid.controls = true;
        container.appendChild(vid);
      }
    }

    if (msg.pending) {
      const typing = document.createElement('div');
      typing.className = 'typing';
      typing.innerHTML = '<span></span><span></span><span></span>';
      container.appendChild(typing);
      return;
    }

    if (msg.content) {
      const p = document.createElement('div');
      p.innerHTML = this.formatMarkdown(msg.content);
      container.appendChild(p);
    }
  },

  buildActions(msg) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action';
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      کپی`;
    copyBtn.onclick = () => this.copyMessage(msg.content);
    actions.appendChild(copyBtn);

    if (msg.role === 'user') {
      const editBtn = document.createElement('button');
      editBtn.className = 'msg-action';
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        ویرایش`;
      editBtn.onclick = () => this.editMessage(msg);
      actions.appendChild(editBtn);
    }

    if (msg.role === 'assistant') {
      const regenBtn = document.createElement('button');
      regenBtn.className = 'msg-action';
      regenBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        بازتولید`;
      regenBtn.onclick = () => this.regenerate(msg);
      actions.appendChild(regenBtn);
    }

    return actions;
  },

  renderChatList() {
    const box = this.el.chatList;
    if (!box) return;
    box.innerHTML = '';

    const q = this.searchQuery.trim().toLowerCase();
    const list = q
      ? this.sessions.filter(s =>
          s.title.toLowerCase().includes(q) ||
          s.messages.some(m => (m.content || '').toLowerCase().includes(q))
        )
      : this.sessions;

    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:20px;text-align:center;color:var(--text-3);font-size:12px';
      empty.textContent = q ? 'چیزی پیدا نشد' : 'هنوز چتی نداری';
      box.appendChild(empty);
      return;
    }

    list.forEach(s => {
      const item = document.createElement('div');
      item.className = 'chat-item';
      if (s.id === this.currentId) item.classList.add('active');
      if (s.pinned) item.classList.add('pinned');

      const icon = document.createElement('div');
      icon.className = 'chat-item-icon';
      icon.textContent = '💬';

      const text = document.createElement('div');
      text.className = 'chat-item-text';
      text.textContent = s.title;

      const del = document.createElement('button');
      del.className = 'chat-item-del';
      del.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        </svg>`;
      del.onclick = (e) => {
        e.stopPropagation();
        this.confirmDelete(s.id);
      };

      item.appendChild(icon);
      item.appendChild(text);
      item.appendChild(del);

      item.onclick = () => this.switchSession(s.id);

      item.ondblclick = (e) => {
        e.preventDefault();
        this.togglePin(s.id);
      };

      box.appendChild(item);
    });
  },

  updateHeaderTitle() {
    const s = this.getCurrentSession();
    if (!this.el.headerTitle) return;
    this.el.headerTitle.textContent = s ? s.title : 'ستاره';
  },

  updateWelcomeVisibility() {
    const s = this.getCurrentSession();
    const has = s && s.messages.length > 0;
    if (this.el.welcome) {
      this.el.welcome.style.display = has ? 'none' : 'block';
    }
  },

  scrollToBottom(smooth = true) {
    const area = this.el.chatArea;
    if (!area) return;
    requestAnimationFrame(() => {
      area.scrollTo({
        top: area.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    });
  },

  formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  },

  formatMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
      `<pre><code>${code.trim()}</code></pre>`
    );

    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br/>');

    return html;
  },

  toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), 2200);
  },

  closeSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('overlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('show');
  },

  bindEvents() {},
  sendMessage() {},
  copyMessage() {},
  editMessage() {},
  regenerate() {},
  confirmDelete() {},
};
/* ═══════════════════════════════════════════════════
   CHAT — بخش ۲: ارسال، Puter، رویدادها
   ═══════════════════════════════════════════════════ */

Object.assign(window.CHAT, {

  bindEvents() {
    const { inputBox, sendBtn, newChatBtn, attachBtn, micBtn, fileInput,
            copyAllBtn, exportBtn, chatSearch } = this.el;

    if (sendBtn) sendBtn.onclick = () => this.handleSend();

    if (inputBox) {
      inputBox.addEventListener('input', () => {
        this.autoResize();
        this.updateSendState();
      });
      inputBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSend();
        }
      });
    }

    if (newChatBtn) newChatBtn.onclick = () => {
      this.createSession();
      this.closeSidebar();
      setTimeout(() => inputBox && inputBox.focus(), 200);
    };

    if (attachBtn) attachBtn.onclick = () => fileInput && fileInput.click();
    if (fileInput) fileInput.onchange = (e) => this.handleAttach(e);

    if (micBtn) micBtn.onclick = () => this.toggleMic();

    if (copyAllBtn) copyAllBtn.onclick = () => this.copyAll();
    if (exportBtn) exportBtn.onclick = () => this.exportPDF();

    if (chatSearch) {
      chatSearch.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.renderChatList();
      };
    }

    if (this.el.headerTitle) {
      this.el.headerTitle.ondblclick = () => this.startRenameTitle();
    }
  },

  handleSend() {
    const text = (this.el.inputBox?.value || '').trim();
    if (!text && this.attachments.length === 0) return;
    if (this.isGenerating) {
      this.toast('صبر کن، دارم جواب می‌دم...');
      return;
    }

    this.sendMessage(text, null);
    this.el.inputBox.value = '';
    this.attachments = [];
    this.autoResize();
    this.updateSendState();
  },

  async sendMessage(text, attachment) {
    const s = this.getCurrentSession();
    if (!s) return;

    const userMsg = {
      id: 'm_' + Date.now(),
      role: 'user',
      content: text,
      attachment: attachment || (this.attachments[0] || null),
      time: Date.now(),
    };
    s.messages.push(userMsg);
    s.updatedAt = Date.now();

    if (s.title === 'چت جدید' && text) {
      s.title = text.slice(0, 32) + (text.length > 32 ? '…' : '');
    }

    this.saveSessions();
    this.updateWelcomeVisibility();
    this.updateHeaderTitle();
    this.renderMessages();
    this.renderChatList();

    const pendingMsg = {
      id: 'p_' + Date.now(),
      role: 'assistant',
      content: '',
      pending: true,
      time: Date.now(),
    };
    s.messages.push(pendingMsg);
    this.renderMessages();

    this.isGenerating = true;
    this.updateSendState();

    try {
      const wantsImage = /(عکس|تصویر|نقاشی|بکش|بساز.*عکس|image|draw|paint)/i.test(text);

      if (wantsImage && !attachment) {
        await this.generateImage(text, pendingMsg);
      } else {
        await this.generateText(text, attachment, pendingMsg);
      }
    } catch (err) {
      console.error('[CHAT] error:', err);
      pendingMsg.pending = false;
      pendingMsg.content = '⚠️ متأسفم، خطایی رخ داد: ' + (err.message || 'نامشخص');
    }

    pendingMsg.pending = false;
    this.isGenerating = false;
    this.saveSessions();
    this.renderMessages();
    this.renderChatList();
    this.updateSendState();
  },

  async generateText(prompt, attachment, pendingMsg) {
    let finalPrompt = prompt;

    if (attachment && attachment.type === 'image') {
      finalPrompt = `[کاربر یک عکس پیوست کرده]\n\n${prompt || 'این عکس رو توضیح بده'}`;
    }

    const response = await puter.ai.chat(finalPrompt, {
      model: 'gpt-5-nano',
    });

    let text = '';
    if (typeof response === 'string') {
      text = response;
    } else if (response?.message?.content) {
      text = response.message.content;
    } else if (response?.text) {
      text = response.text;
    } else if (response?.toString) {
      text = response.toString();
    }

    pendingMsg.content = text || 'پاسخی دریافت نشد.';
  },

  async generateImage(prompt, pendingMsg) {
    const cleanPrompt = prompt
      .replace(/(یه|یک)\s*عکس\s*(از|با)?/g, '')
      .replace(/(بساز|بکش|درست کن)/g, '')
      .trim() || prompt;

    pendingMsg.content = '🎨 دارم تصویر می‌سازم...';

    const result = await puter.ai.txt2img(cleanPrompt, {
      model: 'dall-e-3',
    });

    let imgUrl = '';
    if (typeof result === 'string') {
      imgUrl = result;
    } else if (result?.src) {
      imgUrl = result.src;
    } else if (result?.url) {
      imgUrl = result.url;
    } else if (result?.toString) {
      imgUrl = result.toString();
    }

    if (!imgUrl || !imgUrl.startsWith('http')) {
      throw new Error('تصویر ساخته نشد');
    }

    pendingMsg.image = imgUrl;
    pendingMsg.content = '✨ اینم تصویری که خواستی:';

    this.saveToGallery(imgUrl, cleanPrompt);
  },

  saveToGallery(url, prompt) {
    try {
      const g = JSON.parse(localStorage.getItem('setareh_gallery') || '[]');
      g.unshift({ url, prompt, time: Date.now() });
      localStorage.setItem('setareh_gallery', JSON.stringify(g.slice(0, 100)));
    } catch (e) {
      console.warn('[GALLERY] save failed', e);
    }
  },

  editMessage(msg) {
    const s = this.getCurrentSession();
    if (!s) return;

    const idx = s.messages.findIndex(m => m.id === msg.id);
    if (idx === -1) return;

    s.messages.splice(idx);
    this.saveSessions();
    this.renderMessages();
    this.renderChatList();

    this.el.inputBox.value = msg.content || '';
    this.autoResize();
    this.updateSendState();
    this.el.inputBox.focus();
  },

  async regenerate(aiMsg) {
    if (this.isGenerating) return;

    const s = this.getCurrentSession();
    if (!s) return;

    const idx = s.messages.findIndex(m => m.id === aiMsg.id);
    if (idx <= 0) return;

    const userMsg = s.messages[idx - 1];
    if (!userMsg || userMsg.role !== 'user') return;

    s.messages.splice(idx);

    this.sendMessage(userMsg.content, userMsg.attachment);
  },

  async copyMessage(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.toast('✅ کپی شد');
    } catch {
      this.toast('❌ کپی نشد');
    }
  },

  async copyAll() {
    const s = this.getCurrentSession();
    if (!s || s.messages.length === 0) {
      this.toast('چیزی برای کپی نیست');
      return;
    }

    const text = s.messages
      .filter(m => !m.pending)
      .map(m => {
        const who = m.role === 'user' ? '👤 من' : '✨ ستاره';
        const content = m.image ? `[تصویر: ${m.image}]` : m.content;
        return `${who}:\n${content}`;
      })
      .join('\n\n──────────\n\n');

    try {
      await navigator.clipboard.writeText(text);
      this.toast('✅ کل گفتگو کپی شد');
    } catch {
      this.toast('❌ کپی نشد');
    }
  },

  exportPDF() {
    const s = this.getCurrentSession();
    if (!s || s.messages.length === 0) {
      this.toast('چیزی برای خروجی نیست');
      return;
    }

    const win = window.open('', '_blank');
    const msgs = s.messages
      .filter(m => !m.pending)
      .map(m => {
        const who = m.role === 'user' ? 'من' : 'ستاره';
        const cls = m.role === 'user' ? 'user' : 'ai';
        const content = m.image
          ? `<img src="${m.image}" style="max-width:100%;border-radius:12px"/>`
          : this.formatMarkdown(m.content || '');
        return `<div class="m ${cls}"><b>${who}:</b><div>${content}</div></div>`;
      })
      .join('');

    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8"/>
        <title>${s.title} — ستاره</title>
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700&display=swap" rel="stylesheet"/>
        <style>
          body{font-family:Vazirmatn,sans-serif;padding:30px;line-height:1.8;color:#111;max-width:800px;margin:0 auto}
          h1{font-size:20px;border-bottom:2px solid #4d6bfe;padding-bottom:10px;margin-bottom:20px}
          .m{margin-bottom:16px;padding:12px 16px;border-radius:12px;background:#f5f6fa}
          .m.user{background:#e8edff;border-right:4px solid #4d6bfe}
          .m.ai{background:#f0f0f5;border-right:4px solid #8b5cf6}
          .m b{color:#4d6bfe;display:block;margin-bottom:6px}
          pre{background:#1a1a24;color:#fff;padding:12px;border-radius:8px;overflow-x:auto;direction:ltr;text-align:left}
          code{background:#e0e0e8;padding:2px 6px;border-radius:4px;font-family:monospace}
          pre code{background:none;padding:0}
          img{max-width:100%;border-radius:10px;margin-top:8px}
          @media print{body{padding:10px}}
        </style>
      </head>
      <body>
        <h1>${s.title}</h1>
        ${msgs}
        <script>setTimeout(()=>window.print(),800)<\/script>
      </body>
      </html>
    `);
    win.document.close();
  },

  startRenameTitle() {
    const el = this.el.headerTitle;
    if (!el) return;

    const s = this.getCurrentSession();
    if (!s) return;

    el.contentEditable = 'true';
    el.textContent = s.title;
    el.focus();

    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finish = () => {
      el.contentEditable = 'false';
      this.renameSession(s.id, el.textContent);
      this.updateHeaderTitle();
    };

    el.onblur = finish;
    el.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      }
      if (e.key === 'Escape') {
        el.textContent = s.title;
        el.blur();
      }
    };
  },

  handleAttach(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const type = file.type.startsWith('video') ? 'video' : 'image';
      this.attachments = [{
        type,
        url: ev.target.result,
        name: file.name,
      }];

      const preview = type === 'image'
        ? `📷 [تصویر: ${file.name}] `
        : `🎬 [ویدیو: ${file.name}] `;
      this.el.inputBox.value = preview + this.el.inputBox.value;
      this.updateSendState();
      this.toast('✅ پیوست شد');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  },

  async toggleMic() {
    if (this._recording) {
      this._recognition?.stop();
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.toast('مرورگر از ضبط صدا پشتیبانی نمی‌کنه');
      return;
    }

    const rec = new SR();
    rec.lang = 'fa-IR';
    rec.continuous = false;
    rec.interimResults = true;

    rec.onstart = () => {
      this._recording = true;
      this.toast('🎤 در حال ضبط...');
      const micBtn = this.el.micBtn;
      if (micBtn) micBtn.style.color = 'var(--danger)';
    };

    rec.onresult = (ev) => {
      let text = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        text += ev.results[i][0].transcript;
      }
      this.el.inputBox.value = text;
      this.autoResize();
      this.updateSendState();
    };

    rec.onend = () => {
      this._recording = false;
      const micBtn = this.el.micBtn;
      if (micBtn) micBtn.style.color = '';
    };

    rec.onerror = (e) => {
      console.warn('[MIC]', e.error);
      this.toast('خطای ضبط صدا');
      this._recording = false;
    };

    this._recognition = rec;
    rec.start();
  },

  autoResize() {
    const t = this.el.inputBox;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 160) + 'px';
  },

  updateSendState() {
    const t = this.el.inputBox;
    const btn = this.el.sendBtn;
    if (!t || !btn) return;
    const has = t.value.trim().length > 0 || this.attachments.length > 0;
    btn.disabled = !has || this.isGenerating;
  },

  confirmDelete(id) {
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('modalTitle');
    const text = document.getElementById('modalText');
    const cancel = document.getElementById('modalCancel');
    const confirm = document.getElementById('modalConfirm');

    if (!modal) {
      if (window.confirm('این چت حذف بشه؟')) this.deleteSession(id);
      return;
    }

    const s = this.sessions.find(x => x.id === id);
    if (title) title.textContent = 'حذف چت';
    if (text) text.textContent = `«${s?.title || 'این چت'}» حذف بشه؟ این عمل برگشت‌پذیر نیست.`;

    modal.classList.add('show');

    const close = () => {
      modal.classList.remove('show');
      cancel.onclick = null;
      confirm.onclick = null;
    };

    cancel.onclick = close;
    confirm.onclick = () => {
      this.deleteSession(id);
      this.toast('🗑️ حذف شد');
      close();
    };
  },
});

/* ─── راه‌اندازی CHAT ─── */
window.addEventListener('DOMContentLoaded', () => {
  if (window.CHAT && typeof CHAT.init === 'function') {
    try {
      CHAT.init();
    } catch (err) {
      console.error('[CHAT] init failed:', err);
    }
  }
});
