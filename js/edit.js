// ===== js/edit.js — ویرایش عکس با هوش مصنوعی =====

var EDIT = {
  _file: null,
  _lastUrl: null,
  _loader: null,

  init: function() {
    var self = this;

    var input = document.getElementById('editImageInput');
    if (input) {
      input.addEventListener('change', function(e) { self.onFileSelect(e); });
    }

    var btn = document.getElementById('editBtn');
    if (btn) btn.addEventListener('click', function() { self.generate(); });

    var prompt = document.getElementById('editPrompt');
    if (prompt) {
      prompt.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          self.generate();
        }
      });
    }

    console.log('✏️ EDIT: آماده');
  },

  onFileSelect: function(e) {
    var file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      APP.toast('عکس بزرگه (حداکثر ۱۰MB)');
      return;
    }

    if (!file.type.startsWith('image/')) {
      APP.toast('فقط عکس مجازه');
      return;
    }

    this._file = file;

    var preview = document.getElementById('editImagePreview');
    var reader = new FileReader();
    reader.onload = function(ev) {
      preview.innerHTML = '<img src="' + ev.target.result + '" alt="preview">';
    };
    reader.readAsDataURL(file);

    APP.vibrate(20);
  },

  generate: async function() {
    var result = document.getElementById('editResult');
    var btn = document.getElementById('editBtn');

    if (!this._file) {
      APP.toast('اول یه عکس انتخاب کن');
      APP.vibrate(30);
      return;
    }

    var prompt = (document.getElementById('editPrompt') || {}).value || '';
    prompt = prompt.trim();
    if (!prompt) {
      APP.toast('توضیح بده چیکار کنه');
      APP.vibrate(30);
      return;
    }

    if (typeof puter === 'undefined' || !puter.ai) {
      APP.toast('اتصال برقرار نیست');
      return;
    }

    btn.disabled = true;
    APP.vibrate(20);

    this._loader = APP.startLoading('editResult', {
      title: 'در حال ویرایش عکس...',
      sub: 'ممکنه ۲۰ تا ۶۰ ثانیه طول بکشه',
      duration: 45000
    });

    try {
      // درخواست با Puter
      var response = await puter.ai.chat(
        'Edit this image with this instruction: "' + prompt + '". Generate a new image based on this. ' +
        'Return only the edited image.',
        this._file
      );

      // استخراج URL
      var url = this._extractUrl(response);

      if (!url) {
        // اگه مستقیم عکس نداد، از متن به عکس استفاده کن
        var description = await this._describeAndGenerate(prompt);
        url = description;
      }

      if (!url) throw new Error('عکس ویرایش‌شده تولید نشد');

      this._lastUrl = url;

      if (this._loader) {
        this._loader.setTitle('تمام شد!');
        this._loader.finish();
      }
      await this._delay(400);

      // نمایش
      this._showResult(result, url);

      APP.toast('عکس ویرایش شد');
      APP.vibrate(40);

    } catch (err) {
      console.error('edit error:', err);
      if (this._loader) this._loader.stop();
      var msg = err.message || 'خطای ناشناخته';
      if (msg.length > 100) msg = msg.substring(0, 100) + '...';
      APP.showError('editResult', 'خطا در ویرایش: ' + msg);
      APP.toast('خطا');
      APP.vibrate(50);
    } finally {
      btn.disabled = false;
      this._loader = null;
    }
  },

  // ============ توصیف + ساخت از نو ============
  _describeAndGenerate: async function(prompt) {
    try {
      // توصیف عکس
      var base64 = await new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(EDIT._file);
      });

      var descRes = await puter.ai.chat(
        'Describe this image in detail in English (max 50 words), then say: now modified with: "' + prompt + '"',
        base64
      );

      var descText = '';
      if (typeof descRes === 'string') descText = descRes;
      else if (descRes && descRes.message && descRes.message.content) {
        var c = descRes.message.content;
        descText = Array.isArray(c) ? c.map(function(x) { return x.text || x; }).join(' ') : c;
      } else if (descRes && descRes.text) descText = descRes.text;
      else if (descRes && descRes.toString) descText = descRes.toString();

      if (!descText) return null;

      // ساخت عکس از توصیف
      var imgRes = await puter.ai.txt2img(descText + '. ' + prompt);
      return EDIT._extractUrl(imgRes);

    } catch(e) {
      console.warn('describeAndGenerate error:', e);
      return null;
    }
  },

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

  _showResult: function(container, url) {
    container.innerHTML = '';

    var img = document.createElement('img');
    img.src = url;
    img.alt = 'edited';
    container.appendChild(img);

    var actions = document.createElement('div');
    actions.className = 'result-actions';

    var dl = document.createElement('button');
    dl.className = 'result-btn';
    dl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> دانلود';
    dl.onclick = function() { EDIT.download(); };
    actions.appendChild(dl);

    var cp = document.createElement('button');
    cp.className = 'result-btn';
    cp.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> کپی لینک';
    cp.onclick = function() { APP.copyUrl(EDIT._lastUrl); };
    actions.appendChild(cp);

    container.appendChild(actions);
  },

  download: function() {
    if (!this._lastUrl) return;
    APP.downloadFile(this._lastUrl, 'setareh-edited-' + Date.now() + '.png');
  },

  _delay: function(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }
};

window.EDIT = EDIT;
