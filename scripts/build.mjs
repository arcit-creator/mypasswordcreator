// Static site build: assembles pages from partials into dist/.
// No dependencies. Run with `npm run build`.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { passwordEntropyBits } from '../src/core/generator.js';
import { passphraseEntropyBits } from '../src/core/passphrase.js';
import { describeStrength } from '../src/core/strength.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const ORIGIN = 'https://mypasswordcreator.com';
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const safeUrl = (u) => (typeof u === 'string' && /^https:\/\/[^\s"<>]+$/.test(u) ? u : '');
const SUPPORT_URL = safeUrl(CONFIG.supportUrl);
const BUSINESS_URL = safeUrl(CONFIG.businessUrl);
function footerExtras() {
  const links = [];
  if (SUPPORT_URL) links.push(`<a href="${esc(SUPPORT_URL)}" rel="noopener">${esc(CONFIG.supportLabel || 'Support this site')}</a>`);
  if (BUSINESS_URL) links.push(`<a href="${esc(BUSINESS_URL)}" rel="noopener">${esc(CONFIG.businessLabel || 'For business')}</a>`);
  return links.length ? `      <p class="footer-extras">${links.join(' <span aria-hidden="true">|</span> ')}</p>` : '';
}
function supportPara() {
  if (!SUPPORT_URL) return '';
  return `    <h2>Support this site</h2>\n    <p>MyPasswordCreator is free and has no ads. If it's useful to you, you can <a href="${esc(SUPPORT_URL)}" rel="noopener">support it here</a>. Support goes to keeping the site running and building new tools. It isn't a charity, so it isn't tax-deductible.</p>`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Content hash of all static assets → cache-busting folder name.
const assetDirs = ['css', 'js', 'core', 'fonts'];
const hash = createHash('sha256');
for (const d of assetDirs) for (const f of walk(join(SRC, d)).sort()) hash.update(f.slice(SRC.length)).update(readFileSync(f));
const BUILD = hash.digest('hex').slice(0, 10);

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, 'public'), DIST, { recursive: true });
for (const d of assetDirs) cpSync(join(SRC, d), join(DIST, 'assets', BUILD, d), { recursive: true });

const partials = Object.fromEntries(
  readdirSync(join(SRC, 'partials')).map((f) => [f.replace(/\.html$/, ''), readFileSync(join(SRC, 'partials', f), 'utf8')]),
);

function renderPartials(html) {
  return html.replace(/\{\{>\s*(\w+)((?:\s+\w+="[^"]*")*)\s*\}\}/g, (_, name, argStr) => {
    let body = partials[name];
    if (body === undefined) throw new Error(`Missing partial: ${name}`);
    for (const [, k, v] of argStr.matchAll(/(\w+)="([^"]*)"/g)) body = body.replaceAll(`{{${k}}}`, v);
    return body;
  });
}

function lengthTable() {
  const rows = [8, 12, 16, 20].map((n) => {
    const s = describeStrength(passwordEntropyBits({ length: n, classes: ['upper', 'lower', 'digits', 'symbols'] }));
    return `<tr><td>${n} characters</td><td class="num">${Math.round(s.bits)} bits</td><td>${s.timeText}</td></tr>`;
  });
  const pp = [5, 6, 7].map((n) => {
    const s = describeStrength(passphraseEntropyBits({ wordlistSize: 7776, words: n }));
    return `<tr><td>${n}-word passphrase</td><td class="num">${Math.round(s.bits)} bits</td><td>${s.timeText}</td></tr>`;
  });
  return `<table class="data"><thead><tr><th scope="col">Random password</th><th scope="col">Strength</th><th scope="col">Time to guess</th></tr></thead><tbody>${[...rows, ...pp].join('')}</tbody></table>`;
}

const stripTags = (s) => s.replace(/<table[\s\S]*?<\/table>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function schemaFor(meta, content) {
  const blocks = [];
  if (meta.schema === 'app') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'MyPasswordCreator',
      url: ORIGIN + '/',
      applicationCategory: 'SecurityApplication',
      operatingSystem: 'Any (runs in the browser)',
      browserRequirements: 'Requires JavaScript and the Web Crypto API',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: meta.description,
    });
    blocks.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'MyPasswordCreator', url: ORIGIN + '/' });
  }
  if (meta.schema === 'faq') {
    const items = [...content.matchAll(/<summary>([\s\S]*?)<\/summary>\s*<div class="answer">([\s\S]*?)<\/div>\s*<\/details>/g)];
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map(([, q, a]) => ({
        '@type': 'Question',
        name: stripTags(q),
        acceptedAnswer: { '@type': 'Answer', text: stripTags(a) },
      })),
    });
  }
  return blocks.map((b) => `<script type="application/ld+json">${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`).join('\n');
}

const layout = partials.layout;
const sitemap = [];

for (const file of readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html'))) {
  const raw = readFileSync(join(SRC, 'pages', file), 'utf8');
  const m = raw.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`${file}: missing meta block`);
  const meta = JSON.parse(m[1]);
  let content = renderPartials(raw.slice(m[0].length))
    .replaceAll('{{lengthTable}}', lengthTable())
    .replaceAll('{{supportPara}}', supportPara())
    .replaceAll('{{buildDate}}', new Date(BUILD_DATE + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }));

  const url = ORIGIN + (meta.path === '/' ? '/' : meta.path);
  let html = layout
    .replace('{{content}}', content)
    .replaceAll('{{footerExtras}}', footerExtras())
    .replaceAll('{{title}}', esc(meta.title))
    .replaceAll('{{ogTitle}}', esc(meta.ogTitle || meta.title))
    .replaceAll('{{description}}', esc(meta.description))
    .replaceAll('{{url}}', url)
    .replaceAll('{{origin}}', ORIGIN)
    .replaceAll('{{robots}}', meta.noindex ? 'noindex' : 'index, follow')
    .replaceAll('{{schema}}', schemaFor(meta, content))
    .replaceAll('{{scripts}}', (meta.scripts || []).map((s) => `<script type="module" src="/assets/{{build}}/js/${s}"></script>`).join('\n'))
    .replaceAll('{{build}}', BUILD)
    .replace(/\{\{nav:(\w+)\}\}/g, (_, k) => (k === meta.nav ? 'aria-current="page"' : ''));

  if (meta.noindex) html = html.replace(/<link rel="canonical"[^>]*>\n/, '');
  const leftover = html.match(/\{\{[^}]+\}\}/);
  if (leftover) throw new Error(`${file}: unreplaced token ${leftover[0]}`);

  const out = meta.path === '/' ? 'index.html' : `${meta.path.slice(1)}.html`;
  writeFileSync(join(DIST, out), html);
  if (!meta.noindex) sitemap.push({ loc: url, priority: meta.priority || '0.5' });
  console.log(`  ${out}`);
}

// Service worker: precache every page and every asset in this build.
const swPages = sitemap.map((s) => new URL(s.loc).pathname.replace(/\/$/, '') || '/');
const swAssets = [
  ...walk(join(DIST, 'assets', BUILD)).filter((f) => !/LICENSE|\.txt$/.test(f)).map((f) => f.slice(DIST.length).split('\\').join('/')),
  '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/manifest.webmanifest', '/img/icon-192.png', '/img/icon-512.png',
];
writeFileSync(
  join(DIST, 'sw.js'),
  readFileSync(join(SRC, 'sw.js'), 'utf8')
    .replace('__BUILD__', BUILD)
    .replace('__PAGES__', JSON.stringify(swPages))
    .replace('__ASSETS__', JSON.stringify(swAssets)),
);

writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
    .map((s) => `  <url><loc>${s.loc}</loc><lastmod>${BUILD_DATE}</lastmod><priority>${s.priority}</priority></url>`)
    .join('\n')}\n</urlset>\n`,
);
console.log(`Built ${sitemap.length + 1} pages, assets/${BUILD}`);
