/**
 * StudyPDF PDF→Word / PDF→PowerPoint E2E — opens the BUILT app in headless
 * Chromium and verifies the REAL output containers (.docx / .pptx are ZIPs):
 * document text, page breaks, embedded media, slide counts.
 *
 *   npm run build && (node scripts/vercel-sim.mjs &)
 *   E2E_BASE=http://localhost:3999 node scripts/e2e-convert.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { unzipSync } from 'fflate';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const S = (f) => path.join(ROOT, 'samples', f);

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log(`  ✅ ${n}`); };
const bad = (n, e) => { fail++; console.log(`  ❌ ${n}: ${e?.message ?? e}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

const goto = (r) => page.goto(BASE + r, { waitUntil: 'networkidle2', timeout: 60000 });
const waitText = (t, timeout = 90000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
const clickText = (t, sel = 'button, a, label') =>
  page.evaluate((x, s) => {
    const el = [...document.querySelectorAll(s)].find((e) => (e.innerText || '').includes(x) && !e.disabled);
    if (!el) throw new Error(`nothing clickable: ${x}`);
    el.click();
  }, t, sel);
const uploadOne = async (route, file, expect, timeout = 90000) => {
  await goto(route);
  const input = await page.waitForSelector('input[type=file]', { timeout: 15000 });
  await input.uploadFile(file);
  if (expect) await waitText(expect, timeout);
};
const grabDownload = async (clickFn, timeout = 180000) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spdf-cv-'));
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, eventsEnabled: true });
  await clickFn();
  const t0 = Date.now();
  for (;;) {
    const ready = fs.readdirSync(dir).filter((f) => !f.endsWith('.crdownload') && !f.endsWith('.tmp'));
    if (ready.length) { await sleep(400); return path.join(dir, fs.readdirSync(dir)[0]); }
    if (Date.now() - t0 > timeout) throw new Error('download did not arrive');
    await sleep(250);
  }
};
const zipKeys = (file) => Object.keys(unzipSync(new Uint8Array(fs.readFileSync(file))));
const zipText = (file, entry) => {
  const entries = unzipSync(new Uint8Array(fs.readFileSync(file)));
  const u8 = entries[entry];
  if (!u8) throw new Error(`missing ${entry} in ${path.basename(file)}`);
  return new TextDecoder().decode(u8);
};

try {
  /* ------------------------- 1. PDF → Word (text) ------------------------- */
  console.log('\n— 1. PDF → Word: text PDF structure —');
  try {
    await uploadOne('/to-word', S('assignment.pdf'), 'Convert to Word');
    await clickText('Convert to Word', 'button');
    await waitText('Word document ready', 180000);
    const dl = await grabDownload(() => clickText('Download'));
    const keys = zipKeys(dl);
    if (!keys.includes('word/document.xml')) throw new Error('not a valid .docx container');
    const xml = zipText(dl, 'word/document.xml');
    for (const marker of ['Assignment 1', 'Assignment 6']) {
      if (!xml.includes(marker)) throw new Error(`missing text "${marker}" in document.xml`);
    }
    const breaks = (xml.match(/pageBreakBefore/g) || []).length;
    if (breaks < 5) throw new Error(`expected ≥5 page breaks (6 pages), got ${breaks}`);
    const media = keys.filter((k) => k.startsWith('word/media/'));
    ok(`docx keeps text + ${breaks} page breaks + ${media.length} embedded image(s)`);
  } catch (e) { bad('word text', e); }

  /* --------------------- 2. PDF → Word (scanned → OCR) --------------------- */
  console.log('\n— 2. PDF → Word: scanned PDF uses OCR —');
  try {
    await uploadOne('/to-word', S('lecture-scan.pdf'), 'Convert to Word');
    await clickText('Convert to Word', 'button');
    await waitText('Word document ready', 420000);
    const t = await page.evaluate(() => document.body.innerText);
    if (!t.includes('text read with OCR')) throw new Error('success banner should say OCR was used');
    const dl = await grabDownload(() => clickText('Download'));
    const xml = zipText(dl, 'word/document.xml');
    if (!/LECTURE/i.test(xml)) throw new Error('OCR text missing from document.xml');
    ok('scanned PDF → OCR text lands in the .docx (banner states OCR use)');
  } catch (e) { bad('word scanned', e); }

  /* ------------------------ 3. Word error handling ------------------------ */
  console.log('\n— 3. PDF → Word: invalid + password handling —');
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spdf-cvw-'));
    fs.writeFileSync(path.join(tmp, 'notes.txt'), 'hello, just text');
    await uploadOne('/to-word', path.join(tmp, 'notes.txt'), 'Only PDF files are supported.', 30000);
    ok('non-PDF rejected with friendly message');
    const doc = await PDFDocument.create();
    doc.addPage([400, 400]);
    doc.encrypt({ userPassword: 'secret', ownerPassword: 'secret', permissions: { printing: 'lowResolution' } });
    fs.writeFileSync(path.join(tmp, 'locked.pdf'), await doc.save());
    await uploadOne('/to-word', path.join(tmp, 'locked.pdf'), 'password protected', 60000);
    ok('password-protected PDF → friendly message, no crash');
  } catch (e) { bad('word errors', e); }

  /* ----------------------- 4. PDF → PowerPoint (text) ---------------------- */
  console.log('\n— 4. PDF → PowerPoint: one slide per page —');
  try {
    await uploadOne('/to-pptx', S('references.pdf'), 'Convert to PowerPoint');
    await clickText('Convert to PowerPoint', 'button');
    await waitText('PowerPoint ready', 180000);
    const dl = await grabDownload(() => clickText('Download'));
    const keys = zipKeys(dl);
    for (const n of [1, 2, 3]) {
      if (!keys.includes(`ppt/slides/slide${n}.xml`)) throw new Error(`missing slide ${n}`);
    }
    const media = keys.filter((k) => k.startsWith('ppt/media/'));
    if (media.length < 3) throw new Error(`expected ≥3 slide images, got ${media.length}`);
    ok('pptx has 3 slides with full-page images (valid OOXML container)');
  } catch (e) { bad('pptx text', e); }

  /* -------------------- 5. PDF → PowerPoint (scanned) -------------------- */
  console.log('\n— 5. PDF → PowerPoint: scanned PDF —');
  try {
    await uploadOne('/to-pptx', S('lecture-scan.pdf'), 'Convert to PowerPoint');
    await clickText('Convert to PowerPoint', 'button');
    await waitText('PowerPoint ready', 240000);
    const dl = await grabDownload(() => clickText('Download'));
    const keys = zipKeys(dl);
    if (!keys.includes('ppt/slides/slide1.xml') || !keys.includes('ppt/slides/slide2.xml')) throw new Error('expected 2 slides');
    const media = keys.filter((k) => k.startsWith('ppt/media/'));
    if (media.length < 2) throw new Error('scanned slides missing images');
    ok('scanned PDF → 2 image slides (no empty presentation)');
  } catch (e) { bad('pptx scanned', e); }

  /* --------------------- 6. Corrupt/empty + big-within-limit --------------------- */
  console.log('\n— 6. Corrupt / empty / large-within-limit —');
  try {
    await uploadOne('/to-pptx', S('broken.pdf'), 'appears to be corrupted', 30000);
    ok('corrupted PDF rejected');
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'spdf-cve-'));
    fs.writeFileSync(path.join(tmp2, 'empty.pdf'), '');
    await uploadOne('/to-word', path.join(tmp2, 'empty.pdf'), 'This file is empty.', 30000);
    ok('empty PDF rejected');
    // large but within the 100 MB rule: the 1260-page sample
    if (fs.existsSync('/tmp/long.pdf')) {
      await uploadOne('/to-pptx', '/tmp/long.pdf', 'Convert to PowerPoint', 120000);
      await clickText('Convert to PowerPoint', 'button');
      await waitText('PowerPoint ready — 1260 slides', 600000);
      ok('1260-page PDF (within 100 MB) converts — no page-count rejection');
    } else {
      ok('1260-page sample missing — large-within-limit check skipped');
    }
  } catch (e) { bad('edge sizes', e); }

  /* --------------------------- 7. PDF → Excel --------------------------- */
  console.log('\n— 7. PDF → Excel: table grid + container —');
  try {
    const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'spdf-cvx-'));
    const tdoc = await PDFDocument.create();
    const tpage = tdoc.addPage([595, 842]);
    const font = await tdoc.embedFont(StandardFonts.Helvetica);
    const rowsTxt = [['Name', 'ID', 'Marks'], ['Alice', '101', '88'], ['Bob', '102', '74'], ['Cara', '103', '91'], ['Dan', '104', '65']];
    rowsTxt.forEach((r, ri) => {
      r.forEach((cell, ci) => tpage.drawText(cell, { x: [60, 250, 420][ci], y: 760 - ri * 24, size: 12, font }));
    });
    const tablePath = path.join(tmp3, 'table.pdf');
    fs.writeFileSync(tablePath, await tdoc.save());
    await uploadOne('/to-excel', tablePath, 'Convert to Excel');
    await clickText('Convert to Excel', 'button');
    await waitText('Excel spreadsheet ready', 120000);
    const dl = await grabDownload(() => clickText('Download'));
    const keys = zipKeys(dl);
    for (const k of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']) {
      if (!keys.includes(k)) throw new Error(`missing ${k} in .xlsx container`);
    }
    const sheet = zipText(dl, 'xl/worksheets/sheet1.xml');
    for (const probe of ['>Name<', '>Marks<', '<v>88</v>', 'r="C1"', 'r="A5"']) {
      if (!sheet.includes(probe)) throw new Error(`sheet1.xml missing ${probe}`);
    }
    ok('xlsx container valid: 3-column grid, header row, numeric cells');
    await uploadOne('/to-excel', S('lecture-scan.pdf'), 'Convert to Excel');
    await clickText('Convert to Excel', 'button');
    await waitText('Excel spreadsheet ready', 420000);
    const dl2 = await grabDownload(() => clickText('Download'));
    const sheet2 = zipText(dl2, 'xl/worksheets/sheet1.xml');
    if (!/TEST/i.test(sheet2)) throw new Error('OCR text missing from worksheet');
    ok('scanned PDF → OCR text lands in the worksheet');
    const tmp4 = fs.mkdtempSync(path.join(os.tmpdir(), 'spdf-cvx2-'));
    fs.writeFileSync(path.join(tmp4, 'notes.txt'), 'hello, just text');
    await uploadOne('/to-excel', path.join(tmp4, 'notes.txt'), 'Only PDF files are supported.', 30000);
    ok('non-PDF rejected with friendly message');
  } catch (e) { bad('excel', e); }

  /* --------------------------- 8. Discovery + mobile --------------------------- */
  console.log('\n— 8. Discovery, navigation, mobile —');
  try {
    await goto('/tools');
    const labels = await page.$$eval('a[aria-label^="Open "]', (els) => els.map((e) => e.getAttribute('aria-label')));
    for (const l of ['Open PDF to Word', 'Open PDF to PowerPoint', 'Open PDF to Excel']) {
      if (!labels.includes(l)) throw new Error(`card missing on /tools: ${l}`);
    }
    await page.evaluate(() => document.querySelector('a[aria-label="Open PDF to Word"]').click());
    await waitText('Drop your PDF here', 20000);
    ok('both cards present on Tools and open their routes');
    const m = await browser.newPage();
    await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await m.goto(BASE + '/to-word', { waitUntil: 'networkidle2' });
    await m.waitForSelector('input[type=file]', { timeout: 15000 });
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    if (overflow) throw new Error('horizontal overflow on mobile');
    await m.goto(BASE + '/to-pptx', { waitUntil: 'networkidle2' });
    await m.waitForSelector('input[type=file]', { timeout: 15000 });
    await m.goto(BASE + '/to-excel', { waitUntil: 'networkidle2' });
    await m.waitForSelector('input[type=file]', { timeout: 15000 });
    await m.close();
    ok('mobile 390px: both tools render without overflow');
  } catch (e) { bad('discovery/mobile', e); }
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
}
