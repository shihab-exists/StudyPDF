// Generates sample PDFs + images for tests and demos:  npm run samples
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PDFDocument, rgb, StandardFonts } from '@cantoo/pdf-lib';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'samples');
fs.mkdirSync(outDir, { recursive: true });

/* ------------------------- tiny PNG encoder (zlib) ------------------------- */
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** color: (x,y) => [r,g,b] */
export function makePng(w, h, color) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = color(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------ 5x7 block font (for OCR-able "scans") ------------------ */
const FONT = {
  A: ['00100','01010','10001','11111','10001','10001','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  I: ['11111','00100','00100','00100','00100','00100','11111'],
  G: ['01110','10001','10000','10111','10001','10001','01110'],
  N: ['10001','11001','11001','10101','10011','10011','10001'],
  M: ['10001','11011','10101','10101','10001','10001','10001'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  L: ['10000','10000','10000','10000','10000','10000','11111'],
  C: ['01110','10001','10000','10000','10000','10001','01110'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  R: ['11110','10001','10001','11110','10100','10010','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  D: ['11110','10001','10001','10001','10001','10001','11110'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'],
  P: ['11110','10001','10001','11110','10000','10000','10000'],
  F: ['11111','10000','10000','11110','10000','10000','10000'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
};

/** Returns a predicate: is (x,y) inside rendered text? */
function textMask(lines, ox, oy, scale) {
  const rects = [];
  lines.forEach((line, li) => {
    let cx = ox;
    for (const ch of line.toUpperCase()) {
      const glyph = FONT[ch] || FONT[' '];
      glyph.forEach((row, fy) => {
        for (let fx = 0; fx < 5; fx++) {
          if (row[fx] === '1') rects.push([cx + fx * scale, oy + li * 10 * scale + fy * scale, scale, scale]);
        }
      });
      cx += 7 * scale;
    }
  });
  return (x, y) => rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
}

// Hash-ish noise: high entropy so zlib can't collapse it (a "real" scan stays big)
const noisy = (x, y) => {
  const band = Math.floor(y / 40) % 2;
  const h = (Math.imul(x, 1103515245) ^ Math.imul(y, 12345) ^ Math.imul(x + y, 2654435761)) >>> 8;
  const n = (h % 53) - 26;
  const base = band ? 235 : 210;
  const v = Math.max(0, Math.min(255, base + n));
  return [v, Math.max(0, v - 6), Math.max(0, v - 14)];
};

/* --------------------------- assignment.pdf (6p) --------------------------- */
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.HelveticaBold);
const fontR = await doc.embedFont(StandardFonts.Helvetica);
const png = makePng(420, 300, noisy);
const img = await doc.embedPng(png);

for (let p = 1; p <= 6; p++) {
  const page = doc.addPage([595, 842]);
  page.drawRectangle({ x: 0, y: 780, width: 595, height: 62, color: rgb(0.08, 0.33, 0.75) });
  page.drawText(`Assignment ${p} — StudyPDF sample`, { x: 40, y: 800, size: 24, font, color: rgb(1, 1, 1) });
  page.drawText(`Page ${p} of 6. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`, { x: 40, y: 740, size: 12, font: fontR, color: rgb(0.1, 0.1, 0.1) });
  for (let i = 0; i < 22; i++) {
    page.drawText(`Line ${i + 1}: sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`, { x: 40, y: 700 - i * 18, size: 11, font: fontR, color: rgb(0.2, 0.2, 0.25) });
  }
  page.drawImage(img, { x: 120, y: 180, width: 340, height: 243 });
}
fs.writeFileSync(path.join(outDir, 'assignment.pdf'), await doc.save());

/* --------------------------- references.pdf (3p) --------------------------- */
const doc2 = await PDFDocument.create();
const f2 = await doc2.embedFont(StandardFonts.HelveticaBold);
for (let p = 1; p <= 3; p++) {
  const page = doc2.addPage([595, 842]);
  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 0.85, 0.4) });
  page.drawText(`References — part ${p}`, { x: 60, y: 760, size: 28, font: f2, color: rgb(0.07, 0.2, 0.4) });
}
fs.writeFileSync(path.join(outDir, 'references.pdf'), await doc2.save());

/* ------------------ lecture-scan.pdf (2p, image-only "scan") ------------------ */
// Text sits on a clean white panel so OCR is measured on legible input,
// while the surrounding page keeps high-entropy scanner noise.
function scanPage(lines) {
  const mask = textMask(lines, 70, 130, 10);
  const panel = (x, y) => y >= 90 && y <= 460 && x >= 40 && x <= 960;
  return makePng(1000, 1400, (x, y) => {
    if (mask(x, y)) return [30, 35, 50];
    if (panel(x, y)) return [248, 248, 246];
    return noisy(x, y);
  });
}
const scan1 = scanPage(['TEST FILE 1', 'LECTURE 101']);
const scan2 = scanPage(['TEST FILE 2', 'MORE LECTURE']);
const doc3 = await PDFDocument.create();
const s1 = await doc3.embedPng(scan1);
const s2 = await doc3.embedPng(scan2);
const p3a = doc3.addPage([595, 842]);
p3a.drawImage(s1, { x: 0, y: 21, width: 595, height: 821 });
const p3b = doc3.addPage([595, 842]);
p3b.drawImage(s2, { x: 0, y: 21, width: 595, height: 821 });
fs.writeFileSync(path.join(outDir, 'lecture-scan.pdf'), await doc3.save());

/* ------------------------------- broken.pdf ------------------------------- */
// Correct header, destroyed body — must fail deep parsing, not the magic check.
fs.writeFileSync(
  path.join(outDir, 'broken.pdf'),
  '%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF but the xref and streams are garbage \u0000\u0001\u0002\u0003'.repeat(3),
);

/* -------------------- images for the Images→PDF tests -------------------- */
fs.writeFileSync(path.join(outDir, 'red.png'), makePng(400, 200, () => [220, 60, 50]));
fs.writeFileSync(path.join(outDir, 'green.png'), makePng(200, 400, () => [60, 180, 90]));
fs.writeFileSync(path.join(outDir, 'blue.png'), makePng(300, 300, () => [60, 110, 220]));

console.log('samples written to', outDir);
console.log(fs.readdirSync(outDir).map((f) => `  ${f} (${fs.statSync(path.join(outDir, f)).size} bytes)`).join('\n'));
