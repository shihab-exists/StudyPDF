import { strToU8, zipSync } from 'fflate';
import { openPdf } from './pdfjs';
import { analyzePdf } from './pdfops';
import { runOcr } from './ocr';

export interface ExcelProgress {
  stage: string;
  page: number;
  totalPages: number;
  percent: number;
}

export interface ExcelResult {
  blob: Blob;
  pages: number;
  sheets: number;
  rows: number;
  ocrUsed: boolean;
}

interface Cell {
  n: number | null; // number when the text is purely numeric
  s: string;
}
type Row = Cell[];

const COL_GAP = 20; // pt between column-cluster means
const MAX_COLS = 64;
const MAX_ROWS = 4000;

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function colName(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function toCell(text: string): Cell {
  const t = text.trim();
  const num = /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/.test(t);
  return { n: num ? Number(t.replace(/,/g, '')) : null, s: t };
}

interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
}

/** Join a line's items, inserting a space only where the PDF actually has a gap. */
function joinLine(ln: Item[]): string {
  const sorted = [...ln].sort((a, b) => a.x - b.x);
  let out = '';
  let prevEnd: number | null = null;
  for (const i of sorted) {
    if (prevEnd !== null && i.x - prevEnd > 1) out += ' ';
    out += i.str;
    prevEnd = i.x + (i.w || i.str.length * 5);
  }
  return out.replace(/[ \t]+/g, ' ').trim();
}

/** Cluster pdf.js text items into a rows × columns grid (simple table detection). */
function pageGrid(items: Item[]): { rows: Row[]; table: boolean } {
  if (!items.length) return { rows: [], table: false };
  // rows: cluster by y (pdf y grows upward → sort descending)
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Item[][] = [];
  let cur: Item[] = [];
  let curY = sorted[0].y;
  for (const it of sorted) {
    if (Math.abs(curY - it.y) > 2.5) {
      if (cur.length) lines.push(cur);
      cur = [];
      curY = it.y;
    }
    cur.push(it);
  }
  if (cur.length) lines.push(cur);

  // columns: 1-D cluster item x-starts across the whole page
  const xs = items.map((i) => i.x).sort((a, b) => a - b);
  const cols: { sum: number; n: number }[] = [];
  for (const x of xs) {
    const last = cols[cols.length - 1];
    if (last && x - last.sum / last.n <= COL_GAP) {
      last.sum += x;
      last.n++;
    } else cols.push({ sum: x, n: 1 });
  }
  const bounds = cols.slice(0, MAX_COLS).map((c) => c.sum / c.n);

  // real tables have few columns; OCR prose scatters into dozens → keep as lines
  const table = bounds.length >= 2 && bounds.length <= 8 && lines.filter((ln) => {
    const used = new Set<number>();
    for (const i of ln) used.add(colOf(i.x, bounds));
    return used.size >= 2;
  }).length >= 3;

  const rows: Row[] = [];
  for (const ln of lines) {
    if (rows.length >= MAX_ROWS) break;
    if (bounds.length >= 2 && table) {
      const buckets: Item[][] = bounds.map(() => []);
      for (const i of ln) buckets[colOf(i.x, bounds)].push(i);
      const cells = buckets.map(joinLine);
      // drop trailing empties but keep inner gaps (real tables have empty cells)
      while (cells.length && !cells[cells.length - 1].trim()) cells.pop();
      if (cells.some((c) => c.trim())) rows.push(cells.map(toCell));
    } else {
      const text = joinLine(ln);
      if (text) rows.push([toCell(text)]);
    }
  }
  return { rows, table };
}

function colOf(x: number, bounds: number[]): number {
  let c = 0;
  for (let i = 0; i < bounds.length; i++) if (x >= bounds[i] - COL_GAP / 2) c = i;
  return Math.min(c, bounds.length - 1);
}

/* ------------------------- minimal OOXML .xlsx writer ------------------------ */

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function sheetXml(rows: Row[], table: boolean): string {
  const body = rows
    .map((row, ri) => {
      const cells = row
        .map((cell, ci) => {
          const ref = `${colName(ci)}${ri + 1}`;
          const style = ri === 0 && table ? ' s="1"' : '';
          if (cell.n !== null) return `<c r="${ref}"${style}><v>${cell.n}</v></c>`;
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(cell.s)}</t></is></c>`;
        })
        .join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function buildXlsx(sheets: { name: string; rows: Row[]; table: boolean }[]): Blob {
  const n = sheets.length;
  const overrides = sheets
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('');
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const sheetTags = sheets.map((s, i) => `<sheet name="${esc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(wbRels),
    'xl/styles.xml': strToU8(STYLES),
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows, s.table));
  });
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * PDF → .xlsx fully in the browser: one worksheet per PDF page. Pages with a
 * consistent multi-column layout become real cell grids (header row bold);
 * plain-text pages fall back to one column of rows. Scanned PDFs are routed
 * through the existing OCR pipeline first (its positioned text layer is then
 * grid-extracted). Numbers are written as numeric cells.
 */
export async function pdfToExcel(bytes: Uint8Array, onProgress?: (p: ExcelProgress) => void): Promise<ExcelResult> {
  const analysis = await analyzePdf(bytes);
  const total = analysis.pages;
  let srcBytes = bytes;
  let ocrUsed = false;

  if (!analysis.searchable) {
    onProgress?.({ stage: 'Scanned PDF detected — reading pages with OCR…', page: 0, totalPages: total, percent: 1 });
    const ocr = await runOcr(
      bytes,
      { ocr: true, deskew: true, denoise: true, contrast: true, sharpen: true, readability: false },
      (p) => onProgress?.({ stage: `OCR page ${p.page} of ${p.totalPages}…`, page: p.page, totalPages: p.totalPages, percent: p.percent }),
    );
    srcBytes = new Uint8Array(await ocr.blob.arrayBuffer());
    ocrUsed = true;
  }

  const src = await openPdf(srcBytes);
  const sheets: { name: string; rows: Row[]; table: boolean }[] = [];
  let rowsTotal = 0;
  try {
    for (let p = 1; p <= total; p++) {
      onProgress?.({ stage: `Reading page ${p} of ${total}…`, page: p, totalPages: total, percent: Math.round((p / total) * 92) });
      const page = await src.getPage(p);
      const tc = await page.getTextContent();
      const items: Item[] = [];
      for (const it of tc.items as Array<{ str?: string; transform: number[] }>) {
        const str = (it.str ?? '').trim();
        if (!str) continue;
        items.push({ str, x: it.transform[4], y: it.transform[5], w: (it as { width?: number }).width ?? 0 });
      }
      const { rows, table } = pageGrid(items);
      sheets.push({ name: `Page ${p}`, rows, table });
      rowsTotal += rows.length;
      page.cleanup();
    }
  } finally {
    void src.destroy();
  }

  if (!rowsTotal) throw new Error('No text or tables could be read from this PDF.');
  onProgress?.({ stage: 'Writing your Excel file…', page: total, totalPages: total, percent: 96 });
  const blob = buildXlsx(sheets);
  onProgress?.({ stage: 'Done', page: total, totalPages: total, percent: 100 });
  return { blob, pages: total, sheets: sheets.length, rows: rowsTotal, ocrUsed };
}
