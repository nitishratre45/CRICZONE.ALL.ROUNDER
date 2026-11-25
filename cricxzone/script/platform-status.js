/*
 * platform-status.js
 * ------------------------------------------------------------------
 * Keeps the small status line above each homepage section
 * (Willow, FanCode, World Sports, Sony LIV) short and accurate,
 * e.g. "2 events live", "5 upcoming events", "No events live".
 *
 * BUG FIX:
 * The old version watched the WHOLE section with a MutationObserver.
 * The status label lives inside that same section, so every time the
 * label text was updated the observer fired again, updated the label
 * again, and so on forever. That endless loop froze the whole page
 * (nothing loaded, desktop mode would not open).
 *
 * Now we:
 *   1. Watch only the card track (the label is NOT inside it).
 *   2. Change the label only when the text is really different.
 *   3. Batch many quick changes into one update per frame.
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  // Each entry links a section to its card track and status label.
  var definitions = [
    { section: 'willow-live',        track: 'willowLiveTrack',  status: 'willowStatus' },
    { section: 'fancodeSection',     track: 'fancodeTrack',     status: 'fancodeStatus' },
    { section: 'worldSportsSection', track: 'worldSportsTrack', status: 'worldSportsStatus' },
    { section: 'sonyLivSection',     track: 'sonyLivTrack',     status: 'sonyLivStatus' }
  ];

  // Decide which text the label should show, based on the cards present.
  function getStatusText(container) {
    var cards = container.querySelectorAll('.md-card');

    if (!cards.length) {
      if (container.querySelector('.md-skeleton')) return 'Loading events';
      if (container.querySelector('.md-error')) return 'Schedule unavailable';
      if (container.querySelector('.md-empty')) return 'No events live';
      return null; // Nothing rendered yet: keep the current text.
    }

    var live = container.querySelectorAll('.md-card.md-live').length;
    var upcoming = container.querySelectorAll('.md-card.md-upcoming').length;

    if (live) return live + (live === 1 ? ' event live' : ' events live');
    if (upcoming) return upcoming + (upcoming === 1 ? ' upcoming event' : ' upcoming events');
    return 'No events live';
  }

  // Update one label, but only if the text actually changes.
  function update(definition) {
    var section = document.getElementById(definition.section);
    var label = document.getElementById(definition.status);
    if (!section || !label) return;

    var track = document.getElementById(definition.track) || section;
    var next = getStatusText(track);
    if (next !== null && label.textContent !== next) {
      label.textContent = next;
    }
  }

  definitions.forEach(function (definition) {
    var track = document.getElementById(definition.track);

    // First update right away.
    update(definition);

    // Old browsers or missing track: nothing more to watch.
    if (!track || !window.MutationObserver) return;

    // Batch rapid card insertions into a single update per frame.
    var scheduled = false;
    var schedule = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };

    new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      schedule(function () {
        scheduled = false;
        update(definition);
      });
    }).observe(track, { childList: true, subtree: true });
  });
})();
