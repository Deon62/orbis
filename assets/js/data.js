/* ==========================================================================
   orbisflow — mock data set. Swap for API responses when the backend lands.
   Asset marks: country flags from flagcdn.com, coin marks from Simple Icons.
   ========================================================================== */
(function (global) {
  'use strict';

  function flag(code) { return 'https://flagcdn.com/w40/' + code + '.png'; }
  function coin(slug, hex) { return 'https://cdn.simpleicons.org/' + slug + '/' + hex; }

  /* icon spec per market:
       {pair:['eu','us']}  two flags, overlapped
       {flag:'us'}         single flag
       {img:'<url>'}       coin / brand mark
       {lucide:'waves'}    generic glyph
       {text:'Au'}         two-letter fallback                                */
  var markets = [
    { sym:'EUR/USD', name:'Euro / US Dollar',  cat:'forex',       icon:{pair:['eu','us']}, price:'1.08420', chg: 0.18, payout:88, vol:0.0016, base:1.0842, dp:5 },
    { sym:'GBP/USD', name:'Pound / US Dollar', cat:'forex',       icon:{pair:['gb','us']}, price:'1.27140', chg:-0.24, payout:87, vol:0.0019, base:1.2714, dp:5 },
    { sym:'USD/JPY', name:'US Dollar / Yen',   cat:'forex',       icon:{pair:['us','jp']}, price:'151.380', chg: 0.31, payout:86, vol:0.18,   base:151.38, dp:3 },
    { sym:'AUD/USD', name:'Aussie / US Dollar',cat:'forex',       icon:{pair:['au','us']}, price:'0.66280', chg:-0.09, payout:86, vol:0.0014, base:0.6628, dp:5 },
    { sym:'BTC/USD', name:'Bitcoin',           cat:'crypto',      icon:{img:coin('bitcoin','F7931A')},  price:'67,240.00', chg: 1.92, payout:84, vol:120, base:67240, dp:2 },
    { sym:'ETH/USD', name:'Ethereum',          cat:'crypto',      icon:{img:coin('ethereum','627EEA')}, price:'3,412.60',  chg:-1.07, payout:83, vol:9,   base:3412.6, dp:2 },
    { sym:'SOL/USD', name:'Solana',            cat:'crypto',      icon:{img:coin('solana','14F195')},   price:'168.42',    chg: 2.64, payout:82, vol:1.4, base:168.42, dp:2 },
    { sym:'XAU/USD', name:'Gold spot',         cat:'commodities', icon:{text:'Au'},        price:'2,318.40', chg: 0.46, payout:85, vol:3.4,  base:2318.4, dp:2 },
    { sym:'XAG/USD', name:'Silver spot',       cat:'commodities', icon:{text:'Ag'},        price:'27.412',   chg:-0.62, payout:82, vol:0.06, base:27.412, dp:3 },
    { sym:'WTI',     name:'Crude oil WTI',     cat:'commodities', icon:{lucide:'fuel'},    price:'78.930',   chg: 0.88, payout:81, vol:0.12, base:78.93,  dp:3 },
    { sym:'US 500',  name:'S&P 500 index',     cat:'indices',     icon:{flag:'us'},        price:'5,308.20', chg: 0.35, payout:86, vol:5.2,  base:5308.2, dp:2 },
    { sym:'US 100',  name:'Nasdaq 100 index',  cat:'indices',     icon:{flag:'us'},        price:'18,642.10',chg: 0.74, payout:85, vol:22,   base:18642,  dp:2 },
    { sym:'UK 100',  name:'FTSE 100 index',    cat:'indices',     icon:{flag:'gb'},        price:'8,214.60', chg:-0.12, payout:84, vol:7,    base:8214.6, dp:2 },
    { sym:'GER 40',  name:'DAX 40 index',      cat:'indices',     icon:{flag:'de'},        price:'18,492.30',chg: 0.28, payout:84, vol:19,   base:18492,  dp:2 },
    { sym:'Volatility 75', name:'Synthetic index', cat:'synthetics', icon:{lucide:'waves'},    price:'412,880.4', chg: 2.41, payout:92, vol:420, base:412880, dp:1 },
    { sym:'Volatility 25', name:'Synthetic index', cat:'synthetics', icon:{lucide:'waves'},    price:'2,684.31',  chg:-0.53, payout:90, vol:3.1, base:2684.3, dp:2 },
    { sym:'Boom 500',      name:'Synthetic index', cat:'synthetics', icon:{lucide:'activity'}, price:'9,142.77',  chg: 0.19, payout:89, vol:8,   base:9142.8, dp:2 }
  ];

  var CATS = {
    forex:'Forex', crypto:'Crypto', commodities:'Commodities',
    indices:'Indices', synthetics:'Synthetics'
  };

  function assetHTML(m) {
    var i = m.icon || {};
    if (i.pair) {
      return '<span class="asset asset-pair">' +
             '<img src="' + flag(i.pair[0]) + '" alt="" loading="lazy">' +
             '<img src="' + flag(i.pair[1]) + '" alt="" loading="lazy">' +
             '</span>';
    }
    if (i.flag) return '<span class="asset"><img src="' + flag(i.flag) + '" alt="" loading="lazy"></span>';
    if (i.img)  return '<span class="asset" style="background:var(--panel-2)"><img src="' + i.img +
                       '" alt="" width="18" height="18" style="width:18px;height:18px;object-fit:contain" loading="lazy"></span>';
    if (i.lucide) return '<span class="asset"><i data-lucide="' + i.lucide + '" class="i-sm"></i></span>';
    return '<span class="asset">' + (i.text || m.sym.slice(0, 2)) + '</span>';
  }

  function rowHTML(m, idx) {
    var up = m.chg >= 0;
    return '<a class="mkt-row" href="/trade?symbol=' + encodeURIComponent(m.sym) + '">' +
      assetHTML(m) +
      '<span class="mkt-name"><b>' + m.sym + '</b><span>' + m.name + '</span></span>' +
      '<canvas class="spark" data-seed="' + (idx * 13 + 5) + '" data-up="' + up + '" ' +
        'width="78" height="28"></canvas>' +
      '<span class="mkt-val">' +
        '<b class="mono">' + m.price + '</b>' +
        '<span class="' + (up ? 'up' : 'down') + '">' + (up ? '+' : '') + m.chg.toFixed(2) + '%</span>' +
      '</span>' +
      '<span class="tag mkt-payout">' + m.payout + '%</span>' +
      '<i data-lucide="chevron-right" class="i-sm dim"></i>' +
    '</a>';
  }

  function drawSparklines() {
    document.querySelectorAll('canvas.spark').forEach(function (c) {
      OrbisChart.sparkline(c, Number(c.dataset.seed), c.dataset.up === 'true');
    });
  }

  /* ------------------------------------------------------------ trades -- */
  var openTrades = [
    { id:'OB-948213', sym:'EUR/USD', dir:'Rise', stake:25, entry:'1.08402', now:'1.08431', ends:'00:41', pl:+22.0 },
    { id:'OB-948198', sym:'BTC/USD', dir:'Fall', stake:50, entry:'67,301.0', now:'67,240.0', ends:'02:08', pl:+42.0 },
    { id:'OB-948155', sym:'Volatility 75', dir:'Rise', stake:10, entry:'412,410', now:'412,880', ends:'00:12', pl:+9.2 },
    { id:'OB-948101', sym:'XAU/USD', dir:'Rise', stake:15, entry:'2,319.10', now:'2,318.40', ends:'04:55', pl:-15.0 }
  ];

  var closedTrades = [
    { id:'OB-947880', sym:'GBP/USD', dir:'Fall', stake:20, entry:'1.27310', exit:'1.27140', result:'won',  pl:+17.4, when:'Today 09:41' },
    { id:'OB-947812', sym:'US 100',  dir:'Rise', stake:30, entry:'18,600.2', exit:'18,642.1', result:'won', pl:+25.5, when:'Today 09:12' },
    { id:'OB-947744', sym:'ETH/USD', dir:'Rise', stake:40, entry:'3,441.0', exit:'3,412.6', result:'lost', pl:-40.0, when:'Today 08:36' },
    { id:'OB-947690', sym:'EUR/USD', dir:'Rise', stake:10, entry:'1.08380', exit:'1.08402', result:'won',  pl:+8.8,  when:'Yesterday 21:04' },
    { id:'OB-947612', sym:'WTI',     dir:'Fall', stake:25, entry:'78.520',  exit:'78.930',  result:'lost', pl:-25.0, when:'Yesterday 18:47' },
    { id:'OB-947559', sym:'Volatility 25', dir:'Fall', stake:15, entry:'2,701.4', exit:'2,684.3', result:'won', pl:+13.5, when:'Yesterday 16:22' }
  ];

  var transactions = [
    { type:'Deposit',    method:'M-Pesa',        amount:+200,  status:'Completed', ref:'DP-77120', when:'22 Sep 2026, 10:14' },
    { type:'Trade P/L',  method:'Settlements',   amount:-12.7, status:'Completed', ref:'TR-88191', when:'22 Sep 2026, 09:58' },
    { type:'Withdrawal', method:'Bank transfer', amount:-150,  status:'Pending',   ref:'WD-40027', when:'21 Sep 2026, 17:31' },
    { type:'Referral',   method:'Weekly payout', amount:+34.2, status:'Completed', ref:'RF-11934', when:'21 Sep 2026, 00:05' },
    { type:'Deposit',    method:'Visa ••4417',   amount:+500,  status:'Completed', ref:'DP-77004', when:'19 Sep 2026, 12:02' },
    { type:'Withdrawal', method:'USDT (TRC-20)', amount:-300,  status:'Completed', ref:'WD-39988', when:'17 Sep 2026, 08:44' }
  ];

  var referrals = [
    { user:'j•••@gmail.com',   joined:'18 Sep 2026', status:'Active',   volume:4120, earned:21.40 },
    { user:'m•••@outlook.com', joined:'14 Sep 2026', status:'Active',   volume:2860, earned:14.80 },
    { user:'k•••@yahoo.com',   joined:'09 Sep 2026', status:'Active',   volume:9740, earned:52.10 },
    { user:'a•••@gmail.com',   joined:'02 Sep 2026', status:'Inactive', volume:310,  earned:1.60 },
    { user:'t•••@proton.me',   joined:'28 Aug 2026', status:'Pending',  volume:0,    earned:0 }
  ];

  /* --------------------------------------------------------- providers -- */
  var providers = [
    { id:'wk', name:'Wanjiru Kamau',  initials:'WK', style:'Momentum · majors',
      min:100, ret:18.4, win:64, copiers:412,  dd:9,  since:'Mar 2025' },
    { id:'dp', name:'Deshawn Price',  initials:'DP', style:'Synthetics · scalping',
      min:250, ret:31.2, win:58, copiers:1204, dd:22, since:'Nov 2024' },
    { id:'at', name:'Aiko Tanaka',    initials:'AT', style:'Yen carry · swing',
      min:50,  ret:9.1,  win:71, copiers:233,  dd:5,  since:'Jul 2025' },
    { id:'mf', name:'Marco Ferreira', initials:'MF', style:'Commodities · swing',
      min:500, ret:24.7, win:61, copiers:786,  dd:15, since:'Jan 2025' }
  ];

  global.OrbisData = {
    providers: providers,
    providerById: function (id) {
      for (var i = 0; i < providers.length; i++) if (providers[i].id === id) return providers[i];
      return null;
    },
    markets: markets,
    cats: CATS,
    assetHTML: assetHTML,
    rowHTML: rowHTML,
    drawSparklines: drawSparklines,
    bySymbol: function (s) {
      for (var i = 0; i < markets.length; i++) if (markets[i].sym === s) return markets[i];
      return null;
    },
    openTrades: openTrades,
    closedTrades: closedTrades,
    transactions: transactions,
    referrals: referrals,
    money: function (n) {
      return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  };
})(window);
