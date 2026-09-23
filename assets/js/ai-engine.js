/* ==========================================================================
   orbisflow, AI scan stand-in
   Not a model. It plays the part of the scanning service: each scan picks
   markets from the live list, draws a direction, a confidence and a reason
   at random, and answers after a network-like pause, in exactly the shape
   /signals and /patterns will return. When the real service is connected
   (OrbisAPI with a base URL), the AI page stops calling this.
   ========================================================================== */
(function (global) {
  'use strict';

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function int(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function fill(t, v) { return t.replace(/\{(\w+)\}/g, function (_, k) { return v[k]; }); }

  /* a price near the market's base, written the way that market is quoted */
  function near(m, spread) {
    var p = m.base + (Math.random() - 0.5) * m.vol * (spread || 6);
    return p.toLocaleString('en-US', { minimumFractionDigits: m.dp, maximumFractionDigits: m.dp });
  }

  var TF = {
    forex:       ['5m', '15m', '1h'],
    crypto:      ['5m', '15m', '1h'],
    commodities: ['5m', '15m', '1h'],
    indices:     ['5m', '15m'],
    synthetics:  ['1m', '5m']
  };

  /* reasons, by market type and direction; {level} {tf} {n} {rsi} filled in */
  var WHY = {
    forex: {
      Rise: ['Holding above the session VWAP at {level} with volume building into the open.',
             'Higher lows on the {tf} for {n} candles; the dollar side is softening.',
             'RSI {rsi} turning up from oversold on the {tf}, with a bullish divergence.',
             'Bounced twice off {level} support; buyers defending the level.'],
      Fall: ['Rejected {level} three times on the {tf}; sellers are capping rallies.',
             'Lower highs for {n} candles on the {tf}, momentum fading.',
             'RSI {rsi} rolling over from overbought, bearish divergence on the {tf}.',
             'Broke below {level} and retested it from underneath.']
    },
    crypto: {
      Rise: ['Broke the overnight range high at {level} and retested it as support.',
             'Funding still neutral while price climbs, so the move is not crowded.',
             'Reclaimed {level} on rising spot volume; shorts being squeezed.',
             'Higher lows for {n} candles on the {tf} against a flat market.'],
      Fall: ['Lower highs against bitcoin for {n} hours; relative strength fading.',
             'Lost {level} support on the {tf} with volume on the break.',
             'Funding running hot at the top of the range; longs look crowded.',
             'RSI {rsi} with price stalling under {level}.']
    },
    commodities: {
      Rise: ['Held {level} support through the last session; buyers stepping in on dips.',
             'Weaker dollar giving room above {level}.',
             'Higher lows on the {tf} for {n} candles into resistance.'],
      Fall: ['Rejected {level} three times on the {tf}.',
             'Real yields ticking up, pressing on the metal below {level}.',
             'Stalling under {level} with RSI {rsi} and falling momentum.']
    },
    indices: {
      Rise: ['Gap filled at {level}; buyers took it straight back.',
             'Opening range broken to the upside on the {tf}.',
             'Breadth improving while price holds above {level}.'],
      Fall: ['Failed at the prior high near {level}; opening range lost.',
             'Lower highs through the session on the {tf}.',
             'RSI {rsi} while price struggles under {level}.']
    },
    synthetics: {
      Rise: ['Mean-reversion setup after a two-sigma move down. Low conviction, size small.',
             'Run of {n} falling ticks is long for this index; a bounce is due.',
             'Holding {level} after a fast drop on the {tf}.'],
      Fall: ['Mean-reversion setup after a two-sigma move up. Low conviction, size small.',
             'Run of {n} rising ticks is long for this index; a pullback is due.',
             'Stalling at {level} after a fast climb on the {tf}.']
    }
  };

  var PATTERNS = [
    ['Double top', 'Fall'], ['Double bottom', 'Rise'],
    ['Bull flag', 'Rise'], ['Bear flag', 'Fall'],
    ['Head and shoulders', 'Fall'], ['Inverse head and shoulders', 'Rise'],
    ['Ascending triangle', 'Rise'], ['Descending triangle', 'Fall'],
    ['Falling wedge', 'Rise'], ['Rising wedge', 'Fall'],
    ['Breakout retest', null], ['Range break', null]
  ];

  function markets() { return (global.OrbisData && global.OrbisData.markets) || []; }

  function signals() {
    var list = markets();
    /* most scans find a handful; now and then the market is quiet */
    var n = Math.random() < 0.08 ? 0 : int(3, 7);
    return shuffle(list).slice(0, n).map(function (m) {
      var dir = Math.random() < 0.5 ? 'Rise' : 'Fall';
      var tf = pick(TF[m.cat] || ['5m']);
      /* synthetics are noise with a clock, so they never score high */
      var conf = m.cat === 'synthetics' ? int(52, 62) : Math.round(52 + Math.pow(Math.random(), 1.4) * 36);
      var stake = conf >= 75 ? pick([25, 50]) : conf >= 62 ? 25 : 10;
      var reasons = (WHY[m.cat] || WHY.forex)[dir].filter(function (t) {
        return !(m.sym === 'BTC/USD' && /bitcoin/.test(t));   /* bitcoin is not weak against itself */
      });
      var why = fill(pick(reasons), {
        level: near(m), tf: tf, n: int(4, 9), rsi: dir === 'Rise' ? int(28, 38) : int(66, 76)
      });
      return { sym: m.sym, dir: dir, conf: conf, tf: tf, stake: stake, why: why };
    }).sort(function (a, b) { return b.conf - a.conf; });
  }

  function patterns() {
    var n = Math.random() < 0.1 ? 0 : int(2, 6);
    return shuffle(markets()).slice(0, n).map(function (m) {
      var p = pick(PATTERNS);
      return { sym: m.sym, pattern: p[0], tf: pick(TF[m.cat] || ['5m']),
               bias: p[1] || (Math.random() < 0.5 ? 'Rise' : 'Fall'), mins: int(1, 58) };
    }).sort(function (a, b) { return a.mins - b.mins; })
      .map(function (p) { p.ago = p.mins === 1 ? '1 min ago' : p.mins + ' min ago'; delete p.mins; return p; });
  }

  /* one scan: steps reported as it goes, results after a believable wait */
  function scan(onStep) {
    var count = markets().length;
    var steps = ['Reading ' + count + ' markets', 'Scoring setups', 'Ranking signals'];
    var total = rnd(1600, 2800);
    return new Promise(function (resolve) {
      steps.forEach(function (s, i) {
        setTimeout(function () { if (onStep) onStep(s, i, steps.length); }, (total / steps.length) * i);
      });
      setTimeout(function () {
        resolve({ signals: signals(), patterns: patterns(), scannedAt: Date.now(), markets: count });
      }, total);
    });
  }

  global.OrbisAIEngine = { scan: scan };
})(window);
