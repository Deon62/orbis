/* ==========================================================================
   Trade confirmations: each settled contract downloads as a real one-page
   PDF, built here in the browser. The "server" preparing it is simulated,
   the file is not: it opens in any PDF reader.
   ========================================================================== */
(function (global) {
  'use strict';

  var D = global.OrbisData;
  var list = document.getElementById('confList');
  if (!D || !list) return;

  var TRADES = D.closedTrades;
  var ACCOUNT = { name: 'Amara Otieno', id: 'CR-5521904', ccy: 'USD' };

  function ic(n, c) { return '<i data-lucide="' + n + '" class="' + (c || 'i') + '"></i>'; }
  function icons() { if (global.orbisIcons) global.orbisIcons(); }
  function toast(m, i) { if (global.orbisToast) global.orbisToast(m, i); }
  var money = D.money;

  /* "Today 09:41" into a real date, so the document carries one */
  function settledAt(t) {
    var p = t.when.split(' '), d = new Date();
    if (p[0] === 'Yesterday') d.setDate(d.getDate() - 1);
    var date = d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'short' }) + ' ' + d.getFullYear();
    return { date: date, time: p[1], full: date + ', ' + p[1] + ' UTC' };
  }

  /* ============================================================ rows == */
  list.innerHTML = TRADES.map(function (t, i) {
    var s = settledAt(t), won = t.result === 'won';
    return '<div class="row-line conf-row">' +
      '<div><b>' + t.id + '</b>' +
        '<span>' + t.sym + ' · ' + t.dir + ' · ' + money(t.stake) + ' · settled ' + t.when.toLowerCase() + '</span></div>' +
      '<span class="conf-pl mono ' + (won ? 'up' : 'down') + '">' + (won ? '+' : '') + money(t.pl) + '</span>' +
      '<button class="conf-dl" data-i="' + i + '" aria-label="Download confirmation ' + t.id + '">' +
        '<span class="conf-ic">' + ic('download', 'i-sm') + '</span>' +
        '<span class="conf-ok">' + ic('check', 'i-sm') + '</span>' +
        '<svg class="conf-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/></svg>' +
      '</button>' +
    '</div>';
  }).join('');
  icons();

  /* ======================================================= tiny PDF == */
  function pdfText(s) {
    return String(s).replace(/·/g, '-').replace(/[^\x20-\x7E]/g, '').replace(/([\\()])/g, '\\$1');
  }

  function pageStream(t) {
    var s = settledAt(t), won = t.result === 'won';
    var ops = [];
    function text(x, y, str, font, size, grey) {
      ops.push((grey != null ? grey + ' g ' : '0 g ') + 'BT /' + font + ' ' + size + ' Tf ' + x + ' ' + y +
               ' Td (' + pdfText(str) + ') Tj ET');
    }
    function rule(y, w) { ops.push('0.85 G ' + (w || 0.6) + ' w 56 ' + y + ' m 539 ' + y + ' l S'); }

    text(56, 780, 'orbisflow', 'F2', 20);
    text(56, 762, 'orbisflow Markets Ltd - Nairobi, Kenya', 'F1', 9, 0.45);
    text(360, 780, 'TRADE CONFIRMATION', 'F2', 11);
    text(360, 764, 'Contract ' + t.id, 'F1', 10, 0.35);
    rule(740, 1);

    text(56, 712, 'Account holder', 'F1', 9, 0.45); text(200, 712, ACCOUNT.name, 'F1', 10);
    text(56, 694, 'Account', 'F1', 9, 0.45);        text(200, 694, ACCOUNT.id + ' (' + ACCOUNT.ccy + ')', 'F1', 10);
    text(56, 676, 'Issued', 'F1', 9, 0.45);         text(200, 676, new Date().toUTCString().replace('GMT', 'UTC'), 'F1', 10);
    rule(656);

    var rows = [
      ['Contract ID', t.id],
      ['Market', t.sym],
      ['Contract type', 'Binary - ' + t.dir],
      ['Stake', money(t.stake)],
      ['Entry price', t.entry],
      ['Exit price', t.exit],
      ['Settled', s.full],
      ['Result', won ? 'Won' : 'Lost'],
      ['Amount returned', money(won ? t.stake + t.pl : 0)],
      ['Profit / loss', (won ? '+' : '') + money(t.pl)]
    ];
    var y = 628;
    rows.forEach(function (r, i) {
      var last = i === rows.length - 1;
      text(56, y, r[0], 'F1', 10, 0.35);
      text(300, y, r[1], last ? 'F2' : 'F1', last ? 12 : 10.5);
      y -= 26;
      if (i === rows.length - 2) { rule(y + 12); y -= 6; }
    });
    rule(y + 4, 1);

    var foot = [
      'This confirmation records a contract settled automatically at expiry against the published',
      'settlement price. Keep it for your records. If anything here looks wrong, contact',
      'support@orbisflow.com within 30 days quoting the contract ID.',
      '',
      'Binary options carry a high risk of losing money rapidly. Nothing here is investment advice.'
    ];
    y -= 26;
    foot.forEach(function (l) { if (l) text(56, y, l, 'F1', 8.5, 0.45); y -= 13; });
    text(56, 48, 'orbisflow.com', 'F1', 8, 0.55);
    text(470, 48, 'Page 1 of 1', 'F1', 8, 0.55);
    return ops.join('\n');
  }

  function buildPDF(trades) {
    var objs = [];                 /* objs[n-1] is object n */
    var nPages = trades.length;
    var pageIds = [], out = '%PDF-1.4\n';

    objs[0] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Producer (orbisflow) /Title (Trade confirmation) >>';
    trades.forEach(function (t, i) {
      var pid = 6 + i * 2, cid = 7 + i * 2;
      var stream = pageStream(t).replace('Page 1 of 1', 'Page ' + (i + 1) + ' of ' + nPages);
      pageIds.push(pid + ' 0 R');
      objs[pid - 1] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
        '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + cid + ' 0 R >>';
      objs[cid - 1] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream';
    });
    objs[1] = '<< /Type /Pages /Kids [' + pageIds.join(' ') + '] /Count ' + nPages + ' >>';

    var offsets = [];
    objs.forEach(function (o, i) {
      offsets[i] = out.length;
      out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n';
    });
    var xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' +
      offsets.map(function (o) { return ('0000000000' + o).slice(-10) + ' 00000 n \n'; }).join('') +
      'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    return new Blob([out], { type: 'application/pdf' });
  }

  function save(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* ================================================ the simulated wait == */
  /* preparing, then a ring that fills as the "file" arrives, then a tick */
  function lock(on) {
    list.classList.toggle('conf-locked', on);
    list.querySelectorAll('.conf-dl').forEach(function (b) {
      if (!b.classList.contains('is-busy')) b.disabled = on;
    });
  }

  function run(btn, trades, name, done) {
    if (list.classList.contains('conf-locked')) return;
    lock(true);
    var ring = btn.querySelector('.conf-ring circle');
    var C = 2 * Math.PI * 15;
    btn.classList.add('is-busy', 'is-prep');
    btn.setAttribute('aria-busy', 'true');
    if (ring) { ring.style.strokeDasharray = C; ring.style.strokeDashoffset = C; }

    setTimeout(function () {
      btn.classList.remove('is-prep');
      var pct = 0;
      var t = setInterval(function () {
        pct = Math.min(100, pct + 6 + Math.random() * 16);
        if (ring) ring.style.strokeDashoffset = C * (1 - pct / 100);
        if (done && done.progress) done.progress(pct);
        if (pct < 100) return;
        clearInterval(t);
        save(buildPDF(trades), name);
        btn.classList.remove('is-busy');
        btn.classList.add('is-done');
        btn.removeAttribute('aria-busy');
        lock(false);
        if (done && done.finish) done.finish();
        setTimeout(function () {
          btn.classList.remove('is-done');
          if (ring) ring.style.strokeDashoffset = C;
        }, 2600);
      }, 120);
    }, 700 + Math.random() * 500);
  }

  list.addEventListener('click', function (e) {
    var b = e.target.closest('.conf-dl');
    if (!b) return;
    var t = TRADES[Number(b.dataset.i)];
    run(b, [t], 'orbisflow-confirmation-' + t.id + '.pdf', {
      finish: function () { toast(t.id + ' confirmation downloaded', 'file-check'); }
    });
  });

})(window);
