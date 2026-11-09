/* =========================================================
   CRICZONE
   HOME PAGE APPLICATION
   app.js
========================================================= */

'use strict';


/* =========================================================
   CONFIG
========================================================= */

const CNPTV_SOURCE =
  'https://raw.githubusercontent.com/kajju027/Fancode-Events-Json/main/fan.json';

const WORLD_SOURCE =
  'https://raw.githubusercontent.com/kajju027/Fancode-Events-Json/main/fancode.json';

const PLAYER_PAGE = 'play.html';

const TELEGRAM_LINK =
  'https://t.me/+MueCDjlpoS8yNmJl';

const FALLBACK_IMG =
  'https://www.fancode.com/skillup-uploads/cms-media/Cricket_Fallback_Old_match-card.jpg';

const REFRESH_INTERVAL_MS = 60000;


/* =========================================================
   LANGUAGE DATA
========================================================= */

const LANG_CODE_MAP = {
  ENGLISH: 'eng',
  HINDI: 'hin',
  BANGLA: 'ban',
  BENGALI: 'ban',
  TAMIL: 'tam',
  TELUGU: 'tel',
  KANNADA: 'kan',
  MARATHI: 'mar',
  MALAYALAM: 'mal',
  PUNJABI: 'pan',
  GUJARATI: 'guj',
  URDU: 'urd',
  ODIA: 'ori',
  ASSAMESE: 'asm',
  BHOJPURI: 'bho'
};


const LANG_NAMES = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  kn: 'Kannada',
  mr: 'Marathi',
  gu: 'Gujarati',
  pa: 'Punjabi',
  or: 'Odia',
  as: 'Assamese',
  ur: 'Urdu'
};


/* =========================================================
   ICONS
========================================================= */

const ICON_GLOBE = `
<svg
  width="12"
  height="12"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
>
  <circle cx="12" cy="12" r="9"></circle>
  <path d="M3 12h18"></path>
  <path d="M12 3c2.4 2.7 3.8 6 3.8 9s-1.4 6.3-3.8 9c-2.4-2.7-3.8-6-3.8-9s1.4-6.3-3.8-9z"></path>
</svg>
`;


const ICON_CHEVRON = `
<svg
  class="ww-chevron"
  width="13"
  height="13"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.3"
>
  <path d="M6 9l6 6 6-6"></path>
</svg>
`;


/* =========================================================
   DOM
========================================================= */

const grid =
  document.getElementById('matchesGrid');

const searchInput =
  document.getElementById('searchInput');

const searchClear =
  document.getElementById('searchClear');

const searchWrap =
  document.getElementById('searchWrap');

const langSelect =
  document.getElementById('langSelect');

const lastUpdateEl =
  document.getElementById('lastUpdate');

const featuredLive =
  document.getElementById('featuredLive');

const heroLiveCount =
  document.getElementById('heroLiveCount');

const heroMatchCount =
  document.getElementById('heroMatchCount');

const currentYear =
  document.getElementById('currentYear');

const joinTelegramBtn =
  document.getElementById('joinTelegramBtn');

const headerSearchBtn =
  document.getElementById('headerSearchBtn');

const telegramModal =
  document.getElementById('telegramModal');

const popupClose =
  document.getElementById('popupClose');

const closeButton =
  document.getElementById('closeButton');

const joinButton =
  document.getElementById('joinButton');

const translateIndicator =
  document.getElementById('translateIndicator');

const translateMsg =
  document.getElementById('translateMsg');


/* =========================================================
   STATE
========================================================= */

let allMatches = [];

let activeFilter = 'all';

let currentLang =
  localStorage.getItem('criczone_lang') || 'en';

let openPanels = new Set();

let languageOpenPanels = new Set();

let lastWorldSnapshot = null;

let translationCache = {};

let currentTranslations = {};

let isRefreshing = false;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  init
);


function init() {

  if (currentYear) {
    currentYear.textContent =
      new Date().getFullYear();
  }


  if (langSelect) {
    langSelect.value = currentLang;
  }


  setupNavigation();

  setupSearch();

  setupFilters();

  setupTelegram();

  refreshMatches(true);

  setInterval(
    () => refreshMatches(false),
    REFRESH_INTERVAL_MS
  );
}


/* =========================================================
   SAFE HTML
========================================================= */

function esc(value) {

  return String(value ?? '')
    .replace(
      /[&<>"']/g,
      char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char])
    );

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

  if (
    headerSearchBtn &&
    searchInput
  ) {

    headerSearchBtn.addEventListener(
      'click',
      () => {

        searchWrap?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        setTimeout(
          () => searchInput.focus(),
          350
        );

      }
    );

  }


  document
    .querySelectorAll('.nav-link')
    .forEach(
      link => {

        link.addEventListener(
          'click',
          () => {

            document
              .querySelectorAll('.nav-link')
              .forEach(
                item =>
                  item.classList.remove(
                    'active'
                  )
              );

            link.classList.add(
              'active'
            );

          }
        );

      }
    );


  document
    .querySelectorAll('a[href^="#"]')
    .forEach(
      link => {

        link.addEventListener(
          'click',
          event => {

            const target =
              document.querySelector(
                link.getAttribute('href')
              );

            if (!target) return;

            event.preventDefault();

            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });

          }
        );

      }
    );

}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

  if (!searchInput) return;


  searchInput.addEventListener(
    'input',
    applyCurrentView
  );


  if (searchClear) {

    searchClear.addEventListener(
      'click',
      () => {

        searchInput.value = '';

        searchInput.focus();

        applyCurrentView();

      }
    );

  }


  searchInput.addEventListener(
    'keydown',
    event => {

      if (event.key === 'Escape') {

        searchInput.value = '';

        applyCurrentView();

        searchInput.blur();

      }

    }
  );

}


/* =========================================================
   FILTERS
========================================================= */

function setupFilters() {

  document
    .querySelectorAll('.filter-btn')
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            activeFilter =
              button.dataset.filter ||
              'all';


            document
              .querySelectorAll(
                '.filter-btn'
              )
              .forEach(
                item =>
                  item.classList.remove(
                    'active'
                  )
              );


            button.classList.add(
              'active'
            );


            applyCurrentView();

          }
        );

      }
    );

}


/* =========================================================
   TELEGRAM
========================================================= */

function setupTelegram() {

  if (joinTelegramBtn) {

    joinTelegramBtn.addEventListener(
      'click',
      () => {

        window.open(
          TELEGRAM_LINK,
          '_blank',
          'noopener,noreferrer'
        );

      }
    );

  }


  if (joinButton) {

    joinButton.addEventListener(
      'click',
      () => {

        sessionStorage.setItem(
          'criczone_telegram',
          'joined'
        );

        closeTelegramPopup();

      }
    );

  }


  if (closeButton) {

    closeButton.addEventListener(
      'click',
      () => {

        sessionStorage.setItem(
          'criczone_telegram',
          'dismissed'
        );

        closeTelegramPopup();

      }
    );

  }


  if (popupClose) {

    popupClose.addEventListener(
      'click',
      closeTelegramPopup
    );

  }


  if (telegramModal) {

    telegramModal.addEventListener(
      'click',
      event => {

        if (
          event.target ===
          telegramModal
        ) {

          closeTelegramPopup();

        }

      }
    );

  }


  if (
    !sessionStorage.getItem(
      'criczone_telegram'
    )
  ) {

    setTimeout(
      () =>
        openTelegramPopup(),
      1400
    );

  }

}


function openTelegramPopup() {

  if (!telegramModal) return;

  telegramModal.classList.remove(
    'hidden'
  );

  telegramModal.setAttribute(
    'aria-hidden',
    'false'
  );

  document.body.classList.add(
    'modal-open'
  );

}


function closeTelegramPopup() {

  if (!telegramModal) return;

  telegramModal.classList.add(
    'hidden'
  );

  telegramModal.setAttribute(
    'aria-hidden',
    'true'
  );

  document.body.classList.remove(
    'modal-open'
  );

}


/* =========================================================
   FETCH MATCH DATA
========================================================= */

async function refreshMatches(
  isFirstLoad = false
) {

  if (isRefreshing) return;

  isRefreshing = true;


  try {

    const [
      cnptvResponse,
      worldResponse
    ] = await Promise.all([

      fetch(
        CNPTV_SOURCE,
        {
          cache: 'no-store'
        }
      ),

      fetch(
        WORLD_SOURCE,
        {
          cache: 'no-store'
        }
      )

    ]);


    if (!worldResponse.ok) {

      throw new Error(
        'Match data request failed'
      );

    }


    const cnptvData =
      cnptvResponse.ok
        ? await cnptvResponse.json()
        : {
            matches: []
          };


    const worldData =
      await worldResponse.json();


    const snapshot =
      JSON.stringify(
        worldData.matches || []
      );


    const updatedAt =
      parseUpdatedAt(
        worldData.updatedAt
      ) ||
      new Date();


    if (
      !isFirstLoad &&
      snapshot === lastWorldSnapshot
    ) {

      updateLastUpdate(
        updatedAt
      );

      return;

    }


    lastWorldSnapshot =
      snapshot;


    allMatches =
      buildMatches(
        cnptvData,
        worldData
      );


    updateCounters();

    updateLastUpdate(
      updatedAt
    );


    await renderCurrentView();


  } catch (error) {

    console.error(
      'CricZone match refresh error:',
      error
    );


    if (isFirstLoad) {

      showInitialError();

    }

  } finally {

    isRefreshing = false;

  }

}


/* =========================================================
   BUILD MATCH OBJECTS
========================================================= */

function buildMatches(
  cnptvData,
  worldData
) {

  const cnptvMap = {};


  (
    cnptvData.matches ||
    []
  )
    .forEach(
      match => {

        cnptvMap[
          match.match_id
        ] = match;

      }
    );


  const matches =
    (
      worldData.matches ||
      []
    )
      .map(
        match => {

          const rawStatus =
            String(
              match.status || ''
            ).toUpperCase();


          const status =
            rawStatus === 'LIVE'
              ? 'LIVE'
              : rawStatus ===
                  'COMPLETED'
                ? 'COMPLETED'
                : 'UPCOMING';


          const isLive =
            status === 'LIVE';


          const cnptv =
            cnptvMap[
              match.match_id
            ];


          const streams =
            match.streams || {};


          return {

            id:
              match.match_id,

            title:
              match.title ||
              'Cricket Match',

            tournament:
              match.tournament ||
              'Cricket',

            image:
              match.image ||
              FALLBACK_IMG,

            status,

            language:
              match.language ||
              'ENGLISH',

            /*
              IMPORTANT:
              Preserve auto_streams so the
              Home page can show English,
              Hindi and other audio streams.
            */
            autoStreams:
              match.auto_streams ||
              {},

            time:
              parseMatchTime(
                match.startTime
              ),

            langCode:
              langToCode(
                match.language,
                isLive
              ),

            cnptvUrl:
              cnptv?.cnptv_cdn ||
              null,

            lk:
              streams.fancode_lk_cdn ||
              null,

            np:
              streams.fancode_np_cdn ||
              null,

            bd:
              streams.fancode_bd_cdn ||
              null

          };

        }
      );


  /* LIVE first */

  matches.sort(
    (a, b) => {

      if (
        a.status === 'LIVE' &&
        b.status !== 'LIVE'
      ) return -1;


      if (
        a.status !== 'LIVE' &&
        b.status === 'LIVE'
      ) return 1;


      const aTime =
        a.time
          ? a.time.getTime()
          : Infinity;


      const bTime =
        b.time
          ? b.time.getTime()
          : Infinity;


      return aTime - bTime;

    }
  );


  return matches;

}


/* =========================================================
   FILTER + SEARCH
========================================================= */

function getVisibleMatches() {

  let matches =
    [...allMatches];


  if (
    activeFilter !== 'all'
  ) {

    matches =
      matches.filter(
        match =>
          match.status.toLowerCase() ===
          activeFilter
      );

  }


  const query =
    searchInput?.value
      ?.trim()
      ?.toLowerCase() ||
    '';


  if (query) {

    matches =
      matches.filter(
        match => {

          return (

            match.title
              .toLowerCase()
              .includes(query)

            ||

            match.tournament
              .toLowerCase()
              .includes(query)

            ||

            String(
              match.language || ''
            )
              .toLowerCase()
              .includes(query)

          );

        }
      );

  }


  return matches;

}


function applyCurrentView() {

  renderCurrentView();

}


/* =========================================================
   RENDER
========================================================= */

async function renderCurrentView() {

  const visible =
    getVisibleMatches();


  renderGrid(
    visible,
    currentTranslations
  );


  renderFeaturedLive();

}


/* =========================================================
   MATCH CARD
========================================================= */

function renderCard(
  match,
  translation = null
) {

  const title =
    translation?.title ||
    match.title;


  const tournament =
    translation?.tournament ||
    match.tournament;


  const time =
    formatMatchTime(
      match.time
    );


  let statusHTML = '';

  let actionsHTML = '';


  /* -----------------------------
     LIVE
  ----------------------------- */

  if (
    match.status === 'LIVE'
  ) {

    statusHTML = `
      <span class="status-badge live">
        <span class="status-dot-mini"></span>
        LIVE
      </span>
    `;


    const canWatch =
      Boolean(
        match.cnptvUrl &&
        match.langCode
      );


    /* =====================================================
       AUDIO LANGUAGE STREAMS
       Reads directly from match.autoStreams
    ====================================================== */

    const languageStreams =
      Object.keys(
        match.autoStreams || {}
      )
        .map(
          language => {

            const languageData =
              match.autoStreams?.[
                language
              ];


            const streams =
              languageData?.streams ||
              {};


            const hasStream =
              Object.keys(
                streams
              ).length > 0;


            const code =
              LANG_CODE_MAP[
                String(
                  language
                ).toUpperCase()
              ];


            if (
              !hasStream ||
              !code
            ) {

              return null;

            }


            const languageMeta = {

              ENGLISH: {
                flag: '🇬🇧',
                name: 'English'
              },

              HINDI: {
                flag: '🇮🇳',
                name: 'Hindi'
              },

              BANGLA: {
                flag: '🇮🇳',
                name: 'Bangla'
              },

              BENGALI: {
                flag: '🇮🇳',
                name: 'Bengali'
              },

              TAMIL: {
                flag: '🇮🇳',
                name: 'Tamil'
              },

              TELUGU: {
                flag: '🇮🇳',
                name: 'Telugu'
              },

              KANNADA: {
                flag: '🇮🇳',
                name: 'Kannada'
              },

              MARATHI: {
                flag: '🇮🇳',
                name: 'Marathi'
              },

              MALAYALAM: {
                flag: '🇮🇳',
                name: 'Malayalam'
              },

              PUNJABI: {
                flag: '🇮🇳',
                name: 'Punjabi'
              },

              GUJARATI: {
                flag: '🇮🇳',
                name: 'Gujarati'
              },

              URDU: {
                flag: '🇮🇳',
                name: 'Urdu'
              },

              ODIA: {
                flag: '🇮🇳',
                name: 'Odia'
              },

              ASSAMESE: {
                flag: '🇮🇳',
                name: 'Assamese'
              },

              BHOJPURI: {
                flag: '🇮🇳',
                name: 'Bhojpuri'
              }

            };


            const meta =
              languageMeta[
                String(
                  language
                ).toUpperCase()
              ] || {

                flag: '🌐',
                name: language

              };


            return {

              language,

              code,

              flag:
                meta.flag,

              name:
                meta.name

            };

          }
        )
        .filter(
          Boolean
        );


    const hasLanguageStreams =
      languageStreams.length > 0;


    /* =====================================================
       WORLD / REGIONAL STREAMS
    ====================================================== */

    const worldStreams = [

      {
        flag: '🇱🇰',
        name: 'Sri Lanka',
        code: 'LK',
        url: match.lk,
        index: 1
      },

      {
        flag: '🇳🇵',
        name: 'Nepal',
        code: 'NP',
        url: match.np,
        index: 2
      },

      {
        flag: '🇧🇩',
        name: 'Bangladesh',
        code: 'BD',
        url: match.bd,
        index: 3
      }

    ].filter(
      stream =>
        Boolean(
          stream.url
        )
    );


    const hasWorldStreams =
      Boolean(
        worldStreams.length
      );


    const isOpen =
      openPanels.has(
        String(
          match.id
        )
      );


    const isLanguageOpen =
      languageOpenPanels.has(
        String(
          match.id
        )
      );


    actionsHTML = `

      <!-- DEFAULT ENGLISH / PRIMARY -->

      <button
        type="button"
        class="match-watch-btn ${
          canWatch
            ? ''
            : 'disabled'
        }"
        ${
          canWatch
            ? `data-url="${esc(
                buildPlayerUrl(
                  match.id,
                  match.langCode,
                  0
                )
              )}"`
            : 'disabled'
        }
      >

        <span class="watch-icon">
          ▶
        </span>

        WATCH LIVE

      </button>


      <!-- AUDIO LANGUAGE SELECTOR -->

      ${
        hasLanguageStreams
          ? `

            <button
              type="button"
              class="world-stream-btn language-stream-btn ${
                isLanguageOpen
                  ? 'open'
                  : ''
              }"
              data-target="language-${esc(
                match.id
              )}"
            >

              ${ICON_GLOBE}

              <span>
                LANGUAGE
              </span>

              ${ICON_CHEVRON}

            </button>


            <div
              class="world-panel ${
                isLanguageOpen
                  ? 'open'
                  : ''
              }"
              id="language-${esc(
                match.id
              )}"
            >

              <div
                class="world-panel-inner"
              >

                ${
                  languageStreams
                    .map(
                      stream => `

                    <button
                      type="button"
                      class="world-row"
                      data-url="${esc(
                        buildPlayerUrl(
                          match.id,
                          stream.code,
                          0
                        )
                      )}"
                    >

                      <span
                        class="world-flag"
                      >
                        ${stream.flag}
                      </span>

                      <span
                        class="world-name"
                      >
                        ${esc(
                          stream.name
                        )}
                      </span>

                      <span
                        class="world-code"
                      >
                        ${stream.code.toUpperCase()}
                      </span>

                    </button>

                  `
                    )
                    .join('')
                }

              </div>

            </div>

          `
          : ''
      }


      <!-- WORLDWIDE / REGIONAL -->

      ${
        hasWorldStreams
          ? `

            <button
              type="button"
              class="world-stream-btn ${
                isOpen
                  ? 'open'
                  : ''
              }"
              data-target="world-${esc(
                match.id
              )}"
            >

              ${ICON_GLOBE}

              <span>
                WORLDWIDE STREAM
              </span>

              ${ICON_CHEVRON}

            </button>


            <div
              class="world-panel ${
                isOpen
                  ? 'open'
                  : ''
              }"
              id="world-${esc(
                match.id
              )}"
            >

              <div
                class="world-panel-inner"
              >

                ${
                  worldStreams
                    .map(
                      stream => `

                    <button
                      type="button"
                      class="world-row"
                      data-url="${esc(
                        buildPlayerUrl(
                          match.id,
                          match.langCode,
                          stream.index
                        )
                      )}"
                    >

                      <span
                        class="world-flag"
                      >
                        ${stream.flag}
                      </span>

                      <span
                        class="world-name"
                      >
                        ${esc(
                          stream.name
                        )}
                      </span>

                      <span
                        class="world-code"
                      >
                        ${stream.code}
                      </span>

                    </button>

                  `
                    )
                    .join('')
                }

              </div>

            </div>

          `
          : ''
      }

    `;

  }


  /* -----------------------------
     UPCOMING
  ----------------------------- */

  else if (
    match.status === 'UPCOMING'
  ) {

    statusHTML = `
      <span class="status-badge upcoming">
        <span class="status-dot-mini"></span>
        UPCOMING
      </span>
    `;


    actionsHTML = `

      <button
        type="button"
        class="match-upcoming-btn"
        data-upcoming-time="${esc(
          time
        )}"
      >

        <span>
          UPCOMING
        </span>

        <small>
          ${esc(time)}
        </small>

      </button>

    `;

  }


  /* -----------------------------
     COMPLETED
  ----------------------------- */

  else {

    statusHTML = `
      <span class="status-badge completed">
        <span class="status-dot-mini"></span>
        COMPLETED
      </span>
    `;


    actionsHTML = `

      <a
        class="match-completed-btn"
        href="${TELEGRAM_LINK}"
        target="_blank"
        rel="noopener noreferrer"
      >
        GET UPDATES
      </a>

    `;

  }


  return `

    <article
      class="match-card"
      data-match-id="${esc(
        match.id
      )}"
    >

      <div class="match-thumbnail">

        <img
          src="${esc(
            match.image
          )}"
          alt="${esc(
            title
          )}"
          loading="lazy"
          onerror="
            this.onerror=null;
            this.src='${FALLBACK_IMG}'
          "
        >


        <div
          class="thumbnail-gradient"
        ></div>


        ${
          match.status === 'LIVE'
            ? `

              <span
                class="language-badge"
              >

                ${ICON_GLOBE}

                ${esc(
                  langLabel(
                    match.language
                  ) || 'LIVE'
                )}

              </span>

            `
            : ''
        }


        ${statusHTML}

      </div>


      <div class="match-content">

        <h3 class="match-title">
          ${esc(title)}
        </h3>


        <div class="match-tournament">
          ${esc(tournament)}
        </div>


        <div class="match-time">

          <span class="time-icon">
            ◷
          </span>

          ${esc(time)}

        </div>


        <div class="match-actions">

          ${actionsHTML}

        </div>

      </div>

    </article>

  `;

}


/* =========================================================
   GRID
========================================================= */

function renderGrid(
  matches,
  translations = {}
) {

  if (!grid) return;


  if (!matches.length) {

    grid.innerHTML = `

      <div class="empty-state">

        <div class="empty-icon">
          🔍
        </div>

        <h3>
          No matches found
        </h3>

        <p>
          Try another search or filter.
        </p>

      </div>

    `;

    return;

  }


  grid.innerHTML =
    matches
      .map(
        match =>
          renderCard(
            match,
            translations[
              match.id
            ]
          )
      )
      .join('');

}


/* =========================================================
   FEATURED LIVE
========================================================= */

function renderFeaturedLive() {

  if (!featuredLive) return;


  const liveMatches =
    allMatches.filter(
      match =>
        match.status === 'LIVE'
    );


  if (!liveMatches.length) {

    featuredLive.innerHTML = `

      <div class="no-live-card">

        <div class="no-live-icon">
          🏏
        </div>

        <div>

          <strong>
            No live match right now
          </strong>

          <span>
            Check the upcoming matches below.
          </span>

        </div>

      </div>

    `;

    return;

  }


  const match =
    liveMatches[0];


  const title =
    currentTranslations[
      match.id
    ]?.title ||
    match.title;


  const tournament =
    currentTranslations[
      match.id
    ]?.tournament ||
    match.tournament;


  featuredLive.innerHTML = `

    <div
      class="featured-live-card"
    >

      <div class="featured-image">

        <img
          src="${esc(
            match.image
          )}"
          alt="${esc(
            title
          )}"
          onerror="
            this.onerror=null;
            this.src='${FALLBACK_IMG}'
          "
        >

        <div
          class="featured-image-overlay"
        ></div>

      </div>


      <div
        class="featured-live-content"
      >

        <div
          class="featured-live-label"
        >

          <span
            class="featured-pulse"
          ></span>

          LIVE NOW

        </div>


        <h3>
          ${esc(title)}
        </h3>


        <p>
          ${esc(tournament)}
        </p>


        <div
          class="featured-meta"
        >

          <span>

            ${ICON_GLOBE}

            ${esc(
              langLabel(
                match.language
              ) || 'LIVE'
            )}

          </span>


          <span>

            ${esc(
              formatMatchTime(
                match.time
              )
            )}

          </span>

        </div>


        <button
          type="button"
          class="featured-watch-btn"
          data-featured-url="${esc(
            buildPlayerUrl(
              match.id,
              match.langCode,
              0
            )
          )}"
        >

          <span>
            ▶
          </span>

          WATCH LIVE

        </button>

      </div>

    </div>

  `;


  const watchButton =
    featuredLive.querySelector(
      '[data-featured-url]'
    );


  if (watchButton) {

    watchButton.addEventListener(
      'click',
      () => {

        const url =
          watchButton.dataset
            .featuredUrl;

        if (url) {

          window.location.href =
            url;

        }

      }
    );

  }

}


/* =========================================================
   GRID EVENTS
========================================================= */

if (grid) {

  grid.addEventListener(
    'click',
    event => {

      /* WATCH */

      const watch =
        event.target.closest(
          '.match-watch-btn'
        );


      if (
        watch &&
        watch.dataset.url
      ) {

        window.location.href =
          watch.dataset.url;

        return;

      }


      /* LANGUAGE / WORLD ROW */

      const worldRow =
        event.target.closest(
          '.world-row'
        );


      if (
        worldRow &&
        worldRow.dataset.url
      ) {

        window.location.href =
          worldRow.dataset.url;

        return;

      }


      /* WORLD / LANGUAGE BUTTON */

      const streamButton =
        event.target.closest(
          '.world-stream-btn, .language-stream-btn'
        );


      if (streamButton) {

        const card =
          streamButton.closest(
            '.match-card'
          );


        const matchId =
          card?.dataset.matchId;


        const target =
          document.getElementById(
            streamButton.dataset.target
          );


        if (!target) return;


        const willOpen =
          !target.classList.contains(
            'open'
          );


        target.classList.toggle(
          'open',
          willOpen
        );


        streamButton.classList.toggle(
          'open',
          willOpen
        );


        if (matchId) {

          const isLanguage =
            streamButton.classList.contains(
              'language-stream-btn'
            );


          const panelSet =
            isLanguage
              ? languageOpenPanels
              : openPanels;


          if (willOpen) {

            panelSet.add(
              matchId
            );

          } else {

            panelSet.delete(
              matchId
            );

          }

        }


        return;

      }


      /* UPCOMING */

      const upcoming =
        event.target.closest(
          '.match-upcoming-btn'
        );


      if (upcoming) {

        const time =
          upcoming.dataset
            .upcomingTime ||
          'TIME TBA';


        showScheduleMessage(
          time
        );

      }

    }
  );


  grid.addEventListener(
    'keydown',
    event => {

      if (
        event.key !== 'Enter' &&
        event.key !== ' '
      ) return;


      const row =
        event.target.closest(
          '.world-row'
        );


      if (
        row &&
        row.dataset.url
      ) {

        event.preventDefault();

        window.location.href =
          row.dataset.url;

      }

    }
  );

}


/* =========================================================
   UPCOMING MESSAGE
========================================================= */

function showScheduleMessage(
  time
) {

  alert(
    `This match is scheduled to start at:\n\n${time}`
  );

}


/* =========================================================
   LANGUAGE
========================================================= */

if (langSelect) {

  langSelect.addEventListener(
    'change',
    async () => {

      currentLang =
        langSelect.value;


      localStorage.setItem(
        'criczone_lang',
        currentLang
      );


      await translateMatches();

    }
  );

}


function langToCode(
  rawLanguage,
  isLive
) {

  let language =
    String(
      rawLanguage || ''
    )
      .trim()
      .toUpperCase();


  if (
    !language ||
    language ===
      'BLOODY_SWEET'
  ) {

    if (isLive) {

      language =
        'ENGLISH';

    } else {

      return null;

    }

  }


  if (
    LANG_CODE_MAP[
      language
    ]
  ) {

    return LANG_CODE_MAP[
      language
    ];

  }


  return (
    language
      .slice(
        0,
        3
      )
      .toLowerCase()
    ||
    'eng'
  );

}


function langLabel(
  rawLanguage
) {

  const language =
    String(
      rawLanguage || ''
    )
      .trim()
      .toUpperCase();


  if (!language) {
    return null;
  }


  if (
    language ===
      'BLOODY_SWEET'
  ) {

    return 'MULTI';

  }


  return language;

}


/* =========================================================
   TRANSLATION
========================================================= */

async function translateMatches() {

  if (
    currentLang === 'en' ||
    !allMatches.length
  ) {

    currentTranslations = {};

    await renderCurrentView();

    return;

  }


  if (translateIndicator) {

    translateIndicator.classList.add(
      'visible'
    );

  }


  if (translateMsg) {

    translateMsg.textContent =
      `Translating to ${
        LANG_NAMES[
          currentLang
        ] ||
        currentLang
      }...`;

  }


  try {

    const texts = [];


    allMatches.forEach(
      match => {

        texts.push(
          match.title
        );

        texts.push(
          match.tournament
        );

      }
    );


    const translated =
      await translateBatch(
        texts,
        currentLang
      );


    currentTranslations = {};


    allMatches.forEach(
      (match, index) => {

        currentTranslations[
          match.id
        ] = {

          title:
            translated[
              index * 2
            ] ||
            match.title,

          tournament:
            translated[
              index * 2 + 1
            ] ||
            match.tournament

        };

      }
    );


  } catch (error) {

    console.warn(
      'Translation failed:',
      error
    );

    currentTranslations = {};

  }


  if (translateIndicator) {

    translateIndicator.classList.remove(
      'visible'
    );

  }


  await renderCurrentView();

}


async function translateBatch(
  texts,
  targetLanguage
) {

  const key =
    `${targetLanguage}::${texts.join(
      '||'
    )}`;


  if (
    translationCache[key]
  ) {

    return translationCache[key];

  }


  const languageName =
    LANG_NAMES[
      targetLanguage
    ] ||
    targetLanguage;


  const prompt = `
Translate each cricket title or tournament
name below into ${languageName}.

Rules:
- Keep team names recognizable.
- Keep abbreviations recognizable.
- Keep cricket terminology natural.
- Return ONLY a JSON array.
- Keep exactly the same number of items.

Input:
${JSON.stringify(texts)}
`;


  try {

    const response =
      await fetch(
        'https://api.anthropic.com/v1/messages',
        {

          method:
            'POST',

          headers: {

            'Content-Type':
              'application/json'

          },

          body:
            JSON.stringify({

              model:
                'claude-sonnet-4-6',

              max_tokens:
                1500,

              messages: [

                {
                  role: 'user',
                  content: prompt
                }

              ]

            })

        }
      );


    if (!response.ok) {

      throw new Error(
        'Translation request failed'
      );

    }


    const data =
      await response.json();


    const raw =
      (
        data.content ||
        []
      )
        .map(
          block =>
            block.text || ''
        )
        .join('');


    const clean =
      raw
        .replace(
          /```json|```/g,
          ''
        )
        .trim();


    const result =
      JSON.parse(
        clean
      );


    if (
      Array.isArray(result) &&
      result.length ===
        texts.length
    ) {

      translationCache[key] =
        result;

      return result;

    }

  } catch (error) {

    console.warn(
      'Translation unavailable:',
      error
    );

  }


  return texts;

}


/* =========================================================
   DATE / TIME
========================================================= */

function parseMatchTime(
  value
) {

  if (!value) {
    return null;
  }


  const months = {

    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11

  };


  const match =
    String(value).match(
      /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i
    );


  if (!match) {

    const date =
      new Date(value);

    return isNaN(date)
      ? null
      : date;

  }


  let [
    ,
    day,
    monthName,
    year,
    hour,
    minute,
    ampm
  ] = match;


  const month =
    months[
      monthName.toLowerCase()
    ];


  if (
    month === undefined
  ) {

    const date =
      new Date(value);

    return isNaN(date)
      ? null
      : date;

  }


  day =
    Number(day);

  year =
    Number(year);

  hour =
    Number(hour);

  minute =
    Number(minute);


  if (ampm) {

    ampm =
      ampm.toUpperCase();


    if (
      ampm === 'PM' &&
      hour < 12
    ) {

      hour += 12;

    }


    if (
      ampm === 'AM' &&
      hour === 12
    ) {

      hour = 0;

    }

  }


  return new Date(
    year,
    month,
    day,
    hour,
    minute
  );

}


function parseUpdatedAt(
  value
) {

  if (!value) {
    return null;
  }


  const match =
    String(value).match(
      /(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)/i
    );


  if (!match) {

    const date =
      new Date(value);

    return isNaN(date)
      ? null
      : date;

  }


  let day =
    Number(
      match[1]
    );


  let month =
    Number(
      match[2]
    );


  let year =
    Number(
      match[3]
    );


  let hour =
    Number(
      match[4]
    );


  const minute =
    Number(
      match[5]
    );


  const second =
    Number(
      match[6]
    );


  const ampm =
    match[7].toLowerCase();


  if (
    ampm === 'pm' &&
    hour < 12
  ) {

    hour += 12;

  }


  if (
    ampm === 'am' &&
    hour === 12
  ) {

    hour = 0;

  }


  return new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

}


function formatMatchTime(
  date
) {

  if (!date) {
    return 'TIME TBA';
  }


  const datePart =
    date.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short'
      }
    ).toUpperCase();


  let hour =
    date.getHours();


  const minute =
    String(
      date.getMinutes()
    ).padStart(
      2,
      '0'
    );


  const ampm =
    hour >= 12
      ? 'PM'
      : 'AM';


  hour =
    hour % 12;


  if (hour === 0) {
    hour = 12;
  }


  return (
    `${datePart}, ` +
    `${hour}:${minute} ` +
    `${ampm}`
  );

}


function formatAbsoluteIST(
  date
) {

  if (!date) {
    return 'UNAVAILABLE';
  }


  const datePart =
    date.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short'
      }
    ).toUpperCase();


  let hour =
    date.getHours();


  const minute =
    String(
      date.getMinutes()
    ).padStart(
      2,
      '0'
    );


  const ampm =
    hour >= 12
      ? 'PM'
      : 'AM';


  hour =
    hour % 12;


  if (hour === 0) {
    hour = 12;
  }


  return (
    `${datePart}, ` +
    `${hour}:${minute} ` +
    `${ampm} IST`
  );

}


/* =========================================================
   PLAYER URL
========================================================= */

function buildPlayerUrl(
  id,
  languageCode,
  streamIndex
) {

  return (
    `${PLAYER_PAGE}` +
    `?id=${encodeURIComponent(
      `${id}_${languageCode}`
    )}` +
    `&s=${streamIndex}`
  );

}


/* =========================================================
   COUNTERS
========================================================= */

function updateCounters() {

  const live =
    allMatches.filter(
      match =>
        match.status ===
        'LIVE'
    ).length;


  const total =
    allMatches.length;


  if (heroLiveCount) {

    animateNumber(
      heroLiveCount,
      live
    );

  }


  if (heroMatchCount) {

    animateNumber(
      heroMatchCount,
      total
    );

  }

}


function animateNumber(
  element,
  target
) {

  const start =
    Number(
      element.dataset.value ||
      0
    );


  if (start === target) {

    element.textContent =
      target;

    return;

  }


  element.dataset.value =
    target;


  const duration =
    500;


  const startTime =
    performance.now();


  function update(
    now
  ) {

    const progress =
      Math.min(
        (now - startTime) /
          duration,
        1
      );


    const eased =
      1 -
      Math.pow(
        1 - progress,
        3
      );


    const value =
      Math.round(
        start +
        (target - start) *
          eased
      );


    element.textContent =
      value;


    if (
      progress < 1
    ) {

      requestAnimationFrame(
        update
      );

    }

  }


  requestAnimationFrame(
    update
  );

}


/* =========================================================
   LAST UPDATE
========================================================= */

function updateLastUpdate(
  date
) {

  if (!lastUpdateEl) return;


  lastUpdateEl.textContent =
    `LAST UPDATE: ${
      formatAbsoluteIST(
        date
      )
    }`;

}


/* =========================================================
   INITIAL ERROR
========================================================= */

function showInitialError() {

  if (!grid) return;


  grid.innerHTML = `

    <div
      class="empty-state error-state"
    >

      <div class="empty-icon">
        ⚠️
      </div>

      <h3>
        Couldn't load matches
      </h3>

      <p>
        Please check your connection
        and refresh the page.
      </p>

      <button
        type="button"
        class="empty-retry"
        id="emptyRetry"
      >
        Try Again
      </button>

    </div>

  `;


  const retry =
    document.getElementById(
      'emptyRetry'
    );


  retry?.addEventListener(
    'click',
    () => {

      refreshMatches(
        true
      );

    }
  );

}


/* =========================================================
   GLOBAL KEYBOARD
========================================================= */

document.addEventListener(
  'keydown',
  event => {

    if (
      event.key === '/' &&
      document.activeElement !==
        searchInput
    ) {

      event.preventDefault();

      searchInput?.focus();

    }


    if (
      event.key === 'Escape' &&
      telegramModal &&
      !telegramModal.classList.contains(
        'hidden'
      )
    ) {

      closeTelegramPopup();

    }

  }
);


/* =========================================================
   VISIBILITY REFRESH
========================================================= */

document.addEventListener(
  'visibilitychange',
  () => {

    if (
      document.visibilityState ===
      'visible'
    ) {

      refreshMatches(
        false
      );

    }

  }
);


/* =========================================================
   EXPORT
========================================================= */

window.CricZone = {

  refresh:
    () =>
      refreshMatches(
        false
      ),

  getMatches:
    () =>
      [...allMatches],

  getLiveMatches:
    () =>
      allMatches.filter(
        match =>
          match.status ===
          'LIVE'
      )

};
