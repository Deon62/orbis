/* ==========================================================================
   orbisflow, data layer
   Every page that shows account data asks through here.

   ┌──────────────────────────────────────────────────────────────────────┐
   │ API_BASE: the address of the orbisflow API (the backend on Render). │
   │ Empty = offline: pages show their empty states and the auth forms   │
   │ and payments run their local simulation.                            │
   └──────────────────────────────────────────────────────────────────────┘ */
var API_BASE = 'https://backend-xv27.onrender.com';
/*
   It can also be set per page with <html data-api="…">, or with
   window.ORBIS_API_BASE before this file loads.

   Sessions: sign-in stores Supabase's access and refresh tokens here in
   localStorage. Every request carries the access token; a 401 refreshes it
   once and retries. App pages redirect to /login when there is no session.

   Endpoints (the backend README has the full list):
     /me /accounts /payment-methods /referrals /referrals/link /transactions
     /payments/deposit/mpesa /payments/deposit/card /payments/withdraw /payments/{ref}
     /rates
   Not built on the backend yet (a 404 reads as "nothing yet", so these pages
   show their empty states): /trades/* /reports/profit /confirmations /calendar
   /news /alerts /watchlists /signals /patterns /copy/providers /sessions
   /support/messages /status
   ========================================================================== */
(function (global) {
  'use strict';

  var BASE = (document.documentElement.getAttribute('data-api') || global.ORBIS_API_BASE || API_BASE || '').replace(/\/$/, '');
  var SESSION_KEY = 'orbisflow-session';

  /* ---------------------------------------------------------- session --- */
  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch (e) { return null; }
  }
  function setSession(s) {
    try {
      var prev = session() || {};
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        access_token: s.access_token, refresh_token: s.refresh_token || prev.refresh_token,
        expires_at: s.expires_at || null, profile: s.profile || prev.profile || null
      }));
    } catch (e) {}
  }
  function setProfile(p) {
    var s = session();
    if (!s) return;
    s.profile = p;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

  function toLogin() {
    var next = location.pathname + location.search;
    location.replace('/login' + (next && next !== '/' ? '?next=' + encodeURIComponent(next) : ''));
  }

  /* ---------------------------------------------------------- requests --- */
  function ApiError(message, status) {
    var e = new Error(message);
    e.status = status;
    return e;
  }

  var refreshing = null;
  function refresh() {
    var s = session();
    if (!s || !s.refresh_token) return Promise.reject(ApiError('Your session has ended. Log in again.', 401));
    if (!refreshing) {
      refreshing = fetch(BASE + '/auth/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      }).then(function (r) {
        if (!r.ok) throw ApiError('Your session has ended. Log in again.', 401);
        return r.json();
      }).then(function (fresh) { setSession(fresh); return fresh; })
        .finally(function () { refreshing = null; });
    }
    return refreshing;
  }

  function request(method, path, body, retried) {
    if (!BASE) return Promise.reject(ApiError('Not connected', 0));
    var s = session();
    var headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (s && s.access_token) headers.Authorization = 'Bearer ' + s.access_token;

    return fetch(BASE + path, { method: method, headers: headers, body: body !== undefined ? JSON.stringify(body) : undefined })
      .catch(function () { throw ApiError('Could not reach orbisflow. Check your connection.', 0); })
      .then(function (r) {
        if (r.status === 401 && s && s.refresh_token && !retried && path.indexOf('/auth/') !== 0) {
          return refresh().then(function () { return request(method, path, body, true); }, function (err) {
            clearSession();
            if (document.body.dataset.shell === 'app') toLogin();
            throw err;
          });
        }
        if (r.status === 204) return null;
        return r.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) {}
          if (!r.ok) {
            var msg = data && typeof data.detail === 'string' ? data.detail : 'Something went wrong. Try again.';
            var err = ApiError(msg, r.status);
            /* 428: a one-time code is owed. For signing in, that is the login
               page's job; anything else (a withdrawal) is the caller's. */
            err.otp = r.headers.get('X-Orbis-Otp');
            if (r.status === 428 && err.otp === 'login' && document.body.dataset.page !== 'login') {
              var next = location.pathname + location.search;
              location.replace('/login?otp=1&next=' + encodeURIComponent(next));
            }
            throw err;
          }
          return data;
        });
      });
  }

  /* offline, reads answer "nothing yet"; so does an endpoint the backend
     does not have yet (404), so its page shows the empty state */
  function get(path) {
    if (!BASE) return Promise.resolve(null);
    return request('GET', path).catch(function (e) {
      if (e.status === 404) return null;
      throw e;
    });
  }
  function post(path, body) { return request('POST', path, body === undefined ? {} : body); }
  function patch(path, body) { return request('PATCH', path, body); }
  function put(path, body) { return request('PUT', path, body); }
  function del(path) { return request('DELETE', path); }

  /* app pages need a signed-in user once the API is connected */
  if (BASE && document.body && document.body.dataset.shell === 'app' && !session()) toLogin();

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
    base: BASE,
    get: get,
    post: post,
    patch: patch,
    put: put,
    del: del,
    session: session,
    setSession: setSession,
    setProfile: setProfile,
    clearSession: clearSession,
    signedIn: function () { return !!(session() && session().access_token); },
    load: load,
    isEmpty: isEmpty,
    empty: emptyHTML,
    loading: loadingHTML,
    money: money
  };
})(window);
