/* ==========================================================================
   Status: one row of daily bars per service.

   From REAL_FROM on, every day comes from the backend's own checks (GET
   /status: each service checked every five minutes). The 29 days before it
   are sample history, so the bars are not empty at launch; earlier days read
   "No data". Today's headline also pings /health from this browser, so a
   backend that is down shows as down even when /status cannot answer.
   ========================================================================== */
(function (global) {
  'use strict';

  var list = document.getElementById('stList');
  if (!list) return;

  var SERVICES = [
    { k: 'api',      name: 'orbisflow API',      note: 'Sign-in, accounts and the database' },
    { k: 'trading',  name: 'Trading platform',   note: 'Placing and settling contracts' },
    { k: 'app',      name: 'Web and mobile app', note: 'orbisflow.com and the app' },
    { k: 'mpesa',    name: 'M-Pesa deposits' },
    { k: 'card',     name: 'Card payments',      note: 'Processed by Paystack' },
    { k: 'usdt',     name: 'USDT on TRON' },
    { k: 'withdraw', name: 'Withdrawals' },
    { k: 'chat',     name: 'Live chat' },
    { k: 'academy',  name: 'Academy' }
  ];

  var t0 = Date.now();
  var REAL_FROM = '2026-10-16';   /* the first day of real checks */
  var SAMPLE_DAYS = 29;           /* sample history before it */

  /* filled from /status: REAL[k][date] = { sev: 0-3, up: percent } */
  var REAL = {};
  var LIVE = null;                /* this browser's own /health ping: true, false, or null before it answers */
  var idle = true;

  /* days are Kenyan days, as the backend counts them */
  function key(d) { return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' }); }
  function daysBefore(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }

  /* a steady, repeatable sample: mostly clean days, the odd slow one */
  function sample(svc, date) {
    var h = 2166136261;
    var s = svc + date;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    var r = (h >>> 0) / 4294967296;
    if (r < 0.04) return { sev: 1, up: 98.2 + r * 20, note: 'Slower responses for part of the day' };
    if (r < 0.05) return { sev: 2, up: 95.1 + r * 40, note: 'Interrupted for about an hour, then restored' };
    return { sev: 0, up: r > 0.6 ? 100 : 99.9 + r * 0.1 };
  }

  var SEV = [
    { cls: 'st-good',    label: 'Operational' },
    { cls: 'st-warn',    label: 'Degraded' },
    { cls: 'st-serious', label: 'Partial outage' },
    { cls: 'st-crit',    label: 'Major outage' }
  ];
  function icons() { if (global.orbisIcons) global.orbisIcons(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function dayDate(ago) { var d = new Date(); d.setDate(d.getDate() - ago); return d; }
  function fmtDate(d, year) {
    return d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'short' }) + (year ? ' ' + d.getFullYear() : '');
  }

  function day(svc, ago) {
    var date = key(dayDate(ago));
    if (date >= REAL_FROM) {
      var d = REAL[svc.k] && REAL[svc.k][date];
      if (ago === 0 && svc.k === 'api' && LIVE === false)
        return { sev: 3, up: d ? d.up : 0, note: 'The API is not answering right now' };
      if (ago === 0 && svc.k === 'api' && LIVE === true && !d)
        return { sev: 0, up: 100, note: "Answering now. Today's checks are still coming in" };
      return d ? { sev: d.sev, up: d.up, note: d.note } : { sev: -1 };
    }
    var before = daysBefore(date, REAL_FROM);
    return before >= 1 && before <= SAMPLE_DAYS ? sample(svc.k, date) : { sev: -1 };
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
      var now = today.sev < 0 ? { cls: 'st-none', label: 'No data' } : SEV[today.sev];
      return '<div class="st-row">' +
        '<div class="st-row-hd">' +
          '<div><b>' + svc.name + '</b>' + (svc.note ? '<span>' + svc.note + '</span>' : '') + '</div>' +
          '<span class="st-now ' + now.cls + '">' +
            '<i data-lucide="' + (today.sev > 0 ? 'triangle-alert' : today.sev < 0 ? 'minus' : 'check') + '" class="i-sm"></i>' + now.label + '</span>' +
        '</div>' +
        '<div class="st-bars" style="--n:' + DAYS + '" role="img" aria-label="' + svc.name + ': ' +
          (up == null ? 'no data' : up.toFixed(2) + '% uptime') + ' over ' + DAYS + ' days">' + bars + '</div>' +
        '<div class="st-axis"><span>' + DAYS + ' days ago</span>' +
          '<b class="mono">' + (up == null ? 'No data yet' : up.toFixed(2) + '% uptime') + '</b><span>Today</span></div>' +
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
    if (d.sev < 0) html += '<span class="st-tip-row"><i class="st-sw st-none"></i>No data for this day</span>';
    else {
      html += '<span class="st-tip-row"><i class="st-sw ' + SEV[d.sev].cls + '"></i>' + SEV[d.sev].label +
              '<em class="mono">' + d.up.toFixed(2) + '%</em></span>';
      if (d.note) html += '<span class="st-tip-inc">' + esc(d.note) + '</span>';
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

  /* ========================================================== banner == */
  function banner() {
    var head = document.getElementById('stHead');
    var box = document.getElementById('stBanner');
    var worst = -1;
    SERVICES.forEach(function (svc) { worst = Math.max(worst, day(svc, 0).sev); });
    var B = worst < 0 ? ['st-idle', 'activity', 'Live monitoring is being connected']
          : worst === 0 ? ['', 'check', 'All systems operational']
          : worst === 1 ? ['st-b-warn', 'triangle-alert', 'Some services are degraded']
          : worst === 2 ? ['st-b-serious', 'triangle-alert', 'Partial outage']
          : ['st-b-crit', 'triangle-alert', 'Major outage'];
    box.className = 'st-banner ' + B[0];
    box.querySelector('.st-banner-ic').innerHTML = '<i data-lucide="' + B[1] + '" class="i"></i>';
    head.textContent = B[2];
    idle = worst < 0;
    if (idle) document.getElementById('stUpdated').textContent = 'Daily uptime for each service will show here once it starts.';
    icons();
  }

  function refresh() {
    var A = global.OrbisAPI;
    var history = A.get('/status').then(function (d) {
      REAL = {};
      (d && d.services || []).forEach(function (svc) {
        REAL[svc.k] = {};
        (svc.days || []).forEach(function (x) { REAL[svc.k][x.date] = x; });
      });
    }).catch(function () {});
    var ping = A.connected
      ? A.get('/health').then(function (h) { LIVE = !!(h && h.ok); }, function () { LIVE = false; })
      : Promise.resolve();
    return Promise.all([history, ping]).then(function () { t0 = Date.now(); render(); banner(); });
  }
  refresh();
  setInterval(refresh, 60000);

  /* ========================================================= updated == */
  var upd = document.getElementById('stUpdated');
  setInterval(function () {
    if (idle) return;
    var s = Math.round((Date.now() - t0) / 1000);
    upd.textContent = s < 60 ? 'Checked ' + (s < 5 ? 'just now' : s + ' seconds ago') : 'Checked ' + Math.floor(s / 60) + ' min ago';
  }, 5000);
})(window);
