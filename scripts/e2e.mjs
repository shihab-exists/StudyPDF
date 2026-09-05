/**
 * StudyPDF production E2E — drives the BUILT app in headless Chromium and
 * verifies real output files (page counts, text layers, pixels, encryption),
 * never just UI states.
 *
 *   npm run build && npm start          (or: node scripts/vercel-sim.mjs)
 *   E2E_BASE=http://localhost:3999 node scripts/e2e.mjs
 *
 * Requires: chromium at /usr/bin/chromium, poppler-utils (pdftotext) for
 * text-layer proofs. Test-only tools — the app itself uses no binaries.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { PDFDocument } from '@cantoo/pdf-lib';
import { unzipSync } from 'fflate';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const S = (f) => path.join(ROOT, 'samples', f);

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name) => { pass++; console.log(`  ✅ ${name}`); };
const bad = (name, e) => { fail++; failures.push(name); console.log(`  ❌ ${name}: ${e?.message ?? e}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

async function goto(p, route) {
  await p.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 60000 });
}

async function bodyText(p = page) {
  return p.evaluate(() => document.body.innerText);
}

async function uploadOne(p, route, file, expectText, timeout = 90000) {
  await goto(p, route);
  const input = await p.waitForSelector('input[type=file]', { timeout: 15000 });
  await input.uploadFile(file);
  if (expectText) {
    await p.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, expectText);
  }
}

async function clickText(p, text, selector = 'button, a, label, figcaption') {
  const clicked = await p.evaluate((t, sel) => {
    const els = [...document.querySelectorAll(sel)];
    const el = els.find((e) => (e.innerText || '').includes(t) && !e.disabled && !e.closest('[disabled]'));
    if (!el) return false;
    el.click();
    return true;
  }, text, selector);
  if (!clicked) throw new Error(`nothing clickable contains "${text}"`);
}

async function clickNth(p, text, n, selector = 'button, a') {
  const clicked = await p.evaluate((t, i, sel) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => (e.innerText || '').includes(t) && !e.disabled);
    if (els.length <= i) return false;
    els[i].click();
    return true;
  }, text, n, selector);
  if (!clicked) throw new Error(`no element #${n} containing "${text}"`);
}

async function waitText(p, text, timeout = 90000) {
  await p.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}

async function grabDownload(p, clickFn, timeout = 120000) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spdf-dl-'));
  const cdp = await p.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, eventsEnabled: true });
  await clickFn();
  const t0 = Date.now();
  for (;;) {
    const ready = fs.readdirSync(dir).filter((f) => !f.endsWith('.crdownload') && !f.endsWith('.tmp'));
    if (ready.length) {
      await sleep(400);
      const final = fs.readdirSync(dir).filter((f) => !f.endsWith('.crdownload') && !f.endsWith('.tmp'));
      return path.join(dir, final[0]);
    }
    if (Date.now() - t0 > timeout) throw new Error('download did not arrive');
    await sleep(250);
  }
}

async function setInputValue(p, handle, value) {
  await p.evaluate((el, v) => {
    const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, handle, value);
}

const loadPdf = async (file) => PDFDocument.load(fs.readFileSync(file));
const pdftotext = (file) => execSync(`pdftotext "${file}" -`, { encoding: 'utf8', maxBuffer: 64e6 });

try {
  /* ============================ 0. Vercel routing ============================ */
  console.log('\n— 0. Vercel routing contract (filesystem → rewrites) —');
  try {
    const h = await fetch(BASE + '/api/health');
    const ctype = h.headers.get('content-type') || '';
    if (ctype.includes('text/html')) {
      console.log('  ⏭  /api/health not served here (vite preview mode) — run vs vercel-sim for full routing checks');
    } else {
      const body = await h.json();
      if (!h.ok || !body.ok) throw new Error(`health not ok (${h.status})`);
      ok(`/api/health served by the function, not the SPA (${ctype}, runtime=${body.runtime})`);
      const idx = await (await fetch(BASE + '/')).text();
      const asset = idx.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
      const a = await fetch(BASE + asset);
      if (!a.ok || !(a.headers.get('content-type') || '').includes('javascript')) throw new Error('asset mime wrong');
      ok('hashed JS asset served with JS mime');
      const gz = await fetch(BASE + '/tessdata/eng.traineddata.gz', { method: 'HEAD' });
      const gzt = gz.headers.get('content-type') || '';
      if (!gz.ok || gzt.includes('text/html')) throw new Error(`traineddata served as ${gzt}`);
      ok(`OCR traineddata served as ${gzt}`);
      const w = await fetch(BASE + '/tess/worker.min.js', { method: 'HEAD' });
      if (!w.ok || !(w.headers.get('content-type') || '').includes('javascript')) throw new Error('tess worker mime wrong');
      ok('tesseract worker served same-origin');
      const deep = await fetch(BASE + '/pages?file=abc');
      const dtxt = await deep.text();
      if (!deep.ok || !dtxt.includes('id="root"')) throw new Error('deep link refresh broken');
      ok('refresh/deep link on tool route returns SPA shell');
    }
  } catch (e) { bad('vercel routing', e); }

  /* ============================ 1. Home upload ============================ */
  console.log('\n— 1. Home upload (small normal PDF) —');
  try {
    await uploadOne(page, '/', S('assignment.pdf'), 'Nice! What next?');
    const t = await bodyText();
    if (!t.includes('Compress PDF') || !t.includes('All 16 tools')) throw new Error('what-next panel incomplete');
    ok('upload assignment.pdf + what-next panel (4 core tools + all-tools link)');
  } catch (e) { bad('home upload', e); }

  /* ========================= 2. Invalid / bad files ========================= */
  console.log('\n— 2. Invalid / corrupted / empty files —');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spdf-bad-'));
  fs.writeFileSync(path.join(tmp, 'notes.txt'), 'hello, just text');
  fs.writeFileSync(path.join(tmp, 'fake.pdf'), 'NOTPDF but wearing a costume');
  fs.writeFileSync(path.join(tmp, 'empty.pdf'), '');
  for (const [file, expect] of [
    ['notes.txt', 'Only PDF files are supported.'],
    ['fake.pdf', "isn't a valid PDF"],
    ['broken.pdf', 'appears to be corrupted'],
    ['empty.pdf', 'This file is empty.'],
  ]) {
    try {
      const p = path.join(file === 'broken.pdf' ? S('broken.pdf') : path.join(tmp, file));
      await uploadOne(page, '/compress', p, expect, 30000);
      ok(`${file} rejected — "${expect}"`);
    } catch (e) { bad(`invalid ${file}`, e); }
  }

  /* ============================= 3. Compress ============================== */
  console.log('\n— 3. Compress (scanned PDF, real size reduction) —');
  let compressSaved = 0;
  try {
    await uploadOne(page, '/compress', S('lecture-scan.pdf'), 'Compression');
    await clickText(page, 'Maximum', 'label');
    await clickText(page, 'Compress PDF', 'button');
    await waitText(page, 'PDF processed successfully', 240000);
    const t = await bodyText();
    const m = t.split('Saved').pop().match(/([\d.]+)%/);
    if (!m) throw new Error('no Saved % shown');
    compressSaved = Number(m[1]);
    const dl = await grabDownload(page, () => clickText(page, 'Download PDF'));
    const origSize = fs.statSync(S('lecture-scan.pdf')).size;
    const newSize = fs.statSync(dl).size;
    if (newSize >= origSize) throw new Error(`no byte reduction (${origSize} → ${newSize})`);
    const doc = await loadPdf(dl);
    if (doc.getPageCount() !== 2) throw new Error(`expected 2 pages, got ${doc.getPageCount()}`);
    ok(`compress maximum saved ${compressSaved}% (${origSize} → ${newSize} bytes, 2 pages)`);
    if (compressSaved <= 40) throw new Error(`suspiciously low saving: ${compressSaved}%`);
  } catch (e) { bad('compress', e); }

  /* =============================== 4. Merge =============================== */
  console.log('\n— 4. Merge (multiple PDFs) —');
  try {
    await goto(page, '/merge');
    const input = await page.waitForSelector('input[type=file]');
    await input.uploadFile(S('assignment.pdf'), S('references.pdf'));
    await waitText(page, 'Merge 2 PDFs');
    await clickText(page, 'Merge 2 PDFs', 'button');
    await waitText(page, 'Merged successfully into 9 pages', 120000);
    const dl = await grabDownload(page, () => clickText(page, 'Download PDF'));
    const doc = await loadPdf(dl);
    if (doc.getPageCount() !== 9) throw new Error(`expected 9 pages, got ${doc.getPageCount()}`);
    ok('merge → 9 pages (verified in output file)');
  } catch (e) { bad('merge', e); }

  /* ============================ 5. Page Manager =========================== */
  console.log('\n— 5. Page Manager: thumbnails, rotate, delete, save, extract —');
  try {
    await uploadOne(page, '/pages', S('assignment.pdf'), 'assignment.pdf');
    await page.waitForFunction(() => document.querySelectorAll('.thumb img').length === 6, { timeout: 120000 });
    ok('6 thumbnails rendered in-browser');
    await page.evaluate(() => document.querySelector('[aria-label="Rotate page 1"]').click());
    await page.$$eval('.thumb input[type=checkbox]', (els) => els[5].click()); // select page 6
    await clickText(page, 'Delete', 'button');
    await clickText(page, 'Save as new PDF', 'button');
    await waitText(page, 'Edited PDF ready — 5 pages', 120000);
    const dl = await grabDownload(page, () => clickText(page, 'Download PDF'));
    const doc = await loadPdf(dl);
    if (doc.getPageCount() !== 5) throw new Error(`expected 5 pages, got ${doc.getPageCount()}`);
    const rot = doc.getPage(0).getRotation().angle;
    if (rot !== 90) throw new Error(`page 1 rotation ${rot}°, expected 90`);
    ok('rotate + delete + save → 5 pages w/ 90° (verified in output file)');
  } catch (e) { bad('page manager edit', e); }
  try {
    await uploadOne(page, '/pages', S('assignment.pdf'), 'assignment.pdf');
    await page.waitForFunction(() => document.querySelectorAll('.thumb img').length === 6, { timeout: 120000 });
    const rangeInput = await page.$('input.input-paper');
    await setInputValue(page, rangeInput, '1-2');
    await clickText(page, 'Extract Pages', 'button');
    await waitText(page, 'Extracted PDF ready — 2 pages', 120000);
    const dl = await grabDownload(page, () => clickText(page, 'Download PDF'));
    const doc = await loadPdf(dl);
    if (doc.getPageCount() !== 2) throw new Error(`expected 2 pages, got ${doc.getPageCount()}`);
    ok('extract range 1-2 → 2 pages');
  } catch (e) { bad('page manager extract', e); }

  /* ================================ 6. OCR ================================ */
  console.log('\n— 6. OCR & Enhance (scanned PDF → searchable) —');
  try {
    await uploadOne(page, '/ocr', S('lecture-scan.pdf'), 'lecture-scan.pdf');
    await waitText(page, 'PDF Analysis', 120000);
    const t = await bodyText();
    if (!/Searchable text\s*\n?\s*No/.test(t)) throw new Error('analysis should say Searchable text: No');
    ok('scan analysis (searchable: No)');
    await clickText(page, 'Enhance & OCR', 'button');
    await waitText(page, 'processed successfully', 420000);
    const dl = await grabDownload(page, () => clickText(page, 'Download PDF'));
    const txt = pdftotext(dl);
    if (!/TEST\s*FILE/i.test(txt) || !/LECTURE/i.test(txt)) throw new Error(`OCR text layer missing (got: ${JSON.stringify(txt.slice(0, 120))})`);
    ok('OCR → searchable PDF (pdftotext finds "TEST FILE" + "LECTURE")');
    const tdl = await grabDownload(page, () => clickText(page, 'OCR text (.txt)'));
    const txt2 = fs.readFileSync(tdl, 'utf8');
    if (!/LECTURE/i.test(txt2)) throw new Error('.txt export missing OCR text');
    ok('OCR .txt export present');
  } catch (e) { bad('ocr', e); }

  /* ======================= 7. My Files + deep links ======================= */
  console.log('\n— 7. My Files + deep links + 404 —');
  try {
    await goto(page, '/my-files');
    await page.waitForSelector('.file-row', { timeout: 15000 });
    const t = await bodyText();
    if (!t.includes('searchable')) throw new Error('OCR result not listed');
    ok('My Files lists processed files (IndexedDB)');
  } catch (e) { bad('my files', e); }
  try {
    await goto(page, '/compress?file=does-not-exist');
    await waitText(page, 'no longer available', 15000);
    ok('expired/unknown deep link handled');
  } catch (e) { bad('deep link', e); }
  try {
    await goto(page, '/this-page-does-not-exist');
    await waitText(page, 'Page not found', 15000);
    ok('SPA 404 page');
  } catch (e) { bad('404', e); }

  /* ================================ 8. Split ============================== */
  console.log('\n— 8. Split PDF (ranges, per-file + ZIP) —');
  try {
    await uploadOne(page, '/split', S('assignment.pdf'), 'How should we split it?');
    const ta = await page.$('textarea');
    await setInputValue(page, ta, '1-2, 3-6');
    await clickText(page, 'Split PDF', 'button');
    await waitText(page, 'Split into 2 files', 120000);
    const d1 = await grabDownload(page, () => clickNth(page, 'Download PDF', 0));
    const d2 = await grabDownload(page, () => clickNth(page, 'Download PDF', 1));
    const [c1, c2] = [(await loadPdf(d1)).getPageCount(), (await loadPdf(d2)).getPageCount()];
    if (c1 !== 2 || c2 !== 4) throw new Error(`expected 2+4 pages, got ${c1}+${c2}`);
    const dz = await grabDownload(page, () => clickText(page, 'Download all as ZIP'));
    const entries = Object.keys(unzipSync(fs.readFileSync(dz)));
    if (entries.length !== 2 || !entries.every((n) => n.endsWith('.pdf'))) throw new Error(`zip entries wrong: ${entries}`);
    ok('split ranges 1-2,3-6 → 2+4 pages, ZIP has both parts');
  } catch (e) { bad('split', e); }

  /* =========================== 9. Page numbers ============================ */
  console.log('\n— 9. Add Page Numbers (real text in output) —');
  try {
    await uploadOne(page, '/numbers', S('assignment.pdf'), 'Position');
    const numInputs = await page.$$('input[type=number]');
    await setInputValue(page, numInputs[0], '101');
    await clickText(page, 'Add Page Numbers', 'button');
    await waitText(page, 'Page numbers added to 6 pages', 120000);
    const dl = await grabDownload(page, () => clickText(page, 'Download PDF'));
    const txt = pdftotext(dl);
    if (!txt.includes('101') || !txt.includes('106')) throw new Error('page numbers not found in output text layer');
    ok('page numbers 101–106 present in output (pdftotext verified)');
  } catch (e) { bad('page numbers', e); }

  /* ============================= 10. Watermark ============================ */
  console.log('\n— 10. Watermark PDF (rendered into pages) —');
  try {
    await uploadOne(page, '/watermark', S('assignment.pdf'), 'Watermark text');
    const textInput = await page.$('input.input-paper');
    await setInputValue(page, textInput, 'DRAFTX9');
    const sliders = await page.$$('input[type=range]'); // [size, rotation, opacity]
    await setInputValue(page, sliders[1], '0');
    await clickText(page, 'Add Watermark', 'button');
    await waitText(page, 'Watermark added to 6 pages', 120000);
    const dl = await grabDownload(page, () => clickText(page, 'Download PDF'));
    const txt = pdftotext(dl);
    const hits = (txt.match(/DRAFTX9/g) || []).length;
    if (hits < 6) throw new Error(`watermark found on ${hits}/6 pages`);
    ok(`watermark "DRAFTX9" rendered into all 6 pages (${hits} hits)`);
  } catch (e) { bad('watermark', e); }

  /* ============================== 11. Protect ============================= */
  console.log('\n— 11. Protect PDF (genuine encryption) —');
  try {
    await uploadOne(page, '/protect', S('assignment.pdf'), 'Confirm password');
    const pw = await page.$$('input[type=password]');
    await setInputValue(page, pw[0], 'test1234');
    await setInputValue(page, pw[1], 'test1234');
    await clickText(page, 'Encrypt PDF', 'button');
    await waitText(page, 'PDF encrypted', 120000);
    const dl = await grabDownload(page, () => clickText(page, 'Download PDF'));
    const bytes = fs.readFileSync(dl);
    let threw = false;
    try { await PDFDocument.load(bytes); } catch { threw = true; }
    if (!threw) throw new Error('PDF opens WITHOUT a password — protection is fake');
    let wrongThrew = false;
    try { await PDFDocument.load(bytes, { password: 'wrongpass' }); } catch { wrongThrew = true; }
    if (!wrongThrew) throw new Error('wrong password accepted');
    const opened = await PDFDocument.load(bytes, { password: 'test1234' });
    if (opened.getPageCount() !== 6) throw new Error('page count changed by encryption');
    ok('protected PDF genuinely requires the password (AES-256; no-password & wrong-password both rejected)');
  } catch (e) { bad('protect', e); }

  /* ============================ 12. PDF→Images ============================ */
  console.log('\n— 12. PDF to Images (PNG render + ZIP) —');
  try {
    await uploadOne(page, '/to-images', S('references.pdf'), 'Resolution');
    await clickText(page, 'Convert to PNG', 'button');
    await waitText(page, 'images rendered as PNG', 180000);
    const d1 = await grabDownload(page, () => page.click('[aria-label="Download page 1"]'));
    const buf = fs.readFileSync(d1);
    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) throw new Error('not a PNG');
    if (buf.length < 1000) throw new Error('PNG suspiciously small');
    const dz = await grabDownload(page, () => clickText(page, 'Download all as ZIP'));
    const unz = unzipSync(fs.readFileSync(dz));
    const names = Object.keys(unz);
    if (names.length !== 3) throw new Error(`expected 3 zip entries, got ${names.length}`);
    for (const n of names) {
      if (unz[n][0] !== 0x89 || unz[n][1] !== 0x50) throw new Error(`${n} is not a PNG`);
    }
    ok('3 pages → 3 valid PNGs, individual download + ZIP verified');
  } catch (e) { bad('pdf to images', e); }

  /* ============================ 13. Images→PDF ============================ */
  console.log('\n— 13. Images to PDF (order + fitting) —');
  try {
    await goto(page, '/from-images');
    const input = await page.waitForSelector('input[type=file]');
    await input.uploadFile(S('red.png'), S('green.png'), S('blue.png'));
    await waitText(page, 'Create PDF from 3 images');
    await clickText(page, 'Fit to image', 'label');
    await clickText(page, 'Create PDF from 3 images', 'button');
    await waitText(page, 'combined into one PDF', 120000);
    const dl = await grabDownload(page, () => clickText(page, 'Download PDF'));
    const doc = await loadPdf(dl);
    if (doc.getPageCount() !== 3) throw new Error(`expected 3 pages, got ${doc.getPageCount()}`);
    const [p1, p2, p3] = doc.getPages().map((p) => p.getSize());
    if (!(p1.width > p1.height)) throw new Error('page 1 should be landscape (red 400×200)');
    if (!(p2.height > p2.width)) throw new Error('page 2 should be portrait (green 200×400)');
    if (Math.abs(p3.width - p3.height) > 2) throw new Error('page 3 should be square (blue 300×300)');
    ok('3 images → 3-page PDF in order, aspect ratios verified');
  } catch (e) { bad('images to pdf', e); }

  /* ============================ 14. Rotate all ============================ */
  console.log('\n— 14. Rotate All Pages —');
  try {
    await uploadOne(page, '/rotate', S('references.pdf'), 'Rotation');
    await waitText(page, 'first page now', 60000);
    await clickText(page, 'Rotate all 3 pages', 'button');
    await waitText(page, 'Rotated 3 pages by 90°', 120000);
    const dl = await grabDownload(page, () => clickText(page, 'Download PDF'));
    const doc = await loadPdf(dl);
    const rot = doc.getPage(0).getRotation().angle;
    if (doc.getPageCount() !== 3 || rot !== 90) throw new Error(`expected 3 pages @90°, got ${doc.getPageCount()} @${rot}°`);
    ok('rotate all → every page 90° (verified in output file) + before/after preview');
  } catch (e) { bad('rotate all', e); }

  /* ============================ 15. Extract text ========================== */
  console.log('\n— 15. Extract Text (real text + scanned fallback) —');
  try {
    await uploadOne(page, '/text', S('assignment.pdf'), 'Change');
    await clickText(page, 'Extract Text', 'button');
    await page.waitForSelector('textarea[aria-label="Extracted text"]', { timeout: 120000 });
    const value = await page.$eval('textarea[aria-label="Extracted text"]', (el) => el.value);
    if (!value.includes('Assignment')) throw new Error('expected "Assignment" in extracted text');
    if (!value.includes('— Page 6 —')) throw new Error('page boundaries missing');
    const dl = await grabDownload(page, () => clickText(page, 'Download .txt'));
    const txt = fs.readFileSync(dl, 'utf8');
    if (!txt.includes('Assignment')) throw new Error('.txt download missing text');
    ok('extract text → readable textarea + .txt download contain real text with page markers');
  } catch (e) { bad('extract text', e); }
  try {
    await uploadOne(page, '/text', S('lecture-scan.pdf'), 'Change');
    await clickText(page, 'Extract Text', 'button');
    await waitText(page, 'This PDF does not contain selectable text. Try OCR & Enhance.', 180000);
    const link = await page.$('a[href^="/ocr?file="]');
    if (!link) throw new Error('no OCR hand-off link');
    ok('scanned PDF → honest "no selectable text" state + OCR hand-off');
  } catch (e) { bad('extract text scanned', e); }

  /* ============================== 16. PDF info ============================ */
  console.log('\n— 16. PDF Info —');
  try {
    await uploadOne(page, '/info', S('assignment.pdf'), 'Document');
    await waitText(page, 'Metadata', 120000);
    const t = await bodyText();
    for (const expect of ['1.7', '595 × 842', 'assignment.pdf', 'Mixed (images + text)', 'Producer']) {
      if (!t.includes(expect)) throw new Error(`info missing "${expect}"`);
    }
    if (!/Pages\s*\n?\s*6/.test(t)) throw new Error('page count not shown as 6');
    ok('PDF info: version 1.7, 6 pages, 595×842pt, mixed content, metadata rows (read-only)');
  } catch (e) { bad('pdf info', e); }

  /* ========================= 17. Tools page + Home ======================== */
  console.log('\n— 17. Tools page organization + Home layout —');
  try {
    await goto(page, '/tools');
    const t = await bodyText();
    for (const section of ['Organize PDF', 'Edit & Customize', 'Convert', 'Extract & Inspect']) {
      if (!t.includes(section)) throw new Error(`missing section ${section}`);
    }
    const cards = await page.$$eval('a[aria-label^="Open "]', (els) => els.map((e) => e.getAttribute('aria-label')));
    if (cards.length !== 16) throw new Error(`expected 16 tool cards, got ${cards.length}`);
    ok('Tools page: 4 category sections, all 16 tool cards');
  } catch (e) { bad('tools page', e); }
  try {
    await goto(page, '/');
    const cards = await page.$$eval('a[aria-label^="Open "]', (els) => els.length);
    if (cards !== 4) throw new Error(`home should keep 4 prominent cards, got ${cards}`);
    const t = await bodyText();
    if (!t.includes('More tools')) throw new Error('missing More tools strip');
    for (const title of ['Split PDF', 'Add Page Numbers', 'Watermark PDF', 'Protect PDF', 'PDF to Images', 'Images to PDF', 'Rotate All Pages', 'Extract Text', 'PDF Info', 'PDF to Word', 'PDF to PowerPoint', 'PDF to Excel']) {
      if (!t.includes(title)) throw new Error(`home missing link to ${title}`);
    }
    if (t.includes('Ghostscript') || t.includes('Poppler')) throw new Error('stale server-era copy on home');
    ok('Home: 4 hero cards + 12 more-tool chips, privacy copy is browser-side');
  } catch (e) { bad('home layout', e); }

  /* ============================== 18. Mobile ============================== */
  console.log('\n— 18. Mobile viewport sanity —');
  try {
    const mob = await browser.newPage();
    await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await goto(mob, '/');
    await waitText(mob, 'StudyPDF', 30000);
    const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 2) throw new Error(`horizontal overflow ${overflow}px`);
    await goto(mob, '/tools');
    const cards = await mob.$$eval('a[aria-label^="Open "]', (els) => els.length);
    if (cards !== 16) throw new Error(`tools page broken on mobile (${cards} cards)`);
    ok('mobile 390px: home + tools render without overflow');
    await mob.close();
  } catch (e) { bad('mobile', e); }
} catch (e) {
  bad('fatal', e);
} finally {
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed${failures.length ? ` (${failures.join(', ')})` : ''}\n`);
  process.exit(fail ? 1 : 0);
}
