# Maintaining MyPasswordCreator

Notes for the maintainer: layout, settings, commands and deploy. Visitors want the [README](../README.md).

## Layout

```
src/core/      Security logic (pure ES modules, unit-tested, reusable on other sites)
  random.js      crypto.getRandomValues + rejection sampling (no modulo bias)
  generator.js   passwords + exact entropy (inclusion–exclusion)
  passphrase.js  EFF-wordlist passphrases
  strength.js    rating + time-to-guess (assumes 1e11 guesses/sec)
  hibp.js        Have I Been Pwned k-anonymity lookup (padding, caching, real errors)
  pin.js         PINs that skip repeats, runs, years, keypad lines, and known favourites
  wifi.js        Wi-Fi keys (8–63 chars) and the WIFI: QR payload
  bulk.js        Bulk batches (1–250, labels), CSV/TSV export with formula-injection guard
  qrcode.js      Vendored qrcode-generator 1.4.4 (MIT)
  eff-*.js       EFF large (7,776) and short (1,296) word lists
src/sw.js      Service worker template (offline support); build fills in the file list
src/js/        Page scripts (UI only)
src/css/       site.css (design tokens at the top)
src/fonts/     Self-hosted Public Sans + JetBrains Mono (OFL)
src/partials/  layout, vault, aside
src/pages/     One file per page; JSON meta block at top sets title/description/etc.
public/        Copied as-is: _headers (CSP etc.), _redirects (old .aspx URLs), icons, OG image
scripts/       build.mjs (→ dist/), serve.mjs (local preview with real headers)
test/          node --test
```

## Site settings (site.config.json)

- `supportUrl`: your Ko-fi page (must start with https://). When set, a coffee-cup support line appears in the footer (`supportIntro` + linked `supportLabel`) and a short section on the About page. Empty = hidden.
- `businessUrl`: SecurePasscode.com once it exists. When set, the footer shows "Need this for your business? SecurePasscode." Empty = hidden.
- Edit the file, then commit and push. Cloudflare rebuilds automatically.

## Commands

```
npm test          # core unit tests
npm run build     # builds dist/
npm run preview   # build + local server at http://localhost:8788 (applies _headers/_redirects)
npm run deploy    # build + wrangler deploy (needs `npx wrangler login` once)
```

Node 20+. No `npm install` needed except for wrangler, which npx fetches.

## Deploy (live setup: GitHub → Cloudflare Pages)

Repo: github.com/arcit-creator/mypasswordcreator. Cloudflare Pages project `mypasswordcreator`:
- Framework preset: None
- Build command: `npm run build`
- Build output directory: `dist`

Every push to `main` rebuilds and deploys production automatically. Preview URL: https://mypasswordcreator.pages.dev
Custom domains: mypasswordcreator.com and www.mypasswordcreator.com.

Update workflow:
```
git add .
git commit -m "what changed"
git push
```

`wrangler.jsonc` is only used if you ever move to Workers (`npm run deploy`); Pages ignores it.

## Rules for future changes

- Anything third-party (scripts, fonts, widgets, analytics) needs its domain added to the CSP in `public/_headers`, and the privacy page plus the "no ads / no tracking" lines in `tips.html`, `about.html` and `aside.html` must be updated in the same commit. The site promises no tracking, so a change like that needs a deliberate decision first.
- `sw.js` is regenerated on every build. Never cache cross-origin requests.
- Staging: the `staging` branch deploys to staging.mypasswordcreator.pages.dev (behind Cloudflare Access). `main` is production. Confirm `main` == `staging` after every push.
