const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const port = process.env.EDGE_DEBUG_PORT || '9225';
const root = path.resolve(__dirname, '..');
const popupUrl = pathToFileURL(path.join(root, 'popup.html')).href;
const screenshotPath = path.join(root, 'build', 'edge-popup.png');

async function createTarget(url) {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' }
  );
  if (!response.ok) throw new Error(`Could not create Edge target: ${response.status}`);
  return response.json();
}

function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;

    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  return {
    ready: new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    }),
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      socket.close();
    }
  };
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || 'Edge evaluation failed');
  }
  return result.result.value;
}

async function waitFor(client, expression) {
  const timeoutAt = Date.now() + 5000;
  while (Date.now() < timeoutAt) {
    if (await evaluate(client, expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function main() {
  const target = await createTarget('about:blank');
  const client = connect(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 360,
    height: 640,
    deviceScaleFactor: 1,
    mobile: true
  });
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      globalThis.__storage = { hideShorts: true, shortsHardMode: true };
      globalThis.chrome = {
        storage: {
          local: {
            async get(keys) {
              if (keys === null) return { ...globalThis.__storage };
              return Object.fromEntries(keys.filter((key) => key in globalThis.__storage)
                .map((key) => [key, globalThis.__storage[key]]));
            },
            async set(values) { Object.assign(globalThis.__storage, values); },
            async remove(key) { delete globalThis.__storage[key]; }
          },
          onChanged: { addListener() {} }
        }
      };
    `
  });
  await client.send('Page.navigate', { url: popupUrl });
  await waitFor(client, 'document.readyState === "complete" && !!document.querySelector("#hideShorts")');

  const pickerState = await evaluate(client, `
    (async () => {
      const checkbox = document.querySelector('#hideShorts');
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        checkboxChecked: checkbox.checked,
        dialogOpen: document.querySelector('#shortsDurationDialog').open,
        customHidden: document.querySelector('#customOptions').hidden,
        permanentHidden: document.querySelector('#enableShortsPermanently').offsetParent === null
      };
    })()
  `);
  assert.deepEqual(pickerState, {
    checkboxChecked: true,
    dialogOpen: true,
    customHidden: true,
    permanentHidden: true
  });

  await evaluate(client, `
    document.querySelector('#showCustomOptions').click();
    document.querySelector('#customDuration').value = '2';
    document.querySelector('#customDurationUnit').value = 'days';
  `);
  await waitFor(client, '!document.querySelector("#customOptions").hidden');

  const customLayout = await evaluate(client, `
    (() => {
      const dialog = document.querySelector('#shortsDurationDialog');
      const permanent = document.querySelector('.permanent-option');
      const customButton = document.querySelector('#enableShortsCustom');
      return {
        viewportWidth: innerWidth,
        dialogFitsViewport: dialog.getBoundingClientRect().width <= innerWidth - 24,
        presetTapHeight: document.querySelector('[data-duration-minutes]')
          .getBoundingClientRect().height,
        permanentVisible: permanent.getBoundingClientRect().height > 0,
        permanentAfterCustom: permanent.getBoundingClientRect().top >
          customButton.getBoundingClientRect().bottom
      };
    })()
  `);
  assert.equal(customLayout.viewportWidth, 360);
  assert.equal(customLayout.dialogFitsViewport, true);
  assert.ok(customLayout.presetTapHeight >= 36);
  assert.equal(customLayout.permanentVisible, true);
  assert.equal(customLayout.permanentAfterCustom, true);

  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false
  });
  require('node:fs').mkdirSync(path.dirname(screenshotPath), { recursive: true });
  require('node:fs').writeFileSync(screenshotPath, screenshot.data, 'base64');

  const beforeCustom = Date.now();
  await evaluate(client, 'document.querySelector("#enableShortsCustom").click()');
  await waitFor(client, '!document.querySelector("#shortsDurationDialog").open');
  const customState = await evaluate(client, 'globalThis.__storage');
  assert.equal(customState.hideShorts, false);
  assert.ok(customState.shortsReenableUntil >= beforeCustom + 2 * 24 * 60 * 60 * 1000);

  const permanentState = await evaluate(client, `
    (async () => {
      const checkbox = document.querySelector('#hideShorts');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#showCustomOptions').click();
      document.querySelector('#enableShortsPermanently').click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { ...globalThis.__storage };
    })()
  `);
  assert.equal(permanentState.hideShorts, false);
  assert.equal('shortsReenableUntil' in permanentState, false);

  client.close();
  console.log(`Edge popup integration test passed; screenshot: ${screenshotPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
