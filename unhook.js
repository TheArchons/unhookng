// Single stylesheet for all hiding rules
let styleElement = null;

function applyStyles(settings) {
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'unhook-styles';
    document.head.appendChild(styleElement);
  }

  const rules = [];
  
  if (settings.hideVideoSidebar) rules.push('#secondary { display: none !important; }')
  if (settings.hideRecommended) rules.push('#related { display: none !important; }');
  if (settings.hideLiveChat) rules.push('#chat-container { display: none !important; }');
  if (settings.hidePlaylist) rules.push('#playlist { display: none !important; }');
  if (settings.hideFundraiser) rules.push('#donation-shelf { display: none !important; }');
  
  
  styleElement.textContent = rules.join('\n');
}

async function main() {
  const settings = await browser.storage.local.get(null);
  applyStyles(settings);
}

// Content scripts run after DOM is ready by default, so call main directly
main();

// Listen for storage changes and reapply all settings
browser.storage.onChanged.addListener(() => {
  main();
});
