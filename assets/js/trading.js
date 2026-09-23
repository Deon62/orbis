/* ==========================================================================
   orbisflow, placing and settling contracts
   One place the Trade page goes through for money. With the API connected
   the backend holds the balance: placing takes the stake, settling pays back
   what the contract returned, selling back pays 75% of the stake. Offline,
   the same rules run against the balance in the account card, so a demo
   balance moves either way.

   The result is the market's, not a coin flip: Rise wins if the price at
   expiry is above the entry, Fall if it is below. An unchanged price loses.
   ========================================================================== */
(function (global) {
  'use strict';

  var API = global.OrbisAPI;
  var SELL_BACK = 0.75;

  function live() { return !!(API && API.connected && API.signedIn()); }
  function account() { return global.orbisActiveAccount ? global.orbisActiveAccount() : 'demo'; }
  function balance(kind) { return global.orbisBalance ? global.orbisBalance(kind) : 0; }
  function setBalance(kind, v) { if (global.orbisSetBalance) global.orbisSetBalance(kind, v); }
  function round2(n) { return Math.round(n * 100) / 100; }
  function num(text) { return Number(String(text).replace(/,/g, '')); }

  /* the price the chart is showing right now */
  function price() {
    var el = document.getElementById('price');
    return el ? el.textContent.trim() : '';
  }

  function outcome(dir, entry, exit) {
    var a = num(entry), b = num(exit);
    return dir === 'Rise' ? b > a : b < a;
  }

  /* ------------------------------------------------------------ place --- */
  /* c: { sym, dir, stake, payout, seconds, entry }. Resolves to the trade,
     with the balance after the stake has gone. */
  function place(c) {
    var kind = account();
    if (live()) {
      return API.post('/trades', {
        account: kind, symbol: c.sym, direction: c.dir, stake: c.stake,
        payout_pct: c.payout, duration_s: c.seconds, entry_price: String(c.entry)
      }).then(function (t) {
        setBalance(kind, t.balance);
        return t;
      });
    }
    var bal = balance(kind);
    if (c.stake > bal) return Promise.reject(new Error('Not enough balance for that stake.'));
    setBalance(kind, round2(bal - c.stake));
    return Promise.resolve({
      id: 'OB-' + Math.random().toString(36).slice(2, 9).toUpperCase(), local: true, account: kind,
      sym: c.sym, dir: c.dir, stake: c.stake, payout: c.payout, entry: String(c.entry), status: 'open',
      balance: round2(bal - c.stake)
    });
  }

  /* ----------------------------------------------------------- settle --- */
  /* Resolves to { won, returned, profit, entry, exit, balance }. */
  function settle(t, exit) {
    exit = exit || price();
    if (!t.local) {
      return API.post('/trades/' + encodeURIComponent(t.id) + '/settle', { exit_price: String(exit) })
        .then(function (r) {
          setBalance(t.account, r.balance);
          return { won: r.status === 'won', returned: r.returned, profit: r.profit,
                   entry: r.entry, exit: r.exit, balance: r.balance };
        });
    }
    var won = outcome(t.dir, t.entry, exit);
    var returned = won ? round2(t.stake * (1 + t.payout / 100)) : 0;
    var bal = round2(balance(t.account) + returned);
    setBalance(t.account, bal);
    return Promise.resolve({ won: won, returned: returned, profit: round2(returned - t.stake),
                             entry: t.entry, exit: String(exit), balance: bal });
  }

  /* ------------------------------------------------------------- sell --- */
  function sell(t) {
    if (!t.local) {
      return API.post('/trades/' + encodeURIComponent(t.id) + '/sell').then(function (r) {
        setBalance(t.account, r.balance);
        return { returned: r.returned, balance: r.balance };
      });
    }
    var returned = round2(t.stake * SELL_BACK);
    var bal = round2(balance(t.account) + returned);
    setBalance(t.account, bal);
    return Promise.resolve({ returned: returned, balance: bal });
  }

  /* ------------------------------------------------------- demo reset --- */
  function resetDemo() {
    if (live()) {
      return API.post('/accounts/demo/reset').then(function (r) { setBalance('demo', r.balance); return r; });
    }
    setBalance('demo', 10000);
    return Promise.resolve({ kind: 'demo', balance: 10000 });
  }

  /* real money waits for server-side prices; the backend refuses it too */
  function canTrade(kind) {
    return !(live() && (kind || account()) === 'real');
  }

  global.OrbisTrading = { place: place, settle: settle, sell: sell, resetDemo: resetDemo,
                          canTrade: canTrade, price: price, live: live };
})(window);
