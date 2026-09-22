#!/usr/bin/env node
/* Strip em and en dashes from the site copy.
 *
 * They read as an affectation and they are awkward to type, so the house style
 * is: a comma where the dash joined two clauses, a hyphen where it spanned a
 * range. Run from the repo root:
 *
 *     node scripts/dedash.js          # rewrite
 *     node scripts/dedash.js --check  # list offenders, change nothing
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXT = new Set(['.html', '.css', '.js']);
const SKIP = new Set(['node_modules', '.git', 'scripts']);
const check = process.argv.includes('--check');

const RULES = [
  /* " — " joining clauses becomes a comma */
  [/\s+—\s+/g, ', '],
  /* " – " spanning a range becomes a hyphen: "1 – 2 days" -> "1-2 days" */
  [/(\d)\s*–\s*(\d)/g, '$1-$2'],
  [/\s+–\s+/g, ', '],
  /* anything left over, including a dash used on its own as a placeholder */
  [/—/g, '-'],
  [/–/g, '-'],
  /* the comma rule can double up against existing punctuation */
  [/,\s*,/g, ','],
  [/([,.:;])\s*,\s/g, '$1 '],
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

let touched = 0;
let found = 0;

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/[—–]/.test(src)) continue;

  found += (src.match(/[—–]/g) || []).length;
  const rel = path.relative(ROOT, file);

  if (check) {
    src.split('\n').forEach((line, i) => {
      if (/[—–]/.test(line)) console.log(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
    continue;
  }

  let out = src;
  for (const [re, to] of RULES) out = out.replace(re, to);
  if (out !== src) {
    fs.writeFileSync(file, out);
    console.log('rewrote', rel);
    touched++;
  }
}

console.log(check
  ? `${found} dash${found === 1 ? '' : 'es'} remaining`
  : `done: ${touched} file${touched === 1 ? '' : 's'}, ${found} dash${found === 1 ? '' : 'es'} replaced`);
