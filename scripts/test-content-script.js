const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const styleElement = { id: '', textContent: '' };
const storage = {
  hideShorts: false,
  shortsHardMode: true,
  shortsReenableUntil: Date.now() + 60_000
};
let timerDelay = null;

const context = vm.createContext({
  console,
  document: {
    head: { appendChild() {} },
    body: { addEventListener() {} },
    createElement() { return styleElement; }
  },
  window: {
    location: {
      pathname: '/',
      replace() {}
    }
  },
  chrome: {
    storage: {
      local: {
        async get() { return { ...storage }; },
        async set(values) { Object.assign(storage, values); },
        async remove(key) { delete storage[key]; }
      },
      onChanged: { addListener() {} }
    }
  },
  setTimeout(callback, delay) {
    timerDelay = delay;
    return 1;
  },
  clearTimeout() {}
});

vm.runInContext(fs.readFileSync(path.join(root, 'hard-mode.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'unhook.js'), 'utf8'), context);

async function main() {
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(styleElement.textContent.includes('a[href^="/shorts/"]'), false);
  assert.ok(timerDelay > 0 && timerDelay <= 60_000);

  storage.shortsReenableUntil = Date.now() - 1;
  await vm.runInContext('main()', context);

  assert.equal(styleElement.textContent.includes('a[href^="/shorts/"]'), true);
  assert.equal(storage.hideShorts, true);
  assert.equal('shortsReenableUntil' in storage, false);
  console.log('Content script Hard Mode tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
