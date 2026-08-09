#!/usr/bin/env node

const port = process.env.EDGE_ANDROID_DEBUG_PORT || '9223';
const expectation = process.argv[2];

if (expectation && !['--expect-hidden', '--expect-visible'].includes(expectation)) {
  console.error('usage: scripts/inspect-edge-android-shorts.js [--expect-hidden|--expect-visible]');
  process.exit(2);
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
    },
  };
}

async function main() {
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const youtube = targets.find((target) => target.type === 'page' && target.url.includes('youtube.com'));
  if (!youtube) throw new Error('No YouTube page found in Edge Android');

  const client = connect(youtube.webSocketDebuggerUrl);
  await client.ready;
  const result = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const selectors = [
        'a[href*="/shorts"]',
        '[aria-label*="Shorts"]',
        '[title*="Shorts"]',
        'ytm-pivot-bar-item-renderer',
        'ytm-reel-shelf-renderer',
        'ytm-shorts-lockup-view-model'
      ];
      const elements = [...new Set(selectors.flatMap((selector) =>
        [...document.querySelectorAll(selector)]))];
      return {
        url: location.href,
        extensionStyle: document.querySelector('#unhook-styles')?.textContent || null,
        matches: elements.map((element) => ({
          tag: element.tagName.toLowerCase(),
          href: element.getAttribute('href'),
          title: element.getAttribute('title'),
          ariaLabel: element.getAttribute('aria-label'),
          text: element.textContent.trim().slice(0, 120),
          display: getComputedStyle(element).display,
          parent: element.parentElement?.outerHTML.slice(0, 700) || null,
          html: element.outerHTML.slice(0, 700),
        })),
      };
    })()`,
    returnByValue: true,
  });
  client.close();

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || 'Edge Android evaluation failed');
  }
  const report = result.result.value;
  console.log(JSON.stringify(report, null, 2));

  if (expectation) {
    const shortsElements = report.matches.filter((element) =>
      element.text === 'Shorts' || element.href?.includes('/shorts'));
    if (shortsElements.length === 0) {
      throw new Error('No Shorts controls were found on mobile YouTube');
    }
    const shouldBeHidden = expectation === '--expect-hidden';
    const failed = shortsElements.some((element) =>
      (element.display === 'none') !== shouldBeHidden);
    if (failed) {
      throw new Error(`Shorts controls did not become ${shouldBeHidden ? 'hidden' : 'visible'}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
