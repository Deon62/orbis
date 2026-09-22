/* ==========================================================================
   orbisflow, canvas candlestick chart
   Colours are read from the active theme, so light/dark just works.
   Replace generate()/tick() with a real price feed when the backend exists.
   ========================================================================== */
(function (global) {
  'use strict';

  var instances = [];

  function themeColors(el) {
    var cs = getComputedStyle(el || document.documentElement);
    function v(name, fallback) {
      var out = cs.getPropertyValue(name).trim();
      return out || fallback;
    }
    return {
      grid: v('--chart-grid', '#EDEBE6'),
      axis: v('--chart-axis', '#93928C'),
      up:   v('--up', '#00A861'),
      down: v('--down', '#E0413F'),
      on:   v('--panel', '#FFFFFF')
    };
  }

  function rnd(seed) {
    var s = seed || 1;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function generate(n, start, vol, seed) {
    var r = rnd(seed), out = [], price = start;
    for (var i = 0; i < n; i++) {
      var open = price;
      var close = Math.max(0.0001, open + (r() - 0.48) * vol);
      var wick = vol * (0.35 + r() * 0.9);
      out.push({ o: open, c: close, h: Math.max(open, close) + wick * r(), l: Math.min(open, close) - wick * r() });
      price = close;
    }
    return out;
  }

  function fmt(v) {
    if (v >= 1000) return v.toFixed(2);
    if (v >= 10)   return v.toFixed(3);
    return v.toFixed(5);
  }

  function Chart(canvas, opts) {
    opts = opts || {};
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.count = opts.count || 140;        /* candles kept in memory */
    this.view = opts.view || 72;           /* candles actually drawn */
    this.minView = 24;
    this.vol = opts.vol || 0.0018;
    this.data = generate(this.count, opts.start || 1.0842, this.vol, opts.seed || 7);
    this.onZoom = opts.onZoom || function () {};
    this.padR = opts.padR === undefined ? 58 : opts.padR;
    this.padB = opts.padB === undefined ? 22 : opts.padB;
    this.padT = 14;
    this.onPrice = opts.onPrice || function () {};
    this.ticks = 0;
    this.barTicks = opts.barTicks || 6;
    this.C = themeColors(canvas);
    this.type = opts.type || 'candle';     /* 'candle' or 'line' */
    this.smas = [];                        /* moving-average overlays */

    this.resize();
    var self = this;
    this._ro = new ResizeObserver(function () { self.resize(); self.draw(); });
    this._ro.observe(canvas.parentElement || canvas);
    this.draw();
    this.start(opts.interval || 1100);
    instances.push(this);
  }

  Chart.prototype.retheme = function () { this.C = themeColors(this.cv); this.draw(); };

  Chart.prototype.visible = function () { return this.data.slice(-this.view); };

  Chart.prototype.setType = function (t) { this.type = t; this.draw(); };
  Chart.prototype.setSmas = function (list) { this.smas = list || []; this.draw(); };

  /* dir > 0 zooms in (fewer, wider candles), dir < 0 zooms out */
  Chart.prototype.zoom = function (dir) {
    var next = Math.round(dir > 0 ? this.view * 0.75 : this.view / 0.75);
    this.view = Math.max(this.minView, Math.min(this.data.length, next));
    this.draw();
    this.onZoom(this.view, this.view <= this.minView, this.view >= this.data.length);
  };

  Chart.prototype.resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var r = this.cv.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * dpr);
    this.cv.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  Chart.prototype.range = function () {
    var d = this.visible();
    var hi = -Infinity, lo = Infinity;
    for (var i = 0; i < d.length; i++) {
      if (d[i].h > hi) hi = d[i].h;
      if (d[i].l < lo) lo = d[i].l;
    }
    var pad = (hi - lo) * 0.12 || 0.001;
    return { hi: hi + pad, lo: lo - pad };
  };

  Chart.prototype.draw = function () {
    var ctx = this.ctx, w = this.w, h = this.h, C = this.C;
    if (!w || !h) return;
    var plotW = w - this.padR, plotH = h - this.padB - this.padT;
    var rg = this.range(), span = rg.hi - rg.lo;
    var self = this;
    var y = function (p) { return self.padT + (rg.hi - p) / span * plotH; };

    ctx.clearRect(0, 0, w, h);
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;

    for (var g = 0; g <= 5; g++) {
      var gy = this.padT + (plotH / 5) * g;
      ctx.strokeStyle = C.grid;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(gy) + 0.5);
      ctx.lineTo(plotW, Math.round(gy) + 0.5);
      ctx.stroke();
      ctx.fillStyle = C.axis;
      ctx.textAlign = 'left';
      ctx.fillText(fmt(rg.hi - (span / 5) * g), plotW + 9, gy);
    }

    var slots = 6, now = Date.now();
    ctx.textAlign = 'center';
    for (var v = 1; v < slots; v++) {
      var vx = Math.round((plotW / slots) * v) + 0.5;
      ctx.strokeStyle = C.grid;
      ctx.beginPath();
      ctx.moveTo(vx, this.padT);
      ctx.lineTo(vx, this.padT + plotH);
      ctx.stroke();
      var t = new Date(now - (slots - v) * 9 * 60000);
      ctx.fillStyle = C.axis;
      ctx.fillText(('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2), vx, h - this.padB / 2);
    }

    var series = this.visible();
    var step = plotW / series.length;
    var bw = Math.max(2, Math.min(18, step * 0.62));

    if (this.type === 'line') {
      ctx.strokeStyle = series[series.length - 1].c >= series[0].c ? C.up : C.down;
      ctx.lineWidth = 2;
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      for (var li = 0; li < series.length; li++) {
        var lx = step * li + step / 2, lyy = y(series[li].c);
        li ? ctx.lineTo(lx, lyy) : ctx.moveTo(lx, lyy);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
    } else {
      for (var i = 0; i < series.length; i++) {
        var d = series[i];
        var cx = Math.round(step * i + step / 2);
        ctx.strokeStyle = ctx.fillStyle = d.c >= d.o ? C.up : C.down;
        ctx.beginPath();
        ctx.moveTo(cx + 0.5, y(d.h));
        ctx.lineTo(cx + 0.5, y(d.l));
        ctx.stroke();
        var top = y(Math.max(d.o, d.c));
        var bh = Math.max(1, Math.abs(y(d.o) - y(d.c)));
        ctx.fillRect(Math.round(cx - bw / 2), Math.round(top), Math.round(bw), Math.round(bh));
      }
    }

    /* moving averages ride over whichever mark type is showing */
    this.smas.forEach(function (sma) {
      var pts = [];
      for (var i = sma.period - 1; i < series.length; i++) {
        var sum = 0;
        for (var k = i + 1 - sma.period; k <= i; k++) sum += series[k].c;
        pts.push([step * i + step / 2, y(sum / sma.period)]);
      }
      if (pts.length < 2) return;
      ctx.strokeStyle = sma.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var j = 0; j < pts.length; j++) {
        j ? ctx.lineTo(pts[j][0], pts[j][1]) : ctx.moveTo(pts[j][0], pts[j][1]);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
    });

    var last = this.data[this.data.length - 1];
    var ly = Math.round(y(last.c)) + 0.5;
    var col = last.c >= last.o ? C.up : C.down;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(plotW, ly);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = col;
    ctx.fillRect(plotW + 4, ly - 10, this.padR - 6, 20);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(fmt(last.c), plotW + 9, ly);
  };

  Chart.prototype.tick = function () {
    var last = this.data[this.data.length - 1];
    last.c = Math.max(0.0001, last.c + (Math.random() - 0.5) * this.vol * 0.9);
    last.h = Math.max(last.h, last.c);
    last.l = Math.min(last.l, last.c);
    this.ticks++;
    if (this.ticks % this.barTicks === 0) {
      this.data.push({ o: last.c, c: last.c, h: last.c, l: last.c });
      if (this.data.length > this.count) this.data.shift();
    }
    this.draw();
    this.onPrice(last.c, last.c >= last.o);
  };

  Chart.prototype.start = function (ms) {
    var self = this;
    this.stop();
    this._t = setInterval(function () { self.tick(); }, ms);
  };
  Chart.prototype.stop = function () { clearInterval(this._t); };

  Chart.prototype.reseed = function (o) {
    this.vol = o.vol || this.vol;
    this.data = generate(this.count, o.start, this.vol, o.seed || Math.random() * 999);
    this.draw();
  };

  /* --------------------------------------------------------- sparkline -- */
  function sparkline(canvas, seed, rising) {
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var r = canvas.getBoundingClientRect();
    var w = r.width || 78, h = r.height || 28;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var C = themeColors(canvas);
    var pts = generate(26, 100, 2.2, seed).map(function (d) { return d.c; });
    var hi = Math.max.apply(null, pts), lo = Math.min.apply(null, pts);
    var span = (hi - lo) || 1;
    ctx.strokeStyle = rising ? C.up : C.down;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach(function (p, i) {
      var x = (w / (pts.length - 1)) * i;
      var yy = h - 3 - ((p - lo) / span) * (h - 6);
      i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
    });
    ctx.stroke();
  }

  /* app.js calls this after a theme switch */
  global.orbisChartTheme = function () {
    instances.forEach(function (c) { c.retheme(); });
    if (global.OrbisData) global.OrbisData.drawSparklines();
  };

  global.OrbisChart = {
    create: function (canvas, opts) { return new Chart(canvas, opts); },
    sparkline: sparkline,
    generate: generate,
    fmt: fmt
  };
})(window);
