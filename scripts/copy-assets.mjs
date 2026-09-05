/**
 * Vendors the runtime assets the browser needs, same-origin:
 *  - pdf.js cmaps + standard fonts
 *  - tesseract.js worker + WASM cores (trimmed to the LSTM builds we use)
 *  - English OCR traineddata (gz), with validation — a build machine without
 *    network still succeeds; the app then falls back to the jsdelivr CDN at
 *    runtime (download-only, never uploads).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nm = path.join(root, 'node_modules');
const pub = path.join(root, 'client', 'public');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) throw new Error(`missing ${src}`);
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function du(p) {
  let total = 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    total += e.isDirectory() ? du(f) : fs.statSync(f).size;
  }
  return total;
}

// vite build does not clean public/ — start fresh so stale assets never ship
for (const d of ['cmaps', 'standard_fonts', 'tess', 'tessdata']) {
  fs.rmSync(path.join(pub, d), { recursive: true, force: true });
}

copyDir(path.join(nm, 'pdfjs-dist', 'cmaps'), path.join(pub, 'cmaps'));
copyDir(path.join(nm, 'pdfjs-dist', 'standard_fonts'), path.join(pub, 'standard_fonts'));

const tess = path.join(pub, 'tess');
fs.mkdirSync(tess, { recursive: true });
fs.copyFileSync(path.join(nm, 'tesseract.js', 'dist', 'worker.min.js'), path.join(tess, 'worker.min.js'));
for (const core of ['tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js']) {
  const src = path.join(nm, 'tesseract.js-core', core);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tess, core));
}

const tessdata = path.join(pub, 'tessdata');
fs.mkdirSync(tessdata, { recursive: true });
const LANG_URL = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';
try {
  const res = await fetch(LANG_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // validate: gzip magic + plausible size (defeats SPA-fallback HTML bodies)
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) throw new Error('not gzip');
  if (buf.length < 500_000) throw new Error(`suspiciously small (${buf.length} bytes)`);
  fs.writeFileSync(path.join(tessdata, 'eng.traineddata.gz'), buf);
  console.log(`[copy-assets] vendored eng.traineddata.gz (${buf.length.toLocaleString()} bytes)`);
} catch (e) {
  console.warn(`[copy-assets] WARN: could not vendor OCR language data (${e.message}) — runtime CDN fallback will be used.`);
}

console.log('[copy-assets] done:');
for (const d of ['cmaps', 'standard_fonts', 'tess', 'tessdata']) {
  const p = path.join(pub, d);
  if (fs.existsSync(p)) console.log(`  ${d}: ${(du(p) / 1e6).toFixed(1)} MB`);
}
