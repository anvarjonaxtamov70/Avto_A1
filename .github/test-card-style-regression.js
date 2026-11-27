'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const match = html.match(/<script\b[^>]*\bid="card-style-switch"[^>]*>([\s\S]*?)<\/script>/);
assert.ok(match, 'Card style controller must exist');
function boot(cached) {
  const storage = new Map(cached === undefined ? [] : [['avto_card_style', cached]]);
  let callback, renders = 0, writes = [];
  const window = { renderProducts() { renders++; } };
  const db = { ref(key) {
    assert.equal(key, 'settings/ui/cardStyle');
    return { on(event, fn) { assert.equal(event, 'value'); callback = fn; },
      set(value) { writes.push(value); return Promise.resolve(); } };
  }};
  const context = { window, db, document: { getElementById() { return null; } },
    localStorage: { getItem(k) { return storage.get(k); }, setItem(k,v) { storage.set(k,v); } },
    setTimeout() {} };
  vm.runInNewContext(match[1], context);
  assert.equal(typeof callback, 'function');
  return { window, storage, writes, emit(v) { callback({val: () => v}); }, renders: () => renders };
}
(async () => {
  for (const style of ['market','appstore','classic']) {
    const app = boot(style);
    assert.equal(app.window.CardStyle.get(), style);
    for (const next of ['market','appstore','classic']) {
      const before = app.renders();
      const previous = app.window.CardStyle.get();
      app.emit(next);
      assert.equal(app.window.CardStyle.get(), next);
      assert.equal(app.renders(), before + Number(previous !== next));
    }
    app.emit('invalid');
    assert.equal(app.window.CardStyle.get(), 'classic');
    assert.equal(app.storage.get('avto_card_style'), 'classic');
    app.window.CardStyle.set('market');
    await Promise.resolve();
    assert.equal(app.window.CardStyle.get(), 'market');
    assert.deepEqual(app.writes, ['market']);
    app.window.CardStyle.set('invalid');
    assert.deepEqual(app.writes, ['market']);
  }
  assert.equal(boot('invalid').window.CardStyle.get(), 'market');
  assert.equal(boot().window.CardStyle.get(), 'market');
  assert.match(html, /_cardStyle\s*===\s*'appstore'/);
  assert.match(html, /_cardStyle\s*===\s*'market'/);
  assert.match(html, /classic:\s*\{/);
  console.log('Card style regression guards passed');
})().catch(err => { console.error(err); process.exitCode = 1; });
