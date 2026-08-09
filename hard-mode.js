globalThis.UnhookShortsHardMode = (() => {
  const HARD_MODE_KEY = 'shortsHardMode';
  const REENABLE_UNTIL_KEY = 'shortsReenableUntil';
  const MAX_TIMER_DELAY = 2_147_483_647;
  const UNIT_MILLISECONDS = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000
  };

  function durationInMilliseconds(value, unit) {
    const amount = Number(value);
    const unitMilliseconds = UNIT_MILLISECONDS[unit];

    if (!Number.isInteger(amount) || amount <= 0 || !unitMilliseconds) {
      return null;
    }

    const duration = amount * unitMilliseconds;
    return Number.isSafeInteger(duration) ? duration : null;
  }

  function hasTimedReenable(settings) {
    return settings[HARD_MODE_KEY] === true &&
      settings.hideShorts !== true &&
      Number.isFinite(settings[REENABLE_UNTIL_KEY]);
  }

  function shouldRestoreShortsBlock(settings, now = Date.now()) {
    return hasTimedReenable(settings) && settings[REENABLE_UNTIL_KEY] <= now;
  }

  function shouldHideShorts(settings, now = Date.now()) {
    return settings.hideShorts === true || shouldRestoreShortsBlock(settings, now);
  }

  function restoreTimerDelay(settings, now = Date.now()) {
    if (!hasTimedReenable(settings)) return null;

    const remaining = settings[REENABLE_UNTIL_KEY] - now;
    if (remaining <= 0) return 0;
    return Math.min(remaining, MAX_TIMER_DELAY);
  }

  return Object.freeze({
    HARD_MODE_KEY,
    REENABLE_UNTIL_KEY,
    durationInMilliseconds,
    shouldRestoreShortsBlock,
    shouldHideShorts,
    restoreTimerDelay
  });
})();
