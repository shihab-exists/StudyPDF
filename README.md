# StudyPDF — Simple PDF tools for students

16 genuinely working PDF utilities that run **entirely in your browser**.
No uploads, no server storage, no binaries — deploy as a static site + one tiny serverless smoke-test.

| Organize PDF | Edit & Customize | Convert | Extract & Inspect |
| --- | --- | --- | --- |
| Compress PDF · Merge PDFs · Split PDF · Page Manager · Rotate All Pages | Add Page Numbers · Watermark PDF · Protect PDF (AES-256) | PDF to Images · Images to PDF · PDF to Word · PDF to PowerPoint · PDF to Excel | OCR & Enhance · Extract Text · PDF Info |

## How it works

```
upload (IndexedDB, 24 h) → pdf.js / pdf-lib / canvas / tesseract.js (in-browser) → download
```

- **pdf.js** renders, analyses and extracts text (`cmaps` + `standard_fonts` vendored, same-origin worker).
- **@cantoo/pdf-lib** (pdf-lib fork) merges, splits, rotates, stamps text, embeds images — and does **real AES-256 encryption** (`/V 5 /R 6`) for Protect PDF.
- **canvas pipeline** powers Compress (re-render at 96–150 dpi), enhance (deskew/denoise/contrast/sharpen/readability) and PDF→Images.
- **tesseract.js v6** runs OCR with vendored worker + WASM + English traineddata (jsdelivr CDN fallback, download-only).
- **fflate** zips multi-file results (Split, PDF→Images).
- **IndexedDB** (`studypdf` / `files`) is "My Files"; `sweepExpired()` deletes anything older than 24 h on app start.

Nothing is uploaded anywhere. The only network calls: same-origin static assets, the optional `/api/health` smoke-test (no payload), OCR language-model downloads, and Google Fonts CSS.

## Run locally

```bash
npm install          # root workspace (client only)
npm run dev          # http://localhost:5173
npm run build        # vendors assets (cmaps/fonts/tess/tessdata) + vite build
npm start            # preview the production build on :3000
npm run samples      # regenerate samples/*.pdf + *.png test fixtures
```

Optional overrides (baked at build time, defaults 100 MB / 24 h):
`VITE_MAX_UPLOAD_MB`, `VITE_FILE_TTL_HOURS` — see `.env.example`. No required env vars.

## Deploy to Vercel

```bash
git init && git add -A && git commit -m "StudyPDF v3 — 16 browser-side PDF tools"
git remote add origin <your-repo> && git push -u origin main
```

1. Vercel → **Add New… → Project** → import the repo.
2. **Root Directory must be the repository root** (leave the field empty). If this project was imported when the code lived in a nested folder (e.g. `studypdf/`), a stale Root Directory makes Vercel build an empty/missing folder → every route returns `404 NOT_FOUND`. Fix: Project → Settings → General → Root Directory → clear it (or set the correct folder), then redeploy.
3. Everything else is read from `vercel.json`: install `npm install --no-audit --no-fund`, build `npm run build`, output `client/dist`, function `api/health.ts` (Node 20), SPA rewrite (`/(.*) → /index.html`, applied *after* the filesystem check so `/api/health` and static assets are never swallowed), immutable-asset headers. **No env vars to set.**
4. Smoke-test `https://<project>.vercel.app/api/health` → `{"ok":true,"runtime":"vercel",…}`, then hard-refresh `/compress`, `/split`, `/ocr` (deep links must return the SPA shell, not 404).
5. `uploads/` in the repo is an **archived static asset only** (the original design reference photo). It is never written to at runtime — user files live in the visitor's browser (IndexedDB, 24 h).

## Testing

```bash
sudo apt-get install -y chromium poppler-utils      # E2E-only tools
node scripts/vercel-sim.mjs                          # Vercel routing contract on :3999
E2E_BASE=http://localhost:3999 npm run e2e           # 34 checks, real output files
E2E_BASE=http://localhost:3999 node scripts/e2e-pages.mjs  # 20 preview/section/navigation checks
E2E_BASE=http://localhost:3999 node scripts/e2e-convert.mjs # Word/PowerPoint output containers (.docx/.pptx ZIP entries)
node scripts/test-sections.mjs                       # 75 unit assertions: virtual-section math
LONG_PAGES=5432 PDF_OUT=/tmp/long5432.pdf node scripts/repro-long.mjs   # any page count, same code path
node scripts/repro-long.mjs                          # 1260-page PDF: lazy-render + layout proof
```

Page counts are unlimited: the only upload boundary is the 100 MB file-size rule.
Documents longer than 100 pages are viewed through virtual 100-page sections
(one original PDF, one pdf.js document, 100 DOM cells at a time); selections,
reordering, rotation and extraction always use absolute page identity, so they
survive section navigation and cross section boundaries.

The suite drives the built app in headless Chromium and verifies actual bytes: page counts, rotation angles, OCR text layers (`pdftotext`), PNG magic bytes, ZIP entries, aspect-ratio ordering, and that protected PDFs refuse to open without the password. `e2e-pages.mjs` additionally proves the visual page grid is real: selections, reorders, rotations and deletions made on thumbnails must appear in the generated PDFs (checked with pdf-lib + `pdftotext`), and that a 1260-page document renders only ~a couple of dozen thumbnails instead of 1260 canvases.

## Known limitations

- OCR needs a few seconds per page; very large scans depend on the visitor's RAM (100 MB cap, graceful errors).
- Only English OCR language is vendored; other languages fall back to a runtime CDN download.
- Compress re-rasterises pages at the chosen DPI; the smaller of raster-vs-original always wins, so savings can honestly be 0 %.
- Protect/PDF encryption uses the PDF standard security handler — the password is real protection; permission flags (print/copy/modify) are advisory hints honoured by most viewers.
- StudyPDF cannot open password-protected PDFs, so Protect is always the last step of a workflow.
- Unknown `/api/*` paths return the SPA shell (the frontend never calls them).

Made for students, with students in mind. 💙
