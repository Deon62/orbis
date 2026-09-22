#!/usr/bin/env node
/* Rebuild assets/js/icons.js: only the icons this site actually uses.
 *
 * The full lucide UMD build is 436 KB for 2100 icons; we use about ninety of
 * them. This fetches the library, scans the repo for names, and writes a small
 * file with a createIcons() of the same shape. Run it after using a new icon:
 *
 *     node scripts/build-icons.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets/js/icons.js');
const CDN = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';

const pascal = k => k.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join('');

async function loadLibrary() {
  const res = await fetch(CDN);
  if (!res.ok) throw new Error('could not fetch lucide: ' + res.status);
  const src = await res.text();
  /* the UMD wrapper populates `exports`, so module.exports has to be the very
     same object or the icons land somewhere we never look */
  const mod = { exports: {} };
  const sandbox = { window: {}, self: {}, module: mod, exports: mod.exports };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const lib = mod.exports.icons ? mod.exports : (sandbox.window.lucide || sandbox.lucide);
  if (!lib || !lib.icons) throw new Error('lucide did not expose its icons');
  return lib.icons;
}

function collect(ICONS) {
  const names = new Set();
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).map(f => path.join(ROOT, f))
    .concat(fs.readdirSync(path.join(ROOT, 'assets/js'))
      .filter(f => f.endsWith('.js') && f !== 'icons.js')
      .map(f => path.join(ROOT, 'assets/js', f)));

  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/data-lucide="([a-z0-9-]+)"/g)) names.add(m[1]);
    /* names also reach the DOM through ternaries and concatenation, so keep
       every quoted kebab token that happens to be a real icon */
    for (const m of src.matchAll(/['"]([a-z][a-z0-9]*(?:-[a-z0-9]+)*)['"]/g)) {
      if (ICONS[pascal(m[1])]) names.add(m[1]);
    }
  }
  return [...names].sort();
}

(async () => {
  const ICONS = await loadLibrary();
  const used = collect(ICONS);
  const out = {};
  for (const n of used) out[n] = ICONS[pascal(n)];

  const body = `/* orbisflow, icon subset (${used.length} of ${Object.keys(ICONS).length} lucide icons).
   Regenerate with: node scripts/build-icons.js */
(function (g) {
  var I = ${JSON.stringify(out)};
  var NS = 'http://www.w3.org/2000/svg';
  var BASE = { xmlns: NS, width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none',
               stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round',
               'stroke-linejoin': 'round' };

  function build(name, cls) {
    var spec = I[name];
    if (!spec) return null;
    var svg = document.createElementNS(NS, 'svg');
    for (var k in BASE) svg.setAttribute(k, BASE[k]);
    svg.setAttribute('class', 'lucide lucide-' + name + (cls ? ' ' + cls : ''));
    spec.forEach(function (node) {
      var el = document.createElementNS(NS, node[0]);
      for (var a in node[1]) el.setAttribute(a, node[1][a]);
      svg.appendChild(el);
    });
    return svg;
  }

  function createIcons(opts) {
    var attr = (opts && opts.nameAttr) || 'data-lucide';
    document.querySelectorAll('[' + attr + ']').forEach(function (el) {
      if (el.tagName.toLowerCase() === 'svg') return;
      var svg = build(el.getAttribute(attr), el.getAttribute('class') || '');
      if (svg) el.replaceWith(svg);
    });
  }

  g.lucide = { icons: I, createIcons: createIcons };
})(window);
`;
  fs.writeFileSync(OUT, body);
  console.log(`icons: ${used.length} | ${(Buffer.byteLength(body) / 1024).toFixed(1)} KB`);
})().catch(e => { console.error(e.message); process.exit(1); });
