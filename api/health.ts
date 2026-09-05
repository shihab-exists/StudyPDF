/**
 * Vercel serverless smoke-test endpoint (Node runtime, configured in vercel.json).
 * The app itself is fully client-side; this function only proves the deployment
 * is alive and reports the runtime. No filesystem access, no binaries, no secrets.
 */
type Res = { status: (code: number) => { json: (body: unknown) => void } };

export default function handler(_req: unknown, res: Res) {
  res.status(200).json({
    ok: true,
    runtime: process.env.VERCEL ? 'vercel' : 'local',
    processing: 'client-side (pdf.js + pdf-lib + tesseract.js)',
    storage: 'browser IndexedDB, auto-deleted after 24h',
  });
}
