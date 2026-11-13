(function () {
  'use strict';

  var config = window.CNPTV_CONFIG || window.MATCHDEKHO_CONFIG || {};
  var apis = config.apis || {};
  var refreshEvery = Number(config.eventRefreshMs) || 300000;
  var requestTimeout = 12000;
  var cachePrefix = 'cnptv-home-events-v3:';
  var sections = [
    { key: 'football', api: apis.football || '', fallbackApi: apis.footballFallback || '', trackId: 'footballTrack', statusId: 'footballStatus', previousId: 'footballPrevious', nextId: 'footballNext', label: 'Football' },
    { key: 'cricket',  api: apis.cricket  || '', fallbackApi: apis.cricketFallback || '', trackId: 'cricketTrack',  statusId: 'cricketStatus',  previousId: 'cricketPrevious',  nextId: 'cricketNext',  label: 'Cricket'  }
  ];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeImageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      var parsed = new URL(value.trim());
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch (error) { return ''; }
  }

  function initials(name) {
    return String(name || 'Team').trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (word) { return word.charAt(0); }).join('').toUpperCase() || 'TM';
  }

  function normaliseStatus(item) {
    var status = String(item && item.status || 'upcoming').toLowerCase().trim();
    if (status === 'live' || status === 'in play' || status === 'inplay') return 'live';
    if (status === 'ended' || status === 'finished' || status === 'completed') return 'ended';
    return 'upcoming';
  }

  function statusText(status) {
    return status === 'live' ? 'Live' : status === 'ended' ? 'Ended' : 'Upcoming';
  }

  function statusRank(item) {
    var status = normaliseStatus(item);
    return status === 'live' ? 0 : status === 'upcoming' ? 1 : 2;
  }

  function rawStartTime(item) {
    var event = item && item.event || {};
    return event.startTimeIST || event.startTimeUTC || item.startTime || item.start_time || '';
  }

  function parseIstDate(value) {
    var match = String(value || '').match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (!match) return null;
    var date = new Date(match[1] + '-' + match[2] + '-' + match[3] + 'T' + match[4] + ':' + match[5] + ':00+05:30');
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startTimestamp(item) {
    var date = parseIstDate(rawStartTime(item));
    return date ? date.getTime() : Number.MAX_SAFE_INTEGER;
  }

  function istDayValue(date) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).reduce(function (result, part) {
      result[part.type] = part.value;
      return result;
    }, {});
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  }

  function formatUpcomingTime(value) {
    var match = String(value || '').match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (!match) return value ? String(value).replace(/\s+IST$/i, ' IST') : 'Time to be confirmed';
    var target = parseIstDate(value);
    var difference = target ? Math.round((istDayValue(target) - istDayValue(new Date())) / 86400000) : 9;
    var hour = Number(match[4]);
    var hour12 = hour % 12 || 12;
    var label = difference === 0 ? 'Today' : difference === 1 ? 'Tomorrow' : Number(match[3]) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(match[2]) - 1];
    return label + ' · ' + hour12 + ':' + match[5] + ' ' + (hour >= 12 ? 'PM' : 'AM') + ' IST';
  }

  function formatElapsed(value) {
    var start = parseIstDate(value);
    if (!start) return 'Live now';
    var seconds = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    var remainder = seconds % 60;
    return String(hours).padStart(2, '0') + 'h ' + String(minutes).padStart(2, '0') + 'm ' + String(remainder).padStart(2, '0') + 's';
  }

  function updateLiveDurations() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-live-start]'), function (node) {
      node.textContent = formatElapsed(node.getAttribute('data-live-start'));
    });
  }

  function extractEvents(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.events)) return payload.events;
    if (Array.isArray(payload.matches)) return payload.matches;
    if (payload.data && Array.isArray(payload.data.events)) return payload.data.events;
    return [];
  }

  function presentationEvent(item) {
    var event = item && item.event || {};
    return {
      id: String(item && (item.id || item.matchId || item.match_id || item.matchID || item.stream_id) || ''),
      slug: String(item && item.slug || ''),
      title: String(item && item.title || event.name || ''),
      status: normaliseStatus(item),
      event: {
        name: String(event.name || item && item.title || ''),
        category: String(event.category || ''),
        teamA: String(event.teamA || ''),
        teamB: String(event.teamB || ''),
        teamAFlag: safeImageUrl(event.teamAFlag || event.teamALogo || event.teamAImage || ''),
        teamBFlag: safeImageUrl(event.teamBFlag || event.teamBLogo || event.teamBImage || ''),
        startTimeIST: String(event.startTimeIST || event.startTimeUTC || item && (item.startTime || item.start_time) || '')
      }
    };
  }

  function prepareEvents(payload) {
    return extractEvents(payload).filter(function (item) { return item && typeof item === 'object'; })
      .map(presentationEvent).filter(function (item) { return item.title || item.event.name; })
      .sort(function (left, right) { return statusRank(left) - statusRank(right) || startTimestamp(left) - startTimestamp(right); });
  }

  function cacheKey(key) { return cachePrefix + key; }

  function readCachedEvents(key) {
    try {
      var stored = window.localStorage.getItem(cacheKey(key));
      var parsed = stored ? JSON.parse(stored) : null;
      return parsed && Array.isArray(parsed.events) ? prepareEvents(parsed.events) : [];
    } catch (error) { return []; }
  }

  function writeCachedEvents(key, events) {
    try {
      window.localStorage.setItem(cacheKey(key), JSON.stringify({ savedAt: Date.now(), events: events }));
    } catch (error) {}
  }

  function fetchJsonWithTimeout(url) {
    return new Promise(function (resolve, reject) {
      var controller = typeof window.AbortController === 'function' ? new window.AbortController() : null;
      var options = { cache: 'no-store', headers: { Accept: 'application/json' } };
      var settled = false;
      var timeout;
      if (controller) options.signal = controller.signal;
      function finish(error, payload) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (error) reject(error); else resolve(payload);
      }
      timeout = window.setTimeout(function () {
        if (controller) controller.abort();
        finish(new Error('Request timed out'));
      }, requestTimeout);
      fetch(url, options)
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (payload) { finish(null, payload); }, function (error) { finish(error); });
    });
  }

  function teamMarkup(name, imageUrl) {
    var safeName = escapeHtml(name);
    var image = imageUrl ? '<img src="' + escapeHtml(imageUrl) + '" alt="' + safeName + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-team-logo>' : '';
    return '<div class="event-team"><div class="event-team-logo' + (imageUrl ? '' : ' has-fallback') + '">' + image + '<span class="event-team-fallback">' + escapeHtml(initials(name)) + '</span></div><span class="event-team-name" title="' + safeName + '">' + safeName + '</span></div>';
  }

  function eventUrl(sectionInfo, item) {
    var cfg = window.CNPTV_CONFIG || window.MATCHDEKHO_CONFIG || {};
    var sectionCfg = (cfg.sections || {})[sectionInfo.key];
    var helper = window.CnpTVHelper;
    if (sectionCfg && helper && sectionCfg.link) {
      var eventId = helper.extractId(item) || item.slug || '';
      return helper.buildUrl(sectionCfg, eventId);
    }
    var params = new URLSearchParams();
    params.set('sport', sectionInfo.key);
    if (item.slug) params.set('slug', item.slug);
    if (item.id) params.set('id', item.id);
    return '/events/?' + params.toString();
  }

  function timingMarkup(item, status, category) {
    var time = rawStartTime(item);
    if (status === 'live') {
      return '<div class="event-meta"><span class="event-time-state live">Live for</span><time class="event-live-duration" data-live-start="' + escapeHtml(time) + '">' + escapeHtml(formatElapsed(time)) + '</time></div>';
    }
    if (status === 'upcoming') {
      return '<div class="event-meta"><span class="event-time-state upcoming">Starts</span><time class="event-schedule-time">' + escapeHtml(formatUpcomingTime(time)) + '</time></div>';
    }
    return '<div class="event-meta"><span class="event-time-state">' + escapeHtml(category) + '</span><time class="event-schedule-time">Finished</time></div>';
  }

  function renderCard(item, sectionInfo) {
    var cfg = window.CNPTV_CONFIG || window.MATCHDEKHO_CONFIG || {};
    var upcomingClickable = cfg.upcomingClickable !== false;
    var labels = cfg.labels || {};
    var watchLabel = labels.watchNow || 'Watch Now';
    var comingSoonLabel = labels.comingSoon || 'Coming Soon';

    var event = item && item.event || {};
    var status = normaliseStatus(item);
    var eventName = event.name || item.title || sectionInfo.label + ' Event';
    var category = event.category || sectionInfo.label;
    var league = item.title || eventName;
    var teamA = event.teamA || 'Team A';
    var teamB = event.teamB || 'Team B';
    var imageA = safeImageUrl(event.teamAFlag || event.teamALogo || event.teamAImage || '');
    var imageB = safeImageUrl(event.teamBFlag || event.teamBLogo || event.teamBImage || '');

    var isUpcoming = status === 'upcoming';
    var canClick = !isUpcoming || upcomingClickable;
    var url = eventUrl(sectionInfo, item);

    var buttonLabel = isUpcoming ? comingSoonLabel : watchLabel;
    var buttonClass = 'event-watch-label' + (isUpcoming ? ' upcoming' : status === 'ended' ? ' ended' : '');
    var watchButton = '<span class="' + buttonClass + '">' +
      (!isUpcoming ? '<span aria-hidden="true">&#9654;</span>' : '') +
      escapeHtml(buttonLabel) + '</span>';

    var statusChip = isUpcoming
      ? '<span class="event-status-chip upcoming">Upcoming</span>'
      : '<span class="event-status-chip ' + status + '">' + escapeHtml(statusText(status)) + '</span>';

    var cardClass = 'event-match-card event-status-' + status + (!canClick ? ' event-no-hover' : '');
    var cardOpen = canClick
      ? '<a class="' + cardClass + '" href="' + escapeHtml(url) + '" aria-label="' + escapeHtml(eventName) + '">'
      : '<div class="' + cardClass + '" aria-label="' + escapeHtml(eventName) + '">';
    var cardClose = canClick ? '</a>' : '</div>';

    return cardOpen +
      '<div class="event-match-visual"><div class="event-match-topline"><span class="event-sport-chip">' + escapeHtml(category) + '</span>' + statusChip + '</div>' +
      '<h3 class="event-match-name" title="' + escapeHtml(eventName) + '">' + escapeHtml(eventName) + '</h3>' +
      '<div class="event-teams-row">' + teamMarkup(teamA, imageA) + '<span class="event-versus" aria-hidden="true">VS</span>' + teamMarkup(teamB, imageB) + '</div></div>' +
      '<div class="event-match-info"><p class="event-league" title="' + escapeHtml(league) + '">' + escapeHtml(league) + '</p>' +
      '<div class="event-match-footer">' + timingMarkup(item, status, category) + watchButton + '</div></div>' +
      cardClose;
  }

  function viewAllCardHtml(sectionInfo) {
    var cfg = window.CNPTV_CONFIG || window.MATCHDEKHO_CONFIG || {};
    var labels = cfg.labels || {};
    var sectionCfg = (cfg.sections || {})[sectionInfo.key] || {};
    var link = escapeHtml(sectionCfg.viewAllLink || '/events/');
    var label = escapeHtml(labels.viewAll || 'View All Events');
    return '<a class="event-view-all-card" href="' + link + '" aria-label="' + label + '">' +
      '<span class="view-all-plus" aria-hidden="true">+</span>' +
      '<span class="view-all-label">' + label + '</span>' +
      '</a>';
  }

  function skeletonMarkup(count) {
    var output = '';
    for (var index = 0; index < count; index += 1) output += '<div class="event-match-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>';
    return output;
  }

  function setImageFallbacks(track) {
    Array.prototype.forEach.call(track.querySelectorAll('[data-team-logo]'), function (image) {
      image.addEventListener('error', function () {
        var holder = image.closest('.event-team-logo');
        if (holder) holder.classList.add('has-fallback');
      }, { once: true });
    });
  }

  function setSectionStatus(node, events) {
    if (!node) return;
    var live = events.filter(function (item) { return normaliseStatus(item) === 'live'; }).length;
    var upcoming = events.filter(function (item) { return normaliseStatus(item) === 'upcoming'; }).length;
    var text;
    if (live) {
      text = live + (live === 1 ? ' Event Live' : ' Events Live');
    } else if (upcoming) {
      text = upcoming + (upcoming === 1 ? ' Upcoming Event' : ' Upcoming Events');
    } else {
      text = 'No Events Live';
    }
    node.textContent = text;
  }

  function renderError(track, label, retry) {
    track.innerHTML = '<div class="event-feed-message"><div><strong>' + escapeHtml(label) + ' schedule is unavailable</strong><span>Please refresh or try again in a moment.</span><button type="button">Try again</button></div></div>';
    var button = track.querySelector('button');
    if (button) button.addEventListener('click', retry);
  }

  function renderEmpty(track, label) {
    track.innerHTML = '<div class="event-feed-message"><div><strong>No ' + escapeHtml(label.toLowerCase()) + ' events right now</strong><span>Please check again shortly.</span></div></div>';
  }

  function renderEvents(track, statusNode, sectionInfo, events) {
    var cfg = window.CNPTV_CONFIG || window.MATCHDEKHO_CONFIG || {};
    var cardLimit = Number(cfg.cardLimit) || 10;

    if (!events.length) {
      renderEmpty(track, sectionInfo.label);
      if (statusNode) statusNode.textContent = 'No Events Live';
      return false;
    }

    var visibleEvents = events.slice(0, cardLimit);
    track.innerHTML = visibleEvents.map(function (item) { return renderCard(item, sectionInfo); }).join('') + viewAllCardHtml(sectionInfo);
    setImageFallbacks(track);
    setSectionStatus(statusNode, events);
    updateLiveDurations();
    return true;
  }

  function scrollByCards(track, direction) {
    var card = track.querySelector('.event-match-card, .event-match-skeleton');
    var cardWidth = card ? card.getBoundingClientRect().width : 280;
    var gap = parseFloat(window.getComputedStyle(track).gap || '12') || 12;
    track.scrollBy({ left: direction * (cardWidth + gap) * 2, behavior: 'smooth' });
  }

  function addDragScroll(track) {
    var active = false, startX = 0, initialScroll = 0;
    track.addEventListener('pointerdown', function (event) {
      active = true; startX = event.clientX; initialScroll = track.scrollLeft;
      track.classList.add('is-dragging');
      if (track.setPointerCapture) track.setPointerCapture(event.pointerId);
    });
    track.addEventListener('pointermove', function (event) { if (active) track.scrollLeft = initialScroll - (event.clientX - startX); });
    function stop() { active = false; track.classList.remove('is-dragging'); }
    track.addEventListener('pointerup', stop);
    track.addEventListener('pointercancel', stop);
    track.addEventListener('pointerleave', function (event) { if (active && event.buttons === 0) stop(); });
  }

  function mount(sectionInfo) {
    var track = document.getElementById(sectionInfo.trackId);
    var statusNode = document.getElementById(sectionInfo.statusId);
    var previous = document.getElementById(sectionInfo.previousId);
    var next = document.getElementById(sectionInfo.nextId);
    var hasCachedSchedule = false;

    if (!track) return;
    if (!track.children.length) track.innerHTML = skeletonMarkup(4);
    addDragScroll(track);
    if (previous) previous.addEventListener('click', function () { scrollByCards(track, -1); });
    if (next) next.addEventListener('click', function () { scrollByCards(track, 1); });

    var cachedEvents = readCachedEvents(sectionInfo.key);
    if (cachedEvents.length) hasCachedSchedule = renderEvents(track, statusNode, sectionInfo, cachedEvents);

    function load() {
      if (!sectionInfo.api) {
        if (!hasCachedSchedule) renderError(track, sectionInfo.label, load);
        if (statusNode && !hasCachedSchedule) statusNode.textContent = 'Schedule Unavailable';
        return;
      }
      fetchJsonWithTimeout(sectionInfo.api).catch(function (primaryError) {
        if (!sectionInfo.fallbackApi || sectionInfo.fallbackApi === sectionInfo.api) throw primaryError;
        if (window.console && console.warn) console.warn('[live-events] ' + sectionInfo.key + ' primary feed failed; trying fallback.', primaryError);
        return fetchJsonWithTimeout(sectionInfo.fallbackApi);
      }).then(function (payload) {
        var events = prepareEvents(payload);
        hasCachedSchedule = renderEvents(track, statusNode, sectionInfo, events);
        if (events.length) writeCachedEvents(sectionInfo.key, events);
      }).catch(function (error) {
        if (window.console && console.warn) console.warn('[live-events] ' + sectionInfo.key + ' could not load', error);
        if (!hasCachedSchedule) {
          renderError(track, sectionInfo.label, load);
          if (statusNode) statusNode.textContent = 'Schedule Unavailable';
        }
      });
    }

    load();
    window.setInterval(function () { if (!document.hidden) load(); }, refreshEvery);
  }

  sections.forEach(mount);
  updateLiveDurations();
  window.setInterval(updateLiveDurations, 1000);
})();