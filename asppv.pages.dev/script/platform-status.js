/*
 * platform-status.js
 * ------------------------------------------------------------------
 * Keeps the small status line above each homepage section
 * (Willow, FanCode, World Sports, Sony LIV) short and accurate,
 * e.g. "2 events live", "5 upcoming events", "No events live".
 *
 * Watches only each card track, not the section, so changing the
 * status label cannot trigger an observer loop. Updates are batched
 * into one requestAnimationFrame callback.
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  var definitions = [
    { section: 'willow-live',        track: 'willowLiveTrack',  status: 'willowStatus' },
    { section: 'fancodeSection',     track: 'fancodeTrack',     status: 'fancodeStatus' },
    { section: 'worldSportsSection', track: 'worldSportsTrack', status: 'worldSportsStatus' },
    { section: 'sonyLivSection',     track: 'sonyLivTrack',     status: 'sonyLivStatus' }
  ];

  function getStatusText(container) {
    var cards = container.querySelectorAll('.md-card');

    if (!cards.length) {
      if (container.querySelector('.md-skeleton')) return 'Loading events';
      if (container.querySelector('.md-error')) return 'Schedule unavailable';
      if (container.querySelector('.md-empty')) return 'No events live';
      return null;
    }

    var live = container.querySelectorAll('.md-card.md-live').length;
    var upcoming = container.querySelectorAll('.md-card.md-upcoming').length;

    if (live) return live + (live === 1 ? ' event live' : ' events live');
    if (upcoming) return upcoming + (upcoming === 1 ? ' upcoming event' : ' upcoming events');
    return 'No events live';
  }

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

    update(definition);

    if (!track || !window.MutationObserver) return;

    var scheduled = false;
    var schedule = window.requestAnimationFrame || function (fn) {
      return window.setTimeout(fn, 16);
    };

    var observer = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      schedule(function () {
        scheduled = false;
        update(definition);
      });
    });

    observer.observe(track, { childList: true, subtree: true });
  });
})();
