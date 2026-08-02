// Chrome/Firefox compatibility
const browserAPI = globalThis.browser || globalThis.chrome;

async function intercept_request(requestDetails) {
  const settings = await browserAPI.storage.local.get(null);
  if (settings.redirectToSubscriptions) {
    return {
      redirectUrl: "https://www.youtube.com/feed/subscriptions",
    };
  }

  return {};
}

// listen for a web request and intercept
browserAPI.webRequest.onBeforeRequest.addListener(
  intercept_request,
  {
    urls: [
      "*://www.youtube.com/",
      "*://www.youtube.com/?*",
      "*://www.youtube.com/feed/trending",
      "*://www.youtube.com/feed/trending?*"
    ]
  },
  ["blocking"]
)

// listen for a web request and intercept
browserAPI.webRequest.onBeforeRequest.addListener(
  intercept_request,
  {
    urls: [
      "*://www.youtube.com/",
      "*://www.youtube.com/?*",
      "*://www.youtube.com/feed/trending",
      "*://www.youtube.com/feed/trending?*"
    ]
  },
  ["blocking"]
)