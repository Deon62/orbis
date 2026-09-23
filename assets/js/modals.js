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
    n = Number(n);
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function toast(m, i) { if (global.orbisToast) global.orbisToast(m, i); }

  /* saved details, would come from the account service */
  /* the live USDT deposit address, TRON network */
  var USDT_ADDRESS = 'TXqLJrvZc9ouyVPai66WR55dvDVetR83BH';
  var CARD_FEE = 0.015;          /* what the card processor takes */

  var SAVED = {
    mpesa: { label: 'M-Pesa', masked: 'Your verified M-Pesa number', icon: 'smartphone' },
    card:  { label: 'Paystack', masked: 'Visa, Mastercard, Verve', icon: 'credit-card' },
    bank:  { label: 'Bank transfer', masked: 'Your verified bank account', icon: 'building-2' },
    usdt:  { label: 'USDT (TRC-20)', masked: 'Your verified TRON wallet', icon: 'bitcoin' }
  };

  var WITHDRAW_FEE = 1;          /* flat platform fee, charged on top of the amount */
  var MIN_DEPOSIT = 2;
  var MIN_WITHDRAW = 5;          /* what arrives, before the fee is added */

  /* M-Pesa moves shillings, so every M-Pesa amount is shown in KSh too.
     The fallback is indicative; /rates replaces it once the API is set. */
  var USD_KES = 129.5;
  if (global.OrbisAPI) {
    global.OrbisAPI.get('/rates').then(function (r) {
      if (!r) return;
      /* the backend owns the rules; these only mirror them for display */
      if (r.USD_KES) USD_KES = Number(r.USD_KES);
      if (r.minDepositUsd) MIN_DEPOSIT = Number(r.minDepositUsd);
      if (r.minWithdrawUsd) MIN_WITHDRAW = Number(r.minWithdrawUsd);
      if (r.withdrawFeeUsd != null) WITHDRAW_FEE = Number(r.withdrawFeeUsd);
      if (r.cardFeePct != null) CARD_FEE = Number(r.cardFeePct) / 100;
    })
      .catch(function () {});
  }
  function kes(usd) { return 'KSh ' + Math.round(usd * USD_KES).toLocaleString('en-US'); }

  /* the real account's balance, from the account card in the header */
  function realBalance() {
    var a = (global.orbisAccounts || []).filter(function (x) { return x.id === 'real'; })[0];
    return a ? Number(String(a.amount).replace(/[^0-9.]/g, '')) || 0 : 0;
  }
  var REF_LINK = 'https://orbisflow.com/r/ORBIS-4K92';

  /* with the API connected, deposits, withdrawals, methods and the referral
     link are real; offline, the flows below keep their local simulation */
  var API = global.OrbisAPI;
  function live() { return !!(API && API.connected && API.signedIn()); }
  function refLink() {
    var s = live() && API.session();
    return (s && s.profile && s.profile.referralLink) || REF_LINK;
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function afterMoney() { if (global.orbisRefreshAccount) global.orbisRefreshAccount(); }

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
    { k: 'card',  name: 'Card',          note: 'Visa, Mastercard · via Paystack', tag: 'Instant' },
    { k: 'bank',  name: 'Bank transfer', note: '1-2 business days',        tag: '1-2 days' },
    { k: 'usdt',  name: 'USDT (TRC-20)', note: 'TRON network',               tag: '~10 min' }
  ];

  function depositStep1() {
    /* bank transfers have no automatic crediting yet, so they are hidden when live */
    var list = DEPOSIT_METHODS.filter(function (m) { return !(live() && m.k === 'bank'); });
    var html = '<div class="modal-bd stack-sm">' + list.map(function (m) {
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

  /* USDT is a deposit address, not a form: we show where to send and watch
     for it. Cards never touch this site, Paystack takes them on its own page. */
  function depositCrypto() {
    if (live()) return liveUsdtDeposit();
    var html =
      '<div class="modal-bd">' +
        '<div class="saved">' +
          '<span class="method-ic">' + ic('bitcoin') + '</span>' +
          '<span class="saved-tx"><b>USDT</b><span>TRON network, TRC-20</span></span>' +
          '<span class="tag">~10 min</span>' +
        '</div>' +

        '<p class="hint" style="margin:13px 0 6px">Send to this address</p>' +
        /* an address has to be readable whole, so it wraps rather than scrolls
           out of a one-line input */
        '<div class="addr">' +
          '<code id="mAddr">' + USDT_ADDRESS + '</code>' +
          '<button data-copy="#mAddr">' + ic('copy', 'i-sm') + 'Copy address</button>' +
        '</div>' +

        '<div class="qr-wrap">' +
          '<canvas id="mQr" aria-label="QR code of the USDT deposit address" role="img"></canvas>' +
          '<span class="hint">Scan this from your wallet</span>' +
        '</div>' +

        '<div class="note-warn">' + ic('triangle-alert', 'i-sm') +
          '<span>USDT on TRON (TRC-20) only. Another network or another coin ' +
          'cannot be recovered.</span></div>' +

        '<p class="hint center" style="margin-top:12px">' +
          'Minimum ' + money(MIN_DEPOSIT) + ' · credited after 1 network confirmation</p>' +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-primary btn-block btn-lg" id="mGo">I have sent it</button>' +
      '</div>';

    open('Deposit USDT', html, function (root) {
      var cv = root.querySelector('#mQr');
      if (cv && global.OrbisQR) {
        /* dark-on-light whatever the theme, an inverted QR fails most wallets */
        var small = Math.min(innerHeight, innerWidth) < 820;
        global.OrbisQR.render(cv, USDT_ADDRESS,
          { size: small ? 118 : 148, dark: '#1C1C1C', light: '#FFFFFF' });
      }
      root.querySelector('#mGo').addEventListener('click', function () {
        close();
        toast('Watching the network for your deposit', 'radar');
      });
    }, depositStep1);
  }

  function depositStep2(key) {
    if (key === 'usdt') return depositCrypto();
    if (live() && key === 'mpesa') return liveMpesaDeposit();
    if (live() && key === 'card') return liveCardDeposit();

    var s = SAVED[key];
    var card = key === 'card';
    var mpesa = key === 'mpesa';
    var cta = function (v) {
      if (v < MIN_DEPOSIT) return 'Minimum deposit is ' + money(MIN_DEPOSIT);
      return card ? 'Continue to Paystack · ' + money(v)
           : mpesa ? 'Send STK push · ' + kes(v)
           : 'Deposit ' + money(v);
    };

    var html =
      '<div class="modal-bd">' +
        '<div class="saved">' +
          '<span class="method-ic">' + ic(s.icon) + '</span>' +
          '<span class="saved-tx"><b>' + s.label + '</b><span id="mDest">' + s.masked + '</span></span>' +
          (card ? '' : '<button class="linkish" data-other>Use another</button>') +
        '</div>' +
        (card ? '' :
          '<div id="mOther" hidden style="margin-top:10px">' +
            '<input class="input" id="mOtherInput" placeholder="' +
              (mpesa ? '+254 7XX XXX XXX' : 'Account number') + '">' +
          '</div>') +

        '<div class="field" style="margin:16px 0 10px">' +
          '<label class="label" for="mAmt">Amount</label>' +
          '<div class="input-wrap"><span class="input-prefix">$</span>' +
            '<input class="input" id="mAmt" type="number" value="100" min="' + MIN_DEPOSIT + '" step="any" inputmode="decimal"></div>' +
          '<p class="hint" id="mMin" style="margin-top:6px">Minimum ' + money(MIN_DEPOSIT) + '</p>' +
          '<div class="stake-row">' +
            [20, 100, 250, 500].map(function (v) {
              return '<button class="chip' + (v === 100 ? ' active' : '') + '" data-amt="' + v + '">' + v + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +

        '<div class="kv"><span>' + (card ? 'Processor fee · 1.5%' : 'Fee') + '</span>' +
          '<b class="mono" id="mFee">' + money(card ? 100 * CARD_FEE : 0) + '</b></div>' +
        (mpesa ? '<div class="kv"><span>You pay by M-Pesa</span><b class="mono" id="mKes">' + kes(100) + '</b></div>' : '') +
        '<div class="kv"><span>Credited</span><b class="mono" id="mNet">' +
          money(card ? 100 * (1 - CARD_FEE) : 100) + '</b></div>' +
        (mpesa ? '<p class="hint" style="margin-top:8px">At KSh <span id="mRate">' + USD_KES.toFixed(2) + '</span> to $1. ' +
          'The rate is fixed when you approve the prompt.</p>' : '') +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-primary btn-block btn-lg" id="mGo">' + cta(100) + '</button>' +
        (mpesa ? '<p class="hint center" style="margin-top:10px">Approve the prompt on your phone.</p>' : '') +
        (card ? '<p class="hint center" style="margin-top:10px">' +
                  'Paystack takes the card details on its own secure page. ' +
                  'They never reach orbisflow.</p>' : '') +
      '</div>';

    open('Deposit', html, function (root) {
      var amt = root.querySelector('#mAmt');
      var go = root.querySelector('#mGo');

      function sync() {
        var v = Number(amt.value) || 0;
        var fee = card ? v * CARD_FEE : 0;
        var low = v < MIN_DEPOSIT;
        root.querySelector('#mFee').textContent = money(fee);
        root.querySelector('#mNet').textContent = money(Math.max(0, v - fee));
        if (mpesa) {
          root.querySelector('#mKes').textContent = kes(v);
          root.querySelector('#mRate').textContent = USD_KES.toFixed(2);
        }
        root.querySelector('#mMin').classList.toggle('hint-err', low && amt.value !== '');
        go.disabled = low;
        go.textContent = cta(v);
        root.querySelectorAll('[data-amt]').forEach(function (c) {
          c.classList.toggle('active', Number(c.dataset.amt) === v);
        });
      }
      amt.addEventListener('input', sync);
      root.querySelectorAll('[data-amt]').forEach(function (c) {
        c.addEventListener('click', function () { amt.value = c.dataset.amt; sync(); });
      });

      if (!card) {
        root.querySelector('[data-other]').addEventListener('click', function () {
          var o = root.querySelector('#mOther');
          o.hidden = !o.hidden;
          if (!o.hidden) root.querySelector('#mOtherInput').focus();
        });
      }

      go.addEventListener('click', function () {
        var dest = card ? '' :
          (root.querySelector('#mOther').hidden
            ? root.querySelector('#mDest').textContent
            : (root.querySelector('#mOtherInput').value || s.masked));
        close();
        /* leaving for the processor is a wait with nothing on screen, so it
           gets the loader rather than a toast that outlives the page */
        if (card && global.orbisVeil) global.orbisVeil('Opening Paystack checkout');
        else toast(mpesa ? 'STK push for ' + kes(Number(amt.value)) + ' sent to ' + dest : 'Deposit started', 'check-circle-2');
      });
      sync();
    }, depositStep1);
  }

  /* ========================================================== withdraw == */
  var WITHDRAW_METHODS = [
    { k: 'mpesa', name: 'M-Pesa',        note: 'Same day' },
    { k: 'bank',  name: 'Bank transfer', note: '1-3 business days' },
    { k: 'usdt',  name: 'USDT (TRC-20)', note: '~10 minutes' }
  ];

  function withdrawStep1() {
    if (live()) return liveWithdrawPick();
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

  function withdrawStep2(key, method) {
    /* method: a saved method from the API; without one, the simulated flow */
    var s = method ? { icon: SAVED[method.kind] ? SAVED[method.kind].icon : 'wallet', label: method.label, masked: method.masked }
                   : SAVED[key];
    var mpesa = key === 'mpesa';
    var AVAILABLE = realBalance();
    /* the fee comes on top, so the most you can take out is the balance less the fee */
    var MAX = Math.max(0, Math.floor((AVAILABLE - WITHDRAW_FEE) * 100) / 100);
    var start = MAX >= MIN_WITHDRAW ? Math.min(MAX, 50) : MIN_WITHDRAW;

    var html =
      '<div class="modal-bd">' +
        '<div class="saved">' +
          '<span class="method-ic">' + ic(s.icon) + '</span>' +
          '<span class="saved-tx"><b>' + s.label + '</b><span id="mDest">' + s.masked + '</span></span>' +
          (method ? '' : '<button class="linkish" data-other>Use another</button>') +
        '</div>' +
        (method ? '' :
        '<div id="mOther" hidden style="margin-top:10px">' +
          '<input class="input" id="mOtherInput" placeholder="' + (mpesa ? '+254 7XX XXX XXX' : 'Account or wallet') + '">' +
        '</div>') +

        '<div class="field" style="margin:16px 0 10px">' +
          '<label class="label" for="mAmt">Amount to receive</label>' +
          '<div class="input-wrap"><span class="input-prefix">$</span>' +
            '<input class="input" id="mAmt" type="number" value="' + start + '" min="' + MIN_WITHDRAW + '" step="any" inputmode="decimal"></div>' +
          '<p class="hint" id="mMin" style="margin-top:6px">Minimum ' + money(MIN_WITHDRAW) + ', plus the ' + money(WITHDRAW_FEE) + ' fee</p>' +
          '<div class="stake-row">' +
            [5, 20, 50].map(function (v) {
              return '<button class="chip" data-amt="' + v + '">' + v + '</button>';
            }).join('') +
            '<button class="chip" data-amt="' + MAX + '">All</button>' +
          '</div>' +
        '</div>' +

        '<div class="kv"><span>Available</span><b class="mono">' + money(AVAILABLE) + '</b></div>' +
        '<div class="kv"><span>You receive</span><b class="mono" id="mNet"></b></div>' +
        (mpesa ? '<div class="kv"><span>To your M-Pesa</span><b class="mono" id="mKes"></b></div>' : '') +
        '<div class="kv"><span>Platform fee</span><b class="mono">' + money(WITHDRAW_FEE) + '</b></div>' +
        '<div class="kv"><span>Taken from your balance</span><b class="mono" id="mTotal"></b></div>' +
        (mpesa ? '<p class="hint" style="margin-top:8px">At KSh <span id="mRate">' + USD_KES.toFixed(2) + '</span> to $1. ' +
          'The rate is fixed when the withdrawal is approved.</p>' : '') +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-dark btn-block btn-lg" id="mGo"></button>' +
      '</div>';

    open('Withdraw', html, function (root) {
      var amt = root.querySelector('#mAmt');
      var go = root.querySelector('#mGo');
      function sync() {
        var v = Number(amt.value) || 0;
        var total = v + WITHDRAW_FEE;
        var low = v < MIN_WITHDRAW;
        var over = total > AVAILABLE;
        root.querySelector('#mNet').textContent = money(v);
        root.querySelector('#mTotal').textContent = money(total);
        if (mpesa) {
          root.querySelector('#mKes').textContent = kes(v);
          root.querySelector('#mRate').textContent = USD_KES.toFixed(2);
        }
        root.querySelector('#mMin').classList.toggle('hint-err', low && amt.value !== '');
        root.querySelectorAll('[data-amt]').forEach(function (c) {
          c.classList.toggle('active', Number(c.dataset.amt) === v);
        });
        go.disabled = low || over;
        go.textContent = low ? 'Minimum withdrawal is ' + money(MIN_WITHDRAW)
          : over ? (AVAILABLE < MIN_WITHDRAW + WITHDRAW_FEE
              ? 'You need ' + money(MIN_WITHDRAW + WITHDRAW_FEE) + ' to withdraw'
              : 'Not enough balance, the most is ' + money(MAX))
          : 'Withdraw ' + (mpesa ? kes(v) : money(v));
      }
      amt.addEventListener('input', sync);
      root.querySelectorAll('[data-amt]').forEach(function (c) {
        c.addEventListener('click', function () { amt.value = c.dataset.amt; sync(); });
      });
      var other = root.querySelector('[data-other]');
      if (other) other.addEventListener('click', function () {
        var o = root.querySelector('#mOther');
        o.hidden = !o.hidden;
        if (!o.hidden) root.querySelector('#mOtherInput').focus();
      });
      go.addEventListener('click', function () {
        var v = Number(amt.value) || 0;
        if (!method) {
          close();
          toast('Withdrawal of ' + (mpesa ? kes(v) : money(v)) + ' submitted for review', 'check-circle-2');
          return;
        }
        go.disabled = true;
        go.innerHTML = '<span class="btn-spin"></span>Requesting';
        API.post('/payments/withdraw', { amount_usd: v, payment_method_id: method.id }).then(function (tx) {
          afterMoney();
          /* every withdrawal is paid by the team, so every one ends here */
          resultScreen('Withdraw', true, 'Withdrawal requested',
            (tx.localAmount ? 'KSh ' + Number(tx.localAmount).toLocaleString('en-US') : money(v)) + ' to ' +
            esc(method.masked) + '. Our team pays it, usually the same day and always within a working day.',
            [['Amount', money(tx.amountUsd)], ['Fee', money(tx.feeUsd)], ['Taken from your balance', money(tx.netUsd)],
             ['Reference', tx.reference]]);
        }).catch(function (err) {
          go.disabled = false;
          sync();
          toast(err.message, 'triangle-alert');
        });
      });
      sync();
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
    var link = refLink();
    var share = shareLinks(link).map(function (x) {
      return '<a class="share-btn" href="' + x[2] + '" target="_blank" rel="noopener noreferrer" ' +
        'aria-label="Share on ' + x[1] + '">' +
        '<img class="brand-ic" src="https://cdn.simpleicons.org/' + x[0] + '/93928C" alt="" width="16" height="16">' +
        '</a>';
    }).join('') +
      '<a class="share-btn" href="mailto:?subject=' + encodeURIComponent('Trade with me on orbisflow') +
        '&body=' + encodeURIComponent(SHARE_TEXT + ' ' + link) + '" aria-label="Share by email">' +
        ic('mail', 'i-sm') + '</a>';

    var html =
      '<div class="modal-bd">' +
        '<div class="copybox">' +
          '<input id="mRef" value="' + link + '" readonly aria-label="Your referral link">' +
          '<button data-copy="#mRef" aria-label="Copy link">' + ic('copy', 'i-sm') + '</button>' +
        '</div>' +
        '<div class="share-row">' + share + '</div>' +
        '<div class="qr-wrap">' +
          '<canvas id="mQr" aria-label="QR code for your referral link" role="img"></canvas>' +
          '<span class="hint">Point a camera at this to open your link</span>' +
        '</div>' +
        '<a class="ref-how" href="/referral-how">How it works' + ic('arrow-right', 'i-sm') + '</a>' +
      '</div>' +
      '<div style="border-top:1px solid var(--line)">' +
        '<a class="link-row" href="/referrals">' +
          '<span class="lr-ic">' + ic('users') + '</span>' +
          '<span class="lr-tx"><b>Your referrals</b><span>Everyone who joined with your link</span></span>' +
          ic('chevron-right', 'i-sm') + '</a>' +
        '<a class="link-row" href="/referral-earnings">' +
          '<span class="lr-ic">' + ic('banknote') + '</span>' +
          '<span class="lr-tx"><b>Referral earnings</b><span>What you have earned, and when it pays</span></span>' +
          ic('chevron-right', 'i-sm') + '</a>' +
      '</div>';

    open('Refer &amp; earn', html, function (root) {
      var cv = root.querySelector('#mQr');
      if (cv && global.OrbisQR) {
        /* always dark-on-light: an inverted QR fails on most scanners, so this
           one keeps its own white field even in dark mode */
        global.OrbisQR.render(cv, link, { size: 160, dark: '#1C1C1C', light: '#FFFFFF' });
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
    { k: 'card',  name: 'Card',  note: 'Visa, Mastercard, Verve', icon: 'credit-card',
      hosted: true },
    { k: 'bank',  name: 'Bank account', note: 'Local transfer', icon: 'building-2',
      field: 'Account number', placeholder: '0100 1234 5678', bank: true },
    { k: 'usdt',  name: 'Crypto wallet', note: 'USDT on TRON (TRC-20)', icon: 'bitcoin',
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
        (m.hosted
          ? '<p class="hint" style="margin:0">A card is saved by paying with it. Paystack ' +
              'takes the details on its own secure page and hands back a token, so the ' +
              'number never reaches orbisflow.</p>'
          : (m.bank ? '<div class="field">' +
              '<label class="label" for="mBank">Bank</label>' +
              '<input class="input" id="mBank" placeholder="e.g. Equity Bank">' +
            '</div>' : '') +
            '<div class="field">' +
              '<label class="label" for="mField">' + m.field + '</label>' +
              '<input class="input" id="mField" placeholder="' + m.placeholder + '">' +
            '</div>' +
            '<div class="field">' +
              '<label class="label" for="mName">Name on the account</label>' +
              '<input class="input" id="mName" placeholder="As it appears on your ID" autocomplete="name">' +
            '</div>' +
            '<p class="hint">The name must match your verified identity, or withdrawals are held.</p>') +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-primary btn-block btn-lg" id="mAdd">' +
          (m.hosted ? (live() ? 'Make a card deposit' : 'Continue to Paystack') : 'Add method') + '</button>' +
      '</div>';
    open('Add a method', html, function (root) {
      var add = root.querySelector('#mAdd');
      add.addEventListener('click', function () {
        if (!live()) {
          close();
          if (m.hosted) toast('Opening Paystack checkout', 'external-link');
          else toast(m.name + ' added, pending verification', 'check-circle-2');
          return;
        }
        /* a card is saved by paying with it, so adding one is a card deposit */
        if (m.hosted) return liveCardDeposit();
        var value = root.querySelector('#mField').value.trim();
        var body = { kind: m.k, name: root.querySelector('#mName').value.trim() || null };
        if (m.k === 'mpesa') body.phone = value;
        if (m.k === 'bank') { body.account_number = value; body.bank_name = root.querySelector('#mBank').value.trim(); }
        if (m.k === 'usdt') body.address = value;
        add.disabled = true;
        API.post('/payment-methods', body).then(function (pm) {
          close();
          document.dispatchEvent(new CustomEvent('orbis:methods', { detail: pm }));
          toast(pm.status === 'verified' ? pm.label + ' added' :
                m.k === 'mpesa' ? 'M-Pesa added. Your first deposit from it verifies it.'
                                : pm.label + ' added. We verify it within a working day.', 'check-circle-2');
        }).catch(function (err) { add.disabled = false; toast(err.message, 'triangle-alert'); });
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
    /* the copy-trading page hands over the traders it loaded */
    var p = (global.orbisProviders || []).filter(function (x) { return x.id === id; })[0] || null;
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
      var T = global.OrbisTrading;
      if (!T || !c.trade) {                              /* no ledger: the old simulation */
        if (settled) settleModal(c);
        else toast('Sold back · ' + money(c.stake * 0.75) + ' returned', 'undo-2');
        return;
      }
      /* the money moves here: settled against the price on the chart now,
         or sold back for 75% of the stake */
      if (settled) {
        T.settle(c.trade).then(function (res) { settleModal(c, res); })
          .catch(function (err) { toast(err.message, 'triangle-alert'); });
      } else {
        T.sell(c.trade).then(function (r) { toast('Sold back · ' + money(r.returned) + ' returned', 'undo-2'); })
          .catch(function (err) { toast(err.message, 'triangle-alert'); });
      }
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

  function settleModal(c, res) {
    /* res is the settled trade from the ledger; without one, the old coin flip */
    var won = res ? res.won : Math.random() < 0.5;
    var profit = c.stake * (c.payout / 100);
    var delta = res ? res.profit : (won ? profit : -c.stake);
    var back = res ? res.returned : (won ? c.stake + profit : 0);

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
          (res ? '<div class="kv"><span>Entry → exit</span><b class="mono">' + res.entry + ' → ' + res.exit + '</b></div>' : '') +
          '<div class="kv"><span>Returned</span><b class="mono">' + money(back) + '</b></div>' +
          (res ? '<div class="kv"><span>Balance</span><b class="mono">' + money(res.balance) + '</b></div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="modal-ft" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        '<button class="btn btn-ghost" data-close>Close</button>' +
        '<a class="btn btn-primary" href="/positions">See positions</a>' +
      '</div>';

    open(won ? 'Won' : 'Lost', html);
    if (global.orbisBeep) global.orbisBeep(won ? 'win' : 'lose');
  }

  /* an auto session ends the way a manual contract does: one result, the
     session's numbers under it */
  function autoResultModal(r) {
    var up = r.pnl >= 0;
    var mins = Math.floor(r.secs / 60), secs = r.secs % 60;
    var reason = { 'target profit reached': 'Target profit reached',
                   'stop loss reached': 'Stop loss reached',
                   'by you': 'Stopped by you',
                   'not enough balance for the next stake': 'Not enough balance for the next stake' }[r.why] || r.why;

    var html =
      '<div class="modal-bd center">' +
        '<div class="result ' + (up ? 'result-won' : 'result-lost') + '">' +
          ic(up ? 'trending-up' : 'trending-down', 'i-lg') + '</div>' +
        '<h3 style="margin-top:14px">' + (up ? 'Session in profit' : 'Session at a loss') + '</h3>' +
        '<p class="run-amount ' + (up ? 'up' : 'down') + ' mono">' + (up ? '+' : '') + money(r.pnl) + '</p>' +
        '<p class="hint">' + reason + ' · ' + (mins ? mins + 'm ' : '') + secs + 's</p>' +
        '<div class="auto-sum">' +
          '<div><b class="mono">' + r.trades + '</b><span>Trades</span></div>' +
          '<div><b class="mono up">' + r.wins + '</b><span>Won</span></div>' +
          '<div><b class="mono down">' + (r.trades - r.wins) + '</b><span>Lost</span></div>' +
        '</div>' +
        '<div style="text-align:left;margin-top:14px">' +
          '<div class="kv"><span>Market</span><b>' + r.market + '</b></div>' +
          '<div class="kv"><span>Starting stake</span><b class="mono">' + money(r.stake) + '</b></div>' +
          '<div class="kv"><span>Total staked</span><b class="mono">' + money(r.staked) + '</b></div>' +
          '<div class="kv"><span>Win rate</span><b class="mono">' + Math.round(r.wins / r.trades * 100) + '%</b></div>' +
          '<div class="kv"><span>Best trade</span><b class="mono up">' + (r.best > 0 ? '+' + money(r.best) : money(0)) + '</b></div>' +
          '<div class="kv"><span>Worst trade</span><b class="mono down">' + money(r.worst) + '</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-ft" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        '<button class="btn btn-ghost" data-close>Close</button>' +
        '<a class="btn btn-primary" href="/positions">See positions</a>' +
      '</div>';

    open('Auto trading ended', html);
    if (global.orbisBeep) global.orbisBeep(up ? 'win' : 'lose');
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

  /* ==================================================== academy enrol == */
  /* The Academy is not the trading platform. Enrolling never touches an
     orbisflow account: we take an email, take a payment, and send a login for
     the learning dashboard. Three steps, then a receipt. */
  var COURSES = {
    foundations:  { name: 'Foundations',  price: 19,  level: 'Beginner' },
    practitioner: { name: 'Practitioner', price: 59,  level: 'Intermediate' },
    professional: { name: 'Professional', price: 149, level: 'Complete' }
  };

  var PAY_METHODS = [
    { k: 'mpesa', name: 'M-Pesa',        note: 'STK push to your phone',   icon: 'smartphone' },
    { k: 'card',  name: 'Card',          note: 'Visa, Mastercard, Verve \u00b7 via Paystack', icon: 'credit-card' },
    { k: 'usdt',  name: 'USDT (TRC-20)', note: 'TRON network',             icon: 'bitcoin' }
  ];

  function courseOf(key) { return COURSES[key] || COURSES.foundations; }

  function summaryRow(c) {
    return '<div class="enrol-sum"><b>' + c.name + '<span class="dim" ' +
      'style="font-weight:400"> \u00b7 ' + c.level + '</span></b>' +
      '<span class="mono">' + money(c.price) + '</span></div>';
  }

  /* step one, what enrolling actually gets you */
  function enrolInfo(key) {
    var c = courseOf(key);
    var rows = [
      ['graduation-cap', 'A separate learning dashboard',
       'The Academy runs on its own site. You do not need an orbisflow trading account, and enrolling does not open one.'],
      ['mail', 'Your login arrives by email',
       'A username and password for the dashboard, sent to the address you give on the next step, within a minute of payment.'],
      ['infinity', 'Yours to keep',
       'Lessons stay open once you are enrolled, on a phone or a laptop, with no time limit.']
    ];

    var html =
      '<div class="modal-bd">' +
        summaryRow(c) +
        '<div style="margin-top:10px">' +
          rows.map(function (r) {
            return '<div class="enrol-row">' +
              '<span class="enrol-ic">' + ic(r[0], 'i-sm') + '</span>' +
              '<span class="enrol-tx"><b>' + r[1] + '</b><span>' + r[2] + '</span></span>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-primary btn-block btn-lg" id="mGo">Proceed to enrol</button>' +
      '</div>';

    open('Enrol in ' + c.name, html, function (root) {
      root.querySelector('#mGo').addEventListener('click', function () { enrolEmail(key); });
    });
  }

  /* step two, the address the login goes to */
  function enrolEmail(key) {
    var c = courseOf(key);
    var html =
      '<div class="modal-bd">' +
        summaryRow(c) +
        '<div class="field" style="margin:18px 0 0">' +
          '<label class="label" for="mEmail">Email address</label>' +
          '<input class="input" id="mEmail" type="email" inputmode="email" ' +
            'autocomplete="email" placeholder="you@example.com">' +
          '<p class="hint">Your dashboard login goes here, so check it reads correctly. ' +
            'We do not use it for anything else.</p>' +
        '</div>' +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-primary btn-block btn-lg" id="mGo" disabled>Continue to payment</button>' +
      '</div>';

    open('Enrol in ' + c.name, html, function (root) {
      var input = root.querySelector('#mEmail');
      var go = root.querySelector('#mGo');

      function sync() {
        var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
        go.disabled = !ok;
        go.textContent = ok ? 'Continue to payment \u00b7 ' + money(c.price) : 'Continue to payment';
      }
      input.addEventListener('input', sync);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !go.disabled) go.click();
      });
      go.addEventListener('click', function () { enrolPay(key, input.value.trim()); });
      sync();
    }, function () { enrolInfo(key); });
  }

  /* step three, how they want to pay for it */
  function enrolPay(key, email) {
    var c = courseOf(key);
    var picked = '';

    var html =
      '<div class="modal-bd">' +
        summaryRow(c) +
        '<p class="hint" style="margin:12px 0 10px">Login details go to <b>' + email + '</b></p>' +
        '<div class="stack-sm">' +
          PAY_METHODS.map(function (m) {
            return '<button class="method" data-pay="' + m.k + '">' +
              '<span class="method-ic">' + ic(m.icon, 'i-sm') + '</span>' +
              '<span style="flex:1;text-align:left"><b>' + m.name + '</b>' +
              '<span>' + m.note + '</span></span>' +
              '<i class="pick-dot"></i></button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-primary btn-block btn-lg" id="mGo" disabled>Pay ' + money(c.price) + '</button>' +
      '</div>';

    open('Payment', html, function (root) {
      var go = root.querySelector('#mGo');
      root.querySelectorAll('[data-pay]').forEach(function (b) {
        b.addEventListener('click', function () {
          root.querySelectorAll('[data-pay]').forEach(function (o) { o.classList.remove('active'); });
          b.classList.add('active');
          picked = b.dataset.pay;
          go.disabled = false;
        });
      });

      go.addEventListener('click', function () {
        if (picked === 'usdt') return enrolCrypto(key, email);
        if (picked === 'card') {
          close();
          if (global.orbisVeil) global.orbisVeil('Opening Paystack checkout');
          else toast('Opening Paystack checkout', 'external-link');
          return;
        }
        enrolDone(key, email, 'An STK push is on its way to your phone. ');
      });
    }, function () { enrolEmail(key); });
  }

  /* paying in USDT is the deposit address again, at a course price */
  function enrolCrypto(key, email) {
    var c = courseOf(key);
    var html =
      '<div class="modal-bd">' +
        '<div class="enrol-sum"><b>Send ' + money(c.price) + ' in USDT</b>' +
          '<span class="tag">TRC-20</span></div>' +
        '<p class="hint" style="margin:13px 0 6px">To this address</p>' +
        '<div class="addr">' +
          '<code id="mAddr">' + USDT_ADDRESS + '</code>' +
          '<button data-copy="#mAddr">' + ic('copy', 'i-sm') + 'Copy address</button>' +
        '</div>' +
        '<div class="qr-wrap">' +
          '<canvas id="mQr" aria-label="QR code of the USDT address" role="img"></canvas>' +
        '</div>' +
        '<div class="note-warn">' + ic('triangle-alert', 'i-sm') +
          '<span>USDT on TRON (TRC-20) only. Another network or another coin ' +
          'cannot be recovered.</span></div>' +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-primary btn-block btn-lg" id="mGo">I have sent it</button>' +
      '</div>';

    open('Pay in USDT', html, function (root) {
      var cv = root.querySelector('#mQr');
      if (cv && global.OrbisQR) {
        var small = Math.min(innerHeight, innerWidth) < 820;
        global.OrbisQR.render(cv, USDT_ADDRESS,
          { size: small ? 112 : 132, dark: '#1C1C1C', light: '#FFFFFF' });
      }
      root.querySelector('#mGo').addEventListener('click', function () {
        enrolDone(key, email, 'We are watching the network for your transfer. ');
      });
    }, function () { enrolPay(key, email); });
  }

  /* the receipt */
  function enrolDone(key, email, lead) {
    var c = courseOf(key);
    var html =
      '<div class="modal-bd enrol-done">' +
        '<span class="enrol-ic">' + ic('check') + '</span>' +
        '<h4>You are enrolled in ' + c.name + '</h4>' +
        '<p>' + lead + 'Your Academy login goes to <b>' + email +
          '</b> as soon as the payment clears. It can land in spam the first time.</p>' +
      '</div>' +
      '<div class="modal-ft">' +
        '<button class="btn btn-dark btn-block btn-lg" data-close>Done</button>' +
      '</div>';
    open('Enrolled', html);
  }

  /* ======================================================= indicators == */
  function indicatorsModal() {
    var state = (global.orbisChartState && global.orbisChartState()) ||
                { type: 'candle', smas: [] };

    var html =
      '<div class="modal-bd">' +
        '<h4 class="modal-sub">Chart type</h4>' +
        '<div class="stack-sm" style="margin-bottom:18px">' +
          ['candle', 'line'].map(function (t) {
            var on = state.type === t;
            return '<button class="method' + (on ? ' active' : '') + '" data-ctype="' + t + '">' +
              '<span class="method-ic">' +
                ic(t === 'candle' ? 'chart-candlestick' : 'chart-line', 'i-sm') + '</span>' +
              '<span style="flex:1;text-align:left"><b>' +
                (t === 'candle' ? 'Candles' : 'Line') + '</b><span>' +
                (t === 'candle' ? 'Open, high, low and close' : 'Closing price only') +
              '</span></span>' + (on ? ic('check', 'i-sm') : '') + '</button>';
          }).join('') +
        '</div>' +

        '<h4 class="modal-sub">Overlays</h4>' +
        [20, 50].map(function (n) {
          var on = state.smas.indexOf(n) > -1;
          return '<div class="auto-row">' +
            '<span class="lr-tx"><b>Moving average ' + n + '</b>' +
              '<span>Mean close over the last ' + n + ' candles</span></span>' +
            '<button class="switch' + (on ? ' on' : '') + '" data-sma="' + n +
              '" role="switch" aria-checked="' + on + '"></button></div>';
        }).join('') +
      '</div>';

    open('Indicators', html, function (root) {
      root.querySelectorAll('[data-ctype]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (global.orbisChartType) global.orbisChartType(b.dataset.ctype);
          close();
          toast(b.dataset.ctype === 'line' ? 'Line chart' : 'Candlestick chart', 'check');
        });
      });
      root.querySelectorAll('[data-sma]').forEach(function (b) {
        b.addEventListener('click', function () {
          var on = !b.classList.contains('on');
          b.classList.toggle('on', on);
          b.setAttribute('aria-checked', on);
          if (global.orbisChartSma) global.orbisChartSma(Number(b.dataset.sma), on);
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
    else if (kind === 'add-payment') addPaymentStep1();
    else if (kind === 'market-read') marketReadModal();
    else if (kind === 'indicators') indicatorsModal();
    else if (kind === 'country') countryModal(t);
    else if (kind === 'copy') copyModal(t.dataset.provider);
    else if (kind === 'enrol') enrolInfo(t.dataset.course);
  });


  /* ================================================== live money flows == */
  /* a finished payment, good or bad, on one screen */
  function resultScreen(title, ok, head, text, rows, again) {
    var html =
      '<div class="modal-bd center">' +
        '<div class="result ' + (ok ? 'result-won' : 'result-lost') + '">' + ic(ok ? 'check' : 'x', 'i-lg') + '</div>' +
        '<h3 style="margin-top:14px">' + head + '</h3>' +
        '<p class="hint" style="max-width:34ch;margin:8px auto 0">' + text + '</p>' +
        (rows && rows.length ? '<div style="text-align:left;margin-top:16px">' + rows.map(function (r) {
          return '<div class="kv"><span>' + r[0] + '</span><b class="mono">' + esc(r[1]) + '</b></div>';
        }).join('') + '</div>' : '') +
      '</div>' +
      '<div class="modal-ft">' +
        (again ? '<button class="btn btn-ghost btn-block" data-again style="margin-bottom:8px">Try again</button>' : '') +
        '<button class="btn btn-primary btn-block" data-done>Done</button>' +
      '</div>';
    open(title, html, function (root) {
      root.querySelector('[data-done]').addEventListener('click', close);
      var a = root.querySelector('[data-again]');
      if (a) a.addEventListener('click', again);
    });
  }

  function amountField(value, min) {
    return '<div class="field" style="margin:0 0 10px">' +
        '<label class="label" for="mAmt">Amount</label>' +
        '<div class="input-wrap"><span class="input-prefix">$</span>' +
          '<input class="input" id="mAmt" type="number" value="' + value + '" min="' + min + '" step="any" inputmode="decimal"></div>' +
        '<p class="hint" id="mMin" style="margin-top:6px">Minimum ' + money(min) + '</p>' +
        '<div class="stake-row">' + [5, 20, 100, 250].map(function (v) {
          return '<button class="chip" data-amt="' + v + '">' + v + '</button>';
        }).join('') + '</div>' +
      '</div>';
  }

  /* ---------------------------------------------------------- M-Pesa in -- */
  function liveMpesaDeposit(pre) {
    pre = pre || {};
    API.get('/payment-methods').catch(function () { return []; }).then(function (methods) {
      var saved = (methods || []).filter(function (m) { return m.kind === 'mpesa'; });
      var prof = (API.session() || {}).profile || {};
      var chosen = pre.methodId || (saved[0] && saved[0].id) || '';

      var html =
        '<div class="modal-bd">' +
          amountField(pre.amount || 20, MIN_DEPOSIT) +
          '<p class="label" style="margin:14px 0 8px">Send the prompt to</p>' +
          '<div class="stack-sm" id="mNums">' +
            saved.map(function (m) {
              return '<button class="method' + (m.id === chosen ? ' active' : '') + '" data-num="' + m.id + '">' +
                '<span class="method-ic">' + ic('smartphone', 'i-sm') + '</span>' +
                '<span style="flex:1;text-align:left"><b>' + esc(m.masked) + '</b><span>' +
                  (m.status === 'verified' ? 'Verified' : 'Verified by this deposit') + '</span></span>' +
                '<i class="pick-dot"></i></button>';
            }).join('') +
            '<button class="method' + (chosen ? '' : ' active') + '" data-num="">' +
              '<span class="method-ic">' + ic('plus', 'i-sm') + '</span>' +
              '<span style="flex:1;text-align:left"><b>' + (saved.length ? 'Another number' : 'Your M-Pesa number') + '</b>' +
              '<span>Safaricom, in your own name</span></span><i class="pick-dot"></i></button>' +
          '</div>' +
          '<input class="input" id="mPhone" type="tel" inputmode="tel" placeholder="0712 345 678" style="margin-top:8px" value="' +
            esc(pre.phone || prof.phone || '') + '"' + (chosen ? ' hidden' : '') + '>' +
          '<div class="kv" style="margin-top:14px"><span>You pay by M-Pesa</span><b class="mono" id="mKes"></b></div>' +
          '<div class="kv"><span>Credited</span><b class="mono" id="mNet"></b></div>' +
          '<p class="hint" style="margin-top:8px">At KSh ' + USD_KES.toFixed(2) + ' to $1.</p>' +
        '</div>' +
        '<div class="modal-ft"><button class="btn btn-primary btn-block btn-lg" id="mGo"></button>' +
          '<p class="hint center" style="margin-top:10px">A prompt appears on the phone. Enter your M-Pesa PIN to approve it.</p></div>';

      open('Deposit with M-Pesa', html, function (root) {
        var amt = root.querySelector('#mAmt'), go = root.querySelector('#mGo'), phone = root.querySelector('#mPhone');
        function sync() {
          var v = Number(amt.value) || 0, low = v < MIN_DEPOSIT;
          root.querySelector('#mKes').textContent = kes(v);
          root.querySelector('#mNet').textContent = money(v);
          root.querySelector('#mMin').classList.toggle('hint-err', low && amt.value !== '');
          root.querySelectorAll('[data-amt]').forEach(function (c) { c.classList.toggle('active', Number(c.dataset.amt) === v); });
          go.disabled = low;
          go.textContent = low ? 'Minimum deposit is ' + money(MIN_DEPOSIT) : 'Send prompt · ' + kes(v);
        }
        amt.addEventListener('input', sync);
        root.querySelectorAll('[data-amt]').forEach(function (c) {
          c.addEventListener('click', function () { amt.value = c.dataset.amt; sync(); });
        });
        root.querySelectorAll('[data-num]').forEach(function (b) {
          b.addEventListener('click', function () {
            chosen = b.dataset.num;
            phone.hidden = !!chosen;
            if (!chosen) phone.focus();
          });
        });
        go.addEventListener('click', function () {
          var v = Number(amt.value) || 0;
          var body = { amount_usd: v };
          if (chosen) body.payment_method_id = chosen; else body.phone = phone.value.trim();
          go.disabled = true;
          go.innerHTML = '<span class="btn-spin"></span>Sending the prompt';
          API.post('/payments/deposit/mpesa', body).then(function (tx) {
            waitForMpesa(tx, { amount: v, methodId: chosen, phone: phone.value.trim() });
          }).catch(function (err) { sync(); toast(err.message, 'triangle-alert'); });
        });
        sync();
      }, depositStep1);
    });
  }

  /* the prompt is on the phone: wait for M-Pesa to say yes or no. Closing
     the modal only hides the waiting screen; the check carries on and ends
     in a toast instead */
  function waitForMpesa(tx, pre) {
    var left = 120, tries = 0;
    var html =
      '<div class="modal-bd center pay-wait">' +
        '<span class="pay-phone">' + ic('smartphone', 'i-lg') + '</span>' +
        '<h3>Check your phone</h3>' +
        '<p class="hint" style="max-width:32ch;margin:8px auto 0">Enter your M-Pesa PIN to approve <b>KSh ' +
          Number(tx.localAmount).toLocaleString('en-US') + '</b> to orbisflow. Sent to ' + esc(tx.destination) + '.</p>' +
        '<p class="pay-left mono" id="mLeft">2:00</p>' +
      '</div>' +
      '<div class="modal-ft"><button class="btn btn-ghost btn-block" data-close>Close, and keep waiting in the background</button></div>';
    open('Deposit with M-Pesa', html);
    var box = document.querySelector('.pay-wait');
    function shown() { return document.body.contains(box) && box.offsetParent !== null; }

    var timer = setInterval(function () {
      left--;
      if (!shown()) return clearInterval(timer);
      var el = document.getElementById('mLeft');
      if (el) el.textContent = Math.floor(Math.max(0, left) / 60) + ':' + ('0' + Math.max(0, left) % 60).slice(-2);
      if (left <= 0) {
        clearInterval(timer);
        resultScreen('Deposit with M-Pesa', false, 'Still waiting on M-Pesa',
          'If you approved it, your balance updates as soon as M-Pesa confirms. If not, send the prompt again.', [],
          function () { clearInterval(poll); liveMpesaDeposit(pre); });
      }
    }, 1000);

    var poll = setInterval(function () {
      if (++tries > 60) return clearInterval(poll);        /* four minutes, then leave it to the callback */
      API.get('/payments/' + tx.reference).then(function (t) {
        if (!t || (t.state !== 'completed' && t.state !== 'failed')) return;
        clearInterval(poll); clearInterval(timer);
        var ok = t.state === 'completed';
        if (ok) { afterMoney(); if (global.orbisBeep) global.orbisBeep('win'); }
        if (!shown() && !document.querySelector('.modal-scrim:not([hidden]) .result')) {
          toast(ok ? 'Deposit of ' + money(t.netUsd) + ' received' : 'M-Pesa deposit was not completed',
                ok ? 'check-circle-2' : 'triangle-alert');
          return;
        }
        if (ok) {
          resultScreen('Deposit with M-Pesa', true, money(t.netUsd) + ' received',
            'Your real account is ready to trade.',
            [['Paid', 'KSh ' + Number(t.localAmount).toLocaleString('en-US')], ['Credited', money(t.netUsd)],
             ['New balance', money(t.balance)], ['Reference', t.reference]]);
        } else {
          resultScreen('Deposit with M-Pesa', false, 'Payment not completed',
            esc(t.failureReason || 'The prompt was cancelled or timed out.'), [], function () { liveMpesaDeposit(pre); });
        }
      }).catch(function () {});
    }, 4000);
  }

  /* ------------------------------------------------------------ card in -- */
  function liveCardDeposit() {
    var html =
      '<div class="modal-bd">' +
        amountField(20, MIN_DEPOSIT) +
        '<div class="kv"><span>Processor fee · ' + (CARD_FEE * 100).toFixed(1) + '%</span><b class="mono" id="mFee"></b></div>' +
        '<div class="kv"><span>Credited</span><b class="mono" id="mNet"></b></div>' +
      '</div>' +
      '<div class="modal-ft"><button class="btn btn-primary btn-block btn-lg" id="mGo"></button>' +
        '<p class="hint center" style="margin-top:10px">Paystack takes the card details on its own secure page. ' +
        'They never reach orbisflow, and the card is saved for next time.</p></div>';
    open('Deposit by card', html, function (root) {
      var amt = root.querySelector('#mAmt'), go = root.querySelector('#mGo');
      function sync() {
        var v = Number(amt.value) || 0, low = v < MIN_DEPOSIT;
        root.querySelector('#mFee').textContent = money(v * CARD_FEE);
        root.querySelector('#mNet').textContent = money(Math.max(0, v - v * CARD_FEE));
        root.querySelector('#mMin').classList.toggle('hint-err', low && amt.value !== '');
        root.querySelectorAll('[data-amt]').forEach(function (c) { c.classList.toggle('active', Number(c.dataset.amt) === v); });
        go.disabled = low;
        go.textContent = low ? 'Minimum deposit is ' + money(MIN_DEPOSIT) : 'Continue to Paystack · ' + money(v);
      }
      amt.addEventListener('input', sync);
      root.querySelectorAll('[data-amt]').forEach(function (c) {
        c.addEventListener('click', function () { amt.value = c.dataset.amt; sync(); });
      });
      go.addEventListener('click', function () {
        go.disabled = true;
        go.innerHTML = '<span class="btn-spin"></span>Opening checkout';
        API.post('/payments/deposit/card', { amount_usd: Number(amt.value) }).then(function (r) {
          close();
          if (global.orbisVeil) global.orbisVeil('Opening Paystack checkout');
          location.href = r.authorization_url;
        }).catch(function (err) { sync(); toast(err.message, 'triangle-alert'); });
      });
      sync();
    }, depositStep1);
  }


  /* ------------------------------------------------------------- USDT in -- */
  /* Everyone sends to one address, so each deposit asks for its own exact
     amount (the cents are the fingerprint), and the backend credits it when
     a confirmed transfer of exactly that much arrives. */
  function liveUsdtDeposit() {
    var html =
      '<div class="modal-bd">' +
        amountField(50, MIN_DEPOSIT) +
        '<p class="hint" style="margin-top:4px">You get an exact amount to send, to the cent. ' +
          'Sending exactly that is how your deposit is recognised and credited automatically.</p>' +
      '</div>' +
      '<div class="modal-ft"><button class="btn btn-primary btn-block btn-lg" id="mGo"></button></div>';
    open('Deposit USDT', html, function (root) {
      var amt = root.querySelector('#mAmt'), go = root.querySelector('#mGo');
      function sync() {
        var v = Number(amt.value) || 0, low = v < MIN_DEPOSIT;
        root.querySelector('#mMin').classList.toggle('hint-err', low && amt.value !== '');
        root.querySelectorAll('[data-amt]').forEach(function (c) { c.classList.toggle('active', Number(c.dataset.amt) === v); });
        go.disabled = low;
        go.textContent = low ? 'Minimum deposit is ' + money(MIN_DEPOSIT) : 'Get the amount to send';
      }
      amt.addEventListener('input', sync);
      root.querySelectorAll('[data-amt]').forEach(function (c) {
        c.addEventListener('click', function () { amt.value = c.dataset.amt; sync(); });
      });
      go.addEventListener('click', function () {
        go.disabled = true;
        go.innerHTML = '<span class="btn-spin"></span>Preparing';
        API.post('/payments/deposit/usdt', { amount_usd: Number(amt.value) })
          .then(usdtSendScreen)
          .catch(function (err) { sync(); toast(err.message, 'triangle-alert'); });
      });
      sync();
    }, depositStep1);
  }

  function usdtSendScreen(req) {
    var html =
      '<div class="modal-bd">' +
        '<p class="hint" style="margin:0 0 6px">Send exactly</p>' +
        '<div class="usdt-exact">' +
          '<b class="mono" id="uAmt">' + esc(req.amountUsdt) + '</b><span>USDT</span>' +
          '<button data-copy="#uAmt" aria-label="Copy amount">' + ic('copy', 'i-sm') + 'Copy</button>' +
        '</div>' +
        '<p class="hint" style="margin:14px 0 6px">To this address, on TRON (TRC-20)</p>' +
        '<div class="addr"><code id="mAddr">' + esc(req.address) + '</code>' +
          '<button data-copy="#mAddr">' + ic('copy', 'i-sm') + 'Copy address</button></div>' +
        '<div class="qr-wrap"><canvas id="mQr" aria-label="QR code of the USDT deposit address" role="img"></canvas></div>' +
        '<div class="note-warn">' + ic('triangle-alert', 'i-sm') +
          '<span>Send the exact amount, cents included, on TRC-20 only. A different amount cannot be matched ' +
          'automatically, and another network or coin cannot be recovered.</span></div>' +
        '<div class="usdt-wait" id="uWait"><span class="btn-spin"></span>' +
          '<span>Waiting for your transfer. It is credited about a minute after it confirms. ' +
          '<b class="mono" id="uLeft"></b></span></div>' +
      '</div>' +
      '<div class="modal-ft"><button class="btn btn-ghost btn-block" data-close>Close, and credit it when it arrives</button></div>';

    open('Deposit USDT', html, function (root) {
      var cv = root.querySelector('#mQr');
      if (cv && global.OrbisQR) {
        var small = Math.min(innerHeight, innerWidth) < 820;
        global.OrbisQR.render(cv, req.address, { size: small ? 118 : 140, dark: '#1C1C1C', light: '#FFFFFF' });
      }
    });

    var box = document.getElementById('uWait');
    function shown() { return box && document.body.contains(box) && box.offsetParent !== null; }
    var ends = new Date(req.expiresAt).getTime();
    var clock = setInterval(function () {
      if (!shown()) return clearInterval(clock);
      var left = Math.max(0, Math.round((ends - Date.now()) / 1000));
      var el = document.getElementById('uLeft');
      if (el) el.textContent = Math.floor(left / 60) + ':' + ('0' + left % 60).slice(-2) + ' left';
    }, 1000);
    var poll = setInterval(function () {
      if (!shown()) return clearInterval(poll);
      API.get('/payments/' + req.reference).then(function (t) {
        if (!t || (t.state !== 'completed' && t.state !== 'failed')) return;
        clearInterval(poll); clearInterval(clock);
        if (t.state === 'completed') {
          afterMoney();
          if (global.orbisBeep) global.orbisBeep('win');
          resultScreen('Deposit USDT', true, money(t.netUsd) + ' received', 'Your real account is ready to trade.',
            [['Received', t.localAmount.toFixed(2) + ' USDT'], ['Credited', money(t.netUsd)],
             ['New balance', money(t.balance)], ['Reference', t.reference]]);
        } else {
          resultScreen('Deposit USDT', false, 'Request closed', esc(t.failureReason || 'No matching transfer arrived.') +
            ' If you did send it, contact support with the transaction hash.', [], liveUsdtDeposit);
        }
      }).catch(function () {});
    }, 15000);
  }

  /* ---------------------------------------------------------- money out -- */
  function liveWithdrawPick() {
    open('Withdraw', '<div class="modal-bd">' + (API.loading ? API.loading(3) : '') + '</div>');
    API.get('/payment-methods').then(function (methods) {
      var list = (methods || []).filter(function (m) { return m.kind !== 'card'; });
      if (!list.length) {
        open('Withdraw',
          '<div class="modal-bd">' + API.empty({ icon: 'wallet', title: 'Add where to send it',
            text: 'Withdrawals go to an M-Pesa number, bank account or USDT wallet in your own name.' }) + '</div>' +
          '<div class="modal-ft"><button class="btn btn-primary btn-block" id="mAddM">Add a payment method</button></div>',
          function (root) { root.querySelector('#mAddM').addEventListener('click', addPaymentStep1); });
        return;
      }
      var html = '<div class="modal-bd stack-sm">' + list.map(function (m) {
        var ok = m.status === 'verified';
        return '<button class="method"' + (ok ? '' : ' disabled') + ' data-pick="' + m.id + '">' +
          '<span class="method-ic">' + ic(SAVED[m.kind] ? SAVED[m.kind].icon : 'wallet') + '</span>' +
          '<span style="flex:1;text-align:left"><b>' + esc(m.label) + '</b><span>' + esc(m.masked) + ' · ' +
            (ok ? 'Usually paid the same day'
                : (m.kind === 'mpesa' ? 'Deposit from it once to verify' : 'Being verified')) + '</span></span>' +
          (ok ? ic('chevron-right', 'i-sm') : '<span class="tag tag-wait">Pending</span>') + '</button>';
      }).join('') + '</div>' +
      '<div class="modal-ft"><button class="linkish" id="mAddM">Add another method</button></div>';
      open('Withdraw', html, function (root) {
        root.querySelectorAll('[data-pick]').forEach(function (b) {
          b.addEventListener('click', function () {
            var m = list.filter(function (x) { return x.id === b.dataset.pick; })[0];
            withdrawStep2(m.kind, m);
          });
        });
        root.querySelector('#mAddM').addEventListener('click', addPaymentStep1);
      });
    }).catch(function (err) { close(); toast(err.message, 'triangle-alert'); });
  }

  global.orbisModal = { open: open, close: close, autoResult: autoResultModal, deposit: depositStep1,
                      withdraw: withdrawStep1, refer: referModal, account: accountModal,
                      addPayment: addPaymentStep1, marketRead: marketReadModal, copy: copyModal,
                      trade: tradeModal, country: countryModal, enrol: enrolInfo };
})(window);
