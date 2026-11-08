import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(repoRoot, 'out');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';

if (!fs.existsSync(path.join(root, 'index.html'))) {
  throw new Error('Static export not found. Run `pnpm build` first.');
}

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function resolveRequest(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const relative = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  const candidate = path.resolve(root, relative);
  if (!candidate.startsWith(root + path.sep) && candidate !== path.join(root, 'index.html')) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  if (!path.extname(candidate)) {
    const html = `${candidate}.html`;
    if (fs.existsSync(html)) return html;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const file = resolveRequest(req.url || '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Visual preview: http://${host}:${port}`);
});
