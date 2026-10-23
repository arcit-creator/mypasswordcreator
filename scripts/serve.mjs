// Local preview server that mimics Cloudflare static assets:
// clean URLs, 404 page, _headers and _redirects. `node scripts/serve.mjs [port]`
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.argv[2] || 8788);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

function parseHeaders() {
  const rules = [];
  let cur = null;
  for (const line of readFileSync(join(DIST, '_headers'), 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { cur = { pattern: line.trim(), headers: {} }; rules.push(cur); }
    else { const i = line.indexOf(':'); cur.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  }
  return rules;
}
const matches = (pattern, path) => new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(path);
const redirects = readFileSync(join(DIST, '_redirects'), 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.trim().split(/\s+/));

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  for (const [from, to, code] of redirects) {
    if (matches(from, path)) { res.writeHead(Number(code), { Location: to }); return res.end(); }
  }
  let file = normalize(join(DIST, path));
  if (!file.startsWith(DIST)) { res.writeHead(400); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  else if (!existsSync(file) && existsSync(file + '.html')) file += '.html';
  let status = 200;
  if (!existsSync(file) || path.startsWith('/_')) { file = join(DIST, '404.html'); status = 404; }
  const headers = { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' };
  for (const r of parseHeaders()) if (matches(r.pattern, path)) Object.assign(headers, r.headers);
  delete headers['Strict-Transport-Security'];
  if (headers['Content-Security-Policy']) headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace(/; upgrade-insecure-requests/, '');
  res.writeHead(status, headers);
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}`));
