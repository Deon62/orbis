/* ==========================================================================
   Verification: document upload and the financial assessment.
   Proof of identity and proof of address go to the API (POST /verification)
   and are reviewed on the admin site; withdrawals open once the identity is
   approved. Photos are shrunk in the browser to about 1600 px first. The
   assessment and tax declaration are kept in localStorage.
   ========================================================================== */
(function (global) {
  'use strict';

  var KEY = 'orbisflow-verification';
  var MAX = 10 * 1024 * 1024;

  var DOCS = {
    identity: [
      { k: 'id',       name: 'National ID',     sides: ['Front', 'Back'] },
      { k: 'passport', name: 'Passport',        sides: ['Photo page'] },
      { k: 'licence',  name: 'Driving licence', sides: ['Front', 'Back'] }
    ],
    address: [
      { k: 'utility', name: 'Utility bill',   sides: ['Document'] },
      { k: 'bank',    name: 'Bank statement', sides: ['Document'] }
    ]
  };

  function ic(n, c) { return '<i data-lucide="' + n + '" class="' + (c || 'i') + '"></i>'; }
  function icons() { if (global.orbisIcons) global.orbisIcons(); }
  function toast(m, i) { if (global.orbisToast) global.orbisToast(m, i); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mb(b) { return b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  var state = load();
  var API = global.OrbisAPI;
  var live = !!(API && API.connected && API.signedIn && API.signedIn());
  var DOC_KEY = { 'National ID': 'id', 'Passport': 'passport', 'Driving licence': 'licence', 'Utility bill': 'utility', 'Bank statement': 'bank' };

  /* the server's word on identity and address replaces anything kept locally */
  function fromServer(v) {
    ['identity', 'address'].forEach(function (k) {
      var x = v[k];
      if (!x) { delete state[k]; return; }
      var d = new Date(x.createdAt);
      state[k] = { status: x.status === 'pending' ? 'review' : x.status, docName: x.docName, reason: x.reason,
                   date: d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'short' }) };
    });
    state.verified = !!v.verified;
    state.required = v.required !== false;
    save();
  }

  function banner() {
    var host = document.querySelector('.vf');
    if (!host) return;
    var el = document.getElementById('vfBanner');
    if (!el) {
      el = document.createElement('p');
      el.id = 'vfBanner';
      el.className = 'vf-banner';
      host.parentNode.insertBefore(el, host);
    }
    var id = state.identity || {};
    if (!live || state.required === false) { el.hidden = true; return; }
    el.hidden = false;
    el.className = 'vf-banner' + (state.verified ? ' vf-banner-ok' : '');
    el.innerHTML = state.verified
      ? ic('badge-check', 'i-sm') + 'Your identity is verified. Withdrawals are open.'
      : id.status === 'review'
        ? ic('clock', 'i-sm') + 'Your ID is being reviewed, usually within a working day. Withdrawals open once it is approved.'
        : ic('lock', 'i-sm') + 'Verify your identity to withdraw. Send a photo of your national ID, passport or driving licence below.';
    icons();
  }

  /* ======================================================= row states == */
  function renderState(item) {
    var k = item.dataset.vf, s = state[k] || {}, host = item.querySelector('.vf-state'), html;

    if (k === 'tax') {
      html = s.status === 'done'
        ? '<span class="tag tag-up">' + ic('check', 'i-sm') + 'Submitted</span>' +
          '<button class="btn btn-quiet btn-sm" data-vf-tax>Edit</button>'
        : '<button class="btn btn-ghost btn-sm" data-vf-tax>Declare</button>';
    } else if (k === 'assessment') {
      html = s.status === 'done'
        ? (s.result === 'ok'
            ? '<span class="tag tag-up">' + ic('check', 'i-sm') + 'Complete</span>'
            : '<span class="tag tag-wait">' + ic('triangle-alert', 'i-sm') + 'Complete, with a warning</span>') +
          '<button class="btn btn-quiet btn-sm" data-vf-assess>Retake</button>'
        : '<button class="btn btn-ghost btn-sm" data-vf-assess>Start</button>';
    } else if (s.status === 'approved') {
      html = '<span class="tag tag-up">' + ic('check', 'i-sm') + 'Verified</span>' +
             (k === 'address' ? '<button class="btn btn-quiet btn-sm" data-vf-open>Replace</button>' : '');
    } else if (s.status === 'rejected') {
      html = '<span class="tag tag-down">' + ic('triangle-alert', 'i-sm') + 'Not accepted</span>' +
             '<button class="btn btn-primary btn-sm" data-vf-open>' + ic('upload', 'i-sm') + 'Send again</button>';
    } else if (s.status === 'review') {
      html = '<span class="tag tag-wait">' + ic('clock', 'i-sm') + 'In review</span>' +
             '<button class="btn btn-quiet btn-sm" data-vf-open>Replace</button>';
    } else {
      html = '<button class="btn btn-primary btn-sm" data-vf-open>' + ic('upload', 'i-sm') + 'Upload</button>';
    }
    host.innerHTML = html;

    var sub = item.querySelector('.row-line > div > span');
    if (k === 'tax' && s.status === 'done') {
      sub.dataset.orig = sub.dataset.orig || sub.textContent;
      sub.textContent = s.country + ' · declared ' + s.date;
    } else if (k !== 'assessment' && k !== 'tax' && s.status === 'review') {
      sub.dataset.orig = sub.dataset.orig || sub.textContent;
      sub.textContent = s.docName + ' · submitted ' + s.date + ' · usually reviewed within 24 hours';
    } else if (k !== 'assessment' && k !== 'tax' && s.status === 'approved') {
      sub.dataset.orig = sub.dataset.orig || sub.textContent;
      sub.textContent = s.docName + ' · approved';
    } else if (k !== 'assessment' && k !== 'tax' && s.status === 'rejected') {
      sub.dataset.orig = sub.dataset.orig || sub.textContent;
      sub.textContent = s.docName + ' was not accepted: ' + (s.reason || 'send a clearer copy');
    } else if (k === 'assessment' && s.status === 'done') {
      sub.dataset.orig = sub.dataset.orig || sub.textContent;
      sub.textContent = s.result === 'ok' ? 'Completed ' + s.date + ' · real-money trading is open'
                                          : 'Completed ' + s.date + ' · you can trade, with a risk warning';
    } else if (sub.dataset.orig) {
      sub.textContent = sub.dataset.orig;
    }
    icons();
  }

  /* ========================================================== uploads == */
  function openPanel(item) {
    var k = item.dataset.vf, panel = item.querySelector('.vf-panel');
    var doc = DOCS[k][0];
    var slots = [];
    var timers = [];

    function stopAll() { timers.forEach(clearInterval); timers = []; }

    function draw() {
      stopAll();
      slots = doc.sides.map(function (side) { return { side: side, file: null, url: null, pct: 0, done: false }; });

      panel.innerHTML =
        '<div class="vf-types" role="radiogroup" aria-label="Document type">' +
          DOCS[k].map(function (d) {
            return '<button type="button" class="vf-type' + (d.k === doc.k ? ' active' : '') +
                   '" role="radio" aria-checked="' + (d.k === doc.k) + '" data-doc="' + d.k + '">' + d.name + '</button>';
          }).join('') +
        '</div>' +
        '<div class="vf-slots">' + slots.map(function (s, i) {
          return '<div class="vf-slot" data-slot="' + i + '"></div>';
        }).join('') + '</div>' +
        '<div class="vf-ft">' +
          '<button type="button" class="btn btn-quiet btn-sm" data-vf-cancel>Cancel</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-vf-submit disabled>Submit for review</button>' +
        '</div>';

      slots.forEach(function (_, i) { drawSlot(i); });
      panel.querySelectorAll('[data-doc]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.dataset.doc === doc.k) return;
          doc = DOCS[k].filter(function (d) { return d.k === b.dataset.doc; })[0];
          draw();
        });
      });
      panel.querySelector('[data-vf-cancel]').addEventListener('click', function () { closePanel(); });
      panel.querySelector('[data-vf-submit]').addEventListener('click', submit);
    }

    function slotEl(i) { return panel.querySelector('[data-slot="' + i + '"]'); }

    function drawSlot(i, err) {
      var s = slots[i], el = slotEl(i);
      if (!s.file) {
        /* two real pickers: on a phone the first opens the camera, the
           second the gallery or files; on a desktop both open the dialog */
        el.className = 'vf-slot vf-empty';
        el.innerHTML =
          '<div class="vf-slot-hd"><b>' + s.side + '</b><span>' + doc.name + '</span></div>' +
          '<div class="vf-picks">' +
            '<label class="vf-pick">' + ic('camera') + '<span>Take a photo</span>' +
              '<input type="file" accept="image/*" capture="environment" hidden></label>' +
            '<label class="vf-pick">' + ic('image') + '<span>Choose from gallery</span>' +
              '<input type="file" accept="image/*,application/pdf" hidden></label>' +
          '</div>' +
          '<p class="vf-drop">or drop a file here</p>' +
          (err ? '<p class="vf-err">' + ic('triangle-alert', 'i-sm') + err + '</p>' : '');
        el.querySelectorAll('input[type=file]').forEach(function (inp) {
          inp.addEventListener('change', function () { if (inp.files[0]) pick(i, inp.files[0]); });
        });
        el.ondragover = function (e) { e.preventDefault(); el.classList.add('vf-over'); };
        el.ondragleave = function () { el.classList.remove('vf-over'); };
        el.ondrop = function (e) {
          e.preventDefault(); el.classList.remove('vf-over');
          if (e.dataTransfer.files[0]) pick(i, e.dataTransfer.files[0]);
        };
      } else {
        el.className = 'vf-slot vf-full' + (s.done ? ' vf-done' : '');
        el.ondragover = el.ondragleave = el.ondrop = null;
        var isImg = /^image\//.test(s.file.type) && s.url;
        el.innerHTML =
          '<div class="vf-thumb">' +
            (isImg ? '<img src="' + s.url + '" alt="">' : ic('file-text')) +
          '</div>' +
          '<div class="vf-file">' +
            '<div class="vf-file-hd"><b>' + s.side + '</b>' +
              '<button type="button" class="vf-x" aria-label="Remove">' + ic('x', 'i-sm') + '</button></div>' +
            '<span class="vf-name">' + esc(s.file.name) + '</span>' +
            '<div class="vf-bar"><i style="width:' + s.pct + '%"></i></div>' +
            '<span class="vf-meta">' + (s.done
              ? ic('check', 'i-sm') + 'Ready to send · ' + mb(s.file.size)
              : mb(s.file.size * s.pct / 100) + ' of ' + mb(s.file.size) + ' · ' + Math.floor(s.pct) + '%') +
            '</span>' +
          '</div>';
        var img = el.querySelector('.vf-thumb img');
        /* formats a browser cannot draw, such as HEIC, fall back to an icon */
        if (img) img.onerror = function () { el.querySelector('.vf-thumb').innerHTML = ic('image'); icons(); };
        el.querySelector('.vf-x').addEventListener('click', function () { reset(i); });
      }
      icons();
      sync();
    }

    function pick(i, file) {
      var okType = /^image\//.test(file.type) || file.type === 'application/pdf' ||
                   /\.(jpe?g|png|heic|heif|webp|pdf)$/i.test(file.name);
      if (!okType) return drawSlot(i, 'That file type is not accepted. Use a JPG, PNG or PDF.');
      if (file.size > MAX) return drawSlot(i, 'That file is ' + mb(file.size) + '. The limit is 10 MB.');

      var s = slots[i];
      s.file = file; s.pct = 0; s.done = false;
      s.url = /^image\//.test(file.type) ? URL.createObjectURL(file) : null;
      drawSlot(i);

      /* the file is ready as soon as it is picked; it is sent on Submit */
      s.pct = 100; s.done = true;
      drawSlot(i);
    }

    function reset(i) {
      var s = slots[i];
      if (s.url) URL.revokeObjectURL(s.url);
      s.file = null; s.url = null; s.pct = 0; s.done = false;
      drawSlot(i);
    }

    function sync() {
      var btn = panel.querySelector('[data-vf-submit]');
      if (btn) btn.disabled = !slots.every(function (s) { return s.done; });
    }

    /* a photo shrunk to 1600 px on its long side, as a JPEG data URL; a PDF as it is */
    function prepare(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = function () { reject(new Error('That file could not be read. Choose it again.')); };
        if (!/^image\/(jpeg|png|webp)/.test(file.type)) {
          if (file.type !== 'application/pdf') return reject(new Error('Use a JPG, PNG or PDF. ' + file.name + ' cannot be read here.'));
          reader.onload = function () { resolve(reader.result); };
          return reader.readAsDataURL(file);
        }
        reader.onload = function () {
          var img = new Image();
          img.onerror = function () { reject(new Error('That photo could not be read. Choose it again.')); };
          img.onload = function () {
            var scale = Math.min(1, 1600 / Math.max(img.width, img.height));
            var c = document.createElement('canvas');
            c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
            var g = c.getContext('2d');
            g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
            g.drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL('image/jpeg', 0.85));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    function submit() {
      var btn = panel.querySelector('[data-vf-submit]');
      var done = window.orbisBusy ? window.orbisBusy(btn, 'Sending your documents') : function () {};
      if (!live) {
        done();
        toast('Sign in to send your documents', 'triangle-alert');
        return;
      }
      Promise.all(slots.map(function (s) { return prepare(s.file); }))
        .then(function (urls) {
          return API.post('/verification', {
            kind: k, doc_type: DOC_KEY[doc.name] || doc.k,
            files: slots.map(function (s, i) { return { side: s.side, data: urls[i] }; })
          });
        })
        .then(function (v) {
          done();
          fromServer(v);
          closePanel();
          toast(doc.name + ' sent for review', 'check-circle-2');
        })
        .catch(function (err) {
          done();
          toast(err.message || 'That did not go through. Try again.', 'triangle-alert');
        });
    }

    function closePanel() {
      stopAll();
      slots.forEach(function (s) { if (s.url) URL.revokeObjectURL(s.url); });
      panel.hidden = true;
      panel.innerHTML = '';
      item.classList.remove('vf-open');
      renderState(item);
    }

    draw();
    panel.hidden = false;
    item.classList.add('vf-open');
    item.querySelector('.vf-state').innerHTML = '';
  }

  /* ============================================== financial assessment == */
  var QUESTIONS = [
    { k: 'employment', q: 'What is your employment status?',
      a: ['Employed', 'Self-employed', 'Student', 'Unemployed', 'Retired'] },
    { k: 'income', q: 'What is your annual income, in US dollars?',
      a: ['Under $5,000', '$5,000 to $25,000', '$25,000 to $100,000', 'Over $100,000'] },
    { k: 'source', q: 'Where will the money you trade with come from?',
      a: ['Salary', 'Business income', 'Savings', 'Investments', 'Something else'] },
    { k: 'experience', q: 'How often have you traded in the last 12 months?',
      a: ['Never', 'A few times', 'About monthly', 'Weekly or more'] },
    { k: 'loss', q: 'You stake $20 on a contract paying 85%. It expires against you. What happens?',
      a: ['I lose the $20 stake', 'I lose $17', 'The stake is returned to me'], right: 0 },
    { k: 'risk', q: 'How much of your account would you risk on a single contract?',
      a: ['Up to 2%', 'About 10%', 'A quarter or more'], right: 0 },
    { k: 'afford', q: 'If you lost everything you deposit, how would it affect you?',
      a: ['It would not change my standard of living', 'It would be hard, but manageable', 'I could not cover my living costs'] }
  ];

  function assess(onDone) {
    var M = global.orbisModal;
    if (!M) return;
    var answers = {};

    function step(n) {
      var Q = QUESTIONS[n];
      var html =
        '<div class="modal-bd fa">' +
          '<div class="fa-prog"><i style="width:' + ((n + 1) / (QUESTIONS.length + 1) * 100) + '%"></i></div>' +
          '<p class="fa-count">Question ' + (n + 1) + ' of ' + QUESTIONS.length + '</p>' +
          '<h4 class="fa-q">' + Q.q + '</h4>' +
          '<div class="fa-opts">' + Q.a.map(function (a, i) {
            return '<button type="button" class="method' + (answers[Q.k] === i ? ' active' : '') + '" data-i="' + i + '">' +
                   '<span class="pick-dot"></span><b>' + a + '</b></button>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="modal-ft"><button class="btn btn-primary btn-block" data-next' +
          (answers[Q.k] == null ? ' disabled' : '') + '>Continue</button></div>';

      M.open('Financial assessment', html, function (root) {
        var next = root.querySelector('[data-next]');
        root.querySelectorAll('.fa-opts .method').forEach(function (b) {
          b.addEventListener('click', function () {
            answers[Q.k] = Number(b.dataset.i);
            root.querySelectorAll('.fa-opts .method').forEach(function (x) { x.classList.toggle('active', x === b); });
            next.disabled = false;
          });
        });
        next.addEventListener('click', function () {
          if (n + 1 < QUESTIONS.length) step(n + 1); else confirmStep();
        });
      }, n > 0 ? function () { step(n - 1); } : null);
    }

    function confirmStep() {
      var html =
        '<div class="modal-bd fa">' +
          '<div class="fa-prog"><i style="width:100%"></i></div>' +
          '<p class="fa-count">Last step</p>' +
          '<h4 class="fa-q">Before we assess your answers</h4>' +
          '<label class="check" style="margin-top:6px"><input type="checkbox" data-ack>' +
            '<span>I understand that every binary contract can lose its whole stake, and that nothing on ' +
            'obisflow is investment advice. See the <a href="/terms" target="_blank" rel="noopener">Terms</a>.</span></label>' +
          '<label class="check" style="margin-top:12px"><input type="checkbox" data-true>' +
            '<span>The answers I have given are true and complete.</span></label>' +
        '</div>' +
        '<div class="modal-ft"><button class="btn btn-primary btn-block" data-go disabled>Submit answers</button></div>';

      M.open('Financial assessment', html, function (root) {
        var go = root.querySelector('[data-go]');
        var boxes = root.querySelectorAll('input[type=checkbox]');
        boxes.forEach(function (b) {
          b.addEventListener('change', function () {
            go.disabled = !Array.prototype.every.call(boxes, function (x) { return x.checked; });
          });
        });
        go.addEventListener('click', working);
      }, function () { step(QUESTIONS.length - 1); });
    }

    function working() {
      var lines = ['Checking your trading experience', 'Checking your answers on risk', 'Matching against your finances', 'Preparing your result'];
      M.open('Financial assessment',
        '<div class="modal-bd fa-working"><span class="loader"></span><p data-line>' + lines[0] + '</p></div>');
      var i = 0;
      var t = setInterval(function () {
        i++;
        if (i >= lines.length) { clearInterval(t); result(); return; }
        var p = document.querySelector('.fa-working [data-line]');
        if (!p) return clearInterval(t);   /* closed while working */
        p.textContent = lines[i];
      }, 900);
    }

    function result() {
      /* an appropriateness check: understanding the loss, sizing sensibly,
         and being able to absorb the loss. Failing it warns, it does not block */
      var flags = [];
      if (answers.loss !== QUESTIONS[4].right) flags.push('A losing contract costs the whole stake, not part of it.');
      if (answers.risk !== QUESTIONS[5].right) flags.push('Risking more than about 2% on one contract makes a normal losing run hard to survive.');
      if (answers.afford === 2) flags.push('You told us a total loss would leave you unable to cover living costs.');
      if (answers.experience === 0 && flags.length) flags.push('You have not traded in the last 12 months.');
      var ok = flags.length === 0;

      var d = new Date();
      state.assessment = { status: 'done', result: ok ? 'ok' : 'warn', date: d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'short' }) };
      save();

      var html = ok
        ? '<div class="modal-bd fa-result">' +
            '<span class="fa-badge fa-ok">' + ic('check') + '</span>' +
            '<h4>Real-money trading is open</h4>' +
            '<p>Your answers show you understand how these contracts work and what they can cost. ' +
            'Keep stakes small while you find your feet.</p>' +
          '</div>'
        : '<div class="modal-bd fa-result">' +
            '<span class="fa-badge fa-warn">' + ic('triangle-alert') + '</span>' +
            '<h4>These products may not be right for you yet</h4>' +
            '<p>You can still trade with real money, but please read this first:</p>' +
            '<ul class="fa-flags">' + flags.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>' +
            '<p>The demo account and the <a href="/academy">Academy</a> are good places to start.</p>' +
          '</div>';
      html += '<div class="modal-ft"><button class="btn btn-primary btn-block" data-close-result>Done</button></div>';

      M.open('Your result', html, function (root) {
        root.querySelector('[data-close-result]').addEventListener('click', function () { M.close(); });
      });
      if (onDone) onDone();
    }

    step(0);
  }

  /* ==================================================== tax residency == */
  function taxModal(item) {
    var M = global.orbisModal;
    if (!M) return;
    var cur = state.tax || {};
    var html =
      '<div class="modal-bd">' +
        '<div class="field"><label class="label" for="txC">Country of tax residence</label>' +
          '<input class="input" id="txC" autocomplete="country-name" placeholder="e.g. Kenya" value="' + esc(cur.country || '') + '"></div>' +
        '<div class="field"><label class="label" for="txN">Tax identification number</label>' +
          '<input class="input" id="txN" placeholder="Your KRA PIN or national tax number" value="' + esc(cur.tin || '') + '"></div>' +
        '<label class="check"><input type="checkbox" id="txOk"><span>I confirm this is my only country of tax residence, or I will tell obisflow if that changes.</span></label>' +
      '</div>' +
      '<div class="modal-ft"><button class="btn btn-primary btn-block" id="txGo" disabled>Submit declaration</button></div>';
    M.open('Tax residency', html, function (root) {
      var c = root.querySelector('#txC'), n = root.querySelector('#txN'), ok = root.querySelector('#txOk'), go = root.querySelector('#txGo');
      function check() { go.disabled = !(c.value.trim() && n.value.trim().length >= 4 && ok.checked); }
      [c, n].forEach(function (x) { x.addEventListener('input', check); });
      ok.addEventListener('change', check);
      go.addEventListener('click', function () {
        var d = new Date();
        state.tax = { status: 'done', country: c.value.trim(), tin: n.value.trim(),
          date: d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'short' }) };
        save();
        M.close();
        renderState(item);
        toast('Tax residency declared', 'check-circle-2');
      });
    });
  }

  /* ============================================================= wire == */
  var items = document.querySelectorAll('.vf-item[data-vf]');
  if (live) {
    API.get('/verification').then(function (v) {
      fromServer(v);
      items.forEach(function (item) { if (!item.classList.contains('vf-open')) renderState(item); });
    }).catch(function () { /* offline: the saved state stands */ });
  }
  items.forEach(function (item) {
    renderState(item);
    item.addEventListener('click', function (e) {
      if (e.target.closest('[data-vf-open]')) openPanel(item);
      else if (e.target.closest('[data-vf-assess]')) assess(function () { renderState(item); });
      else if (e.target.closest('[data-vf-tax]')) taxModal(item);
    });
  });
})(window);
