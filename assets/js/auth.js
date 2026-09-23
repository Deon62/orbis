/* ==========================================================================
   orbisflow, sign-up and log-in against the API
   Offline (no API_BASE), the forms keep their local simulation.

   Supabase sends people back to /login with the session in the URL
   fragment after Google sign-in, after confirming their email, and from a
   password reset link. All three are picked up here.
   ========================================================================== */
(function () {
  'use strict';

  var A = window.OrbisAPI;
  var page = document.body.dataset.page;
  var params = new URLSearchParams(location.search);
  var REF_KEY = 'orbisflow-ref';

  /* a referral code travels from the link to the account, even through Google */
  /* /r/ORBIS-XXXXX is rewritten to sign-up but keeps its own address, so the
     code is read from the path as well as from ?ref= */
  var fromPath = location.pathname.match(/^\/r\/([A-Za-z0-9-]{4,20})\/?$/);
  var ref = (params.get('ref') || (fromPath && fromPath[1]) || '').trim().toUpperCase();
  try { if (ref) localStorage.setItem(REF_KEY, ref); } catch (e) {}
  function storedRef() { try { return localStorage.getItem(REF_KEY) || ''; } catch (e) { return ''; } }
  function forgetRef() { try { localStorage.removeItem(REF_KEY); } catch (e) {} }

  var refInput = document.getElementById('ref');
  if (page === 'signup' && refInput && !refInput.value) refInput.value = ref || storedRef();

  if (!A || !A.connected) return;

  var card = document.querySelector('.auth-card');
  var form = card.querySelector('form');
  var google = card.querySelector('.btn-google');
  var forgot = card.querySelector('[data-forgot]');
  form.removeAttribute('data-mock-submit');
  if (google) google.removeAttribute('data-login');
  if (forgot) forgot.removeAttribute('data-mock');

  function ic(n, c) { return '<i data-lucide="' + n + '" class="' + (c || 'i') + '"></i>'; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* only ever go somewhere on this site after signing in */
  function next() {
    var n = params.get('next') || '';
    return /^\/(?!\/)/.test(n) ? n : '/trade';
  }

  function say(msg, kind) {
    var box = card.querySelector('.auth-msg');
    if (!box) {
      box = document.createElement('p');
      box.className = 'auth-msg';
      box.setAttribute('role', 'alert');
      card.querySelector('h1').insertAdjacentElement('afterend', box);
    }
    box.className = 'auth-msg ' + (kind === 'ok' ? 'auth-ok' : 'auth-err');
    box.innerHTML = ic(kind === 'ok' ? 'check-circle-2' : 'triangle-alert', 'i-sm') + '<span>' + esc(msg) + '</span>';
    box.hidden = false;
    if (window.orbisIcons) window.orbisIcons();
  }
  function quiet() { var b = card.querySelector('.auth-msg'); if (b) b.hidden = true; }

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="btn-spin"></span>' + label; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  function claimRef() {
    var r = storedRef();
    if (!r) return Promise.resolve();
    return A.post('/referrals/claim', { code: r }).catch(function () {}).then(forgetRef);
  }

  function signedIn(session) {
    A.setSession(session);
    return claimRef().then(function () { location.replace(next()); });
  }

  /* ---------------------------------------- back from Supabase, with a session */
  var hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (hash.get('error_description')) {
    history.replaceState(null, '', location.pathname + location.search);
    say(hash.get('error_description').replace(/\+/g, ' '), 'err');
  }
  if (hash.get('access_token')) {
    history.replaceState(null, '', location.pathname);
    A.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token'),
                   expires_at: Number(hash.get('expires_at')) || null });
    if (hash.get('type') === 'recovery') return resetForm();
    card.innerHTML = '<div class="auth-wait"><span class="loader"></span><p>Signing you in</p></div>';
    A.get('/me').then(function (p) {
      if (p) A.setProfile(p);
      return claimRef();
    }).then(function () { location.replace(next()); }, function (e) {
      A.clearSession();
      location.replace('/login?error=' + encodeURIComponent(e.message));
    });
    return;
  }
  if (params.get('error')) say(params.get('error'), 'err');

  /* already signed in: straight through */
  if (A.signedIn()) { location.replace(next()); return; }
  if (params.get('confirmed')) say('Email confirmed. Log in to continue.', 'ok');
  if (params.get('reset')) say('That reset link has expired. Ask for a new one below.', 'err');

  /* ------------------------------------------------------------------ forms */
  var submit = form.querySelector('[type=submit]');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    quiet();
    var email = form.querySelector('#email').value.trim();
    var password = form.querySelector('#pw').value;

    if (page === 'signup') {
      if (password.length < 8) return say('Use at least 8 characters for your password.', 'err');
      busy(submit, true, 'Creating your account');
      A.post('/auth/signup', {
        name: form.querySelector('#tn').value.trim(), email: email, password: password,
        referral_code: (refInput && refInput.value.trim()) || null
      }).then(function (res) {
        if (res && res.confirm_email) return checkEmail(res.email || email);
        forgetRef();
        return signedIn(res);
      }).catch(function (err) { busy(submit, false); say(err.message, 'err'); });
      return;
    }

    busy(submit, true, 'Signing you in');
    A.post('/auth/login', { email: email, password: password })
      .then(signedIn)
      .catch(function (err) { busy(submit, false); say(err.message, 'err'); });
  });

  if (google) {
    google.addEventListener('click', function (e) {
      e.preventDefault();
      busy(google, true, 'Opening Google');
      var r = (refInput && refInput.value.trim()) || storedRef();
      if (r) { try { localStorage.setItem(REF_KEY, r.toUpperCase()); } catch (x) {} }
      A.get('/auth/google' + (r ? '?ref=' + encodeURIComponent(r) : '')).then(function (res) {
        if (!res || !res.url) throw new Error('Google sign-in is not available right now.');
        location.href = res.url;
      }).catch(function (err) { busy(google, false); say(err.message, 'err'); });
    });
  }

  if (forgot) {
    forgot.addEventListener('click', function (e) {
      e.preventDefault();
      var email = form.querySelector('#email').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        form.querySelector('#email').focus();
        return say('Enter your email above, then tap Forgot.', 'err');
      }
      A.post('/auth/password/forgot', { email: email }).then(function () {
        say('If there is an account for ' + email + ', a reset link is on its way.', 'ok');
      }).catch(function (err) { say(err.message, 'err'); });
    });
  }

  /* a referral code is checked as soon as it is typed, not after submitting */
  if (page === 'signup' && refInput) {
    refInput.addEventListener('change', function () {
      var c = refInput.value.trim();
      if (!c) return quiet();
      A.get('/referrals/check/' + encodeURIComponent(c)).then(function (r) {
        if (r && r.valid) { quiet(); refInput.classList.remove('input-err'); }
        else { refInput.classList.add('input-err'); say('That referral code does not exist. Check it, or leave it empty.', 'err'); }
      }).catch(function () {});
    });
  }

  /* ------------------------------------------------------------ screens */
  function checkEmail(email) {
    card.innerHTML =
      '<div class="auth-done">' +
        '<span class="auth-done-ic">' + ic('mail') + '</span>' +
        '<h1>Check your email</h1>' +
        '<p>We sent a link to <b>' + esc(email) + '</b>. Open it to confirm your account and you will be signed straight in.</p>' +
        '<p class="hint">Nothing there? Look in spam, or wait a minute.</p>' +
        '<a class="btn btn-ghost btn-block" href="/login">Back to log in</a>' +
      '</div>';
    if (window.orbisIcons) window.orbisIcons();
  }

  function resetForm() {
    card.innerHTML =
      '<h1>Choose a new password</h1>' +
      '<form id="resetForm">' +
        '<div class="field"><label class="label" for="np">New password</label>' +
          '<input class="input" id="np" type="password" placeholder="8+ characters" autocomplete="new-password" required></div>' +
        '<div class="field"><label class="label" for="np2">Type it again</label>' +
          '<input class="input" id="np2" type="password" autocomplete="new-password" required></div>' +
        '<button class="btn btn-primary btn-block btn-lg" type="submit">Save and continue</button>' +
      '</form>';
    var f = card.querySelector('#resetForm');
    var btn = f.querySelector('[type=submit]');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var a = f.querySelector('#np').value, b = f.querySelector('#np2').value;
      if (a.length < 8) return say('Use at least 8 characters.', 'err');
      if (a !== b) return say('The two passwords do not match.', 'err');
      busy(btn, true, 'Saving');
      A.post('/auth/password/update', { password: a })
        .then(function () { location.replace('/trade'); })
        .catch(function (err) { busy(btn, false); say(err.message, 'err'); });
    });
  }
})();
