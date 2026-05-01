const browserAPI = globalThis.browser || globalThis.chrome;

const toggles = [
  'hideHomeFeed',
  'redirectToSubscriptions',
  'hideVideoSidebar',
  'hideRecommended',
  'hideLiveChat',
  'hidePlaylist',
  'hideFundraiser',
  'hideEndScreenCards',
  'hideShorts',
  'hideComments',
  'hideProfilePhotos',
  'hideMixes',
  'hideMerch',
  'hideEventTickets',
  'hideVideoInfo',
  'hideButtonsBar',
  'hideChannel',
  'hideDescription',
  'hideTopHeader',
  'hideNotifications',
  'hideExplore',
  'hideMoreFromYT',
  'hideSubscriptions'
];

// Load saved settings
browserAPI.storage.local.get(toggles).then((result) => {
  toggles.forEach((id) => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.checked = result[id] === true;
    }
  });
});

// Save settings on change
document.addEventListener('change', (e) => {
  if (e.target.type !== 'checkbox') return;

  const id = e.target.id;
  const checked = e.target.checked;
  const settings = { [id]: checked };

  browserAPI.storage.local.set(settings);
});
