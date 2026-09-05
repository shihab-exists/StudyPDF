/**
 * StudyPDF page-preview system E2E — proves the visual page grid is not
 * decoration: selection / reorder / rotate / delete in the previews must show
 * up in the real output PDFs (verified with pdf-lib + pdftotext).
 *
 *   npm run build && (node scripts/vercel-sim.mjs &)
 *   E2E_BASE=http://localhost:3999 node scripts/e2e-pages.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { PDFDocument } from '@cantoo/pdf-lib';

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
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const goto = (r) => page.goto(BASE + r, { waitUntil: 'networkidle2', timeout: 60000 });
const bodyText = () => page.evaluate(() => document.body.innerText);
const waitText = (t, timeout = 90000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
const clickText = (t, sel = 'button, a, label') =>
  page.evaluate((x, s) => {
    const el = [...document.querySelectorAll(s)].find((e) => (e.innerText || '').includes(x) && !e.disabled);
    if (!el) throw new Error(`nothing clickable: ${x}`);
    el.click();
  }, t, sel);
const clickSel = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) throw new Error(`missing ${s}`);
  el.click();
}, sel);
const uploadOne = async (route, file, expect) => {
  await goto(route);
  const input = await page.waitForSelector('input[type=file]', { timeout: 15000 });
  await input.uploadFile(file);
  if (expect) await waitText(expect);
};
const grabDownload = async (clickFn, timeout = 120000) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spdf-pg-'));
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
const loadPdf = (f) => PDFDocument.load(fs.readFileSync(f));
const pdftotext = (f) => execSync(`pdftotext "${f}" -`, { encoding: 'utf8', maxBuffer: 64e6 });
const thumbsReady = (n) => page.waitForFunction((x) => document.querySelectorAll('.thumb img').length >= x, { timeout: 120000 }, n);

try {
  /* ---------------- 1. Full-size preview modal ---------------- */
  console.log('\n— 1. Click-to-enlarge full-size preview —');
  try {
    await uploadOne('/pages', S('assignment.pdf'), 'assignment.pdf');
    await thumbsReady(6);
    await page.evaluate(() => document.querySelector('.thumb .relative').click());
    await waitText('Page 1 of 6', 20000);
    await page.waitForSelector('.pv-card img', { timeout: 30000 });
    await clickText('Next →');
    await waitText('Page 2 of 6', 20000);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.pv-overlay'), { timeout: 10000 });
    ok('thumbnail click opens full-size modal, next/prev + Esc work');
  } catch (e) { bad('preview modal', e); }

  /* --------- 2. Counter-clockwise rotation reaches the PDF --------- */
  console.log('\n— 2. Rotate left (CCW) applies to output —');
  try {
    await uploadOne('/pages', S('assignment.pdf'), 'assignment.pdf');
    await thumbsReady(6);
    await clickSel('[aria-label="Rotate page 2 left"]');
    await waitText('↻270°', 10000);
    await clickText('Save as new PDF');
    await waitText('Edited PDF ready — 6 pages', 120000);
    const dl = await grabDownload(() => clickText('Download PDF'));
    const doc = await loadPdf(dl);
    const rot = doc.getPage(1).getRotation().angle;
    if (rot !== 270) throw new Error(`page 2 rotation ${rot}°, expected 270`);
    ok('CCW thumbnail rotation → page 2 saved at 270°');
  } catch (e) { bad('ccw rotate', e); }

  /* ------- 3. Reorder via touch buttons changes the PDF order ------- */
  console.log('\n— 3. Reorder (touch ←/→) changes real page order —');
  try {
    await uploadOne('/pages', S('assignment.pdf'), 'assignment.pdf');
    await thumbsReady(6);
    await clickSel('[aria-label="Move page 1 right"]'); // 1,2,3.. → 2,1,3..
    await page.waitForFunction(() => document.querySelector('.thumb p').innerText.includes('Page 1'), { timeout: 5000 });
    await clickText('Save as new PDF');
    await waitText('Edited PDF ready — 6 pages', 120000);
    const dl = await grabDownload(() => clickText('Download PDF'));
    const txt = pdftotext(dl);
    const first = txt.indexOf('Assignment 1');
    const second = txt.indexOf('Assignment 2');
    if (first === -1 || second === -1 || second > first) throw new Error('order not swapped in output');
    // page-1 marker must now come AFTER page-2 marker
    if (!(second < first)) throw new Error('expected Assignment 2 first');
    ok('moved page 1 after page 2 → output starts with original page 2 (pdftotext verified)');
  } catch (e) { bad('reorder', e); }

  /* ------------------- 4. Per-page delete button ------------------- */
  console.log('\n— 4. Per-page delete removes from output —');
  try {
    await uploadOne('/pages', S('assignment.pdf'), 'assignment.pdf');
    await thumbsReady(6);
    await clickSel('[aria-label="Delete page 1"]');
    await clickText('Save as new PDF');
    await waitText('Edited PDF ready — 5 pages', 120000);
    const dl = await grabDownload(() => clickText('Download PDF'));
    const doc = await loadPdf(dl);
    if (doc.getPageCount() !== 5) throw new Error(`expected 5 pages, got ${doc.getPageCount()}`);
    const txt = pdftotext(dl);
    if (txt.includes('Assignment 1 —') || !txt.includes('Assignment 2 —')) throw new Error('wrong page removed');
    ok('deleted page 1 → 5-page output without original page 1');
  } catch (e) { bad('delete', e); }

  /* ------------- 5. Split: visual selection → ranges → parts ------------- */
  console.log('\n— 5. Split visual selection drives ranges —');
  try {
    await uploadOne('/split', S('assignment.pdf'), 'How should we split it?');
    await clickText('👁 Preview pages');
    await page.waitForFunction(() => document.querySelectorAll('.thumb img').length >= 6, { timeout: 120000 });
    await page.$$eval('.thumb input[type=checkbox]', (els) => { els[1].click(); els[2].click(); });
    await clickText('Use 2 selected pages as ranges');
    const val = await page.$eval('textarea', (t) => t.value);
    if (val.trim() !== '2-3') throw new Error(`ranges text "${val}", expected "2-3"`);
    await clickText('Split PDF');
    await waitText('Split into 1 file', 120000);
    const dl = await grabDownload(() => clickText('Download PDF'));
    const doc = await loadPdf(dl);
    if (doc.getPageCount() !== 2) throw new Error(`expected 2 pages, got ${doc.getPageCount()}`);
    const txt = pdftotext(dl);
    if (!txt.includes('Assignment 2') || !txt.includes('Assignment 3') || txt.includes('Assignment 1')) throw new Error('wrong pages in part');
    ok('selected pages 2+3 visually → ranges "2-3" → part with exactly those pages');
  } catch (e) { bad('split selection', e); }

  /* ---------------- 6. PDF→Images subset conversion ---------------- */
  console.log('\n— 6. PDF→Images converts only selected pages —');
  try {
    await uploadOne('/to-images', S('references.pdf'), 'Resolution');
    await clickText(' Pick pages');
    await page.waitForFunction(() => document.querySelectorAll('.thumb img').length >= 3, { timeout: 120000 });
    await page.$$eval('.thumb input[type=checkbox]', (els) => els[1].click());
    await clickText('Convert 1 selected to PNG');
    await waitText('1 image rendered as PNG', 120000);
    const t = await bodyText();
    if (!t.includes('Page 2')) throw new Error('result should label the real source page (Page 2)');
    ok('subset conversion → single PNG of page 2 only');
  } catch (e) { bad('to-images subset', e); }

  /* -------- 7. Merge: arrange combined pages, real merge order -------- */
  console.log('\n— 7. Merge page-level arrange + delete —');
  try {
    await goto('/merge');
    const input = await page.waitForSelector('input[type=file]');
    await input.uploadFile(S('assignment.pdf'), S('references.pdf'));
    await waitText('Merge 2 PDFs');
    await clickText('Preview & arrange 9 pages');
    await page.waitForFunction(() => document.querySelectorAll('.thumb img').length >= 9, { timeout: 120000 });
    // move combined page 7 (References part 1) to the front: 6 × left
    // (after each move the page shifts, so its aria-label shifts too)
    for (let i = 0; i < 6; i++) await clickSel(`[aria-label="Move page ${7 - i} left"]`);
    // delete what is now the last-but-one original assignment page 6 (index 9 → page 10? after move: refs1, a1..a6, r2, r3 → delete page 10 = r3? keep 8 pages: delete combined page 9 (r2))
    await clickSel('[aria-label="Delete page 8"]'); // drop References part 2
    await waitText('Combined document — 8 pages', 10000);
    await clickText('Merge 2 PDFs');
    await waitText('Merged successfully into 8 pages', 120000);
    const dl = await grabDownload(() => clickText('Download PDF'));
    const doc = await loadPdf(dl);
    if (doc.getPageCount() !== 8) throw new Error(`expected 8 pages, got ${doc.getPageCount()}`);
    const txt = pdftotext(dl);
    if (txt.indexOf('References — part 1') > txt.indexOf('Assignment 1')) throw new Error('reorder not applied to merge output');
    if (txt.includes('References — part 2')) throw new Error('deleted page still present');
    if (!txt.includes('References — part 3')) throw new Error('kept page missing');
    ok('arranged + deleted pages in preview → merged PDF follows exactly (8 pages, refs-1 first)');
  } catch (e) { bad('merge arrange', e); }

  /* -------------- 8. Encrypted PDF: graceful, no crash -------------- */
  console.log('\n— 8. Encrypted PDF handling in previews —');
  try {
    const doc = await PDFDocument.create();
    doc.addPage([400, 400]);
    doc.encrypt({ userPassword: 'secret', ownerPassword: 'secret', permissions: { printing: 'lowResolution' } });
    fs.writeFileSync('/tmp/locked.pdf', await doc.save());
    await uploadOne('/pages', '/tmp/locked.pdf', null);
    await waitText('password protected', 30000);
    ok('encrypted PDF → friendly message, app keeps working');
  } catch (e) { bad('encrypted', e); }

  /* --------- 9. Long PDF: virtual 100-page sections + jump --------- */
  console.log('\n— 9. 1260-page PDF: 100-page virtual sections, DOM windowing, jump —');
  try {
    if (!fs.existsSync('/tmp/long.pdf')) {
      ok('long PDF sample unavailable — skipped (generate via scripts/repro-long.mjs)');
    } else {
      await uploadOne('/pages', '/tmp/long.pdf', null);
      await page.waitForSelector('.thumb', { timeout: 180000 });
      await sleep(2500);
      const st = await page.evaluate(() => ({
        cells: document.querySelectorAll('.thumb').length,
        imgs: document.querySelectorAll('.thumb img').length,
        nav: document.body.innerText.includes('Section 1 of 13') && document.body.innerText.includes('Pages 1–100 of 1260'),
      }));
      if (st.cells !== 100) throw new Error(`active section should hold 100 cells, got ${st.cells}`);
      if (!st.nav) throw new Error('section navigation bar missing/wrong');
      if (st.imgs > 60 || st.imgs < 5) throw new Error(`unexpected eager render count: ${st.imgs}`);
      // direct page jump to any page
      await page.click('.jump-input');
      await page.keyboard.type('1204');
      await clickText('Go', 'button');
      await waitText('Section 13 of 13', 30000);
      await page.waitForFunction(
        () => [...document.querySelectorAll('.thumb p')].some((p) => p.innerText.startsWith('Page 1204')),
        { timeout: 30000 },
      );
      ok('1260 pages → 13 virtual sections; DOM holds only the active 100; jump 1204 → section 13 + page located');

      /* --------- 10. Cross-section selection survives navigation --------- */
      console.log('\n— 10. Cross-section selection + extract uses absolute pages —');
      await page.click('.jump-input');
      await page.keyboard.type('5');
      await clickText('Go', 'button');
      await waitText('Section 1 of 13', 30000);
      await clickSel('[data-pos="4"] input[type=checkbox]'); // page 5
      await page.click('.jump-input');
      await page.keyboard.type('603');
      await clickText('Go', 'button');
      await waitText('Section 7 of 13', 30000);
      await clickSel('[data-pos="602"] input[type=checkbox]'); // page 603
      await waitText('2 selected (all sections)', 15000);
      // back to section 1: the earlier selection must still be ticked
      await page.click('.jump-input');
      await page.keyboard.type('5');
      await clickText('Go', 'button');
      await waitText('Section 1 of 13', 30000);
      const stillChecked = await page.$eval('[data-pos="4"] input[type=checkbox]', (el) => el.checked);
      if (!stillChecked) throw new Error('selection lost after section navigation');
      await clickText('Extract Pages', 'button');
      await waitText('Extracted PDF ready — 2 pages', 120000);
      const dl = await grabDownload(() => clickText('Download PDF'));
      const txt = pdftotext(dl);
      const lines = txt.split('\n').map((l) => l.trim());
      const i5 = lines.indexOf('LONG DOCUMENT - page 5');
      const i603 = lines.indexOf('LONG DOCUMENT - page 603');
      if (i5 === -1 || i603 === -1 || i603 < i5) throw new Error('extract did not use absolute pages 5 + 603 in order');
      ok('selections 5 + 603 kept across sections → extracted PDF contains exactly those pages, in order');

      /* --------- 11. Cross-section reorder (101 before 5) --------- */
      console.log('\n— 11. Cross-section reorder: page 101 before page 5 —');
      await uploadOne('/pages', '/tmp/long.pdf', null);
      await page.waitForSelector('.thumb', { timeout: 180000 });
      await page.click('.jump-input');
      await page.keyboard.type('101');
      await clickText('Go', 'button');
      await waitText('Section 2 of 13', 30000);
      for (let k = 101; k > 100; k--) await clickSel(`[aria-label="Move page ${k} left"]`);
      // page 101 now sits at position 100 → section 1
      await page.click('.jump-input');
      await page.keyboard.type('100');
      await clickText('Go', 'button');
      await waitText('Section 1 of 13', 30000);
      for (let k = 100; k > 5; k--) await clickSel(`[aria-label="Move page ${k} left"]`);
      const order = await page.evaluate(() =>
        // source-page identity per output position (labels show output position by design)
        [0, 1, 2, 3, 4, 5].map((i) => document.querySelector(`[data-pos="${i}"]`).getAttribute('data-src')),
      );
      const want = ['1', '2', '3', '4', '101', '5'];
      if (JSON.stringify(order) !== JSON.stringify(want)) throw new Error(`preview order ${order.join(',')}`);
      await clickText('Save as new PDF', 'button');
      await waitText('Edited PDF ready — 1260 pages', 180000);
      const dl2 = await grabDownload(() => clickText('Download PDF'));
      const lines2 = pdftotext(dl2).split('\n').map((l) => l.trim());
      const a = lines2.indexOf('LONG DOCUMENT - page 4');
      const b = lines2.indexOf('LONG DOCUMENT - page 101');
      const c = lines2.indexOf('LONG DOCUMENT - page 5');
      if (!(a < b && b < c)) throw new Error(`generated order wrong (4@${a}, 101@${b}, 5@${c})`);
      ok('moved page 101 before page 5 across sections → preview AND generated PDF show 1 2 3 4 101 5 …');
    }
  } catch (e) { bad('long pdf sections', e); }

  /* --------- 12. Tool cards + All tools navigation + a11y --------- */
  console.log('\n— 12. Tool cards fully clickable, keyboard + focus, All tools pill —');
  try {
    await goto('/tools');
    // click on the CARD BODY (title text), not the arrow
    await page.evaluate(() => {
      const h = [...document.querySelectorAll('a.note h3')].find((x) => x.innerText.includes('Watermark PDF'));
      h.click();
    });
    await waitText('Stamp text across every page', 20000);
    ok('clicking anywhere on a tool card opens the tool');
    // keyboard activation + visible focus (real Tab traversal)
    await goto('/tools');
    let focused = false;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      focused = await page.evaluate(() => document.activeElement?.matches('a.note') ?? false);
      if (focused) break;
    }
    if (!focused) throw new Error('could not reach a tool card via keyboard');
    const fv = await page.evaluate(() => document.activeElement.matches(':focus-visible'));
    if (!fv) throw new Error('keyboard-focused card lacks :focus-visible');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.pathname !== '/tools', { timeout: 15000 });
    ok('keyboard Tab reaches card, visible focus ring, Enter opens tool');
    // All tools pill on several tools: present, tappable, consistent
    for (const route of ['/compress', '/pages', '/watermark', '/split']) {
      await goto(route);
      const box = await page.evaluate(() => {
        const a = document.querySelector('a.back-pill');
        if (!a) throw new Error('missing back pill on ' + location.pathname);
        const r = a.getBoundingClientRect();
        return { h: r.height, w: r.width, text: a.innerText };
      });
      if (box.h < 40) throw new Error(`back pill too small on ${route}: ${box.h}px`);
    }
    await page.evaluate(() => document.querySelector('a.back-pill').click());
    await page.waitForFunction(() => location.pathname === '/tools', { timeout: 15000 });
    ok('← All tools pill present on every tool, ≥40px tall, navigates back');
    // mobile touch targets
    const m = await browser.newPage();
    await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await m.goto(BASE + '/tools', { waitUntil: 'networkidle2' });
    const cardBox = await m.evaluate(() => {
      const a = document.querySelector('a.note');
      const r = a.getBoundingClientRect();
      return { h: r.height, w: r.width };
    });
    if (cardBox.h < 100 || cardBox.w < 200) throw new Error('mobile card too small');
    await m.evaluate(() => document.querySelector('a.note h3').click());
    await m.waitForFunction(() => location.pathname !== '/tools', { timeout: 15000 });
    await m.waitForFunction(
      () => {
        const a = document.querySelector('a.back-pill');
        return a && getComputedStyle(a).minHeight === '40px';
      },
      { timeout: 15000 },
    );
    const pillH = await m.evaluate(() => {
      const a = document.querySelector('a.back-pill');
      return a ? a.getBoundingClientRect().height : 0;
    });
    if (pillH < 40) throw new Error('mobile back pill too small');
    await m.close();
    ok('mobile: whole card tappable, back pill ≥40px');
  } catch (e) { bad('tool navigation', e); }

  /* --------- 13. 100 MB rule: size yes, page count no --------- */
  console.log('\n— 13. 100 MB boundary; page count never rejects —');
  try {
    await uploadOne('/compress', '/tmp/big101.pdf', 'larger than 100 MB');
    ok('101 MB file rejected by the existing size rule');
    if (fs.existsSync('/tmp/long5432.pdf')) {
      // isolated browser: a 5,432-page pdf.js document must not starve the rest of the suite
      const b2 = await puppeteer.launch({
        executablePath: '/usr/bin/chromium',
        headless: 'new',
        args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      });
      try {
        const p2 = await b2.newPage();
        await p2.setViewport({ width: 1366, height: 900 });
        await p2.goto(BASE + '/pages', { waitUntil: 'networkidle2', timeout: 60000 });
        const in2 = await p2.waitForSelector('input[type=file]', { timeout: 15000 });
        await in2.uploadFile('/tmp/long5432.pdf');
        await p2.waitForSelector('.thumb', { timeout: 300000 });
        await p2.waitForFunction(() => document.body.innerText.includes('Section 1 of 55'), { timeout: 30000 });
        await p2.waitForFunction(() => document.body.innerText.includes('Pages 1–100 of 5432'), { timeout: 30000 });
        const cells2 = await p2.evaluate(() => document.querySelectorAll('.thumb').length);
        if (cells2 !== 100) throw new Error(`expected 100 windowed cells, got ${cells2}`);
      } finally {
        await b2.close();
      }
      ok('5,432-page PDF (≈3 MB) accepted: 55 virtual sections, 100 windowed cells, no page-count rejection');
    } else {
      ok('5432-page sample not generated yet — skipped (LONG_PAGES=5432 node scripts/repro-long.mjs)');
    }
  } catch (e) { bad('100MB rule', e); }

  /* --------- 14. Config-faithful watermark / page-number previews --------- */
  console.log('\n— 14. Watermark & page-number previews mirror the real config —');
  try {
    await uploadOne('/watermark', S('assignment.pdf'), 'Watermark text');
    await clickText('👁 Preview pages');
    await page.waitForSelector('.pv-wm', { timeout: 60000 });
    let wm = await page.$eval('.pv-wm', (el) => ({ text: el.textContent, transform: el.style.transform, opacity: el.style.opacity }));
    if (wm.text !== 'DRAFT' || !wm.transform.includes('rotate(45deg)') || wm.opacity !== '0.3') throw new Error(JSON.stringify(wm));
    await page.$$eval('input[type=range]', (els) => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(els[1], '0'); // rotation slider
      els[1].dispatchEvent(new Event('input', { bubbles: true }));
    });
    wm = await page.$eval('.pv-wm', (el) => el.style.transform);
    if (!wm.includes('rotate(0deg)')) throw new Error(`overlay rotation not following config: ${wm}`);
    ok('watermark overlay uses the live config (text, rotation, opacity)');
    await uploadOne('/numbers', S('assignment.pdf'), 'Position');
    await clickText('👁 Preview pages');
    await page.waitForFunction(() => document.querySelectorAll('.pv-pn').length >= 2, { timeout: 60000 });
    const nums = await page.$$eval('.pv-pn', (els) => els.slice(0, 2).map((e) => e.textContent));
    if (nums[0] !== '1' || nums[1] !== '2') throw new Error(`number overlay ${nums}`);
    const numInputs = await page.$$('input[type=number]');
    await page.evaluate((el) => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(el, '101');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, numInputs[0]);
    await page.waitForFunction(() => document.querySelector('.pv-pn')?.textContent === '101', { timeout: 15000 });
    await clickText('Top left', 'label');
    await page.waitForSelector('.pv-pn-tl', { timeout: 15000 });
    ok('page-number overlay follows start number + position config');
  } catch (e) { bad('config previews', e); }

  /* --------- 15. Split result-preview groups --------- */
  console.log('\n— 15. Split shows output groups before generating —');
  try {
    await uploadOne('/split', S('assignment.pdf'), 'How should we split it?');
    const ta = await page.$('textarea');
    await page.evaluate((el) => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      set.call(el, '2-3, 5');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, ta);
    await waitText('Result preview — 2 output files', 30000);
    await page.waitForFunction(
      () => [...document.querySelectorAll('.thumb p span')].some((s) => s.textContent === 'Part 1') &&
            [...document.querySelectorAll('.thumb p span')].some((s) => s.textContent === 'Part 2'),
      { timeout: 60000 },
    );
    ok('split preview lists Part 1 (pages 2–3) + Part 2 (page 5) with real thumbnails');
  } catch (e) { bad('split preview', e); }

} finally {
  if (pageErrors.length) console.log('\n[pageerrors]', pageErrors.slice(0, 5));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
}
