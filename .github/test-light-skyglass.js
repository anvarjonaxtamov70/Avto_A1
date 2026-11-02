'use strict';
/* Sky Glass light-only regression guard.
   No network or Firebase needed. Exits non-zero if CSS leaks to Dark mode. */
const fs = require('fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('index.html', 'utf8');
const cssPath = 'light-skyglass-preview/avtoa1-light-only.css';
const css = fs.readFileSync(cssPath, 'utf8');
const doc = fs.readFileSync('light-skyglass-preview/index.html', 'utf8');

const href = 'href="' + cssPath + '?v=1"';
assert.equal(html.split(href).length - 1, 1, 'Sky Glass CSS link must occur exactly once');
assert.match(html, /setAttribute\('data-theme',\s*[^)]*['"]light['"]/,
             'The original Light/Dark theme marker should remain');
assert.match(html, /id="main-slider"/, 'Existing managed banner slider must remain');
assert.match(html, /id="home-products"/, 'Original product catalogue must remain');
assert.match(html, /class="bottom-nav"/, 'Original navigation must remain');
assert.match(css, /#2f8fd8/i, 'Approved primary blue missing');
assert.match(css, /#247bc1/i, 'Approved deep blue missing');
assert.match(css, /backdrop-filter\s*:/, 'Glass blur missing');

const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
let cursor = 0, depth = 0, rules = 0;
for (let i = 0; i < clean.length; i++) {
  if (clean[i] === '{') {
    const selector = clean.slice(cursor, i).trim();
    const media = selector.startsWith('@media');
    assert.ok(media || selector.startsWith('html[data-theme="light"][data-theme="light"]'),
      'Unscoped CSS selector would affect Dark mode: ' + selector.slice(0, 100));
    rules++; depth++; cursor = i + 1;
  } else if (clean[i] === '}') {
    depth--;
    assert.ok(depth >= 0, 'Unexpected CSS closing brace');
    cursor = i + 1;
  }
}
assert.equal(depth, 0, 'CSS braces are unbalanced');
assert.ok(rules >= 15, 'Expected Light-only CSS rules are missing');
assert.doesNotMatch(css, /html\[data-theme=["']dark["']\]/, 'CSS must not modify Dark mode');
assert.equal((doc.match(/data-slide="/g) || []).length, 3, 'Demo must contain exactly three banner slides');
assert.match(doc, /sky-carousel-dots/, 'Banner pagination is missing');
assert.match(doc, /class="product-grid"/, 'Product grid demo is missing');
assert.match(doc, /class="bottom-nav glass"/, 'Bottom glass navigation demo is missing');

console.log('✅ Sky Glass: Light-only scope, original hooks, 3 slides, product cards, glass nav checked (' + rules + ' CSS rules).');
