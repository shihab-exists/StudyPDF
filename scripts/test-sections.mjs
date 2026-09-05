/**
 * Unit tests for the centralised virtual-section / page-index math
 * (client/src/services/sections.ts) — compiled with the esbuild that ships
 * inside Vite, so the tests exercise the REAL shipped helpers.
 *
 *   node scripts/test-sections.mjs
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/tmp/sections-under-test.mjs';

execFileSync(
  path.join(ROOT, 'node_modules', '.bin', 'esbuild'),
  [path.join(ROOT, 'client/src/services/sections.ts'), '--format=esm', `--outfile=${OUT}`],
  { stdio: 'pipe' },
);
const S = await import(OUT);

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log(`  ✅ ${n}`); };
const bad = (n, extra) => { fail++; console.log(`  ❌ ${n} ${extra ?? ''}`); };
const eq = (name, got, want) => {
  if (got === want) ok(name);
  else bad(name, `(got ${got}, want ${want})`);
};

console.log('— section calculation (§37) —');
const CASES = [
  // totalPages, sections, final section range
  [1, 1, [1, 1]],
  [99, 1, [1, 99]],
  [100, 1, [1, 100]],
  [101, 2, [101, 101]],
  [199, 2, [101, 199]],
  [200, 2, [101, 200]],
  [201, 3, [201, 201]],
  [999, 10, [901, 999]],
  [1000, 10, [901, 1000]],
  [1001, 11, [1001, 1001]],
  [1260, 13, [1201, 1260]],
  [1261, 13, [1201, 1261]],
  [5000, 50, [4901, 5000]],
  [5432, 55, [5401, 5432]],
  [10000, 100, [9901, 10000]],
  [17843, 179, [17801, 17843]],
];
for (const [total, sections, [fs, fe]] of CASES) {
  eq(`${total} pages → ${sections} sections`, S.sectionCount(total), sections);
  const last = sections - 1;
  eq(`${total}: final section starts ${fs}`, S.sectionStart(last), fs);
  eq(`${total}: final section ends ${fe}`, S.sectionEnd(last, total), fe);
  const [rs, re] = S.sectionRange(last, total);
  if (rs !== fs || re !== fe) bad(`${total}: sectionRange final`, `(got ${rs}-${re})`);
}

console.log('— page → section mapping (§38) —');
const JUMPS = [
  [1, 0], [99, 0], [100, 0], [101, 1], [199, 1], [200, 1], [201, 2],
  [1000, 9], [1001, 10], [1260, 12], [1261, 12], [4321, 43], [5000, 49], [5432, 54], [10000, 99], [17843, 178],
];
for (const [page, sec] of JUMPS) {
  eq(`page ${page} → section ${sec + 1}`, S.sectionForPage(page), sec);
  // and the page must lie inside that section's absolute range
  const [s, e] = S.sectionRange(sec, 17843);
  if (!(page >= s && page <= e)) bad(`page ${page} inside section range`, `(got ${s}-${e})`);
}

console.log('— absolute indexing identity (§7) —');
for (const p of [1, 100, 101, 1204, 5432, 17843]) {
  eq(`human ${p} → pdf index ${p - 1} → human ${p}`, S.pdfIndexToHumanPage(S.humanPageToPdfIndex(p)), p);
}
eq('clampPage low', S.clampPage(-5, 500), 1);
eq('clampPage high', S.clampPage(99999, 500), 500);
eq('clampPage mid', S.clampPage(250, 500), 250);
eq('sectionCount(0) = 0', S.sectionCount(0), 0);
eq('SECTION_SIZE is 100', S.SECTION_SIZE, 100);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
