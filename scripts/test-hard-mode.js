const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
const source = fs.readFileSync(path.join(root, 'hard-mode.js'), 'utf8');
vm.runInContext(source, context);
const hardMode = vm.runInContext('globalThis.UnhookShortsHardMode', context);

const now = 1_800_000_000_000;

assert.equal(hardMode.shouldHideShorts({ hideShorts: true }, now), true);
assert.equal(hardMode.shouldHideShorts({ hideShorts: false }, now), false);
assert.equal(hardMode.shouldHideShorts({
  hideShorts: false,
  shortsHardMode: true,
  shortsReenableUntil: now + 60_000
}, now), false);
assert.equal(hardMode.shouldHideShorts({
  hideShorts: false,
  shortsHardMode: true,
  shortsReenableUntil: now
}, now), true);
assert.equal(hardMode.shouldHideShorts({
  hideShorts: false,
  shortsHardMode: true
}, now), false);

assert.equal(hardMode.durationInMilliseconds(5, 'minutes'), 300_000);
assert.equal(hardMode.durationInMilliseconds(2, 'hours'), 7_200_000);
assert.equal(hardMode.durationInMilliseconds(3, 'days'), 259_200_000);
assert.equal(hardMode.durationInMilliseconds(0, 'minutes'), null);
assert.equal(hardMode.durationInMilliseconds(1.5, 'hours'), null);
assert.equal(hardMode.durationInMilliseconds(1, 'weeks'), null);

assert.equal(hardMode.restoreTimerDelay({
  hideShorts: false,
  shortsHardMode: true,
  shortsReenableUntil: now + 45_000
}, now), 45_000);
assert.equal(hardMode.restoreTimerDelay({
  hideShorts: false,
  shortsHardMode: true,
  shortsReenableUntil: now + 3_000_000_000
}, now), 2_147_483_647);
assert.equal(hardMode.restoreTimerDelay({
  hideShorts: false,
  shortsHardMode: true
}, now), null);

console.log('Hard Mode logic tests passed');
