/* ==========================================================================
   orbisflow, shared shell
     shell="app"    → icon rail (desktop) + drawer & 6-tab bar (mobile),
                      edge-to-edge, no footer
     shell="public" → marketing header + footer
     shell="bare"   → auth pages
   Everything here is mock. No network calls, no real auth, no real money.
   ========================================================================== */
(function () {
  'use strict';

  var BODY = document.body;
  var PAGE = BODY.dataset.page || '';
  var ACTIVE = BODY.dataset.nav || PAGE;   /* sub-pages keep their parent tab lit */
  var SHELL = BODY.dataset.shell || 'app';
  var ROOT = BODY.dataset.root || './';

  /* pages are served without the .html extension (see vercel.json) */
  function href(p) { return p; }
  function ic(n, c) { return '<i data-lucide="' + n + '" class="' + (c || 'i') + '"></i>'; }

  /* Brand marks were dropped from Lucide, so those come from Simple Icons. */
  function brandIcon(slug, hex) {
    return '<img class="brand-ic" src="https://cdn.simpleicons.org/' + slug + '/' + hex +
           '" alt="" width="16" height="16" loading="lazy">';
  }
  window.orbisBrandIcon = brandIcon;

  /* the mark is a wordmark, so it is type, not an image */
  function logo(cls) {
    return '<a class="logo ' + (cls || '') + '" href="' + href(SHELL === 'app' ? '/trade' : '/') +
           '" aria-label="orbisflow"><span class="logo-word">orbis<span class="flow">flow</span></span></a>';
  }

  /* ============================================================= sound === */
  var SOUND_KEY = 'orbisflow-sound';
  var audio;

  function soundOn() {
    try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) { return true; }
  }
  function setSound(on) {
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch (e) {}
    document.querySelectorAll('[data-sound-switch]').forEach(function (sw) {
      sw.classList.toggle('on', on);
      sw.setAttribute('aria-checked', String(on));
    });
  }

  /* short synthesised tones, no audio files to ship or fail to load */
  function beep(kind) {
    if (!soundOn()) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      var notes = kind === 'win'  ? [[660, 0], [880, 0.12]]
                : kind === 'lose' ? [[400, 0], [300, 0.14]]
                : [[760, 0]];
      notes.forEach(function (n) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine';
        o.frequency.value = n[0];
        var t = audio.currentTime + n[1];
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(audio.destination);
        o.start(t); o.stop(t + 0.18);
      });
    } catch (e) {}
  }
  window.orbisBeep = beep;
  window.orbisSoundOn = soundOn;

  /* ============================================================= theme === */
  var THEME_KEY = 'orbisflow-theme';
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }
  function setTheme(t) {
    var dark = t === 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    document.querySelectorAll('[data-theme-icon]').forEach(function (b) {
      b.innerHTML = ic(dark ? 'sun' : 'moon');
    });
    document.querySelectorAll('[data-theme-switch]').forEach(function (sw) {
      sw.classList.toggle('on', dark);
      sw.setAttribute('aria-checked', String(dark));
    });
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    });
    drawIcons();
    if (window.orbisChartTheme) window.orbisChartTheme();
  }
  window.orbisSetTheme = setTheme;

  /* desktop only, on phones the switch lives in the drawer */
  function themeBtn() {
    return '<button class="icon-btn hide-mobile" data-theme-toggle data-theme-icon aria-label="Switch theme">' +
           ic(currentTheme() === 'dark' ? 'sun' : 'moon') + '</button>';
  }

  /* ========================================================== accounts === */
  /* the active account sits in a card in the top bar; the chevron opens a
     centred modal to switch between them */
  var ACCOUNTS = [
    { id: 'demo', label: 'Demo account', short: 'Demo', amount: '$10,000.00', icon: 'flask-conical' },
    { id: 'real', label: 'Real account', short: 'Real', amount: '$1,384.40',  icon: 'wallet' }
  ];
  var activeAccount = 'demo';
  /* the account card belongs where money is at stake */
  var ACCOUNT_PAGES = ['trade', 'markets', 'positions'];

  function accountCardHTML() {
    var a = ACCOUNTS.filter(function (x) { return x.id === activeAccount; })[0];
    return '<button class="acct-card" data-modal="account" aria-haspopup="dialog">' +
      '<img class="acct-flag" src="https://flagcdn.com/w40/us.png" alt="USD" title="US dollar">' +
      '<span class="acct-card-tx"><small>' + a.short + '</small><b class="num">' + a.amount + '</b></span>' +
      ic('chevron-down', 'i-sm') + '</button>';
  }

  function setAccount(id) {
    activeAccount = id;
    var host = document.querySelector('.hdr-right');
    if (host) {
      var old = host.querySelector('.acct-card');
      if (old) old.outerHTML = accountCardHTML();
      drawIcons();
    }
  }

  window.orbisAccounts = ACCOUNTS;
  window.orbisActiveAccount = function () { return activeAccount; };
  window.orbisSetAccount = setAccount;

  /* ============================================================== nav ==== */
  /* these six are the bottom tab bar and the desktop rail, and so are
     deliberately absent from the drawer, which carries everything else */
  var NAV = [
    { id: 'trade',     label: 'Trade',     icon: 'chart-candlestick', url: '/trade' },
    { id: 'markets',   label: 'Markets',   icon: 'layers',            url: '/markets' },
    { id: 'ai',        label: 'AI',        icon: 'bot',               url: '/ai' },
    { id: 'positions', label: 'Positions', icon: 'receipt-text',      url: '/positions' },
    { id: 'account',   label: 'Profile',   icon: 'user-round',        url: '/profile-details' }
  ];

  var DRAWER_GROUPS = [
    { h: 'Money', items: [
      ['Deposit',             'arrow-down-to-line', 'modal:deposit'],
      ['Withdraw',            'arrow-up-from-line', 'modal:withdraw'],
      ['Transaction history', 'receipt',            '/cashier'],
      ['Refer & earn',        'gift',               'modal:refer']
    ]},
    { h: 'Account', items: [
      ['Verification',     'badge-check', '/verification'],
      ['Security',         'shield',      '/security'],
      ['Payment methods',  'credit-card', '/payments'],
      ['Preferences',      'settings',    '/preferences']
    ]},
    { h: 'Trading tools', items: [
      ['Copy trading',      'users-round',   '/copy-trading'],
      ['Economic calendar', 'calendar-days', '/economic-calendar'],
      ['Market news',       'newspaper',     '/market-news'],
      ['Price alerts',      'bell-ring',     '/price-alerts'],
      ['Watchlists',        'star',          '/watchlists']
    ]},
    { h: 'Reports', items: [
      ['Statements',          'file-text',  '/positions'],
      ['Profit table',        'table',      '/profit-table'],
      ['Trade confirmations', 'file-check', '/trade-confirmations']
    ]},
    { h: 'Support', items: [
      ['Help centre', 'life-buoy',      '/help-centre'],
      ['Live chat',   'message-square', '/live-chat'],
      ['Contact us',  'mail',           '/contact']
    ]},
    { h: 'Legal', items: [
      ['Terms',           'scroll-text',    '/terms'],
      ['Privacy policy',  'lock',           '/privacy'],
      ['Risk disclosure', 'triangle-alert', '/risk-disclosure']
    ]}
  ];

  /* Only pages that actually run the public shell belong here. Everything else
     lives inside the trading app and would drop a visitor into it sideways. */
  var PUBLIC_NAV = [
    { id: 'home',     label: 'Home',     url: '/' },
    { id: 'academy',  label: 'Academy',  url: '/academy' },
    { id: 'newsroom', label: 'Newsroom', url: '/newsroom' },
    { id: 'about',    label: 'About',    url: '/about' }
  ];

  var PUBLIC_DRAWER = [
    { h: 'Platform', items: [
      ['Home',     'home',           '/',         'home'],
      ['Academy',  'graduation-cap', '/academy',  'academy'],
      ['Newsroom', 'newspaper',      '/newsroom', 'newsroom'],
      ['About',    'building-2',     '/about',    'about']
    ]}
  ];

  /* ============================================================= rail ==== */
  function railHTML() {
    var items = NAV.map(function (n) {
      return '<a href="' + href(n.url) + '" class="rail-item ' + (ACTIVE === n.id ? 'active' : '') +
             '" title="' + n.label + '">' + ic(n.icon, 'i-lg') + '<span>' + n.label + '</span></a>';
    }).join('');

    return '<nav class="rail" aria-label="Sections">' +
      '<a class="rail-logo" href="' + href('/trade') + '" aria-label="orbisflow">' +
        '<span class="logo-word"><span class="flow">of</span></span></a>' +
      '<div class="rail-items">' + items + '</div>' +
      '<div class="rail-foot">' +
        '<button class="rail-item" data-drawer-open title="More">' + ic('menu', 'i-lg') + '<span>More</span></button>' +
        '<button class="rail-item" data-theme-toggle title="Theme">' +
          '<span data-theme-icon>' + ic(currentTheme() === 'dark' ? 'sun' : 'moon', 'i-lg') + '</span>' +
          '<span>Theme</span></button>' +
        '<a class="rail-item rail-item-danger" href="' + href('/') + '" title="Log out">' + ic('log-out', 'i-lg') + '<span>Log out</span></a>' +
      '</div></nav>';
  }

  /* =========================================================== drawer ==== */
  function drawerHTML() {
    var groups = DRAWER_GROUPS.map(function (g) {
      return '<div class="drawer-grp"><h4>' + g.h + '</h4>' + g.items.map(function (it) {
        var t = it[2], attr;
        if (!t) attr = ' href="#" data-mock="' + it[0] + '"';
        else if (t.indexOf('modal:') === 0) attr = ' href="#" data-modal="' + t.slice(6) + '"';
        else attr = ' href="' + href(t) + '"';
        return '<a' + attr + '>' + ic(it[1]) + it[0] + '</a>';
      }).join('') + '</div>';
    }).join('');

    return '<div class="scrim" data-drawer-close hidden></div>' +
      '<aside class="drawer" id="drawer" aria-label="Menu" aria-hidden="true">' +
        '<div class="drawer-hd">' + logo() +
          '<button class="icon-btn" data-drawer-close aria-label="Close menu">' + ic('x') + '</button>' +
        '</div>' +
        '<a class="drawer-acct" href="/profile-details">' +
          '<span class="avatar">AO</span>' +
          '<div><b>Amara Otieno</b><span>Demo · $10,000.00</span></div>' +
        '</a>' +
        '<div class="drawer-scroll">' + groups + '</div>' +
        /* pinned, so log out and the theme switch never need scrolling to */
        '<div class="drawer-foot">' +
          '<button class="drawer-act" data-sound-toggle>' +
            ic('volume-2') +
            '<span>Sound</span>' +
            '<span class="switch' + (soundOn() ? ' on' : '') +
              '" data-sound-switch role="switch" aria-checked="' + soundOn() + '"></span>' +
          '</button>' +
          '<button class="drawer-act" data-theme-toggle>' +
            '<span data-theme-icon>' + ic(currentTheme() === 'dark' ? 'sun' : 'moon') + '</span>' +
            '<span>Dark mode</span>' +
            '<span class="switch' + (currentTheme() === 'dark' ? ' on' : '') +
              '" data-theme-switch role="switch" aria-checked="' + (currentTheme() === 'dark') + '"></span>' +
          '</button>' +
          '<a class="drawer-act drawer-act-danger" href="' + href('/') + '">' + ic('log-out') + '<span>Log out</span></a>' +
        '</div>' +
      '</aside>';
  }

  function publicDrawerHTML() {
    var groups = PUBLIC_DRAWER.map(function (g) {
      return '<div class="drawer-grp"><h4>' + g.h + '</h4>' + g.items.map(function (it) {
        var on = ACTIVE === it[3];
        return '<a href="' + it[2] + '"' + (on ? ' class="active" aria-current="page"' : '') + '>' +
               ic(it[1]) + it[0] + '</a>';
      }).join('') + '</div>';
    }).join('');

    return '<div class="scrim" data-drawer-close hidden></div>' +
      '<aside class="drawer" id="drawer" aria-label="Menu" aria-hidden="true">' +
        '<div class="drawer-hd">' + logo() +
          '<button class="icon-btn" data-drawer-close aria-label="Close menu">' + ic('x') + '</button>' +
        '</div>' +
        '<div class="drawer-cta">' +
          '<a class="btn btn-primary btn-block" href="/signup">Create free account</a>' +
          '<a class="btn btn-ghost btn-block" href="/login">Log in</a>' +
        '</div>' +
        '<div class="drawer-scroll">' + groups + '</div>' +
        '<div class="drawer-foot">' +
          '<button class="drawer-act" data-theme-toggle>' +
            '<span data-theme-icon>' + ic(currentTheme() === 'dark' ? 'sun' : 'moon') + '</span>' +
            '<span>Dark mode</span>' +
            '<span class="switch' + (currentTheme() === 'dark' ? ' on' : '') +
              '" data-theme-switch role="switch" aria-checked="' + (currentTheme() === 'dark') + '"></span>' +
          '</button>' +
        '</div>' +
      '</aside>';
  }

  /* =========================================================== header ==== */
  function headerHTML() {
    if (SHELL === 'bare') return '';

    if (SHELL === 'public') {
      var nav = PUBLIC_NAV.map(function (n) {
        var on = ACTIVE === n.id;
        return '<a href="' + href(n.url) + '"' + (on ? ' class="active" aria-current="page"' : '') + '>' +
               n.label + '</a>';
      }).join('');
      return '<header class="hdr"><div class="wrap hdr-in">' + logo() +
        '<nav class="hdr-nav">' + nav + '</nav>' +
        '<div class="hdr-right">' + themeBtn() +
          '<a class="btn btn-quiet btn-sm hide-mobile" href="' + href('/login') + '">Log in</a>' +
          '<a class="btn btn-primary btn-sm hide-mobile" href="' + href('/signup') + '">Create account</a>' +
          '<button class="icon-btn hide-desk" data-drawer-open aria-label="Open menu">' + ic('menu', 'i-lg') + '</button>' +
        '</div></div></header>';
    }

    var sub = BODY.dataset.title;
    var title = sub || (NAV.filter(function (n) { return n.id === ACTIVE; })[0] || { label: '' }).label;
    var full = !sub && ACCOUNT_PAGES.indexOf(ACTIVE) > -1;

    var lead = full
      ? '<button class="icon-btn hide-desk" data-drawer-open aria-label="Open menu">' + ic('menu', 'i-lg') + '</button>' +
        '<span class="hide-desk">' + logo() + '</span>'
      : '<a class="icon-btn" data-back-nav href="' + (BODY.dataset.backTo || '/trade') + '" aria-label="Back">' +
        ic('arrow-left', 'i-lg') + '</a>';

    return '<header class="hdr"><div class="hdr-in">' + lead +
      '<span class="hdr-page' + (full ? '' : ' hdr-page-always') + '">' + title + '</span>' +
      '<div class="hdr-right">' +
        (full ? accountCardHTML() : '') +
        (BODY.dataset.hdrAction
          ? '<button class="icon-btn" data-modal="' + BODY.dataset.hdrAction + '" aria-label="' +
            (BODY.dataset.hdrLabel || 'Details') + '">' + ic(BODY.dataset.hdrIcon || 'info') + '</button>'
          : '') +
        /* a page can put a person in the corner instead, the way live chat does */
        (BODY.dataset.hdrPerson || BODY.dataset.hdrPersonImg
          ? '<span class="hdr-person">' +
              (BODY.dataset.hdrPersonImg
                ? '<span class="agent agent-sm"><img src="' + BODY.dataset.hdrPersonImg +
                  '" alt=""><i class="agent-dot"></i></span>'
                : '<span class="avatar">' + BODY.dataset.hdrPerson + '</span>') +
              '<span class="hdr-person-tx"><b>' + (BODY.dataset.hdrPersonName || '') + '</b>' +
                '<span><i class="dotlive"></i>' + (BODY.dataset.hdrPersonStatus || 'Online') + '</span></span>' +
            '</span>'
          : '') +
        /* deposit only where money is actually at stake */
        (full ? '<button class="hdr-deposit" data-modal="deposit" aria-label="Deposit">' +
                  ic('arrow-down-to-line') + '</button>' : '') +
      '</div></div></header>';
  }

  function tabbarHTML() {
    return '<nav class="tabbar" aria-label="Primary">' + NAV.map(function (t) {
      return '<a href="' + href(t.url) + '" class="' + (ACTIVE === t.id ? 'active' : '') + '">' +
             ic(t.icon) + '<span>' + t.label + '</span></a>';
    }).join('') + '</nav>';
  }

  /* =========================================================== footer ==== */
  var FOOTER_COLS = [
    { h: 'Platform', links: [['Trade', '/trade'], ['Markets', '/markets'],
      ['AI insights', '/ai'], ['Positions', '/positions'],
      ['Cashier', '/cashier'], ['Refer & earn', '/referrals']] },
    { h: 'Company', links: [['About', '/about'], ['Academy', '/academy'], ['Newsroom', '/newsroom'], ['Careers', null], ['Contact', '/contact']] },
    { h: 'Support', links: [['Help centre', null], ['Payment methods', null], ['Verification', null], ['Status', null]] },
    { h: 'Legal', links: [['Terms', null], ['Privacy', null], ['Risk disclosure', null], ['AML policy', null], ['Cookies', null]] }
  ];

  function footerHTML() {
    if (SHELL !== 'public') return '';   /* the trading app carries no footer */

    var cols = FOOTER_COLS.map(function (c) {
      return '<div><h4>' + c.h + '</h4><ul>' + c.links.map(function (l) {
        return '<li><a href="' + (l[1] ? href(l[1]) : '#') + '"' +
               (l[1] ? '' : ' data-mock="' + l[0] + '"') + '>' + l[0] + '</a></li>';
      }).join('') + '</ul></div>';
    }).join('');

    var social = [['x', 'X'], ['facebook', 'Facebook'], ['instagram', 'Instagram'],
                  ['telegram', 'Telegram'], ['youtube', 'YouTube']].map(function (s) {
      return '<a href="#" data-mock="' + s[1] + '" aria-label="' + s[1] + '">' + brandIcon(s[0], '93928C') + '</a>';
    }).join('');

    return '<footer class="ftr"><div class="wrap">' +
      '<div class="ftr-grid">' +
        '<div class="ftr-about">' + logo() +
          '<p>Binary options, stripped back to the six inputs that decide a trade.</p>' +
          '<div class="ftr-social">' + social + '</div>' +
        '</div>' + cols +
      '</div>' +
      '<div class="ftr-risk"><b style="color:var(--ink)">Risk warning.</b> ' +
        'Binary options carry a high risk of losing money rapidly. Never trade with funds you ' +
        'cannot afford to lose.</div>' +
      '<div class="ftr-bottom">' +
        '<span>&copy; ' + new Date().getFullYear() + ' orbisflow Markets Ltd.</span>' +
        '<nav>' +
          '<a href="#" data-mock="Terms">Terms</a>' +
          '<a href="#" data-mock="Privacy">Privacy</a>' +
          '<a href="#" data-mock="Cookies">Cookies</a>' +
          '<a href="#" data-mock="Licensing">Licensing</a>' +
        '</nav>' +
      '</div></div></footer>';
  }

  /* ============================================================ mount ==== */
  function mount(sel, html) {
    var el = document.querySelector(sel);
    if (el) el.outerHTML = html;
  }

  if (SHELL === 'app') {
    BODY.classList.add('app-shell');
    BODY.insertAdjacentHTML('afterbegin', railHTML() + drawerHTML());
  } else if (SHELL === 'public') {
    BODY.insertAdjacentHTML('afterbegin', publicDrawerHTML());
  }
  mount('#site-header', headerHTML());
  mount('#site-footer', footerHTML());
  if (SHELL === 'app') {
    if (BODY.dataset.tabbar === 'hide') BODY.classList.add('no-tabbar');
    else BODY.insertAdjacentHTML('beforeend', tabbarHTML());
  }

  /* ============================================================ toast ==== */
  var toastEl;
  function toast(msg, icon) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = ic(icon || 'info', 'i-sm') + '<span>' + msg + '</span>';
    drawIcons();
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }
  window.orbisToast = toast;

  function setDrawer(open) {
    var d = document.getElementById('drawer');
    var s = document.querySelector('.scrim');
    if (!d) return;
    d.classList.toggle('open', open);
    d.setAttribute('aria-hidden', String(!open));
    if (s) s.hidden = !open;
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }

  /* ================================================== global handlers ==== */
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-theme-toggle]')) {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
      return;
    }
    var back = e.target.closest('[data-back-nav]');
    if (back && history.length > 1 && document.referrer) {
      e.preventDefault();
      history.back();
      return;
    }
    if (e.target.closest('[data-sound-toggle]')) { setSound(!soundOn()); return; }
    if (e.target.closest('[data-drawer-open]')) { setDrawer(true); return; }
    if (e.target.closest('[data-drawer-close]')) { setDrawer(false); return; }

    /* "Continue with Google", signs straight into the demo account */
    var g = e.target.closest('[data-login]');
    if (g) {
      e.preventDefault();
      veil(g.dataset.loading || 'Signing you in');
      setTimeout(function () { window.location.href = href(g.dataset.login); }, 1100);
      return;
    }

    var m = e.target.closest('[data-mock]');
    if (m) { e.preventDefault(); toast(m.dataset.mock + ', not wired up yet', 'construction'); return; }

    var c = e.target.closest('[data-copy]');
    if (c) {
      e.preventDefault();
      var src = document.querySelector(c.dataset.copy);
      var text = src ? (src.value || src.textContent) : c.dataset.copy;
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
      toast('Copied', 'check');
      return;
    }

    var grp = e.target.closest('.seg button, .pills .pill, .stake-row .chip, .ticket-seg button, .tf button');
    if (grp) {
      Array.prototype.forEach.call(grp.parentElement.children, function (ch) { ch.classList.remove('active'); });
      grp.classList.add('active');
      if (grp.dataset.panel) {
        var scope = grp.closest('[data-panels]') || document;
        scope.querySelectorAll('[data-panel-id]').forEach(function (p) {
          p.hidden = (p.dataset.panelId !== grp.dataset.panel);
        });
      }
      return;
    }

    var meth = e.target.closest('.method');
    if (meth && meth.parentElement) {
      meth.parentElement.querySelectorAll('.method').forEach(function (x) { x.classList.remove('active'); });
      meth.classList.add('active');
      return;
    }

    var sw = e.target.closest('.switch');
    if (sw) { sw.classList.toggle('on'); sw.setAttribute('aria-checked', String(sw.classList.contains('on'))); return; }

    var pv = e.target.closest('[data-reveal]');
    if (pv) {
      var field = document.querySelector(pv.dataset.reveal);
      if (field) {
        var showing = field.type === 'text';
        field.type = showing ? 'password' : 'text';
        pv.innerHTML = ic(showing ? 'eye' : 'eye-off', 'i-sm');
        drawIcons();
      }
    }
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setDrawer(false); });

  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-mock-submit]');
    if (f) {
      e.preventDefault();
      /* work that ends on another page gets the loader, work that ends here
         gets a toast: a veil you cannot leave is worse than no feedback */
      if (f.dataset.go) {
        veil(f.dataset.loading || f.dataset.mockSubmit);
        setTimeout(function () { window.location.href = href(f.dataset.go); }, 1200);
      } else {
        toast(f.dataset.mockSubmit, 'check-circle-2');
      }
    }
  });

  /* ======================================================== navigation == */
  /* The bar is created synchronously on click, because the browser tears down
     this document's scripting as soon as the navigation starts, a deferred
     timer never runs. The "only when it is slow" part is a CSS animation-delay:
     nothing is painted for the first 150ms, so a quick switch shows nothing. */
  var navBar;

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var to = a.getAttribute('href');
    if (!to || to.charAt(0) === '#' || /^[a-z]+:/i.test(to)) return;
    if (to === location.pathname + location.search) return;

    if (!navBar) {
      navBar = document.createElement('div');
      navBar.className = 'nav-progress';
      document.body.appendChild(navBar);
    }
    navBar.classList.remove('go');
    void navBar.offsetWidth;            /* restart the animation */
    navBar.classList.add('go');
  });

  /* coming back through the bfcache should not leave the bar stranded */
  window.addEventListener('pageshow', function () {
    if (navBar) navBar.classList.remove('go');
  });

  /* ==================================================== filter dropdown == */
  /* One horizontal row of choices was fine with three options and cramped with
     six. Every filter is a dropdown now; pages listen for 'fdrop:change'. */
  function closeDrops(except) {
    document.querySelectorAll('[data-fdrop]').forEach(function (d) {
      if (d === except) return;
      var m = d.querySelector('.fdrop-menu');
      if (m && !m.hidden) {
        m.hidden = true;
        d.querySelector('.fdrop-btn').setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.fdrop-btn');
    if (btn) {
      var drop = btn.closest('[data-fdrop]');
      var menu = drop.querySelector('.fdrop-menu');
      var willOpen = menu.hidden;
      closeDrops(drop);
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
      return;
    }

    var opt = e.target.closest('.fdrop-opt');
    if (opt) {
      var d = opt.closest('[data-fdrop]');
      d.querySelectorAll('.fdrop-opt').forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
      opt.setAttribute('aria-selected', 'true');

      var label = d.querySelector('.fdrop-val');
      if (label) label.innerHTML = opt.querySelector('.fdrop-tx').innerHTML;

      d.querySelector('.fdrop-menu').hidden = true;
      d.querySelector('.fdrop-btn').setAttribute('aria-expanded', 'false');

      /* options can drive panels directly, the way the segmented tabs did */
      if (opt.dataset.panel) {
        var scope = opt.closest('[data-panels]') || document;
        scope.querySelectorAll('[data-panel-id]').forEach(function (pn) {
          pn.hidden = (pn.dataset.panelId !== opt.dataset.panel);
        });
      }
      d.dispatchEvent(new CustomEvent('fdrop:change', { bubbles: true, detail: { value: opt.dataset.v } }));
      return;
    }

    closeDrops(null);
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrops(null); });

  /* ============================================================ icons ==== */
  function drawIcons() {
    if (window.lucide) window.lucide.createIcons({ nameAttr: 'data-lucide' });
  }
  if (window.lucide) drawIcons();
  else window.addEventListener('load', drawIcons);
  /* ============================================================= veil == */
  function veil(label) {
    var el = document.createElement('div');
    el.className = 'veil';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<span class="loader"></span><p class="veil-tx">' + label + '</p>';
    document.body.appendChild(el);
    document.documentElement.style.overflow = 'hidden';
    return el;
  }

  /* ============================================================== faq == */
  /* one answer open at a time: opening a question closes whichever was open.
     The shared name on <details> does this natively in newer browsers; this
     covers the rest */
  document.querySelectorAll('.faq details').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      d.closest('.faq').querySelectorAll('details[open]').forEach(function (o) {
        if (o !== d) o.open = false;
      });
    });
  });

  window.orbisVeil = veil;
  window.orbisIcons = drawIcons;
})();
