(function () {
  const config = window.CNPTV_CONFIG || window.MATCHDEKHO_CONFIG || {};
  let matches = Array.isArray(config.heroMatches) ? config.heroMatches.slice() : [];
  const slidesRoot = document.getElementById("heroSlides");
  const progressRoot = document.getElementById("sliderProgress");
  const posterWrapper = document.getElementById("posterWrapper");
  const arrowLeft = document.getElementById("arrowLeft");
  const arrowRight = document.getElementById("arrowRight");
  const hamburger = document.getElementById("hamburger");
  const drawer = document.getElementById("drawer");
  const scrim = document.getElementById("scrim");
  const dcloseBtn = document.getElementById("dclose");
  const drNav = document.getElementById("drNav");
  const drSearch = document.getElementById("drSearch");
  const slideDuration = 5000;
  let currentIndex = 0;
  let autoplayTimer = null;
  let physicalIndex = 0;
  let slideNodes = [];
  let settling = false;
  let settleTimer = null;

  function positionTrack(animate, offset) {
    if (!slidesRoot || !slideNodes.length) return;
    const width = slideNodes[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(slidesRoot).gap) || 0;
    const x = (posterWrapper.clientWidth - width) / 2 - physicalIndex * (width + gap) + (offset || 0);
    slidesRoot.style.transition = animate ? 'transform 600ms cubic-bezier(.22,1,.36,1)' : 'none';
    slidesRoot.style.transform = 'translate3d(' + x + 'px,0,0)';
  }

  function finishTransition() {
    clearTimeout(settleTimer);
    if (matches.length > 1) {
      if (physicalIndex === 0) physicalIndex = matches.length;
      if (physicalIndex === matches.length + 1) physicalIndex = 1;
    }
    markActive();
    positionTrack(false);
    settling = false;
  }

  function markActive() {
    slideNodes.forEach(function (slide, index) {
      const active = index === physicalIndex;
      slide.classList.toggle('active', active);
      slide.inert = !active;
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    const backdrop = posterWrapper.querySelector('.hero-ambient-stage');
    if (backdrop) Array.from(backdrop.children).forEach(function (image, index) {
      image.classList.toggle('active', index === currentIndex);
    });
  }


  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function teamValue(team, key) {
    if (team && typeof team === "object") return team[key] || "";
    return "";
  }

  function normalizeMatch(item) {
    const titleText = String(item.title || item.teams || item.match_name || "");
    const splitTeams = titleText.split(/\s+(?:vs\.?|v\.?|versus)\s+/i);
    const home = item.homeTeam || item.team1 || {};
    const away = item.awayTeam || item.team2 || {};
    const homeName = teamValue(home, "name") || item.team_1 || splitTeams[0] || "Home Team";
    const awayName = teamValue(away, "name") || item.team_2 || splitTeams[1] || "Away Team";
    return {
      tournament: item.tournament || item.league || item.event_name || item.series || item.title || "Live Match",
      homeTeam: {
        name: homeName,
        logo: teamValue(home, "logo") || teamValue(home, "flag") || item.home_logo || item.team_1_logo || ""
      },
      awayTeam: {
        name: awayName,
        logo: teamValue(away, "logo") || teamValue(away, "flag") || item.away_logo || item.team_2_logo || ""
      },
      poster: item.poster || item.backgroundImage || item.thumbnail || item.cover_image || item.src || item.tvgLogo || "",
      posterPosition: item.posterPosition || "",
      posterPositionMobile: item.posterPositionMobile || "",
      watchUrl: item.watchUrl || item.page_url || item.watch_now || "#willow-live"
    };
  }

  function renderMatch(match, index) {
    const normalized = normalizeMatch(match);
    const home = normalized.homeTeam;
    const away = normalized.awayTeam;
    const title = escapeHtml(normalized.tournament);
    const homeName = escapeHtml(home.name);
    const awayName = escapeHtml(away.name);
    const poster = escapeHtml(normalized.poster);
    const watchUrl = escapeHtml(normalized.watchUrl);

    const posDesktop = escapeHtml(normalized.posterPosition);
    const posMobile = escapeHtml(normalized.posterPositionMobile);
    const posterStyle = (posDesktop || posMobile)
      ? ` style="--poster-pos:${posDesktop || "center 25%"};--poster-pos-m:${posMobile || posDesktop || "center 40%"};"`
      : "";

    return `
      <section class="poster-section${index === 0 ? " active" : ""}" data-slide="${index}" aria-label="${title}: ${homeName} vs ${awayName}">
        <div class="poster-ambient" aria-hidden="true"><img src="${poster}" alt="" decoding="async" loading="${index === 0 ? "eager" : "lazy"}"></div>
        <div class="hero-card">
        <div class="poster-art">
          <picture>
            <img src="${poster}" alt="${homeName} vs ${awayName}" class="poster-image" loading="eager" decoding="async" ${index === 0 ? 'fetchpriority="high"' : ''}${posterStyle}>
          </picture>
          <div class="gradient-left"></div>
          <div class="gradient-overlay"></div>
        </div>
        <div class="match-details">
          <div class="match-title">${title}</div>
          <div class="teams-row">
            <div class="team">
              <span class="team-name">${homeName}</span>
            </div>
            <span class="vs-label" aria-hidden="true">V</span>
            <div class="team">
              <span class="team-name">${awayName}</span>
            </div>
          </div>
          <div class="action-buttons">
            <a href="${watchUrl}" class="watch-btn"><span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5L20 12L8 19Z"/></svg></span><span>Watch Now</span></a>
          </div>
        </div>
        </div>
      </section>
    `;
  }

  function renderHero() {
    if (!slidesRoot || !progressRoot) return;
    clearTimeout(settleTimer);
    settling = false;
    const visualMatches = matches.length > 1 ? [matches[matches.length - 1]].concat(matches, [matches[0]]) : matches;
    slidesRoot.innerHTML = visualMatches.map(renderMatch).join('');
    slideNodes = Array.from(slidesRoot.querySelectorAll('.poster-section'));
    physicalIndex = matches.length > 1 ? 1 : 0;
    let backdrop = posterWrapper.querySelector('.hero-ambient-stage');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'hero-ambient-stage';
      backdrop.setAttribute('aria-hidden', 'true');
      posterWrapper.prepend(backdrop);
    }
    backdrop.innerHTML = matches.map(function (match) {
      return '<img src="' + escapeHtml(normalizeMatch(match).poster) + '" alt="" decoding="async">';
    }).join('');
    posterWrapper.classList.toggle('hero-single', matches.length < 2);
    progressRoot.innerHTML = matches.map(function (_, index) {
      return `<div class="progress-track" data-track="${index}"><div class="progress-fill"></div></div>`;
    }).join("");

    slidesRoot.querySelectorAll(".poster-image").forEach(function (image) {
      image.addEventListener("error", function () {
        image.hidden = true;
        image.closest(".poster-art").classList.add("image-fallback");
        const ambient = image.closest(".poster-section").querySelector(".poster-ambient");
        if (ambient) ambient.hidden = true;
      });
    });

    slidesRoot.querySelectorAll(".team-flag").forEach(function (image) {
      image.addEventListener("error", function () {
        image.hidden = true;
      });
    });

    if (matches.length < 2) {
      if (arrowLeft) arrowLeft.hidden = true;
      if (arrowRight) arrowRight.hidden = true;
      progressRoot.hidden = true;
    } else {
      if (arrowLeft) arrowLeft.hidden = true;
      if (arrowRight) arrowRight.hidden = true;
      progressRoot.hidden = false;
    }

    slidesRoot.querySelectorAll('.poster-section').forEach(function (slide, index) {
      slide.inert = index !== 0;
      slide.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
    });
    currentIndex = 0;
    markActive();
    positionTrack(false);
    updateProgressBars();
    restartAutoplay();
  }

  function updateProgressBars() {
    if (!progressRoot) return;
    Array.from(progressRoot.querySelectorAll(".progress-track")).forEach(function (track, index) {
      const fill = track.querySelector(".progress-fill");
      fill.classList.remove("filling", "filled");
      fill.style.animationDuration = `${slideDuration}ms`;
      fill.style.width = "";
      void fill.offsetWidth;
      track.classList.toggle('is-active', index === currentIndex);
      if (index === currentIndex) fill.classList.add("filling");
    });
  }

  function goToSlide(index) {
    if (matches.length < 2 || !slidesRoot) return;
    if (settling) {
      finishTransition();
    }
    physicalIndex = index + 1;
    currentIndex = ((index % matches.length) + matches.length) % matches.length;
    markActive();
    settling = true;
    positionTrack(true);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(finishTransition, 650);
    updateProgressBars();
    restartAutoplay();
  }

  if (slidesRoot) slidesRoot.addEventListener('transitionend', function (event) {
    if (event.target === slidesRoot && event.propertyName === 'transform') finishTransition();
  });
  window.addEventListener('resize', function () { finishTransition(); });

  function restartAutoplay() {
    if (autoplayTimer) window.clearTimeout(autoplayTimer);
    if (document.hidden || (posterWrapper && posterWrapper.contains(document.activeElement))) return;
    if (matches.length > 1) {
      autoplayTimer = window.setTimeout(function () {
        goToSlide(currentIndex + 1);
      }, slideDuration);
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (autoplayTimer) window.clearTimeout(autoplayTimer);
    } else {
      updateProgressBars();
      restartAutoplay();
    }
  });

  async function syncActiveLiveMatches() {
    const apis = config.apis || {};
    const sonyUrl = apis.sonyLiv || "https://raw.githubusercontent.com/kajju027/SonyLiv-Events-Json/refs/heads/main/sonyliv.json";
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    try {
      const res = await fetch(sonyUrl, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.matches)) {
        const liveMatches = data.matches.filter(m => m.status && m.status.toLowerCase() === 'live' && m.poster);
        if (liveMatches.length > 0) {
          const curatedLive = liveMatches.slice(0, 3).map(m => {
            const parts = (m.match_name || '').split(/[\-\|]/)[0].split(/\s+vs\.?\s+/i);
            return normalizeMatch({
              tournament: (m.event_name || 'SONY LIV LIVE').toUpperCase(),
              homeTeam: { name: (parts[0] || 'Team 1').trim(), logo: '' },
              awayTeam: { name: (parts[1] || 'Team 2').trim(), logo: '' },
              poster: m.poster,
              date: 'LIVE NOW — SONY LIV HD',
              watchUrl: '/watch/sliv/?id=' + encodeURIComponent(m.match_id || '')
            });
          });

          const existingKeys = new Set(matches.map(m => (m.homeTeam.name + 'v' + m.awayTeam.name).toLowerCase().replace(/[^a-z0-9]/g, '')));
          const newLive = curatedLive.filter(m => !existingKeys.has((m.homeTeam.name + 'v' + m.awayTeam.name).toLowerCase().replace(/[^a-z0-9]/g, '')));
          if (newLive.length > 0) {
            matches = [...newLive, ...matches].slice(0, Number(config.maxHeroMatches) || 8);
            renderHero();
          }
        }
      }
    } catch (err) {}
  }

  async function loadRemoteHeroFeed() {
    const feedUrl = config.heroFeedUrl || "data/hero.json";

    try {
      const cacheBustUrl = feedUrl + (feedUrl.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now();
      const response = await fetch(cacheBustUrl, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        const remoteMatches = Array.isArray(data) ? data : data.heroMatches || data.matches || data.Matches || data.streams || [];
        if (Array.isArray(remoteMatches) && remoteMatches.length) {
          const freshMatches = remoteMatches.slice(0, Number(config.maxHeroMatches) || 8).map(normalizeMatch);
          const prevKey = matches.map(m => m.tournament + ':' + m.homeTeam.name + 'v' + m.awayTeam.name).join('|');
          const newKey = freshMatches.map(m => m.tournament + ':' + m.homeTeam.name + 'v' + m.awayTeam.name).join('|');
          if (prevKey !== newKey || !matches.length) {
            matches = freshMatches;
            renderHero();
          }
        }
      }
    } catch (error) {
      console.warn("Featured match feed could not be loaded:", error);
    }

    try {
      await syncActiveLiveMatches();
    } catch (e) {}
  }

  
  const DR_ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    live: '<circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M7.7 7.7a6 6 0 0 0 0 8.6M16.3 7.7a6 6 0 0 1 0 8.6M4.8 4.8a10 10 0 0 0 0 14.4M19.2 4.8a10 10 0 0 1 0 14.4"/>',
    cric: '<path d="m14 4 6 6-9.5 9.5a2 2 0 0 1-2.8 0l-3.2-3.2a2 2 0 0 1 0-2.8z"/><path d="m5 19-2 2"/>',
    foot: '<circle cx="12" cy="12" r="9"/><path d="m12 8 3.5 2.5-1.3 4.1H9.8L8.5 10.5z"/><path d="M12 3v5M15.5 10.5 20 9M14.2 14.6l2.6 3.7M9.8 14.6l-2.6 3.7M8.5 10.5 4 9"/>',
    tv: '<rect x="3.5" y="6.5" width="17" height="12.5" rx="2"/><path d="m8 3 4 3.5L16 3"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>'
  };

  function drIcon(key) {
    return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + DR_ICONS[key] + "</svg>";
  }

  if (drNav) {
    const OFFER_URL = "#footballSection"; 
    let ki = 0;
    const sty = () => ' style="--i:' + (ki++) + '"';
    const NAV = [
      ["Home", "#top", "home", true],
      ["Football 24\u00d77", "#footballSection", "foot", false],
      ["Cricket 24\u00d77", "#cricketSection", "cric", false],
      ["Willow Cricbuzz", "#willow-live", "live", false],
      ["FanCode", "#fancodeSection", "tv", false]
    ];
    const MORE = [
      ["World Sports", "#worldSportsSection"],
      ["Sony LIV Events", "#sonyLivSection"],
    ];
    drNav.innerHTML =
      NAV.map(function (item) {
        const label = item[0], href = item[1], icon = item[2], current = item[3];
        return '<a class="dr-item"' + sty() + ' href="' + href + '"' + (current ? ' aria-current="page"' : "") + ">" + drIcon(icon) + "<span>" + label + "</span></a>";
      }).join("") +
      '<button class="dr-item dr-acc"' + sty() + ' type="button" aria-expanded="false" aria-controls="drSub">' + drIcon("grid") + "<span>All Sports</span><svg class=\"chev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 9 6 6 6-6\"/></svg></button>" +
      '<div class="dr-sub" id="drSub"><div>' +
      MORE.map(function (item) {
        return '<a class="dr-sub-item" href="' + item[1] + '">' + item[0] + "</a>";
      }).join("") +
      "</div></div>" +
      '<div class="dr-sep"></div>' +
      '<a class="dr-item"' + sty() + ' href="/asppv.pages.dev/Feedback/">' + drIcon("help") + "<span>Feedback &amp; Support</span></a>";
  }

  let dOpen = false;
  let lastFocus = null;

  function openDrawer() {
    if (dOpen || !drawer || !scrim || !hamburger) return;
    dOpen = true;
    lastFocus = document.activeElement;
    try { drawer.inert = false; } catch (e) {}
    drawer.setAttribute("aria-hidden", "false");
    hamburger.setAttribute("aria-expanded", "true");
    drawer.classList.add("open");
    scrim.classList.add("open");
    hamburger.classList.add("active");
    document.documentElement.classList.add("lock");
    const closeBtn = document.getElementById("dclose");
    if (closeBtn) window.setTimeout(function () { closeBtn.focus({ preventScroll: true }); }, 60);
  }

  function closeDrawer() {
    if (!dOpen || !drawer || !scrim || !hamburger) return;
    dOpen = false;
    drawer.classList.remove("open");
    scrim.classList.remove("open");
    hamburger.classList.remove("active");
    try { drawer.inert = true; } catch (e) {}
    drawer.setAttribute("aria-hidden", "true");
    hamburger.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("lock");
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  renderHero();
  loadRemoteHeroFeed();
  // Auto-refresh dynamic hero matches every 60s so day-to-day & live match transitions update seamlessly
  setInterval(loadRemoteHeroFeed, 60000);

  if (arrowRight) arrowRight.addEventListener("click", function (event) {
    event.stopPropagation();
    goToSlide(currentIndex + 1);
  });

  if (arrowLeft) arrowLeft.addEventListener("click", function (event) {
    event.stopPropagation();
    goToSlide(currentIndex - 1);
  });

  
  document.addEventListener("keydown", function (event) {
    if (dOpen) return;
    const tag = (event.target && event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (event.key === "ArrowRight" && matches.length > 1) {
      goToSlide(currentIndex + 1);
    } else if (event.key === "ArrowLeft" && matches.length > 1) {
      goToSlide(currentIndex - 1);
    }
  });

  
  if (posterWrapper) {
    posterWrapper.addEventListener("mouseenter", function () {
      if (autoplayTimer) window.clearTimeout(autoplayTimer);
    });
    posterWrapper.addEventListener("mouseleave", function () {
      restartAutoplay();
    });
  }

  if (posterWrapper) {
    posterWrapper.addEventListener("focusin", function () {
      if (autoplayTimer) window.clearTimeout(autoplayTimer);
    });
    posterWrapper.addEventListener("focusout", function (event) {
      if (!posterWrapper.contains(event.relatedTarget)) restartAutoplay();
    });
  }

  if (posterWrapper) {
    let gesture = null;
    let touchGesture = null;
    let suppressClickUntil = 0;
    posterWrapper.style.touchAction = 'pan-y pinch-zoom';
    posterWrapper.addEventListener('dragstart', function (event) { event.preventDefault(); });

    if (window.PointerEvent) {
      // 1. Modern Pointer Events (handles mouse, pen, and touch with zero double-trigger)
      posterWrapper.addEventListener('pointerdown', function (event) {
        if (!event.isPrimary || matches.length < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return;
        if (event.target.closest('.action-buttons, a, button')) return;
        if (settling) finishTransition();
        clearTimeout(autoplayTimer);
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, start: performance.now(), dx: 0, axis: null };
      });

      posterWrapper.addEventListener('pointermove', function (event) {
        if (!gesture || event.pointerId !== gesture.id) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (!gesture.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 6) {
          gesture.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
          if (gesture.axis === 'x') {
            try { posterWrapper.setPointerCapture(event.pointerId); } catch (error) {}
            posterWrapper.classList.add('hero-dragging');
          }
        }
        if (gesture.axis === 'x') {
          gesture.dx = dx;
          positionTrack(false, dx);
        }
      });

      function endGesture(event) {
        if (!gesture) return;
        if (event && event.pointerId != null && event.pointerId !== gesture.id) return;
        const drag = gesture;
        gesture = null;
        posterWrapper.classList.remove('hero-dragging');

        try {
          if (posterWrapper.hasPointerCapture && posterWrapper.hasPointerCapture(drag.id)) {
            posterWrapper.releasePointerCapture(drag.id);
          }
        } catch (e) {}

        const elapsed = Math.max(1, performance.now() - drag.start);
        const velocity = Math.abs(drag.dx) / elapsed;
        const threshold = Math.min(70, posterWrapper.clientWidth * 0.12);

        if (drag.axis === 'x' && (Math.abs(drag.dx) > threshold || (Math.abs(drag.dx) > 18 && velocity > 0.3))) {
          suppressClickUntil = Date.now() + 450;
          goToSlide(currentIndex + (drag.dx < 0 ? 1 : -1));
        } else {
          positionTrack(true);
          restartAutoplay();
        }
      }

      posterWrapper.addEventListener('pointerup', endGesture);
      posterWrapper.addEventListener('pointercancel', endGesture);
    } else {
      // 2. Direct Touch Events fallback ONLY for legacy environments without PointerEvent
      posterWrapper.addEventListener('touchstart', function (e) {
        if (matches.length < 2 || !e.touches || e.touches.length !== 1) return;
        if (e.target.closest('.action-buttons, a, button')) return;
        if (settling) finishTransition();
        clearTimeout(autoplayTimer);
        const t = e.touches[0];
        touchGesture = { x: t.clientX, y: t.clientY, start: performance.now(), dx: 0, axis: null };
      }, { passive: true });

      posterWrapper.addEventListener('touchmove', function (e) {
        if (!touchGesture || !e.touches || e.touches.length !== 1) return;
        const t = e.touches[0];
        const dx = t.clientX - touchGesture.x;
        const dy = t.clientY - touchGesture.y;
        if (!touchGesture.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 6) {
          touchGesture.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        }
        if (touchGesture.axis === 'x') {
          touchGesture.dx = dx;
          positionTrack(false, dx);
        }
      }, { passive: true });

      function endTouch() {
        if (!touchGesture) return;
        const drag = touchGesture;
        touchGesture = null;
        const elapsed = Math.max(1, performance.now() - drag.start);
        const velocity = Math.abs(drag.dx) / elapsed;
        const threshold = Math.min(70, posterWrapper.clientWidth * 0.12);

        if (drag.axis === 'x' && (Math.abs(drag.dx) > threshold || (Math.abs(drag.dx) > 18 && velocity > 0.3))) {
          suppressClickUntil = Date.now() + 450;
          goToSlide(currentIndex + (drag.dx < 0 ? 1 : -1));
        } else {
          positionTrack(true);
          restartAutoplay();
        }
      }

      posterWrapper.addEventListener('touchend', endTouch, { passive: true });
      posterWrapper.addEventListener('touchcancel', endTouch, { passive: true });
    }

    posterWrapper.addEventListener('click', function (event) {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  // 3. Make slide dots / progress bars interactive
  if (progressRoot) {
    progressRoot.addEventListener('click', function (event) {
      const track = event.target.closest('.progress-track');
      if (!track) return;
      const targetIdx = parseInt(track.dataset.track, 10);
      if (!isNaN(targetIdx) && targetIdx !== currentIndex) {
        if (settling) finishTransition();
        goToSlide(targetIdx);
      }
    });
  }

  if (hamburger && drawer && scrim) {
    hamburger.addEventListener("click", function (event) {
      event.stopPropagation();
      if (dOpen) closeDrawer(); else openDrawer();
    });

    if (dcloseBtn) dcloseBtn.addEventListener("click", closeDrawer);

    scrim.addEventListener("click", closeDrawer);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeDrawer();
    });

    drawer.addEventListener("click", function (event) {
      const acc = event.target.closest(".dr-acc");
      if (acc) {
        const open = acc.getAttribute("aria-expanded") !== "true";
        acc.setAttribute("aria-expanded", String(open));
        const sub = document.getElementById("drSub");
        if (sub) sub.classList.toggle("open", open);
        return;
      }
      if (event.target.closest("a")) closeDrawer();
    });

    
    drawer.addEventListener("keydown", function (event) {
      if (event.key !== "Tab") return;
      const focusables = Array.prototype.filter.call(
        drawer.querySelectorAll("a[href],button,input"),
        function (el) { return el.offsetParent !== null; }
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    
    if (drSearch) {
      drSearch.addEventListener("input", function () {
        const q = drSearch.value.trim().toLowerCase();
        drawer.querySelectorAll(".dr-item").forEach(function (item) {
          if (item.classList.contains("dr-acc")) return;
          const text = item.textContent.toLowerCase();
          item.style.display = (!q || text.indexOf(q) !== -1) ? "" : "none";
        });
        drawer.querySelectorAll(".dr-sub-item").forEach(function (item) {
          const text = item.textContent.toLowerCase();
          item.style.display = (!q || text.indexOf(q) !== -1) ? "" : "none";
        });
        const sub = document.getElementById("drSub");
        const sep = drawer.querySelector(".dr-sep");
        if (sub) sub.style.display = q ? "none" : "";
        if (sep) sep.style.display = q ? "none" : "";
      });
    }
  }
})();