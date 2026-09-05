/** Repro/verify: open a very long PDF in Page Manager and screenshot the grid. */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';

const BASE = process.env.E2E_BASE || 'http://localhost:3999';
const PAGES = Number(process.env.LONG_PAGES || 1260);
const OUT = process.env.OUT || '/tmp/long-after.png';
const PDF = process.env.PDF_OUT || '/tmp/long.pdf';

if (!fs.existsSync(PDF)) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= PAGES; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`LONG DOCUMENT - page ${i}`, { x: 60, y: 780, size: 18, font, color: rgb(0.1, 0.2, 0.5) });
    page.drawText('index entry '.repeat(30), { x: 60, y: 400, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  }
  fs.writeFileSync(PDF, await doc.save());
  console.log('long pdf written', PDF, fs.statSync(PDF).size, 'bytes');
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(BASE + '/pages', { waitUntil: 'networkidle2', timeout: 60000 });
const input = await page.waitForSelector('input[type=file]', { timeout: 15000 });
await input.uploadFile(PDF);
await page.waitForSelector('.thumb', { timeout: 180000 });
await new Promise((r) => setTimeout(r, 4000));

const stats = await page.evaluate(() => ({
  cells: document.querySelectorAll('.thumb').length,
  imgs: document.querySelectorAll('.thumb img').length,
  height: document.body.scrollHeight,
}));
console.log('top:', JSON.stringify(stats));
await page.screenshot({ path: '/tmp/long-top.png' });

// scroll deep into the grid (like the user's screenshot) and let lazy thumbs draw
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.86));
await new Promise((r) => setTimeout(r, 6000));
const stats2 = await page.evaluate(() => ({
  imgs: document.querySelectorAll('.thumb img').length,
  scrollY: Math.round(window.scrollY),
  height: document.body.scrollHeight,
}));
console.log('deep:', JSON.stringify(stats2));
await page.screenshot({ path: OUT });

await browser.close();
console.log('done', OUT);
