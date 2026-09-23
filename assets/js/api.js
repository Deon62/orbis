/* ==========================================================================
   orbisflow, data layer
   Every page that shows account data asks through here. Until an API base
   is set, each request answers empty, so every page shows its empty state
   rather than invented numbers. To connect the backend, set the base once:

     <html data-api="https://api.orbisflow.com">       (per page), or
     window.ORBIS_API_BASE = 'https://api.orbisflow.com' (before this file)

   Endpoints the pages call, all GET, all JSON:
     /me                       profile: { name, email, phone, country, currency }
     /accounts                 [{ id, label, balance, currency }]
     /trades/open              [{ id, sym, dir, stake, entry, now, ends, pl }]
     /trades/closed            [{ id, sym, dir, stake, entry, exit, result, pl, when }]
     /trades/stats             { byMarket: [[sym, pl]], byDuration: [[label, count, winPct]] }
     /transactions             [{ when, type, method, ref, status, amount }]
     /reports/profit           [{ date, trades, won, lost, turnover, pl }]
     /confirmations            [{ id, sym, dir, stake, entry, exit, result, pl, when }]
     /calendar?range=today     [{ time, ccy, flag, event, impact, forecast, previous, actual }]
     /news                     [{ title, source, ago, sym, url }]
     /alerts                   [{ sym, rule, status }]
     /watchlists               [{ id, name, symbols: [] }]
     /signals                  [{ sym, dir, conf, tf, stake, why }]
     /patterns                 [{ sym, pattern, tf, bias, ago }]
     /copy/providers           [{ id, name, initials, style, copiers, ret, win, dd, min }]
     /referrals                [{ user, joined, status, volume, earned }]
     /referrals/earnings       { paid, pending, weeks: [{ period, active, volume, amount, status }] }
     /payment-methods          [{ kind, label, masked, status, isDefault }]
     /sessions                 [{ device, place, lastSeen, current }]
     /support/messages         [{ from: 'agent'|'me', text, at }]
     /status                   { services: [{ k, days: [{ ago, sev, up }] }] }
   ========================================================================== */
(function (global) {
  'use strict';

  var BASE = (document.documentElement.getAttribute('data-api') || global.ORBIS_API_BASE || '').replace(/\/$/, '');

  function get(path) {
    if (!BASE) return Promise.resolve(null);
    return fetch(BASE + path, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.status === 204 ? null : r.json();
      });
  }

  function isEmpty(d) {
    if (d == null) return true;
    if (Array.isArray(d)) return d.length === 0;
    if (Array.isArray(d.items)) return d.items.length === 0;
    return false;
  }

  function ic(n, c) { return '<i data-lucide="' + n + '" class="' + (c || 'i') + '"></i>'; }

  /* ---------------------------------------------------------- states --- */
  function emptyHTML(o) {
    return '<div class="es">' +
      '<span class="es-ic">' + ic(o.icon || 'list') + '</span>' +
      '<b>' + o.title + '</b>' +
      (o.text ? '<p>' + o.text + '</p>' : '') +
      (o.action ? '<div class="es-act">' + o.action + '</div>' : '') +
    '</div>';
  }

  function loadingHTML(rows) {
    var out = '<div class="es-skel" aria-busy="true" aria-label="Loading">';
    for (var i = 0; i < (rows || 3); i++) out += '<span style="width:' + (92 - i * 14) + '%"></span>';
    return out + '</div>';
  }

  function errorHTML() {
    return '<div class="es es-err">' +
      '<span class="es-ic">' + ic('triangle-alert') + '</span>' +
      '<b>This did not load</b><p>Check your connection and try again.</p>' +
      '<div class="es-act"><button class="btn btn-ghost btn-sm" data-es-retry>Try again</button></div>' +
    '</div>';
  }

  function draw() { if (global.orbisIcons) global.orbisIcons(); }

  /* load a list into a container: loading, then the data, the empty state,
     or an error with a retry */
  function load(o) {
    var el = typeof o.el === 'string' ? document.querySelector(o.el) : o.el;
    if (!el) return Promise.resolve();
    el.innerHTML = loadingHTML(o.rows);
    return get(o.path).then(function (data) {
      if (isEmpty(data)) { el.innerHTML = emptyHTML(o.empty); draw(); if (o.onEmpty) o.onEmpty(); return; }
      el.innerHTML = o.render(data);
      draw();
      if (o.after) o.after(data);
    }).catch(function () {
      el.innerHTML = errorHTML();
      draw();
      el.querySelector('[data-es-retry]').addEventListener('click', function () { load(o); });
    });
  }

  function money(n) {
    return (n < 0 ? '-' : '') + '$' + Math.abs(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  global.OrbisAPI = {
    connected: !!BASE,
    get: get,
    load: load,
    isEmpty: isEmpty,
    empty: emptyHTML,
    loading: loadingHTML,
    money: money
  };
})(window);
