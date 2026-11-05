#!/usr/bin/env node
// Builds the site into dist/:
//   dist/<lang>/index.html            the gallery, one per language
//   dist/<lang>/<slug>/index.html     each machine, one self-contained page per language (<html lang> set, the
//                                     machine's i18n reads it), under 1 MB so link crawlers read its share card
//   dist/<slug>/og.png                each machine's share card (and the gallery's thumbnail)
//   dist/og.png (the collection's card, from static/), favicon, 404.html, and dist/_headers with a Content-Security-Policy that allows exactly the inline
//   scripts of the pages by their hashes.
//
//   npm run build                 every machine
//   ONLY=quantum npm run build    one machine (and the gallery)
//
// Adapted from the teardown kit's sims/build.mjs (MIT, kit/LICENSE): three.js and the fonts are inlined, the pages
// open offline.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as esbuild from 'esbuild';
import {CHROME_CSS, footerHTML, headerHTML} from '../shared/chrome.js';
import {GALLERY, MACHINES} from './machines.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const NM = path.join(ROOT, 'node_modules');
export const SITE = 'https://exploded.storagebits.workers.dev';
const LANGS = ['en', 'fr', 'es'];
const MAX_PAGE = 1024 * 1024;
const only = process.env.ONLY;
const machines = MACHINES.filter((m) => !only || m.slug === only);

const font = (file, family, weight) => {
  const b64 = fs.readFileSync(path.join(NM, file)).toString('base64');
  return `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
};
const FONTS = [
  ...[400, 600, 700].map((w) => font(`@fontsource/jetbrains-mono/files/jetbrains-mono-latin-${w}-normal.woff2`, 'JetBrains Mono', w)),
  font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'Inter', '100 900'),
  font('@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2', 'Instrument Serif', 400),
].join('\n');
const KIT_CSS = fs.readFileSync(path.join(ROOT, 'kit/style.css'), 'utf8');

// `teardown-kit/x.js` is the vendored kit in kit/
const kitPlugin = {
  name: 'teardown-kit',
  setup(b) {
    b.onResolve({filter: /^teardown-kit\//}, (args) => ({path: path.join(ROOT, 'kit', args.path.slice('teardown-kit/'.length))}));
  },
};
const bundle = async (entry) => {
  const res = await esbuild.build({
    plugins: [kitPlugin],
    entryPoints: [path.join(ROOT, entry)],
    bundle: true,
    format: 'esm',
    minify: !process.env.DEBUG,
    write: false,
    target: 'es2022',
    legalComments: 'none',
    loader: {'.woff2': 'base64'}, // a machine's own font, as the teardown kit's build loads it
    logLevel: 'warning',
  });
  return res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
};
const sha = (s) => crypto.createHash('sha256').update(s).digest('base64');
const hashes = new Set();

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const head = ({lang, title, description, locale, url, alt, image, extraCss = ''}) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
${alt}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#ecedef">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Exploded">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${locale}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${image}">
<style>
${FONTS}
${extraCss}
</style>
</head>`;
const alternates = (sub) =>
  LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE}/${l}/${sub}">`).join('\n') + (sub ? '' : `\n<link rel="alternate" hreflang="x-default" href="${SITE}/">`);
const write = (rel, html) => {
  if (html.length > MAX_PAGE && !process.env.DEBUG) {
    console.error(`dist/${rel} is ${(html.length / 1024).toFixed(0)} KB, over the 1 MB budget`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(path.join(DIST, rel)), {recursive: true});
  fs.writeFileSync(path.join(DIST, rel), html);
  console.log(`dist/${rel}  ${(html.length / 1024).toFixed(0)} KB`);
};

// Cloudflare Web Analytics (no cookie): the beacon on every page but the 404; its host is allowed in the CSP below.
// The token is public by design, it ends up in the HTML.
const BEACON = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "d40db2e4c8384583b627ead20dd0c055"}'></script>`;

fs.rmSync(DIST, {recursive: true, force: true});
fs.mkdirSync(DIST, {recursive: true});

// ------------------------------------------------------------ the machines
for (const m of machines) {
  const js = await bundle(m.entry);
  hashes.add(sha(js));
  for (const lang of LANGS) {
    const t = m.meta[lang];
    const html = `${head({lang, ...t, url: `${SITE}/${lang}/${m.slug}/`, alt: alternates(`${m.slug}/`), image: `${SITE}/${m.slug}/og.png`, extraCss: KIT_CSS})}
<body>
<div id="app"></div>
<script type="module">${js}</script>
${BEACON}
</body>
</html>
`;
    write(`${lang}/${m.slug}/index.html`, html);
  }
  fs.mkdirSync(path.join(DIST, m.slug), {recursive: true});
  fs.copyFileSync(path.join(ROOT, m.og), path.join(DIST, m.slug, 'og.png'));
}

// ------------------------------------------------------------ the gallery
// the language links set the cookie the Worker reads for `/`, as the machines' do
const LANG_JS = `for(const a of document.querySelectorAll('.lang'))a.addEventListener('click',()=>{document.cookie='lang='+a.dataset.lang+'; path=/; max-age=31536000; samesite=lax'});`;
hashes.add(sha(LANG_JS));
const GALLERY_CSS = `${CHROME_CSS}
html{background:#ebecee linear-gradient(#f4f4f5,#ebecee 55%,#e2e3e6) fixed;color:#16181b}
body{margin:0;font:16px/1.55 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1120px;margin:0 auto;padding:116px 32px 96px}
h1{font:400 64px/1 'Instrument Serif',Georgia,serif;letter-spacing:-.01em;margin:0 0 18px}
.lead{font-size:20px;line-height:1.45;max-width:640px;margin:0 0 8px}
.sub{color:rgba(22,24,27,.6);max-width:640px;margin:0 0 48px}
.grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px}
.card a{display:block;color:inherit;text-decoration:none;background:#f8f8f9;border:1px solid rgba(22,24,27,.1);box-shadow:0 1px 2px rgba(20,22,26,.04);transition:border-color .2s,box-shadow .2s}
.card a:hover{border-color:rgba(22,24,27,.28);box-shadow:0 6px 22px rgba(20,22,26,.08)}
.card a:focus-visible{outline:2px solid #ef4a1d;outline-offset:3px}
.card img{display:block;width:100%;height:auto;aspect-ratio:1200/630;object-fit:cover;border-bottom:1px solid rgba(22,24,27,.08)}
.card .txt{padding:18px 20px 20px}
.card h2{font:400 30px/1.1 'Instrument Serif',Georgia,serif;margin:0 0 8px}
.card p{margin:0 0 14px;color:rgba(22,24,27,.7);font-size:15px}
.card .go{font:600 11px/1 'JetBrains Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#16181b;border-bottom:1.5px solid #ef4a1d;padding-bottom:3px}
@media (max-width:600px){main{padding:84px 16px 72px}h1{font-size:46px}.lead{font-size:18px}.grid{grid-template-columns:1fr}}
`;
for (const lang of LANGS) {
  const g = GALLERY[lang];
  const cards = MACHINES.map(
    (m) => `<li class="card"><a href="/${lang}/${m.slug}/"><img src="/${m.slug}/og.png" width="1200" height="630" alt="" loading="lazy"><div class="txt"><h2>${m.name}</h2><p>${esc(m.meta[lang].line)}</p><span class="go">${g.open} →</span></div></a></li>`,
  ).join('\n');
  const html = `${head({lang, ...g, url: `${SITE}/${lang}/`, alt: alternates(''), image: `${SITE}/og.png`, extraCss: GALLERY_CSS})}
<body>
<header class="site-top">${headerHTML('', '', lang)}</header>
<main>
<h1>Exploded</h1>
<p class="lead">${esc(g.lead)}</p>
<p class="sub">${esc(g.sub)}</p>
<ul class="grid">
${cards}
</ul>
</main>
<footer class="site-foot">${footerHTML('', '', lang)}</footer>
<script>${LANG_JS}</script>
${BEACON}
</body>
</html>
`;
  write(`${lang}/index.html`, html);
}

// ------------------------------------------------------------ static files, 404, headers
for (const f of fs.readdirSync(path.join(ROOT, 'static'))) fs.copyFileSync(path.join(ROOT, 'static', f), path.join(DIST, f));
fs.writeFileSync(
  path.join(DIST, '404.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Exploded · not found</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#ecedef;color:#16181b;font:16px/1.5 system-ui,sans-serif}a{color:#ef4a1d}</style></head><body><p>Nothing here. <a href="/">Back to the machines</a></p></body></html>\n`,
);
const csp = [
  "default-src 'self'",
  `script-src 'self' https://static.cloudflareinsights.com ${[...hashes].map((h) => `'sha256-${h}'`).join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
fs.writeFileSync(
  path.join(DIST, '_headers'),
  `/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Content-Security-Policy: ${csp}
`,
);
console.log(`dist/_headers  ${hashes.size} script hashes`);
