const toggles = [
  'hideHomeFeed',
  'hideVideoSidebar',
  'hideRecommended',
  'hideLiveChat',
  'hidePlaylist',
  'hideFundraiser',
  'hideEndScreenFeed',
  'hideEndScreenCards',
  'hideShorts',
  'hideComments',
  'hideProfilePhotos',
  'hideMixes',
  'hideMerchTickets',
  'hideVideoInfo',
  'hideButtonsBar',
  'hideChannel',
  'hideDescription',
  'hideTopHeader',
  'hideNotifications',
  'hideInaptSearch',
  'hideExploreTrending',
  'hideMoreFromYT',
  'hideSubscriptions',
  'disableAutoplay',
  'disableAnnotations'
];

// Load saved settings
browser.storage.local.get(toggles).then((result) => {
  toggles.forEach((id) => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.checked = result[id] !== false;
    }
  });
});

// Save settings on change
document.addEventListener('change', (e) => {
  if (e.target.type !== 'checkbox') return;

  const id = e.target.id;
  const checked = e.target.checked;
  const settings = { [id]: checked };

  browser.storage.local.set(settings);
});
