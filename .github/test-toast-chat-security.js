'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('index.html');
const source = html.match(/function showToast\(m, t = 'success'\)\s*\{[\s\S]*?\n\}/);
assert.ok(source, 'real deployed toast function must exist');
const appended = [];
const timers = [];
const sandbox = {
  document: {
    getElementById(id) {
      assert.equal(id, 'toast-container');
      return { appendChild(el) { appended.push(el); } };
    },
    createElement(tag) {
      assert.equal(tag, 'div');
      return { style: {}, lastElementChild: {}, remove() { this.removed = true; } };
    }
  },
  setTimeout(fn, delay) { timers.push({fn, delay}); }
};
vm.runInNewContext(source[0], sandbox);
const messages = ['<img src=x onerror="throw 1">', '<b>Mahsulot</b> & narx', "O'zbekcha ✅", 'Ошибка'];
for (const kind of ['success', 'warning']) {
  for (const message of messages) {
    sandbox.showToast(message, kind);
    const el = appended.at(-1);
    assert.equal(el.className, 'toast');
    assert.ok(el.innerHTML.includes(kind === 'success' ? '#i-check' : '#i-alert'));
    assert.ok(!el.innerHTML.includes(message), 'message must never become markup');
    assert.equal(el.lastElementChild.textContent, message);
    assert.ok(el.style.boxShadow);
    const timer = timers.at(-1);
    assert.equal(timer.delay, 3000);
    timer.fn();
    assert.equal(el.removed, true);
  }
}
// Structural RTDB rules guard; actual Rules evaluation requires the Firebase emulator.
const rules = JSON.parse(read('database.rules.json').replace(/^\s*\/\/.*$/gm, '')).rules;
const msg = rules.order_chats.$uid.$orderId.$msgId;
assert.equal(msg['.validate'], "newData.hasChildren(['sender', 'text', 'time'])");
assert.match(msg.sender['.validate'], /newData\.val\(\) === 'mijoz'/);
assert.match(msg['.write'], /!data\.exists\(\)/);
assert.match(msg.text['.validate'], /isString\(\)/);
assert.match(msg.time['.validate'], /isNumber\(\)/);
console.log('Toast text rendering and required chat fields: OK');
