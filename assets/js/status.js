/* ==========================================================================
   Status: one row of daily bars per service. Every day is operational
   unless an incident below says otherwise, so the bars and the incident
   history can never disagree. Mock data, dated relative to today.
   ========================================================================== */
(function (global) {
  'use strict';

  var list = document.getElementById('stList');
  if (!list) return;

  var SERVICES = [
    { k: 'trading',  name: 'Trading platform',   note: 'Placing and settling contracts' },
    { k: 'prices',   name: 'Price feeds',        note: 'Live prices for every market' },
    { k: 'app',      name: 'Web and mobile app', note: 'orbisflow.com and the app' },
    { k: 'mpesa',    name: 'M-Pesa deposits' },
    { k: 'card',     name: 'Card payments',      note: 'Processed by Paystack' },
    { k: 'usdt',     name: 'USDT on TRON' },
    { k: 'withdraw', name: 'Withdrawals' },
    { k: 'chat',     name: 'Live chat' },
    { k: 'academy',  name: 'Academy',            since: 4 }   /* launched four days ago */
  ];

  /* sev: 1 degraded, 2 partial outage, 3 major outage */
  var INCIDENTS = [
    { ago: 3,  k: 'card',     sev: 1, mins: 42,  title: 'Slow card approvals',
      body: 'Card deposits took up to five minutes to approve while Paystack worked through a backlog. No payments were lost.' },
    { ago: 17, k: 'prices',   sev: 2, mins: 18,  title: 'Delayed prices on crypto markets',
      body: 'Crypto prices lagged by up to 20 seconds. New crypto contracts were paused until prices caught up, and open ones settled normally.' },
    { ago: 29, k: 'usdt',     sev: 1, mins: 70,  title: 'USDT deposits confirming slowly',
      body: 'Congestion on the TRON network slowed confirmations. Every deposit was credited once confirmed.' },
    { ago: 46, k: 'withdraw', sev: 2, mins: 125, title: 'Bank withdrawals held for review',
      body: 'A fault in an automatic check sent bank withdrawals to manual review. All were paid the same day.' },
    { ago: 61, k: 'trading',  sev: 3, mins: 11,  title: 'Contracts could not be placed',
      body: 'A failed deployment stopped new contracts for 11 minutes. Open contracts settled at their normal expiry. We rolled back and added a check to catch it earlier.' },
    { ago: 74, k: 'mpesa',    sev: 1, mins: 35,  title: 'M-Pesa confirmations delayed',
      body: 'M-Pesa deposits took longer than usual to show in balances. Every deposit was credited.' }
  ];

  var SEV = [
    { cls: 'st-good',    label: 'Operational' },
    { cls: 'st-warn',    label: 'Degraded' },
    { cls: 'st-serious', label: 'Partial outage' },
    { cls: 'st-crit',    label: 'Major outage' }
  ];
  /* how much of an incident's minutes count against uptime */
  var WEIGHT = [0, 0.25, 0.5, 1];

  function icons() { if (global.orbisIcons) global.orbisIcons(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function dayDate(ago) { var d = new Date(); d.setDate(d.getDate() - ago); return d; }
  function fmtDate(d, year) {
    return d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'short' }) + (year ? ' ' + d.getFullYear() : '');
  }
  function fmtMins(m) { return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + (m % 60 ? (m % 60) + 'm' : ''); }

  function day(svc, ago) {
    if (svc.since != null && ago > svc.since) return { sev: -1 };
    var inc = INCIDENTS.filter(function (i) { return i.k === svc.k && i.ago === ago; })[0];
    if (!inc) return { sev: 0, up: 100 };
    return { sev: inc.sev, up: 100 - inc.mins / 1440 * 100 * WEIGHT[inc.sev], inc: inc };
  }

  function uptime(svc, days) {
    var sum = 0, n = 0;
    for (var a = 0; a < days; a++) {
      var d = day(svc, a);
      if (d.sev < 0) continue;
      sum += d.up; n++;
    }
    return n ? sum / n : null;
  }

  /* ============================================================ bars == */
  var DAYS = global.matchMedia && global.matchMedia('(max-width:640px)').matches ? 30 : 90;

  function render() {
    list.innerHTML = SERVICES.map(function (svc, si) {
      var bars = '';
      for (var a = DAYS - 1; a >= 0; a--) {
        var d = day(svc, a);
        var cls = d.sev < 0 ? 'st-none' : SEV[d.sev].cls;
        bars += '<span class="st-b ' + cls + '" data-s="' + si + '" data-a="' + a + '" tabindex="-1"></span>';
      }
      var up = uptime(svc, DAYS);
      var today = day(svc, 0);
      var now = SEV[today.sev < 0 ? 0 : today.sev];
      return '<div class="st-row">' +
        '<div class="st-row-hd">' +
          '<div><b>' + svc.name + '</b>' + (svc.note ? '<span>' + svc.note + '</span>' : '') + '</div>' +
          '<span class="st-now ' + now.cls + '">' +
            '<i data-lucide="' + (today.sev > 0 ? 'triangle-alert' : 'check') + '" class="i-sm"></i>' + now.label + '</span>' +
        '</div>' +
        '<div class="st-bars" style="--n:' + DAYS + '" role="img" aria-label="' + svc.name + ': ' +
          (up == null ? 'no data' : up.toFixed(2) + '% uptime') + ' over ' + DAYS + ' days">' + bars + '</div>' +
        '<div class="st-axis"><span>' + (svc.since != null && svc.since < DAYS ? 'Launched ' + fmtDate(dayDate(svc.since)) : DAYS + ' days ago') + '</span>' +
          '<b class="mono">' + (up == null ? '' : up.toFixed(2) + '% uptime') + '</b><span>Today</span></div>' +
      '</div>';
    }).join('');
    icons();
  }

  /* ========================================================= tooltip == */
  var tip = document.getElementById('stTip');
  var pinned = null;

  function show(bar) {
    var svc = SERVICES[Number(bar.dataset.s)], a = Number(bar.dataset.a);
    var d = day(svc, a);
    var html = '<b>' + fmtDate(dayDate(a), true) + '</b>';
    if (d.sev < 0) html += '<span class="st-tip-row"><i class="st-sw st-none"></i>No data, not yet launched</span>';
    else {
      html += '<span class="st-tip-row"><i class="st-sw ' + SEV[d.sev].cls + '"></i>' + SEV[d.sev].label +
              '<em class="mono">' + d.up.toFixed(2) + '%</em></span>';
      if (d.inc) html += '<span class="st-tip-inc">' + esc(d.inc.title) + ' · ' + fmtMins(d.inc.mins) + '</span>';
      else html += '<span class="st-tip-inc">No incidents recorded</span>';
    }
    tip.innerHTML = html;
    tip.hidden = false;
    list.querySelectorAll('.st-b.on').forEach(function (x) { x.classList.remove('on'); });
    bar.classList.add('on');

    var r = bar.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = Math.min(global.innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2));
    var y = r.top - th - 10;
    if (y < 8) y = r.bottom + 10;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function hide() {
    tip.hidden = true; pinned = null;
    list.querySelectorAll('.st-b.on').forEach(function (x) { x.classList.remove('on'); });
  }

  list.addEventListener('mouseover', function (e) {
    var b = e.target.closest('.st-b');
    if (b && !pinned) show(b);
  });
  list.addEventListener('mouseleave', function () { if (!pinned) hide(); });
  /* a tap pins it, which is what a phone needs */
  list.addEventListener('click', function (e) {
    var b = e.target.closest('.st-b');
    if (!b) return;
    if (pinned === b) return hide();
    pinned = b; show(b);
  });
  document.addEventListener('click', function (e) { if (pinned && !e.target.closest('.st-bars')) hide(); });
  global.addEventListener('scroll', function () { if (!tip.hidden) hide(); }, { passive: true });

  /* ========================================================== ranges == */
  var seg = document.querySelectorAll('.st-range button');
  function paintSeg() {
    seg.forEach(function (b) { b.classList.toggle('active', Number(b.dataset.days) === DAYS); });
  }
  seg.forEach(function (b) {
    b.addEventListener('click', function () { DAYS = Number(b.dataset.days); paintSeg(); hide(); render(); });
  });
  paintSeg();
  render();

  /* ======================================================= incidents == */
  var inc = document.getElementById('stInc');
  inc.innerHTML = INCIDENTS.map(function (i) {
    var svc = SERVICES.filter(function (s) { return s.k === i.k; })[0];
    return '<article class="st-inc-item">' +
      '<div class="st-inc-hd">' +
        '<span class="st-now ' + SEV[i.sev].cls + '"><i data-lucide="triangle-alert" class="i-sm"></i>' + SEV[i.sev].label + '</span>' +
        '<time>' + fmtDate(dayDate(i.ago), true) + '</time>' +
      '</div>' +
      '<h3>' + i.title + '</h3>' +
      '<p>' + i.body + '</p>' +
      '<p class="st-inc-meta">' + svc.name + ' · lasted ' + fmtMins(i.mins) + ' · <span class="up">Resolved</span></p>' +
    '</article>';
  }).join('');
  icons();

  /* ========================================================= updated == */
  var upd = document.getElementById('stUpdated'), t0 = Date.now();
  setInterval(function () {
    var s = Math.round((Date.now() - t0) / 1000);
    upd.textContent = s < 60 ? 'Checked ' + (s < 5 ? 'just now' : s + ' seconds ago') : 'Checked ' + Math.floor(s / 60) + ' min ago';
  }, 5000);
})(window);
