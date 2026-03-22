// Chrome/Firefox compatibility
const browserAPI = globalThis.browser || globalThis.chrome;

// Single stylesheet for all hiding rules
let styleElement = null;

function applyStyles(settings) {
  const path = window.location.pathname;

  // Redirect homepage to subscriptions
  if (settings.redirectToSubscriptions) {
    if (path === '/' || path === '/feed/trending') {
      window.location.replace('https://www.youtube.com/feed/subscriptions');
      return;
    }
  }

  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'unhook-styles';
    document.head.appendChild(styleElement);
  }

  const rules = [];
  
  if (settings.hideHomeFeed && path == '/') rules.push('ytd-rich-grid-renderer { display: none !important; }');
  if (settings.hideVideoSidebar) rules.push('#secondary { display: none !important; }');
  if (settings.hideRecommended) rules.push('#related { display: none !important; }');
  if (settings.hideLiveChat) rules.push('#chat-container { display: none !important; }');
  if (settings.hidePlaylist) rules.push('#playlist { display: none !important; }');
  if (settings.hideFundraiser) rules.push('#donation-shelf { display: none !important; }');
  
  if (settings.hideEndScreenCards) rules.push('.ytp-fullscreen-grid, .ytp-ce-element { display: none !important; }');
  if (settings.hideShorts) rules.push('a#endpoint[title="Shorts"], ytd-shorts, grid-shelf-view-model, ytd-rich-shelf-renderer { display: none !important; }')

  if (settings.hideComments) rules.push('.ytd-comments { display: none !important; }');
  if (settings.hideProfilePhotos) rules.push('#author-thumbnail { display: none !important; }');

  if (settings.hideMixes) rules.push('yt-lockup-view-model:has(a[href*="list=RDMM"]), ytd-playlist-renderer:has(a[href*="list=RDMM"]) { display: none !important; }');
  if (settings.hideMerch) rules.push('ytd-merch-shelf-renderer { display: none !important; }');

  if (settings.hideVideoInfo) rules.push('ytd-watch-metadata { display: none !important; }');
  if (settings.hideButtonsBar) rules.push('#actions { display: none !important; }');
  if (settings.hideChannel) rules.push('#owner { display: none !important; }');
  if (settings.hideDescription) rules.push('#description { display: none !important; }');

  if (settings.hideTopHeader) rules.push('#masthead-container { display: none !important; }');
  if (settings.hideNotifications) rules.push('ytd-notification-topbar-button-renderer { display: none !important; }');

  // there is no unique id for the explore section but "Music" is inside of this section so we can find only sections with music
  if (settings.hideExplore) rules.push('ytd-guide-section-renderer:has(a[title="Music"]) { display: none !important; }');

  // same as hideExplore but instead we find only sections with YouTube Premium
  if (settings.hideMoreFromYT) rules.push('ytd-guide-section-renderer:has(a[title="YouTube Premium"]) { display: none !important; }');

  // same as hideExplore but instead we only find sections with Subscriptions
  if (settings.hideSubscriptions) {
    // the not is because sometimes youtube puts subscriptions in a section with all the other links, so we don't want to hide that but instead we want to rely on the second rule
    rules.push('ytd-guide-section-renderer:has(a#endpoint[title="Subscriptions"]):not(:has(a#endpoint[title="Home"])) { display: none !important; }');
    rules.push('a#endpoint[title="Subscriptions"] { display: none !important; }');
    if (path == '/feed/subscriptions') {
      rules.push('ytd-rich-grid-renderer { display: none !important; }');
    }
  }

  styleElement.textContent = rules.join('\n');
}

async function main() {
  // Chrome/Firefox compatibility
  const settings = await browserAPI.storage.local.get(null);
  applyStyles(settings);
}

// Content scripts run after DOM is ready by default, so call main directly
main();

// Listen for storage changes and reapply all settings
browserAPI.storage.onChanged.addListener(() => {
  main();
});

document.body.addEventListener("yt-navigate-start", function(event) {
  main();
});