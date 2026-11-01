# Third-party notices

MyPasswordCreator is licensed under the GNU Affero General Public License v3.0 or later (see `LICENSE`).
It includes the following third-party material, each under its own license.

## qrcode-generator 1.4.4 — `src/core/qrcode.js`

Vendored; the UMD wrapper was replaced with an ES module export. License: MIT.

```
Copyright (c) 2009 Kazuhiko Arase

URL: http://www.d-project.com/

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

"QR Code" is a registered trademark of DENSO WAVE INCORPORATED.

## EFF Diceware word lists — `src/core/eff-wordlist.js`, `src/core/eff-short-wordlist.js`

EFF Large Wordlist and EFF Short Wordlist #1 by the Electronic Frontier Foundation,
https://www.eff.org/dice. Licensed under Creative Commons Attribution 3.0 United States
(CC BY 3.0 US), https://creativecommons.org/licenses/by/3.0/us/. Converted to JavaScript arrays;
words unchanged.

## zxcvbn-ts — `src/core/zxcvbn.js`

Password strength estimator. @zxcvbn-ts/core 4.2.0, @zxcvbn-ts/language-common 4.1.3,
@zxcvbn-ts/language-en 4.1.1, @zxcvbn-ts/dictionary-compression 3.0.1,
https://github.com/zxcvbn-ts/zxcvbn. Bundled and minified into one ES module with esbuild
from `scripts/zxcvbn-entry.mjs`:
`npx esbuild scripts/zxcvbn-entry.mjs --bundle --format=esm --minify --outfile=src/core/zxcvbn.js`
(with the packages above installed). License: MIT.

```
Copyright (c) 2012-2016 Dan Wheeler and Dropbox, Inc.
Copyright (c) 2021 @zxcvbn-ts

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Fonts — `src/fonts/`

- Public Sans — SIL Open Font License 1.1. Full text: `src/fonts/LICENSE-public-sans.txt`.
- JetBrains Mono — SIL Open Font License 1.1. Full text: `src/fonts/LICENSE-jetbrains-mono.txt`.
