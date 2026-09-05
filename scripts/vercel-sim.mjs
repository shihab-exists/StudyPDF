/**
 * Vercel routing simulator — validates the deployment contract locally:
 *
 *   1. filesystem first  → static files from client/dist AND Vercel Functions
 *                          (api/*.ts compiled exactly like @vercel/node does)
 *   2. then rewrites     → loaded from the REAL vercel.json
 *   3. else 404
 *
 * This mirrors https://vercel.com/docs/project-configuration/vercel.json
 * ("precedence is given to the filesystem prior to rewrites being applied").
 *
 *   node scripts/vercel-sim.mjs        → http://localhost:3999
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STATIC = path.join(ROOT, 'client', 'dist');
const PORT = Number(process.env.SIM_PORT || 3999);

/* ------------------------- compile the Vercel Function ------------------------ */
const FN_OUT = '/tmp/vsim-health.cjs';
await esbuild.build({
  entryPoints: [path.join(ROOT, 'api', 'health.ts')],
  outfile: FN_OUT,
  bundle: false,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
});
const require = createRequire(import.meta.url);
const fnModule = require(FN_OUT);
const healthHandler = fnModule.default || fnModule;
const FUNCTIONS = { '/api/health': healthHandler }; // api/<name>.ts → /api/<name>

/* ------------------------------ load vercel.json ------------------------------ */
const vconf = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const rewrites = (vconf.rewrites || []).map((r) => ({
  re: new RegExp('^' + r.source + '$'),
  dest: r.destination,
}));

/* ---------------------------------- mime map --------------------------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.gz': 'application/gzip',
  '.bcmap': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

function serveFile(res, file) {
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': fs.statSync(file).size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=600',
  });
  fs.createReadStream(file).pipe(res);
}

/* ------------------------- Vercel-style function invoke ------------------------ */
function invokeFunction(handler, req, res) {
  process.env.VERCEL = '1'; // functions see VERCEL env on the platform
  const shimRes = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return {
        json: (body) => {
          const buf = Buffer.from(JSON.stringify(body));
          res.writeHead(this.statusCode, { 'Content-Type': 'application/json', 'Content-Length': buf.length });
          res.end(buf);
        },
      };
    },
  };
  handler(req, shimRes);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let p = decodeURIComponent(url.pathname);
  if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);

  // 1) filesystem: Vercel Functions
  if (FUNCTIONS[p]) return invokeFunction(FUNCTIONS[p], req, res);

  // 2) filesystem: static output
  const candidate = path.join(STATIC, p === '/' ? 'index.html' : p);
  if (p !== '/' && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return serveFile(res, candidate);
  }

  // 3) rewrites (from vercel.json)
  for (const r of rewrites) {
    const m = p.match(r.re);
    if (m) {
      const dest = r.dest.replace(/\$(\d)/g, (_s, i) => m[Number(i)] ?? '');
      const destFile = path.join(STATIC, dest === '/' ? 'index.html' : dest);
      if (fs.existsSync(destFile)) return serveFile(res, destFile);
      res.writeHead(404);
      return res.end('rewrite destination missing');
    }
  }

  // 4) 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[vercel-sim] serving ${path.relative(ROOT, STATIC)} + ${Object.keys(FUNCTIONS).join(', ')} on :${PORT}`);
  console.log(`[vercel-sim] rewrites: ${rewrites.map((r) => r.re.source + ' → ' + r.dest).join(' | ')}`);
});
