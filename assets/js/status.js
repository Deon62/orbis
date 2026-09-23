/* ==========================================================================
   Status: one row of daily bars per service, from /status. Until the
   monitoring API answers, every day reads "No data" rather than a claim.
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
    { k: 'academy',  name: 'Academy' }
  ];

  /* filled from /status: DAYS_BY[k][ago] = { sev: 0-3, up: percent } */
  var DAYS_BY = {};
  var idle = true;

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
    var d = DAYS_BY[svc.k] && DAYS_BY[svc.k][ago];
    return d ? { sev: d.sev, up: d.up, note: d.note } : { sev: -1 };
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

  global.OrbisAPI.get('/status').then(function (d) {
    (d && d.services || []).forEach(function (svc) {
      DAYS_BY[svc.k] = {};
      (svc.days || []).forEach(function (x) { DAYS_BY[svc.k][x.ago] = x; });
    });
  }).catch(function () {}).then(function () { render(); banner(); });

  /* ========================================================= updated == */
  var upd = document.getElementById('stUpdated'), t0 = Date.now();
  setInterval(function () {
    if (idle) return;
    var s = Math.round((Date.now() - t0) / 1000);
    upd.textContent = s < 60 ? 'Checked ' + (s < 5 ? 'just now' : s + ' seconds ago') : 'Checked ' + Math.floor(s / 60) + ' min ago';
  }, 5000);
})(window);
