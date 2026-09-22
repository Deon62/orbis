/* ==========================================================================
   orbisflow — modals
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

  /* saved details — would come from the account service */
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

  function close() {
    if (!scrim) return;
    scrim.hidden = true;
    document.documentElement.style.overflow = '';
  }

  /* =========================================================== deposit == */
  var DEPOSIT_METHODS = [
    { k: 'mpesa', name: 'M-Pesa',        note: 'Instant · no fee',           tag: 'Instant' },
    { k: 'card',  name: 'Card',          note: 'Visa / Mastercard · 1.5%',   tag: 'Instant' },
    { k: 'bank',  name: 'Bank transfer', note: '1 – 2 business days',        tag: '1–2 days' },
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
    { k: 'bank',  name: 'Bank transfer', note: '1 – 3 business days' },
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
  function referModal() {
    var html =
      '<div class="modal-bd">' +
        '<div class="copybox">' +
          '<input id="mRef" value="' + REF_LINK + '" readonly aria-label="Your referral link">' +
          '<button data-copy="#mRef" aria-label="Copy link">' + ic('copy', 'i-sm') + '</button>' +
        '</div>' +
        '<div class="share-row">' +
          '<button class="share-btn" data-mock="Share to WhatsApp" aria-label="WhatsApp"><img class="brand-ic" src="https://cdn.simpleicons.org/whatsapp/93928C" alt="" width="16" height="16"></button>' +
          '<button class="share-btn" data-mock="Share to X" aria-label="X"><img class="brand-ic" src="https://cdn.simpleicons.org/x/93928C" alt="" width="16" height="16"></button>' +
          '<button class="share-btn" data-mock="Share to Telegram" aria-label="Telegram"><img class="brand-ic" src="https://cdn.simpleicons.org/telegram/93928C" alt="" width="16" height="16"></button>' +
          '<button class="share-btn" data-mock="Share by email" aria-label="Email">' + ic('mail', 'i-sm') + '</button>' +
          '<button class="share-btn" data-mock="QR code" aria-label="QR code">' + ic('qr-code', 'i-sm') + '</button>' +
        '</div>' +
      '</div>' +
      '<div style="border-top:1px solid var(--line)">' +
        '<a class="link-row" href="/referrals">' +
          '<span class="lr-ic">' + ic('users') + '</span>' +
          '<span class="lr-tx"><b>Your referrals</b><span>37 signed up · 21 active</span></span>' +
          ic('chevron-right', 'i-sm') + '</a>' +
        '<a class="link-row" href="/referral-earnings">' +
          '<span class="lr-ic">' + ic('banknote') + '</span>' +
          '<span class="lr-tx"><b>Referral earnings</b><span>$1,406.80 earned · $89.90 pending</span></span>' +
          ic('chevron-right', 'i-sm') + '</a>' +
      '</div>';
    open('Refer &amp; earn', html);
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
  });

  global.orbisModal = { open: open, close: close, deposit: depositStep1,
                      withdraw: withdrawStep1, refer: referModal, account: accountModal };
})(window);
