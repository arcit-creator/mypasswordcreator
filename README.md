# MyPasswordCreator.com

Static site: password generator, passphrase generator, and private breach check.
No framework, no runtime dependencies, no server code. Hosted on Cloudflare Workers (static assets).

## Layout

```
src/core/      Security logic (pure ES modules, unit-tested, reusable on other sites)
  random.js      crypto.getRandomValues + rejection sampling (no modulo bias)
  generator.js   passwords + exact entropy (inclusion–exclusion)
  passphrase.js  EFF-wordlist passphrases
  strength.js    rating + time-to-guess (assumes 1e11 guesses/sec)
  hibp.js        Have I Been Pwned k-anonymity lookup (padding, caching, real errors)
src/js/        Page scripts (UI only)
src/css/       site.css (design tokens at the top)
src/fonts/     Self-hosted Public Sans + JetBrains Mono (OFL)
src/partials/  layout, vault, aside
src/pages/     One file per page; JSON meta block at top sets title/description/etc.
public/        Copied as-is: _headers (CSP etc.), _redirects (old .aspx URLs), icons, OG image
scripts/       build.mjs (→ dist/), serve.mjs (local preview with real headers)
test/          node --test
```

## Commands

```
npm test          # core unit tests
npm run build     # builds dist/
npm run preview   # build + local server at http://localhost:8788 (applies _headers/_redirects)
npm run deploy    # build + wrangler deploy (needs `npx wrangler login` once)
```

Node 20+. No `npm install` needed except for wrangler, which npx fetches.

## Deploy (GitHub → Cloudflare Workers)

1. Create a GitHub repo and push this folder.
2. Cloudflare dashboard → Workers & Pages → Create → Import a repository → pick the repo.
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
3. Test on the `*.workers.dev` URL (all pages, breach check, mobile, the old `/content/*.aspx` links).
4. Domain: mypasswordcreator.com must be on Cloudflare DNS. Worker → Settings → Domains & Routes →
   add Custom Domain `mypasswordcreator.com` and `www.mypasswordcreator.com`.
5. Add a Redirect Rule: `www.mypasswordcreator.com/*` → `https://mypasswordcreator.com/${1}` (301).
6. After cutover: Google Search Console → submit `https://mypasswordcreator.com/sitemap.xml`.
7. Optional: Cloudflare Web Analytics (cookieless). If you enable the JS beacon, add
   `https://static.cloudflareinsights.com` to script-src and `https://cloudflareinsights.com`
   to connect-src in `public/_headers`, and update the privacy page.

## Adding ads or analytics later

The CSP in `public/_headers` blocks every third-party script. Anything added later (AdSense, GA)
needs its domains added there, and the privacy page and the "no ads / no tracking" lines in
`tips.html`, `about.html`, and `aside.html` must be updated in the same change.
