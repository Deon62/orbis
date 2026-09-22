/* ==========================================================================
   orbisflow, minimal QR encoder (byte mode, error correction level M).
   Versions 1 to 6, which covers any referral URL we issue, and stops short of
   the version-information blocks that versions 7 and up require.
   Renders straight to a canvas: OrbisQR.render(canvas, text).
   ========================================================================== */
(function (g) {
  'use strict';

  /* data codewords, EC codewords per block, and block layout, for level M */
  var VERSIONS = {
    1: { data: 16,  ec: 10, blocks: [1] },
    2: { data: 28,  ec: 16, blocks: [1] },
    3: { data: 44,  ec: 26, blocks: [1] },
    4: { data: 64,  ec: 18, blocks: [2] },
    5: { data: 86,  ec: 24, blocks: [2] },
    6: { data: 108, ec: 16, blocks: [4] }
  };
  var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

  /* 15-bit BCH format strings for level M, one per mask */
  var FORMAT = [
    '101010000010010', '101000100100101', '101111001111100', '101101101001011',
    '100010111111001', '100000011001110', '100111110010111', '100101010100000'
  ];

  /* ------------------------------------------------------- GF(256) ------- */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function mul(a, b) { return (a && b) ? EXP[LOG[a] + LOG[b]] : 0; }

  function generator(n) {
    var poly = [1];
    for (var i = 0; i < n; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= mul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function ecBytes(data, n) {
    var gen = generator(n);
    var rem = data.concat(new Array(n).fill(0));
    for (var i = 0; i < data.length; i++) {
      var factor = rem[i];
      if (!factor) continue;
      for (var j = 0; j < gen.length; j++) rem[i + j] ^= mul(gen[j], factor);
    }
    return rem.slice(data.length);
  }

  /* --------------------------------------------------------- encode ------ */
  function bitStream(text) {
    var utf8 = unescape(encodeURIComponent(text));
    var bytes = [];
    for (var i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));

    var version = 0;
    for (var v = 1; v <= 6; v++) {
      /* 4 bits mode + 8 bits length + payload */
      if (bytes.length + 2 <= VERSIONS[v].data) { version = v; break; }
    }
    if (!version) throw new Error('QR: text too long for version 6');

    var cfg = VERSIONS[version];
    var bits = [];
    function push(value, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
    }

    push(4, 4);                 /* byte mode */
    push(bytes.length, 8);
    bytes.forEach(function (b) { push(b, 8); });

    var capacity = cfg.data * 8;
    for (var t = 0; t < 4 && bits.length < capacity; t++) bits.push(0);
    while (bits.length % 8) bits.push(0);

    var words = [];
    for (var k = 0; k < bits.length; k += 8) {
      words.push(parseInt(bits.slice(k, k + 8).join(''), 2));
    }
    var pad = [0xEC, 0x11], p = 0;
    while (words.length < cfg.data) words.push(pad[p++ % 2]);

    /* split into blocks, then interleave data and EC */
    var count = cfg.blocks[0];
    var per = cfg.data / count;
    var dataBlocks = [], ecBlocks = [];
    for (var b = 0; b < count; b++) {
      var block = words.slice(b * per, (b + 1) * per);
      dataBlocks.push(block);
      ecBlocks.push(ecBytes(block, cfg.ec));
    }

    var out = [];
    for (var i2 = 0; i2 < per; i2++) {
      for (var b2 = 0; b2 < count; b2++) out.push(dataBlocks[b2][i2]);
    }
    for (var i3 = 0; i3 < cfg.ec; i3++) {
      for (var b3 = 0; b3 < count; b3++) out.push(ecBlocks[b3][i3]);
    }
    return { version: version, codewords: out };
  }

  /* --------------------------------------------------------- matrix ------ */
  function build(text) {
    var enc = bitStream(text);
    var version = enc.version;
    var size = 17 + version * 4;

    var m = [], reserved = [];
    for (var r = 0; r < size; r++) {
      m.push(new Array(size).fill(0));
      reserved.push(new Array(size).fill(false));
    }

    function set(r, c, v) { m[r][c] = v; reserved[r][c] = true; }

    function finder(r0, c0) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          var rr = r0 + r, cc = c0 + c;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          var edge = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                     (c >= 0 && c <= 6 && (r === 0 || r === 6));
          var core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          set(rr, cc, (edge || core) ? 1 : 0);
        }
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    for (var i = 8; i < size - 8; i++) {
      var bit = i % 2 === 0 ? 1 : 0;
      set(6, i, bit); set(i, 6, bit);
    }

    ALIGN[version].forEach(function (ar) {
      ALIGN[version].forEach(function (ac) {
        if (reserved[ar][ac]) return;           /* skips the finder corners */
        for (var r = -2; r <= 2; r++) {
          for (var c = -2; c <= 2; c++) {
            var ring = Math.max(Math.abs(r), Math.abs(c));
            set(ar + r, ac + c, ring !== 1 ? 1 : 0);
          }
        }
      });
    });

    set(size - 8, 8, 1);                        /* the always-dark module */

    /* reserve the format areas before laying data down */
    for (var f = 0; f < 9; f++) {
      if (!reserved[8][f]) reserved[8][f] = true;
      if (!reserved[f][8]) reserved[f][8] = true;
    }
    for (var f2 = 0; f2 < 8; f2++) {
      reserved[8][size - 1 - f2] = true;
      reserved[size - 1 - f2][8] = true;
    }

    /* zigzag the codewords in from the bottom right */
    var bits = [];
    enc.codewords.forEach(function (w) {
      for (var i = 7; i >= 0; i--) bits.push((w >> i) & 1);
    });

    var idx = 0, up = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;                     /* the vertical timing line */
      for (var n = 0; n < size; n++) {
        var row = up ? size - 1 - n : n;
        for (var s = 0; s < 2; s++) {
          var c2 = col - s;
          if (reserved[row][c2]) continue;
          m[row][c2] = idx < bits.length ? bits[idx++] : 0;
        }
      }
      up = !up;
    }

    /* mask, then keep whichever pattern looks least streaky */
    var MASKS = [
      function (r, c) { return (r + c) % 2 === 0; },
      function (r) { return r % 2 === 0; },
      function (r, c) { return c % 3 === 0; },
      function (r, c) { return (r + c) % 3 === 0; },
      function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
      function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
      function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
      function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }
    ];

    function penalty(grid) {
      var score = 0, dark = 0;
      for (var r = 0; r < size; r++) {
        for (var c = 0; c < size; c++) {
          if (grid[r][c]) dark++;
          [[0, 1], [1, 0]].forEach(function (d) {
            var run = 1;
            while (true) {
              var rr = r + d[0] * run, cc = c + d[1] * run;
              if (rr >= size || cc >= size || grid[rr][cc] !== grid[r][c]) break;
              run++;
            }
            if (run >= 5) score += 3 + (run - 5);
          });
        }
      }
      score += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
      return score;
    }

    var best = null, bestScore = Infinity, bestMask = 0;
    for (var k = 0; k < 8; k++) {
      var grid = m.map(function (row) { return row.slice(); });
      for (var r2 = 0; r2 < size; r2++) {
        for (var c3 = 0; c3 < size; c3++) {
          if (!reserved[r2][c3] && MASKS[k](r2, c3)) grid[r2][c3] ^= 1;
        }
      }
      placeFormat(grid, size, FORMAT[k]);
      var sc = penalty(grid);
      if (sc < bestScore) { bestScore = sc; best = grid; bestMask = k; }
    }

    return { size: size, modules: best, version: version, mask: bestMask };
  }

  function placeFormat(grid, size, bitsStr) {
    /* the string is most-significant bit first, and that is the order the
       modules take, so b[i] goes to position i in both copies */
    var b = bitsStr.split('').map(Number);

    /* copy one: along the top-left finder, left to right then bottom to top */
    var coords = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
                  [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
    for (var i = 0; i < 15; i++) grid[coords[i][0]][coords[i][1]] = b[i];

    /* copy two: seven bits up the bottom-left finder, stopping short of the
       always-dark module, then eight bits across to the top-right */
    for (var j = 0; j <= 6; j++) grid[size - 1 - j][8] = b[j];
    for (var k = 7; k <= 14; k++) grid[8][size - 8 + (k - 7)] = b[k];
  }

  /* --------------------------------------------------------- render ------ */
  function render(canvas, text, opts) {
    opts = opts || {};
    var qr = build(text);
    var quiet = opts.quiet === undefined ? 4 : opts.quiet;
    var total = qr.size + quiet * 2;
    var px = opts.scale || Math.max(2, Math.floor((opts.size || 180) / total));
    var dim = total * px;

    canvas.width = dim;
    canvas.height = dim;
    canvas.style.width = (opts.size || dim) + 'px';
    canvas.style.height = (opts.size || dim) + 'px';

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = opts.light || '#FFFFFF';
    ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = opts.dark || '#1C1C1C';
    for (var r = 0; r < qr.size; r++) {
      for (var c = 0; c < qr.size; c++) {
        if (qr.modules[r][c]) ctx.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
      }
    }
    return qr;
  }

  g.OrbisQR = { build: build, render: render };
})(typeof window !== 'undefined' ? window : globalThis);
