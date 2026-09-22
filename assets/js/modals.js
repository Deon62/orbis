/* ==========================================================================
   orbisflow, modals
   Short flows (deposit, withdraw, refer) happen in place instead of on a page.
   Triggered by data-modal="deposit|withdraw|refer" anywhere in the markup.
   ========================================================================== */
(function (global) {
  'use strict';

  function ic(n, c) { return '<i data-lucide="' + n + '" class="' + (c || 'i') + '"></i>'; }
  function icons() { if (global.lucide) global.lucide.createIcons({ nameAttr: 'data-lucide' }); }
  function money(n) {
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function toast(m, i) { if (global.orbisToast) global.orbisToast(m, i); }

  /* saved details, would come from the account service */
  var SAVED = {
    mpesa: { label: 'M-Pesa', masked: '+254 7•• ••• 412', icon: 'smartphone' },
    card:  { label: 'Visa ••••4417', masked: 'Expires 09/28', icon: 'credit-card' },
    bank:  { label: 'Bank transfer', masked: 'Equity ••••4417', icon: 'building-2' },
    usdt:  { label: 'USDT (TRC-20)', masked: 'T••••••••••••x92', icon: 'bitcoin' }
  };

  var REF_LINK = 'https://orbisflow.com/r/ORBIS-4K92';

  /* ============================================================= shell == */
  var scrim, box;

  function ensure() {
    if (scrim) return;
    scrim = document.createElement('div');
    scrim.className = 'modal-scrim';
    scrim.hidden = true;
    scrim.innerHTML = '<div class="modal" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(scrim);
    box = scrim.querySelector('.modal');

    scrim.addEventListener('click', function (e) {
      if (e.target === scrim || e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !scrim.hidden) close();
    });
  }

  function open(title, bodyHTML, onMount, backFn) {
    ensure();
    box.innerHTML =
      '<div class="modal-hd">' +
        (backFn ? '<button class="icon-btn" data-back aria-label="Back">' + ic('arrow-left') + '</button>' : '') +
        '<b>' + title + '</b>' +
        '<button class="icon-btn" data-close aria-label="Close">' + ic('x') + '</button>' +
      '</div>' + bodyHTML;
    scrim.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    icons();
    box.querySelector('[data-close]').addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation(); close();
    });
    if (backFn) box.querySelector('[data-back]').addEventListener('click', backFn);
    if (onMount) onMount(box);
    var f = box.querySelector('input:not([type=hidden]),button.method');
    if (f) f.focus({ preventScroll: true });
  }

  var running;

  function close() {
    clearInterval(running);
    running = null;
    if (!scrim) return;
    scrim.hidden = true;
    document.documentElement.style.overflow = '';
  }

  /* =========================================================== deposit == */
  var DEPOSIT_METHODS = [
    { k: 'mpesa', name: 'M-Pesa',        note: 'Instant · no fee',           tag: 'Instant' },
    { k: 'card',  name: 'Card',          note: 'Visa / Mastercard · 1.5%',   tag: 'Instant' },
    { k: 'bank',  name: 'Bank transfer', note: '1-2 business days',        tag: '1-2 days' },
    { k: 'usdt',  name: 'Crypto',        note: 'USDT, BTC, ETH',             tag: '~10 min' }
  ];

  function depositStep1() {
    var html = '<div class="modal-bd stack-sm">' + DEPOSIT_METHODS.map(function (m) {
      return '<button class="method" data-pick="' + m.k + '">' +
        '<span class="method-ic">' + ic(SAVED[m.k].icon) + '</span>' +
        '<span style="flex:1"><b>' + m.name + '</b><span>' + m.note + '</span></span>' +
        '<span class="tag">' + m.tag + '</span></button>';
    }).join('') + '</div>';

    open('Deposit', html, function (root) {
      root.querySelectorAll('[data-pick]').forEach(function (b) {
        b.addEventListener('click', function () { depositStep2(b.dataset.pick); });
      });
    });
  }

  function depositStep2(key) {
    var s = SAVED[key];
    var html =
      '<div class="modal-bd">' +
        '<div class="saved">' +
          '<span class="method-ic">' + ic(s.icon) + '</span>' +
          '<span class="saved-tx"><b>' + s.label + '</b><span id="mDest">' + s.masked + '</span></span>' +
          '<button class="linkish" data-other>Use another</button>' +
        '</div>' +
        '<div id="mOther" hidden style="margin-top:10px">' +
          '<input class="input" id="mOtherInput" placeholder="' +
            (key === 'mpesa' ? '+254 7XX XXX XXX' : 'Account or wallet') + '">' +
        '</div>' +

        '<div class="field" style="margin:16px 0 10px">' +
          '<label class="label" for="mAmt">Amount</label>' +
          '<div class="input-wrap"><span class="input-prefix">$</span>' +
            '<input class="input" id="mAmt" type="number" value="100" min="5"></div>' +
          '<div class="stake-row">' +
            [20, 100, 250, 500].map(function (v) {
              return '<button class="chip' + (v === 100 ? ' active' : '') + '" data-amt="' + v + '">' + v + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +

        '<div class="kv"><span>Fee</span><b class="mono">$0.00</b></div>' +
        '<div class="kv"><span>Credited</span><b class="mono" id="mNet">$100.00</b></div>' +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-primary btn-block btn-lg" id="mGo">' +
          (key === 'mpesa' ? 'Send STK push · $100.00' : 'Deposit $100.00') + '</button>' +
        (key === 'mpesa'
          ? '<p class="hint center" style="margin-top:10px">Approve the prompt on your phone.</p>'
          : '') +
      '</div>';

    open('Deposit', html, function (root) {
      var amt = root.querySelector('#mAmt');
      var go = root.querySelector('#mGo');

      function sync() {
        var v = Number(amt.value) || 0;
        root.querySelector('#mNet').textContent = money(v);
        go.textContent = (key === 'mpesa' ? 'Send STK push · ' : 'Deposit ') + money(v);
      }
      amt.addEventListener('input', sync);
      root.querySelectorAll('[data-amt]').forEach(function (c) {
        c.addEventListener('click', function () { amt.value = c.dataset.amt; sync(); });
      });

      root.querySelector('[data-other]').addEventListener('click', function () {
        var o = root.querySelector('#mOther');
        o.hidden = !o.hidden;
        if (!o.hidden) root.querySelector('#mOtherInput').focus();
      });

      go.addEventListener('click', function () {
        var dest = root.querySelector('#mOther').hidden
          ? root.querySelector('#mDest').textContent
          : (root.querySelector('#mOtherInput').value || s.masked);
        close();
        toast(key === 'mpesa' ? 'STK push sent to ' + dest : 'Deposit started', 'check-circle-2');
      });
    }, depositStep1);
  }

  /* ========================================================== withdraw == */
  var WITHDRAW_METHODS = [
    { k: 'mpesa', name: 'M-Pesa',        note: 'Same day' },
    { k: 'bank',  name: 'Bank transfer', note: '1-3 business days' },
    { k: 'usdt',  name: 'USDT (TRC-20)', note: '~10 minutes' }
  ];

  function withdrawStep1() {
    var html = '<div class="modal-bd stack-sm">' + WITHDRAW_METHODS.map(function (m) {
      return '<button class="method" data-pick="' + m.k + '">' +
        '<span class="method-ic">' + ic(SAVED[m.k].icon) + '</span>' +
        '<span style="flex:1"><b>' + m.name + '</b><span>' + SAVED[m.k].masked + ' · ' + m.note + '</span></span>' +
        ic('chevron-right', 'i-sm') + '</button>';
    }).join('') + '</div>';
    open('Withdraw', html, function (root) {
      root.querySelectorAll('[data-pick]').forEach(function (b) {
        b.addEventListener('click', function () { withdrawStep2(b.dataset.pick); });
      });
    });
  }

  function withdrawStep2(key) {
    var s = SAVED[key];
    var AVAILABLE = 1284.40;
    var html =
      '<div class="modal-bd">' +
        '<div class="saved">' +
          '<span class="method-ic">' + ic(s.icon) + '</span>' +
          '<span class="saved-tx"><b>' + s.label + '</b><span id="mDest">' + s.masked + '</span></span>' +
          '<button class="linkish" data-other>Use another</button>' +
        '</div>' +
        '<div id="mOther" hidden style="margin-top:10px">' +
          '<input class="input" id="mOtherInput" placeholder="Account or wallet">' +
        '</div>' +

        '<div class="field" style="margin:16px 0 10px">' +
          '<label class="label" for="mAmt">Amount</label>' +
          '<div class="input-wrap"><span class="input-prefix">$</span>' +
            '<input class="input" id="mAmt" type="number" value="250" min="10"></div>' +
          '<div class="stake-row">' +
            '<button class="chip" data-amt="50">50</button>' +
            '<button class="chip active" data-amt="250">250</button>' +
            '<button class="chip" data-amt="500">500</button>' +
            '<button class="chip" data-amt="1284">All</button>' +
          '</div>' +
        '</div>' +

        '<div class="kv"><span>Available</span><b class="mono">' + money(AVAILABLE) + '</b></div>' +
        '<div class="kv"><span>Fee</span><b class="mono">$0.00</b></div>' +
        '<div class="kv"><span>You receive</span><b class="mono" id="mNet">$250.00</b></div>' +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-dark btn-block btn-lg" id="mGo">Request $250.00</button>' +
      '</div>';

    open('Withdraw', html, function (root) {
      var amt = root.querySelector('#mAmt');
      var go = root.querySelector('#mGo');
      function sync() {
        var v = Number(amt.value) || 0;
        root.querySelector('#mNet').textContent = money(v);
        go.textContent = 'Request ' + money(v);
      }
      amt.addEventListener('input', sync);
      root.querySelectorAll('[data-amt]').forEach(function (c) {
        c.addEventListener('click', function () { amt.value = c.dataset.amt; sync(); });
      });
      root.querySelector('[data-other]').addEventListener('click', function () {
        var o = root.querySelector('#mOther');
        o.hidden = !o.hidden;
        if (!o.hidden) root.querySelector('#mOtherInput').focus();
      });
      go.addEventListener('click', function () {
        close();
        toast('Withdrawal submitted for review', 'check-circle-2');
      });
    }, withdrawStep1);
  }

  /* ============================================================= refer == */
  /* share targets, ready to work the moment the domain is live */
  var SHARE_TEXT = 'I trade on orbisflow. Use my link and we both get a bonus:';

  function shareLinks(url) {
    var t = encodeURIComponent(SHARE_TEXT);
    var u = encodeURIComponent(url);
    return [
      ['whatsapp', 'WhatsApp', 'https://wa.me/?text=' + t + '%20' + u],
      ['x',        'X',        'https://twitter.com/intent/tweet?text=' + t + '&url=' + u],
      ['telegram', 'Telegram', 'https://t.me/share/url?url=' + u + '&text=' + t],
      ['facebook', 'Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + u]
    ];
  }

  function referModal() {
    var share = shareLinks(REF_LINK).map(function (x) {
      return '<a class="share-btn" href="' + x[2] + '" target="_blank" rel="noopener noreferrer" ' +
        'aria-label="Share on ' + x[1] + '">' +
        '<img class="brand-ic" src="https://cdn.simpleicons.org/' + x[0] + '/93928C" alt="" width="16" height="16">' +
        '</a>';
    }).join('') +
      '<a class="share-btn" href="mailto:?subject=' + encodeURIComponent('Trade with me on orbisflow') +
        '&body=' + encodeURIComponent(SHARE_TEXT + ' ' + REF_LINK) + '" aria-label="Share by email">' +
        ic('mail', 'i-sm') + '</a>';

    var html =
      '<div class="modal-bd">' +
        '<div class="copybox">' +
          '<input id="mRef" value="' + REF_LINK + '" readonly aria-label="Your referral link">' +
          '<button data-copy="#mRef" aria-label="Copy link">' + ic('copy', 'i-sm') + '</button>' +
        '</div>' +
        '<div class="share-row">' + share + '</div>' +
        '<div class="qr-wrap">' +
          '<canvas id="mQr" aria-label="QR code for your referral link" role="img"></canvas>' +
          '<span class="hint">Point a camera at this to open your link</span>' +
        '</div>' +
      '</div>' +
      '<div style="border-top:1px solid var(--line)">' +
        '<a class="link-row" href="/referrals">' +
          '<span class="lr-ic">' + ic('users') + '</span>' +
          '<span class="lr-tx"><b>Your referrals</b><span>37 signed up, 21 active</span></span>' +
          ic('chevron-right', 'i-sm') + '</a>' +
        '<a class="link-row" href="/referral-earnings">' +
          '<span class="lr-ic">' + ic('banknote') + '</span>' +
          '<span class="lr-tx"><b>Referral earnings</b><span>$1,406.80 earned, $89.90 pending</span></span>' +
          ic('chevron-right', 'i-sm') + '</a>' +
      '</div>';

    open('Refer &amp; earn', html, function (root) {
      var cv = root.querySelector('#mQr');
      if (cv && global.OrbisQR) {
        /* always dark-on-light: an inverted QR fails on most scanners, so this
           one keeps its own white field even in dark mode */
        global.OrbisQR.render(cv, REF_LINK, { size: 160, dark: '#1C1C1C', light: '#FFFFFF' });
      }
    });
  }

  /* =========================================================== account == */
  function accountModal() {
    var list = global.orbisAccounts || [];
    var active = global.orbisActiveAccount ? global.orbisActiveAccount() : 'demo';
    var html = '<div class="modal-bd stack-sm">' + list.map(function (a) {
      return '<button class="method acct-row' + (a.id === active ? ' active' : '') + '" data-acct="' + a.id + '">' +
        '<span class="method-ic">' + ic(a.icon) + '</span>' +
        '<span style="flex:1"><b>' + a.label + '</b><span class="mono">' + a.amount + '</span></span>' +
        '<img class="acct-flag" src="https://flagcdn.com/w40/us.png" alt="USD" title="US dollar">' +
        (a.id === active ? ic('check', 'i-sm') : '') + '</button>';
    }).join('') + '</div>';

    open('Switch account', html, function (root) {
      root.querySelectorAll('[data-acct]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (global.orbisSetAccount) global.orbisSetAccount(b.dataset.acct);
          close();
          toast((b.dataset.acct === 'demo' ? 'Demo' : 'Real') + ' account selected', 'check');
        });
      });
    });
  }

  /* ==================================================== add a payment === */
  var ADD_METHODS = [
    { k: 'mpesa', name: 'Mobile money', note: 'M-Pesa, Airtel Money', icon: 'smartphone',
      field: 'Phone number', placeholder: '+254 7XX XXX XXX' },
    { k: 'card',  name: 'Card',  note: 'Visa, Mastercard', icon: 'credit-card',
      field: 'Card number', placeholder: '•••• •••• •••• ••••' },
    { k: 'bank',  name: 'Bank account', note: 'Local transfer', icon: 'building-2',
      field: 'Account number', placeholder: '0100 1234 5678' },
    { k: 'usdt',  name: 'Crypto wallet', note: 'USDT, BTC, ETH', icon: 'bitcoin',
      field: 'Wallet address', placeholder: 'T…' }
  ];

  function addPaymentStep1() {
    var html = '<div class="modal-bd stack-sm">' + ADD_METHODS.map(function (m) {
      return '<button class="method" data-add="' + m.k + '">' +
        '<span class="method-ic">' + ic(m.icon) + '</span>' +
        '<span style="flex:1"><b>' + m.name + '</b><span>' + m.note + '</span></span>' +
        ic('chevron-right', 'i-sm') + '</button>';
    }).join('') + '</div>';
    open('Add a method', html, function (root) {
      root.querySelectorAll('[data-add]').forEach(function (b) {
        b.addEventListener('click', function () { addPaymentStep2(b.dataset.add); });
      });
    });
  }

  function addPaymentStep2(key) {
    var m = ADD_METHODS.filter(function (x) { return x.k === key; })[0];
    var html =
      '<div class="modal-bd">' +
        '<div class="saved" style="margin-bottom:16px">' +
          '<span class="method-ic">' + ic(m.icon) + '</span>' +
          '<span class="saved-tx"><b>' + m.name + '</b><span>' + m.note + '</span></span>' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="mField">' + m.field + '</label>' +
          '<input class="input" id="mField" placeholder="' + m.placeholder + '">' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="mName">Name on the account</label>' +
          '<input class="input" id="mName" value="Amara Otieno">' +
        '</div>' +
        '<p class="hint">The name must match your verified identity, or withdrawals are held.</p>' +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-primary btn-block btn-lg" id="mAdd">Add method</button>' +
      '</div>';
    open('Add a method', html, function (root) {
      root.querySelector('#mAdd').addEventListener('click', function () {
        close();
        toast(m.name + ' added, pending verification', 'check-circle-2');
      });
    }, addPaymentStep1);
  }

  /* ================================================= market read (AI) === */
  var MARKET_READ = [
    ['Market sentiment', 'Risk-on', '62% of open contracts are Rise', 'gauge'],
    ['Volatility', 'Elevated', 'Above the 30-day average', 'activity'],
    ['Signal accuracy', '64%', 'Across the last 200 signals', 'target'],
    ['Next event', 'US CPI', 'In 3h 20m · high impact', 'calendar-days']
  ];

  function marketReadModal() {
    var html = '<div class="modal-bd">' + MARKET_READ.map(function (r) {
      return '<div class="read-row">' +
        '<span class="lr-ic">' + ic(r[3]) + '</span>' +
        '<span class="lr-tx"><b>' + r[0] + '</b><span>' + r[2] + '</span></span>' +
        '<b class="read-val">' + r[1] + '</b></div>';
    }).join('') +
      '<p class="hint" style="margin-top:14px">Recomputed on every scan.</p>' +
      '</div>';
    open('Market read', html);
  }

  /* ====================================================== copy trading == */
  function copyModal(id) {
    var D = global.OrbisData;
    var p = D && D.providerById ? D.providerById(id) : null;
    if (!p) return;

    var html =
      '<div class="modal-bd">' +
        '<div class="saved" style="margin-bottom:16px">' +
          '<span class="avatar">' + p.initials + '</span>' +
          '<span class="saved-tx"><b>' + p.name + '</b><span>' + p.style + '</span></span>' +
          '<b class="read-val up">+' + p.ret + '%</b>' +
        '</div>' +

        '<div class="field">' +
          '<label class="label" for="cAmt">Amount to allocate</label>' +
          '<div class="stepper">' +
            '<button type="button" class="step-btn" data-cstep="-1" aria-label="Less">' + ic('minus', 'i-sm') + '</button>' +
            '<span class="stepper-val"><span class="cur">$</span>' +
              '<input id="cAmt" type="number" value="' + p.min + '" min="' + p.min + '" step="10"></span>' +
            '<button type="button" class="step-btn" data-cstep="1" aria-label="More">' + ic('plus', 'i-sm') + '</button>' +
          '</div>' +
          '<p class="hint" id="cHint">Minimum ' + money(p.min) + ' for this provider.</p>' +
        '</div>' +

        '<div class="kv"><span>Copies each trade at</span><b>Proportional to your balance</b></div>' +
        '<div class="kv"><span>Performance fee</span><b>20% of profit</b></div>' +
        '<div class="kv"><span>Stop any time</span><b>Open contracts run to expiry</b></div>' +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-primary btn-block btn-lg" id="cGo">Copy with ' + money(p.min) + '</button>' +
        '<p class="hint center" style="margin-top:10px">Past performance does not predict future results.</p>' +
      '</div>';

    open('Copy ' + p.name, html, function (root) {
      var amt = root.querySelector('#cAmt');
      var go = root.querySelector('#cGo');
      var hint = root.querySelector('#cHint');

      function sync() {
        var v = Number(amt.value) || 0;
        var ok = v >= p.min;
        go.disabled = !ok;
        go.textContent = 'Copy with ' + money(v);
        hint.textContent = ok ? 'Minimum ' + money(p.min) + ' for this provider.'
                              : 'Below the ' + money(p.min) + ' minimum.';
        hint.style.color = ok ? '' : 'var(--down)';
      }
      amt.addEventListener('input', sync);
      root.querySelectorAll('[data-cstep]').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = Number(amt.value) || 0;
          amt.value = Math.max(0, v + 10 * Number(b.dataset.cstep));
          sync();
        });
      });
      go.addEventListener('click', function () {
        close();
        toast('Copying ' + p.name + ' with ' + money(amt.value), 'check-circle-2');
      });
    });
  }

  /* ====================================================== trade ticket == */
  /* Settlement is compressed to a few seconds so the flow can be seen end to
     end; the contract's real duration is stated on the card. */
  var SETTLE_SECONDS = 6;

  function tradeModal(c) {
    var up = c.dir === 'Rise';
    var left = SETTLE_SECONDS;

    var pop = document.createElement('div');
    pop.className = 'run-pop';
    pop.innerHTML =
      '<span class="run-dot ' + (up ? 'up' : 'down') + '">' +
        ic(up ? 'arrow-up' : 'arrow-down', 'i-sm') + '</span>' +
      '<span class="run-tx"><b>' + c.dir + ' · ' + c.sym + '</b>' +
        '<span>' + money(c.stake) + ' · ' + c.duration + '</span></span>' +
      '<b class="run-clock mono">' + left + 's</b>' +
      '<i class="run-line"></i>';
    document.body.appendChild(pop);
    icons();
    requestAnimationFrame(function () { pop.classList.add('in'); });

    var line = pop.querySelector('.run-line');
    var clock = pop.querySelector('.run-clock');

    function emit(name, detail) {
      document.dispatchEvent(new CustomEvent(name, { detail: detail }));
    }

    function stop(settled) {
      clearInterval(running);
      running = null;
      window.orbisTradeStop = null;
      pop.classList.remove('in');
      setTimeout(function () { pop.remove(); }, 200);
      emit('orbis:trade-end', { contract: c, settled: settled });
      if (settled) settleModal(c);
      else toast('Sold back · ' + money(c.stake * 0.75) + ' returned', 'undo-2');
    }

    /* the ticket exposes a stop, because a running contract should be
       interruptible from where it was placed */
    window.orbisTradeStop = function () { stop(false); };

    emit('orbis:trade-start', { contract: c, total: SETTLE_SECONDS });

    running = setInterval(function () {
      left--;
      clock.textContent = Math.max(0, left) + 's';
      line.style.width = ((SETTLE_SECONDS - left) / SETTLE_SECONDS * 100) + '%';
      emit('orbis:trade-tick', { left: Math.max(0, left), total: SETTLE_SECONDS });
      if (left <= 0) stop(true);
    }, 1000);

    if (global.orbisBeep) global.orbisBeep('place');
  }

  function settleModal(c) {
    var won = Math.random() < 0.5;          /* a coin flip, like the contract */
    var profit = c.stake * (c.payout / 100);
    var delta = won ? profit : -c.stake;

    var html =
      '<div class="modal-bd center">' +
        '<div class="result ' + (won ? 'result-won' : 'result-lost') + '">' +
          ic(won ? 'check' : 'x', 'i-lg') + '</div>' +
        '<h3 style="margin-top:14px">' + (won ? 'Contract won' : 'Contract lost') + '</h3>' +
        '<p class="run-amount ' + (won ? 'up' : 'down') + ' mono">' +
          (won ? '+' : '') + money(delta) + '</p>' +
        '<div style="text-align:left;margin-top:18px">' +
          '<div class="kv"><span>Market</span><b>' + c.sym + '</b></div>' +
          '<div class="kv"><span>Direction</span><b>' + c.dir + '</b></div>' +
          '<div class="kv"><span>Stake</span><b class="mono">' + money(c.stake) + '</b></div>' +
          '<div class="kv"><span>Returned</span><b class="mono">' +
            money(won ? c.stake + profit : 0) + '</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-ft" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        '<button class="btn btn-ghost" data-close>Close</button>' +
        '<a class="btn btn-primary" href="/positions">See positions</a>' +
      '</div>';

    open(won ? 'Won' : 'Lost', html);
    if (global.orbisBeep) global.orbisBeep(won ? 'win' : 'lose');
  }

  /* ========================================================== country === */
  function countryModal(trigger) {
    var list = global.OrbisCountries || [];
    var current = trigger ? trigger.dataset.code : '';

    function rows(filter) {
      var f = (filter || '').toLowerCase();
      var out = list.filter(function (c) { return !f || c[1].toLowerCase().indexOf(f) > -1; });
      if (!out.length) return '<div class="empty"><b>No country matches that</b></div>';
      return out.map(function (c) {
        return '<button class="ctry" data-code="' + c[0] + '" data-name="' + c[1] + '">' +
          '<img src="https://flagcdn.com/w40/' + c[0] + '.png" alt="" loading="lazy">' +
          '<span>' + c[1] + '</span>' +
          (c[0] === current ? ic('check', 'i-sm') : '') + '</button>';
      }).join('');
    }

    var html =
      '<div class="modal-search">' +
        '<div class="input-wrap">' +
          '<input class="input" id="ctrySearch" type="search" placeholder="Search countries" aria-label="Search countries">' +
          '<span class="input-affix" style="pointer-events:none">' + ic('search', 'i-sm') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="ctry-list" id="ctryList">' + rows('') + '</div>';

    open('Country', html, function (root) {
      var box = root.querySelector('#ctryList');
      root.querySelector('#ctrySearch').addEventListener('input', function (e) {
        box.innerHTML = rows(e.target.value);
        icons();
      });
      box.addEventListener('click', function (e) {
        var b = e.target.closest('.ctry');
        if (!b || !trigger) return;
        trigger.dataset.code = b.dataset.code;
        trigger.querySelector('.ctry-flag').src = 'https://flagcdn.com/w40/' + b.dataset.code + '.png';
        trigger.querySelector('.ctry-name').textContent = b.dataset.name;
        close();
      });
      icons();
    });
  }

  /* ==================================================== auto session === */
  /* The auto panel scrolls out of sight once you leave the ticket, so the
     session reports itself from the top of the screen instead. */
  var autoPop;

  function autoStart(onStop) {
    if (autoPop) autoPop.remove();
    autoPop = document.createElement('div');
    autoPop.className = 'run-pop';
    autoPop.innerHTML =
      '<span class="run-dot up">' + ic('bot', 'i-sm') + '</span>' +
      '<span class="run-tx"><b>Auto trading</b><span id="autoTx">Starting</span></span>' +
      '<button class="run-stop" id="autoStop" aria-label="Stop auto trading">' + ic('square', 'i-sm') + '</button>';
    document.body.appendChild(autoPop);
    icons();
    requestAnimationFrame(function () { autoPop.classList.add('in'); });
    autoPop.querySelector('#autoStop').addEventListener('click', function () {
      if (onStop) onStop();
    });
  }

  function autoUpdate(text, up) {
    if (!autoPop) return;
    var el = autoPop.querySelector('#autoTx');
    el.textContent = text;
    el.className = up === undefined ? '' : (up ? 'up' : 'down');
  }

  function autoStop() {
    if (!autoPop) return;
    var el = autoPop;
    autoPop = null;
    el.classList.remove('in');
    setTimeout(function () { el.remove(); }, 200);
  }

  global.orbisAuto = { start: autoStart, update: autoUpdate, stop: autoStop };

  /* =========================================================== triggers = */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-modal]');
    if (!t) return;
    e.preventDefault();
    var kind = t.dataset.modal;
    if (kind === 'deposit') depositStep1();
    else if (kind === 'withdraw') withdrawStep1();
    else if (kind === 'refer') referModal();
    else if (kind === 'account') accountModal();
    else if (kind === 'add-payment') addPaymentStep1();
    else if (kind === 'market-read') marketReadModal();
    else if (kind === 'country') countryModal(t);
    else if (kind === 'copy') copyModal(t.dataset.provider);
  });

  global.orbisModal = { open: open, close: close, deposit: depositStep1,
                      withdraw: withdrawStep1, refer: referModal, account: accountModal,
                      addPayment: addPaymentStep1, marketRead: marketReadModal, copy: copyModal,
                      trade: tradeModal, country: countryModal };
})(window);
