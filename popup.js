const browserAPI = globalThis.browser || globalThis.chrome;
const shortsHardMode = globalThis.UnhookShortsHardMode;

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
  'shortsHardMode',
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

const shortsDurationDialog = document.getElementById('shortsDurationDialog');
const customOptions = document.getElementById('customOptions');
const customDuration = document.getElementById('customDuration');
const customDurationUnit = document.getElementById('customDurationUnit');
const shortsStatus = document.getElementById('shortsStatus');
let currentSettings = {};

function updateControls(settings) {
  toggles.forEach((id) => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.checked = settings[id] === true;
    }
  });

  const reenableUntil = settings[shortsHardMode.REENABLE_UNTIL_KEY];
  if (settings.hideShorts !== true &&
      settings.shortsHardMode === true &&
      Number.isFinite(reenableUntil) &&
      reenableUntil > Date.now()) {
    shortsStatus.textContent = `Shorts enabled until ${new Date(reenableUntil).toLocaleString()}`;
    shortsStatus.hidden = false;
  } else if (settings.hideShorts !== true && settings.shortsHardMode === true) {
    shortsStatus.textContent = 'Shorts enabled permanently';
    shortsStatus.hidden = false;
  } else {
    shortsStatus.hidden = true;
  }
}

async function clearReenableTime() {
  await browserAPI.storage.local.remove(shortsHardMode.REENABLE_UNTIL_KEY);
  delete currentSettings[shortsHardMode.REENABLE_UNTIL_KEY];
}

async function loadSettings() {
  const keys = [...toggles, shortsHardMode.REENABLE_UNTIL_KEY];
  currentSettings = await browserAPI.storage.local.get(keys);

  if (shortsHardMode.shouldRestoreShortsBlock(currentSettings)) {
    currentSettings.hideShorts = true;
    await browserAPI.storage.local.set({ hideShorts: true });
    await clearReenableTime();
  }

  updateControls(currentSettings);
}

function showDurationPicker() {
  customOptions.hidden = true;
  shortsDurationDialog.showModal();
}

async function enableShortsFor(duration) {
  if (!Number.isSafeInteger(duration) || duration <= 0) return;

  const reenableUntil = Date.now() + duration;
  if (!Number.isSafeInteger(reenableUntil)) return;

  currentSettings.hideShorts = false;
  currentSettings[shortsHardMode.REENABLE_UNTIL_KEY] = reenableUntil;
  await browserAPI.storage.local.set({
    hideShorts: false,
    [shortsHardMode.REENABLE_UNTIL_KEY]: reenableUntil
  });
  updateControls(currentSettings);
  shortsDurationDialog.close();
}

loadSettings();

// Save settings on change
document.addEventListener('change', async (e) => {
  if (e.target.type !== 'checkbox') return;

  const id = e.target.id;
  const checked = e.target.checked;

  if (id === 'hideShorts') {
    if (!checked && currentSettings.shortsHardMode === true) {
      e.target.checked = true;
      showDurationPicker();
      return;
    }

    currentSettings.hideShorts = checked;
    await browserAPI.storage.local.set({ hideShorts: checked });
    await clearReenableTime();
    updateControls(currentSettings);
    return;
  }

  if (id === 'shortsHardMode') {
    currentSettings.shortsHardMode = checked;
    if (checked) {
      currentSettings.hideShorts = true;
      await browserAPI.storage.local.set({
        shortsHardMode: true,
        hideShorts: true
      });
    } else {
      await browserAPI.storage.local.set({ shortsHardMode: false });
    }
    await clearReenableTime();
    updateControls(currentSettings);
    return;
  }

  currentSettings[id] = checked;
  await browserAPI.storage.local.set({ [id]: checked });
});

document.querySelectorAll('[data-duration-minutes]').forEach((button) => {
  button.addEventListener('click', () => {
    const duration = shortsHardMode.durationInMilliseconds(
      button.dataset.durationMinutes,
      'minutes'
    );
    enableShortsFor(duration);
  });
});

document.getElementById('showCustomOptions').addEventListener('click', () => {
  customOptions.hidden = false;
  customDuration.focus();
});

document.getElementById('enableShortsCustom').addEventListener('click', () => {
  const duration = shortsHardMode.durationInMilliseconds(
    customDuration.value,
    customDurationUnit.value
  );

  if (duration === null) {
    customDuration.setCustomValidity('Enter a whole number greater than zero.');
    customDuration.reportValidity();
    return;
  }

  customDuration.setCustomValidity('');
  enableShortsFor(duration);
});

customDuration.addEventListener('input', () => customDuration.setCustomValidity(''));

document.getElementById('enableShortsPermanently').addEventListener('click', async () => {
  currentSettings.hideShorts = false;
  await browserAPI.storage.local.set({ hideShorts: false });
  await clearReenableTime();
  updateControls(currentSettings);
  shortsDurationDialog.close();
});
