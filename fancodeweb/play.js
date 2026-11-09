/* =========================
   FIREBASE LIVE WATCHING
========================= */

const firebaseConfig = {
  apiKey: "AIzaSyCFusKEh9wF7O6yux5xLQgafvcr_jCv5aA",
  authDomain: "criczone-4daa2.firebaseapp.com",
  databaseURL:
    "https://criczone-4daa2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "criczone-4daa2",
  storageBucket: "criczone-4daa2.firebasestorage.app",
  messagingSenderId: "113293633217",
  appId: "1:113293633217:web:a96d9b3af3045bcd99d640",
  measurementId: "G-Q9RJ0VSSPP"
};

let firebaseApp = null;
let firebaseDb = null;
let firebaseAuth = null;

let viewerPresenceRef = null;
let viewerCountListener = null;

let firebaseReady = false;
let firebaseSetupPromise = null;


/* =========================
   START LIVE WATCHING
========================= */

async function setupLiveWatching(matchId) {

  if (!matchId) {
    return;
  }

  /*
     Prevent multiple Firebase
     initialization at the same time.
  */
  if (firebaseSetupPromise) {
    return firebaseSetupPromise;
  }

  firebaseSetupPromise = (async () => {

    try {

      const {
        initializeApp,
        getDatabase,
        getAuth,
        signInAnonymously
      } = window.firebaseModules || {};

      if (
        !initializeApp ||
        !getDatabase ||
        !getAuth ||
        !signInAnonymously
      ) {
        throw new Error(
          "Firebase modules are not available."
        );
      }


      /* =========================
         INITIALIZE ONLY ONCE
      ========================= */

      if (!firebaseApp) {

        firebaseApp =
          initializeApp(firebaseConfig);

        firebaseDb =
          getDatabase(firebaseApp);

        firebaseAuth =
          getAuth(firebaseApp);

        await signInAnonymously(
          firebaseAuth
        );
      }


      /* =========================
         DATABASE FUNCTIONS
      ========================= */

      const {
        ref,
        onDisconnect,
        set,
        remove,
        onValue
      } = await import(
        "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js"
      );


      /* =========================
         UNIQUE VIEWER ID
      ========================= */

      const viewerId =
        crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now() +
            "_" +
            Math.random()
              .toString(36)
              .slice(2);


      /* =========================
         VIEWER PRESENCE
      ========================= */

      viewerPresenceRef = ref(
        firebaseDb,
        `liveViewers/${matchId}/${viewerId}`
      );


      /*
         Automatically remove viewer
         when connection is lost.
      */

      await onDisconnect(
        viewerPresenceRef
      ).remove();


      /*
         Add current viewer.
      */

      await set(
        viewerPresenceRef,
        {
          joinedAt: Date.now()
        }
      );


      /* =========================
         VIEWER COUNT
      ========================= */

      const viewersRef = ref(
        firebaseDb,
        `liveViewers/${matchId}`
      );


      /*
         Remove previous listener
         if one exists.
      */

      if (viewerCountListener) {
        viewerCountListener();
        viewerCountListener = null;
      }


      viewerCountListener =
        onValue(
          viewersRef,
          snapshot => {

            const data =
              snapshot.val() || {};

            const realViewers =
              Object.keys(data).length;


            /*
               Display count:

               0 actual = 300
               1 actual = 301
               2 actual = 302
               10 actual = 310
            */

            const watching =
              300 + realViewers;


            updateWatchingUI(
              watching
            );


         
          }
        );


      firebaseReady = true;


      console.log(
        "🔥 Firebase watching started:",
        matchId
      );


    } catch (error) {

      console.error(
        "❌ Firebase viewer error:",
        error
      );


      firebaseReady = false;

      updateWatchingUI(300);


    } finally {

      firebaseSetupPromise = null;

    }

  })();


  return firebaseSetupPromise;
}


/* =========================
   UPDATE WATCHING UI
========================= */

function updateWatchingUI(count) {

  const elements =
    document.querySelectorAll(
      "[data-watching-count]"
    );


  elements.forEach(
    element => {

      element.textContent =
        Number(count)
          .toLocaleString("en-IN");

    }
  );
}


/* =========================
   STOP LIVE WATCHING
========================= */

async function stopLiveWatching() {

  try {

    /*
       Stop realtime listener.
    */

    if (viewerCountListener) {

      viewerCountListener();

      viewerCountListener =
        null;
    }


    /*
       Remove current viewer.
    */

    if (viewerPresenceRef) {

      const {
        remove
      } = await import(
        "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js"
      );


      await remove(
        viewerPresenceRef
      );


      viewerPresenceRef =
        null;
    }


    firebaseReady =
      false;


    firebaseSetupPromise =
      null;


  } catch (error) {

    console.warn(
      "⚠️ Viewer cleanup failed:",
      error
    );
  }
}


/* =========================
   PAGE CLOSE
========================= */

window.addEventListener(
  "pagehide",
  () => {
    stopLiveWatching();
  }
);

/* =========================================================
   CRICZONE
   LIVE PLAYER ENGINE
   play.js
========================================================= */

(function () {

  'use strict';


  /* =======================================================
     CONFIG
  ======================================================== */

  const JSON_URL =
    'https://raw.githubusercontent.com/kajju027/Fancode-Events-Json/refs/heads/main/fancode.json';

  const LANG_MAP = {
    eng: 'ENGLISH',
    hin: 'HINDI',
    tam: 'TAMIL',
    tel: 'TELUGU',
    ben: 'BENGALI',
    ban: 'BENGALI',
    mar: 'MARATHI',
    mal: 'MALAYALAM',
    kan: 'KANNADA',
    guj: 'GUJARATI',
    pan: 'PUNJABI',
    urd: 'URDU',
    ori: 'ODIA',
    asm: 'ASSAMESE'
  };


  const Q_ORDER = [
    '1080p',
    '720p',
    '540p',
    '480p',
    '360p',
    '240p'
  ];


  const DEFAULT_Q = '540p';


  const TELEGRAM_LINK =
    'https://t.me/+MueCDjlpoS8yNmJl';


  /* =======================================================
     URL PARAMETERS
  ======================================================== */

  const params =
    new URLSearchParams(
      window.location.search
    );


  const idParam =
    params.get('id') || '';


  const streamIndex =
    parseInt(
      params.get('s') || '0',
      10
    );


  const separator =
    idParam.indexOf('_');


  const matchId =
    separator > -1
      ? idParam.slice(
          0,
          separator
        )
      : idParam;


  const langCode =
    separator > -1
      ? idParam.slice(
          separator + 1
        )
      : 'eng';


  /* =======================================================
     DOM
  ======================================================== */

  const vid =
    document.getElementById('vid');

  const player =
    document.getElementById('player') ||
    document.querySelector('.player-page');


  const overlay =
    document.getElementById('overlay');

  const bufspin =
    document.getElementById('bufspin');

  const errorOverlay =
    document.getElementById('err-ov');

  const controls =
    document.getElementById('ctrls');

  const progress =
    document.getElementById('prog');

  const bufferedBar =
    document.getElementById('pbuf');

  const playedBar =
    document.getElementById('ppl');

  const progressThumb =
    document.getElementById('pth');

  const playButton =
    document.getElementById('bplay');

  const playIcon =
    document.getElementById('pico');

  const volumeButton =
    document.getElementById('bvol');

  const volumeIcon =
    document.getElementById('vico');

  const livePill =
    document.getElementById('livepill');

  const liveText =
    document.getElementById('lpitext');

  const qualityButton =
    document.getElementById('bq');

  const qualityLabel =
    document.getElementById('qlbl');

  const fillButton =
    document.getElementById('bfill');

  const fillIcon =
    document.getElementById('fillico');

  const pipButton =
    document.getElementById('bpip');

  const fullscreenButton =
    document.getElementById('bfs');

  const fullscreenIcon =
    document.getElementById('fsico');

  const bigPlay =
    document.getElementById('bigplay');

  const bigPlayButton =
    document.getElementById('bpbtn');

  const retryButton =
    document.getElementById('retryBtn');

  const backButton =
    document.getElementById('backBtn');

  const streamTitle =
    document.getElementById('streamTitle');

  const popup =
    document.getElementById('popup');

  const popupJoinButton =
    document.getElementById('popupJoinBtn');

  const popupSkipButton =
    document.getElementById('popupSkipBtn');

  const popupClose =
    document.getElementById('popupClose');


  /* =======================================================
     STATE
  ======================================================== */

  let shakaPlayer = null;

  let qualityStreams = {};

  let currentQuality =
    DEFAULT_Q;

  let isLive = true;

  let isDragging = false;

  let userPaused = false;

  let hasError = false;

  let fillModeIndex = 0;

  let isMuted = true;

  let hideControlsTimer = null;

  let retryTimer = null;

  let qualityCooldown = false;

  let playerActivated = false;


  /* =======================================================
     FILL MODES
  ======================================================== */

  const FILL_MODES = [

    {
      fit: 'contain',
      scale: 1,
      title: 'Fit',

      icon: `
        <rect
          x="2"
          y="4"
          width="20"
          height="16"
          rx="2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
        />

        <rect
          x="7"
          y="8"
          width="10"
          height="8"
          rx="1"
          fill="currentColor"
          opacity=".45"
        />
      `
    },


    {
      fit: 'cover',
      scale: 1,
      title: 'Fill',

      icon: `
        <rect
          x="2"
          y="4"
          width="20"
          height="16"
          rx="2"
          fill="currentColor"
          opacity=".2"
          stroke="currentColor"
          stroke-width="1.7"
        />

        <path
          d="M2 4l20 16M22 4L2 20"
          stroke="currentColor"
          stroke-width="1"
          opacity=".35"
        />
      `
    },


    {
      fit: 'contain',
      scale: 1.4,
      title: 'Zoom',

      icon: `
        <circle
          cx="10.5"
          cy="10.5"
          r="7"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
        />

        <line
          x1="16"
          y1="16"
          x2="21.5"
          y2="21.5"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />

        <line
          x1="10.5"
          y1="7.5"
          x2="10.5"
          y2="13.5"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />

        <line
          x1="7.5"
          y1="10.5"
          x2="13.5"
          y2="10.5"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
      `
    }

  ];


  /* =======================================================
     TELEGRAM POPUP
  ======================================================== */

  function closePopup() {

    if (!popup) return;

    popup.classList.remove(
      'visible'
    );

    popup.setAttribute(
      'aria-hidden',
      'true'
    );

  }


  function openPopup() {

    if (!popup) return;

    popup.classList.add(
      'visible'
    );

    popup.setAttribute(
      'aria-hidden',
      'false'
    );

  }


  popupSkipButton?.addEventListener(
    'click',
    closePopup
  );


  popupClose?.addEventListener(
    'click',
    closePopup
  );


  popupJoinButton?.addEventListener(
    'click',
    closePopup
  );


  popup?.addEventListener(
    'click',
    event => {

      if (
        event.target === popup
      ) {

        closePopup();

      }

    }
  );


  /* =======================================================
     BACK BUTTON
  ======================================================== */

  backButton?.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      if (
        document.referrer &&
        document.referrer !==
          window.location.href
      ) {

        history.back();

      } else {

        window.location.href =
          'index.html';

      }

    }
  );


  /* =======================================================
     LOADING OVERLAY
  ======================================================== */

  function showLoading() {

    hasError = false;

    errorOverlay?.classList.remove(
      'show'
    );


    if (!overlay) return;

    overlay.classList.remove(
      'gone'
    );

    overlay.style.opacity = '1';

    overlay.style.pointerEvents =
      'none';

  }


  function hideLoading() {

    if (
      hasError ||
      !overlay
    ) return;


    overlay.style.opacity = '0';

    overlay.style.pointerEvents =
      'none';


    setTimeout(
      () => {

        overlay.classList.add(
          'gone'
        );

      },
      360
    );

  }


  /* =======================================================
     ERROR
  ======================================================== */

  function showError(
    title,
    message,
    retry = false
  ) {

    hasError = true;


    if (overlay) {

      overlay.style.opacity = '0';

      overlay.style.pointerEvents =
        'none';

      setTimeout(
        () => {

          overlay.classList.add(
            'gone'
          );

        },
        360
      );

    }


    const titleElement =
      document.getElementById(
        'etitle'
      );


    const messageElement =
      document.getElementById(
        'emsg'
      );


    const retryStatus =
      document.getElementById(
        'eretry'
      );


    if (titleElement) {

      titleElement.textContent =
        title ||
        'Stream Unavailable';

    }


    if (messageElement) {

      messageElement.textContent =
        message || '';

    }


    if (retryStatus) {

      retryStatus.style.display =
        retry
          ? 'flex'
          : 'none';

    }


    errorOverlay?.classList.add(
      'show'
    );

  }


  /* =======================================================
     RETRY
  ======================================================== */

  function retryPlayback() {

    clearTimeout(
      retryTimer
    );

    hasError = false;

    errorOverlay?.classList.remove(
      'show'
    );

    showLoading();

    start();

  }


  retryButton?.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      retryPlayback();

    }
  );


  /* =======================================================
     BUFFERING
  ======================================================== */

  vid?.addEventListener(
    'waiting',
    () => {

      if (bufspin) {

        bufspin.style.display =
          'block';

      }

    }
  );


  vid?.addEventListener(
    'stalled',
    () => {

      if (bufspin) {

        bufspin.style.display =
          'block';

      }

    }
  );

vid?.addEventListener(
  'playing',
  () => {

    if (bufspin) {
      bufspin.style.display = 'none';
    }

    if (
      matchId &&
      !firebaseReady &&
      !firebaseSetupPromise
    ) {
      setupLiveWatching(matchId);
    }

  }
);


  /* =======================================================
     BIG PLAY
  ======================================================== */

  function syncBigPlay() {

    if (!bigPlay || !vid) {
      return;
    }


    if (vid.paused) {

      bigPlay.classList.add(
        'shown'
      );

      bigPlay.classList.remove(
        'gone'
      );

    } else {

      bigPlay.classList.remove(
        'shown'
      );

      bigPlay.classList.add(
        'gone'
      );

    }

  }


  bigPlayButton?.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      userPaused = false;

      playerActivated = true;

      vid.play().catch(
        () => {}
      );

    }
  );


  vid?.addEventListener(
    'play',
    syncBigPlay
  );


  vid?.addEventListener(
    'pause',
    syncBigPlay
  );


  /* =======================================================
     PLAYER CLICK
  ======================================================== */

  player?.addEventListener(
    'click',
    event => {

      if (
        event.target.closest(
          '#ctrls'
        )
      ) {
        return;
      }


      if (
        event.target.closest(
          '#bigplay'
        )
      ) {
        return;
      }


      if (qualityCooldown) {
        return;
      }


      if (!playerActivated) {

        playerActivated =
          true;

        showControls();

        return;

      }


      if (
        event.target === vid ||
        event.target === player
      ) {

        if (
          controls?.classList.contains(
            'gone'
          )
        ) {

          showControls();

          return;

        }


        togglePlay();

      }

    }
  );


  /* =======================================================
     CONTROLS VISIBILITY
  ======================================================== */

  function showControls() {

    if (!controls) return;

    controls.classList.remove(
      'gone'
    );


    clearTimeout(
      hideControlsTimer
    );


    if (
      vid &&
      !vid.paused
    ) {

      hideControlsTimer =
        setTimeout(
          () => {

            controls.classList.add(
              'gone'
            );

          },
          3200
        );

    }

  }


  player?.addEventListener(
    'mousemove',
    showControls
  );


  player?.addEventListener(
    'touchstart',
    showControls,
    { passive: true }
  );


  showControls();


  /* =======================================================
     PLAY / PAUSE
  ======================================================== */

  function togglePlay() {

    if (!vid) return;


    if (vid.paused) {

      userPaused = false;

      vid.play().catch(
        () => {}
      );

    } else {

      userPaused = true;

      vid.pause();

    }

  }


  playButton?.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      togglePlay();

    }
  );


  function syncPlayIcon() {

    if (
      !playIcon ||
      !vid
    ) return;


    playIcon.innerHTML =
      vid.paused

        ? `
          <path
            d="M8 5.14v13.72a1 1 0 0 0 1.5.87l11-6.86a1 1 0 0 0 0-1.72L9.5 4.27A1 1 0 0 0 8 5.14z"
            fill="currentColor"
          />
        `

        : `
          <rect
            x="6"
            y="5"
            width="4"
            height="14"
            rx="1.5"
            fill="currentColor"
          />

          <rect
            x="14"
            y="5"
            width="4"
            height="14"
            rx="1.5"
            fill="currentColor"
          />
        `;

  }


  vid?.addEventListener(
    'play',
    () => {

      syncPlayIcon();

      showControls();

    }
  );


  vid?.addEventListener(
    'pause',
    () => {

      syncPlayIcon();

      showControls();

    }
  );


  /* =======================================================
     AUTO RESUME
  ======================================================== */

  vid?.addEventListener(
    'pause',
    () => {

      if (
        !vid.ended &&
        !userPaused
      ) {

        setTimeout(
          () => {

            if (
              vid.paused &&
              !vid.ended &&
              !userPaused
            ) {

              vid.play().catch(
                () => {}
              );

            }

          },
          800
        );

      }

    }
  );


  setInterval(
    () => {

      if (
        vid &&
        vid.paused &&
        !vid.ended &&
        !userPaused
      ) {

        vid.play().catch(
          () => {}
        );

      }

    },
    4000
  );


  /* =======================================================
     VOLUME
  ======================================================== */

  volumeButton?.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      vid.muted =
        !vid.muted;

      syncVolume();

    }
  );


  function syncVolume() {

    if (
      !volumeButton ||
      !volumeIcon ||
      !vid
    ) return;


    isMuted =
      vid.muted;


    volumeButton.classList.toggle(
      'is-muted',
      isMuted
    );


    if (isMuted) {

      volumeIcon.innerHTML = `

        <path
          d="M4 9v6h4l5 5V4L8 9H4z"
          fill="currentColor"
        />

        <line
          x1="16.5"
          y1="9.5"
          x2="22.5"
          y2="15.5"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />

        <line
          x1="22.5"
          y1="9.5"
          x2="16.5"
          y2="15.5"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />

      `;

    } else {

      volumeIcon.innerHTML = `

        <path
          d="M4 9v6h4l5 5V4L8 9H4z"
          fill="currentColor"
        />

        <path
          d="M16.5 8.5a5 5 0 0 1 0 7"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          fill="none"
        />

        <path
          d="M19 6a9 9 0 0 1 0 12"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          fill="none"
        />

      `;

    }

  }


  /* =======================================================
     LIVE / GO LIVE
  ======================================================== */

  livePill?.addEventListener(
    'click',
    () => {

      if (
        !isLive ||
        !vid.seekable ||
        !vid.seekable.length
      ) {
        return;
      }


      const edge =
        vid.seekable.end(
          vid.seekable.length - 1
        );


      vid.currentTime =
        edge;


      userPaused = false;


      if (vid.paused) {

        vid.play().catch(
          () => {}
        );

      }

    }
  );


  setInterval(
    updateLiveStatus,
    2000
  );


  function updateLiveStatus() {

    if (!livePill || !vid) {
      return;
    }


    if (!isLive) {

      livePill.style.display =
        'none';

      return;

    }


    if (
      !vid.seekable ||
      !vid.seekable.length
    ) {
      return;
    }


    const edge =
      vid.seekable.end(
        vid.seekable.length - 1
      );


    const behind =
      edge -
      vid.currentTime >
      12;


    livePill.style.cursor =
      behind
        ? 'pointer'
        : 'default';


    if (liveText) {

      liveText.textContent =
        behind
          ? 'GO LIVE'
          : 'LIVE';

    }


    livePill.style.color =
      behind
        ? '#ffb020'
        : '#ff5a5a';


    livePill.style.borderColor =
      behind
        ? 'rgba(255,176,32,.32)'
        : 'rgba(255,69,69,.32)';


    livePill.style.background =
      behind
        ? 'rgba(255,176,32,.13)'
        : 'rgba(255,69,69,.13)';


    const dot =
      livePill.querySelector(
        '.live-dot, .ldot'
      );


    if (dot) {

      dot.style.background =
        behind
          ? '#ffb020'
          : '#ff4545';

    }

  }


  /* =======================================================
     PROGRESS
  ======================================================== */

  vid?.addEventListener(
    'timeupdate',
    () => {

      if (isDragging) {
        return;
      }


      const percentage =
        (
          vid.duration &&
          Number.isFinite(
            vid.duration
          )
        )

          ? (
              vid.currentTime /
              vid.duration
            ) * 100

          : 99.5;


      setProgress(
        percentage
      );

    }
  );


  vid?.addEventListener(
    'progress',
    () => {

      if (
        !vid.buffered.length ||
        !Number.isFinite(
          vid.duration
        )
      ) {
        return;
      }


      const buffered =
        (
          vid.buffered.end(
            vid.buffered.length - 1
          ) /
          vid.duration
        ) * 100;


      if (bufferedBar) {

        bufferedBar.style.width =
          `${Math.min(
            100,
            buffered
          )}%`;

      }

    }
  );


  vid?.addEventListener(
    'loadedmetadata',
    () => {

      isLive =
        !Number.isFinite(
          vid.duration
        ) ||
        vid.duration > 86400;


      if (
        !isLive &&
        livePill
      ) {

        livePill.style.display =
          'none';

      }

    }
  );


  function setProgress(
    percentage
  ) {

    const value =
      Math.max(
        0,
        Math.min(
          100,
          percentage
        )
      );


    if (playedBar) {

      playedBar.style.width =
        `${value}%`;

    }


    if (progressThumb) {

      progressThumb.style.left =
        `${value}%`;

    }

  }


  function progressPercent(
    event
  ) {

    if (!progress) {
      return 0;
    }


    const rect =
      progress.getBoundingClientRect();


    const clientX =
      event.touches
        ? event.touches[0].clientX
        : event.clientX;


    const x =
      clientX -
      rect.left;


    return Math.max(
      0,
      Math.min(
        1,
        x / rect.width
      )
    );

  }


  function applySeek(
    fraction
  ) {

    if (
      !vid ||
      !Number.isFinite(
        vid.duration
      )
    ) {
      return;
    }


    vid.currentTime =
      fraction *
      vid.duration;


    setProgress(
      fraction * 100
    );

  }


  progress?.addEventListener(
    'mousedown',
    event => {

      isDragging = true;

      progress.classList.add(
        'drag'
      );

      applySeek(
        progressPercent(event)
      );

    }
  );


  progress?.addEventListener(
    'touchstart',
    event => {

      isDragging = true;

      progress.classList.add(
        'drag'
      );

      applySeek(
        progressPercent(event)
      );

    },
    { passive: true }
  );


  document.addEventListener(
    'mousemove',
    event => {

      if (!isDragging) {
        return;
      }

      applySeek(
        progressPercent(event)
      );

    }
  );


  document.addEventListener(
    'touchmove',
    event => {

      if (!isDragging) {
        return;
      }


      event.preventDefault();


      applySeek(
        progressPercent(event)
      );

    },
    { passive: false }
  );


  function stopDragging() {

    if (!isDragging) {
      return;
    }


    isDragging = false;

    progress?.classList.remove(
      'drag'
    );

  }


  document.addEventListener(
    'mouseup',
    stopDragging
  );


  document.addEventListener(
    'touchend',
    stopDragging
  );
/* =======================================================
   QUALITY - PREMIUM CUSTOM MENU
======================================================= */

let qualityMenu = null;


/* -------------------------------------------------------
   CLOSE QUALITY MENU
------------------------------------------------------- */

function closeQualityMenu() {

  if (!qualityMenu) {
    return;
  }

  qualityMenu.classList.remove('show');

  setTimeout(() => {

    if (
      qualityMenu &&
      qualityMenu.parentNode
    ) {

      qualityMenu.parentNode.removeChild(
        qualityMenu
      );

    }

    qualityMenu = null;

  }, 180);
}


/* -------------------------------------------------------
   OPEN QUALITY MENU
------------------------------------------------------- */

function openQualityMenu() {

  if (
    qualityCooldown ||
    !qualityButton
  ) {
    return;
  }


  const available =
    Q_ORDER.filter(
      quality =>
        qualityStreams[quality]
    );


  if (!available.length) {
    return;
  }


  /* Close old menu */

  if (qualityMenu) {
    closeQualityMenu();
  }


  /* Create menu */

  qualityMenu =
    document.createElement('div');

  qualityMenu.className =
    'quality-menu';


  /* Menu HTML */

  qualityMenu.innerHTML = `

    <div class="quality-menu-header">

      <span>
        Video Quality
      </span>

      <span class="quality-auto">
        AUTO
      </span>

    </div>


    <div class="quality-options">

      ${available.map(quality => `

        <button
          type="button"
          class="quality-option ${
            quality === currentQuality
              ? 'active'
              : ''
          }"
          data-quality="${quality}"
        >

          <span class="quality-name">
            ${quality}
          </span>

          ${
            quality === currentQuality
              ? `
                <span class="quality-check">
                  ✓
                </span>
              `
              : ''
          }

        </button>

      `).join('')}

    </div>

  `;


  /* Add to page */

  document.body.appendChild(
    qualityMenu
  );


  /* -----------------------------------------------------
     POSITION MENU ABOVE QUALITY BUTTON
  ----------------------------------------------------- */

  const rect =
    qualityButton.getBoundingClientRect();


  const menuWidth =
    qualityMenu.offsetWidth;


  const menuHeight =
    qualityMenu.offsetHeight;


  /*
     Right side aligned with
     quality button
  */

  let left =
    rect.right -
    menuWidth;


  /*
     IMPORTANT:
     Menu opens ABOVE button
  */

  let top =
    rect.top -
    menuHeight -
    10;


  /* -----------------------------------------------------
     KEEP MENU INSIDE SCREEN
  ----------------------------------------------------- */

  left =
    Math.max(
      8,
      Math.min(
        left,
        window.innerWidth -
        menuWidth -
        8
      )
    );


  /*
     If there isn't enough
     space above, keep it
     at the top safely.
  */

  top =
    Math.max(
      8,
      top
    );


  qualityMenu.style.left =
    `${left}px`;


  qualityMenu.style.top =
    `${top}px`;


  /* -----------------------------------------------------
     SHOW ANIMATION
  ----------------------------------------------------- */

  requestAnimationFrame(() => {

    if (qualityMenu) {

      qualityMenu.classList.add(
        'show'
      );

    }

  });


  /* -----------------------------------------------------
     QUALITY OPTIONS
  ----------------------------------------------------- */

  qualityMenu
    .querySelectorAll(
      '.quality-option'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        event => {

          event.stopPropagation();


          const quality =
            button.dataset.quality;


          closeQualityMenu();


          if (
            quality &&
            quality !==
            currentQuality
          ) {

            switchQuality(
              quality
            );

          }

        }
      );

    });


  /* Small click protection */

  qualityCooldown =
    true;


  setTimeout(() => {

    qualityCooldown =
      false;

    playerActivated =
      true;

  }, 300);

}


/* =======================================================
   QUALITY BUTTON
======================================================= */

qualityButton?.addEventListener(
  'click',
  event => {

    event.stopPropagation();
    event.preventDefault();


    if (qualityMenu) {

      closeQualityMenu();

      return;

    }


    openQualityMenu();

  }
);


/* =======================================================
   CLOSE OUTSIDE CLICK
======================================================= */

document.addEventListener(
  'click',
  event => {

    if (
      qualityMenu &&
      !event.target.closest(
        '.quality-menu'
      ) &&
      !event.target.closest(
        '#bq'
      )
    ) {

      closeQualityMenu();

    }

  }
);


/* =======================================================
   ESC CLOSE
======================================================= */

document.addEventListener(
  'keydown',
  event => {

    if (
      event.key === 'Escape' &&
      qualityMenu
    ) {

      closeQualityMenu();

    }

  }
);


/* =======================================================
   CLOSE ON RESIZE / ORIENTATION CHANGE
======================================================= */

window.addEventListener(
  'resize',
  () => {

    if (qualityMenu) {
      closeQualityMenu();
    }

  }
);


/* =======================================================
   SWITCH QUALITY
======================================================= */

async function switchQuality(
  quality
) {

  const url =
    qualityStreams[quality];


  if (!url) {
    return;
  }


  /* Update current quality */

  currentQuality =
    quality;


  if (qualityLabel) {

    qualityLabel.textContent =
      quality;

  }


  /* Preserve player state */

  const wasMuted =
    vid.muted;


  const wasPlaying =
    !vid.paused;


  const currentTime =
    vid.currentTime;


  /* Loading */

  showLoading();


  /* Load selected stream */

  await loadStream(
    url,
    []
  );


  /* Restore position */

  try {

    if (
      Number.isFinite(
        currentTime
      ) &&
      Number.isFinite(
        vid.duration
      )
    ) {

      vid.currentTime =
        Math.min(
          currentTime,
          vid.duration
        );

    }

  } catch {}


  /* Restore mute */

  vid.muted =
    wasMuted;


  /* Restore playback */

  if (
    wasPlaying &&
    vid.paused
  ) {

    vid.play().catch(
      () => {}
    );

  }


  syncVolume();

}

  /* =======================================================
     FIT / FILL / ZOOM
  ======================================================== */

  function applyFillMode(
    index
  ) {

    const mode =
      FILL_MODES[
        index
      ];


    if (!mode || !vid) {
      return;
    }


    vid.style.objectFit =
      mode.fit;


    vid.style.transform =
      mode.scale !== 1
        ? `scale(${mode.scale})`
        : 'none';


    if (fillIcon) {

      fillIcon.innerHTML =
        mode.icon;

    }


    if (fillButton) {

      fillButton.title =
        mode.title;

    }

  }


  applyFillMode(0);


  fillButton?.addEventListener(
    'click',
    event => {

      event.stopPropagation();


      fillModeIndex =
        (
          fillModeIndex + 1
        ) %
        FILL_MODES.length;


      applyFillMode(
        fillModeIndex
      );

    }
  );


  /* =======================================================
     PICTURE IN PICTURE
  ======================================================== */

  if (
    !document.pictureInPictureEnabled
  ) {

    if (pipButton) {

      pipButton.style.display =
        'none';

    }

  }


  pipButton?.addEventListener(
    'click',
    event => {

      event.stopPropagation();


      if (
        document.pictureInPictureElement
      ) {

        document
          .exitPictureInPicture()
          .catch(
            () => {}
          );

      } else if (
        vid?.requestPictureInPicture
      ) {

        vid
          .requestPictureInPicture()
          .catch(
            () => {}
          );

      }

    }
  );


  /* =======================================================
     FULLSCREEN
  ======================================================== */

  fullscreenButton?.addEventListener(
    'click',
    event => {

      event.stopPropagation();


      const fullscreenElement =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement;


      if (!fullscreenElement) {

        const target =
          player ||
          document.documentElement;


        const request =
          target.requestFullscreen ||
          target.webkitRequestFullscreen ||
          target.mozRequestFullScreen;


        if (request) {

          const result =
            request.call(
              target
            );


          Promise.resolve(
            result
          )
            .then(
              () => {

                if (
                  screen.orientation &&
                  screen.orientation.lock
                ) {

                  screen.orientation
                    .lock('landscape')
                    .catch(
                      () => {}
                    );

                }

              }
            )
            .catch(
              () => {

                if (
                  vid?.webkitEnterFullscreen
                ) {

                  vid.webkitEnterFullscreen();

                }

              }
            );

        } else if (
          vid?.webkitEnterFullscreen
        ) {

          vid.webkitEnterFullscreen();

        }

      } else {

        const exit =
          document.exitFullscreen ||
          document.webkitExitFullscreen ||
          document.mozCancelFullScreen;


        if (exit) {

          Promise.resolve(
            exit.call(
              document
            )
          ).catch(
            () => {}
          );

        }


        if (
          screen.orientation &&
          screen.orientation.unlock
        ) {

          screen.orientation.unlock();

        }

      }

    }
  );


  function syncFullscreen() {

    if (!fullscreenIcon) {
      return;
    }


    const isFullscreen =
      Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      );


    fullscreenIcon.innerHTML =
      isFullscreen

        ? `
          <path d="M4 9V4h5"/>
          <path d="M20 9V4h-5"/>
          <path d="M4 15v5h5"/>
          <path d="M20 15v5h-5"/>
        `

        : `
          <path d="M9 4H4v5"/>
          <path d="M15 4h5v5"/>
          <path d="M9 20H4v-5"/>
          <path d="M15 20h5v-5"/>
        `;

  }


  [
    'fullscreenchange',
    'webkitfullscreenchange',
    'mozfullscreenchange'
  ].forEach(
    eventName => {

      document.addEventListener(
        eventName,
        syncFullscreen
      );

    }
  );


  /* =======================================================
     SHAka
  ======================================================== */

  async function destroyShaka() {

    if (!shakaPlayer) {
      return;
    }


    try {

      await shakaPlayer.destroy();

    } catch {}


    shakaPlayer =
      null;

  }


  async function initializeShaka(
    url
  ) {

    await destroyShaka();


    if (
      !window.shaka ||
      !shaka.Player
    ) {

      throw new Error(
        'Shaka Player unavailable'
      );

    }


    shaka.polyfill.installAll();


    if (
      !shaka.Player.isBrowserSupported()
    ) {

      throw new Error(
        'Browser not supported'
      );

    }


    shakaPlayer =
      new shaka.Player();


    await shakaPlayer.attach(
      vid
    );


    shakaPlayer.configure({

      streaming: {

        bufferingGoal: 10,

        rebufferingGoal: 2,

        safeSeekOffset: 5,

        lowLatencyMode: true

      }

    });


    const networkingEngine =
      shakaPlayer
        .getNetworkingEngine();


    if (networkingEngine) {

      networkingEngine
        .registerRequestFilter(
          function (
            type,
            request
          ) {

            request.allowCrossSiteCredentials =
              true;

          }
        );

    }


    await shakaPlayer.load(
      url
    );

  }


  /* =======================================================
     STREAM LOADER
  ======================================================== */

  async function loadStream(
    url,
    fallbackUrls = []
  ) {

    hasError = false;

    errorOverlay?.classList.remove(
      'show'
    );


    const urls =
      [
        url,
        ...fallbackUrls
      ]
        .filter(Boolean)
        .filter(
          (value, index, array) =>
            array.indexOf(
              value
            ) === index
        );


    let lastError =
      null;


    /* ---------------------------------------
       Shaka
    ---------------------------------------- */

    for (
      let index = 0;
      index < urls.length;
      index++
    ) {

      try {

        await initializeShaka(
          urls[index]
        );


        lastError =
          null;

        break;

      } catch (error) {

        console.warn(
          'Stream attempt failed:',
          error
        );


        lastError =
          error;


        await destroyShaka();

      }

    }


    /* ---------------------------------------
       Native HLS fallback
    ---------------------------------------- */

    if (
      lastError &&
      vid?.canPlayType(
        'application/vnd.apple.mpegurl'
      )
    ) {

      try {

        vid.src =
          urls[0] ||
          url;


        vid.load();


        lastError =
          null;

      } catch (error) {

        lastError =
          error;

      }

    }


    if (lastError) {

      showError(
        'Playback Error',
        lastError.message ||
          'Unable to load stream.',
        true
      );

      return false;

    }


    /* ---------------------------------------
       Start playback
    ---------------------------------------- */

    vid.muted =
      true;


    try {

      await vid.play();

    } catch {

      /*
        Browser autoplay may require
        user interaction. The big play
        button will remain available.
      */

      syncBigPlay();

    }


    syncVolume();


    const playingHandler =
      () => {

        vid.removeEventListener(
          'playing',
          playingHandler
        );

        hideLoading();

      };


    vid.addEventListener(
      'playing',
      playingHandler
    );


    setTimeout(
      () => {

        if (!hasError) {

          hideLoading();

        }

      },
      9000
    );


    return true;

  }


  /* =======================================================
     FETCH JSON
  ======================================================== */

  function fetchJSON(
    url
  ) {

    return new Promise(
      (resolve, reject) => {

        const xhr =
          new XMLHttpRequest();


        xhr.open(
          'GET',
          url,
          true
        );


        xhr.timeout =
          12000;


        xhr.onreadystatechange =
          function () {

            if (
              xhr.readyState !==
              4
            ) {
              return;
            }


            if (
              xhr.status >= 200 &&
              xhr.status < 300
            ) {

              try {

                resolve(
                  JSON.parse(
                    xhr.responseText
                  )
                );

              } catch {

                reject(
                  new Error(
                    'JSON parse error'
                  )
                );

              }

            } else {

              reject(
                new Error(
                  `HTTP ${xhr.status}`
                )
              );

            }

          };


        xhr.onerror =
          () => {

            reject(
              new Error(
                'Network error'
              )
            );

          };


        xhr.ontimeout =
          () => {

            reject(
              new Error(
                'Request timeout'
              )
            );

          };


        xhr.send();

      }
    );

  }


  /* =======================================================
     RESOLVE MATCH
  ======================================================== */

  function resolveMatch(
    data
  ) {

    const list =
      Array.isArray(data)
        ? data
        : Array.isArray(
            data.matches
          )
          ? data.matches
          : [];


    if (!list.length) {

      throw new Error(
        'No matches found in JSON'
      );

    }


    const match =
      list.find(
        item =>
          String(
            item.match_id
          ) ===
          String(matchId)
      );


    if (!match) {

      throw new Error(
        `Match "${matchId}" not found`
      );

    }


    /* ---------------------------------------
       Match title
    ---------------------------------------- */

    if (streamTitle) {

      streamTitle.textContent =
        match.title ||
        'CricZone Live';

    }


    const streams =
      match.streams ||
      {};


    const fallbackUrls = [

      streams.primary,

      streams.fancode_cdn,

      streams.fancode_lk_cdn,

      streams.fancode_np_cdn,

      streams.fancode_bd_cdn

    ].filter(Boolean);


    /* ---------------------------------------
       Main stream
    ---------------------------------------- */

    if (
      streamIndex === 0
    ) {

      const autoStreams =
        match.auto_streams ||
        {};


      const languageKeys =
        Object.keys(
          autoStreams
        );


      if (
        !languageKeys.length
      ) {

        throw new Error(
          'No live stream available'
        );

      }


      const languageName =
        LANG_MAP[
          langCode
        ] ||
        match.language ||
        languageKeys[0];


      const languageData =
        autoStreams[
          languageName
        ] ||
        autoStreams[
          languageKeys[0]
        ];


      if (
        !languageData ||
        !languageData.streams
      ) {

        throw new Error(
          'Stream data is empty'
        );

      }


      const availableStreams =
        languageData.streams;


      if (
        !Object.keys(
          availableStreams
        ).length
      ) {

        throw new Error(
          'Stream URLs are empty'
        );

      }


      return {

        type: 'multi',

        streams:
          availableStreams,

        fallbacks:
          fallbackUrls,

        match

      };

    }


    /* ---------------------------------------
       Regional streams
    ---------------------------------------- */

    let selectedUrl =
      null;


    if (
      streamIndex === 1
    ) {

      selectedUrl =
        streams.fancode_lk_cdn;

    } else if (
      streamIndex === 2
    ) {

      selectedUrl =
        streams.fancode_np_cdn;

    } else if (
      streamIndex === 3
    ) {

      selectedUrl =
        streams.fancode_bd_cdn;

    }


    if (!selectedUrl) {

      throw new Error(
        `Regional stream not available`
      );

    }


    return {

      type: 'single',

      url:
        selectedUrl,

      fallbacks:
        fallbackUrls,

      match

    };

  }


  /* =======================================================
     START PLAYER
  ======================================================== */

  async function start() {

    clearTimeout(
      retryTimer
    );


    showLoading();


    if (!matchId) {

      showError(
        'Missing Match ID',
        'The player URL does not contain a valid match ID.',
        false
      );

      return;

    }


    try {

      const data =
        await fetchJSON(
          JSON_URL
        );


      const result =
        resolveMatch(
          data
        );


      if (
        result.type ===
        'multi'
      ) {

        qualityStreams =
          result.streams;


        const firstAvailable =
          Q_ORDER.find(
            quality =>
              qualityStreams[
                quality
              ]
          );


        if (!firstAvailable) {

          throw new Error(
            'No quality stream available'
          );

        }


        currentQuality =
          qualityStreams[
            DEFAULT_Q
          ]
            ? DEFAULT_Q
            : firstAvailable;


        const selectedUrl =
          qualityStreams[
            currentQuality
          ];


        if (qualityLabel) {

          qualityLabel.textContent =
            currentQuality;

        }


        if (qualityButton) {

          qualityButton.style.display =
            '';

        }


        await loadStream(
          selectedUrl,
          result.fallbacks
        );

      } else {

        qualityStreams =
          {};


        if (qualityButton) {

          qualityButton.style.display =
            'none';

        }


        await loadStream(
          result.url,
          result.fallbacks
        );

      }

    } catch (error) {

      console.error(
        'CricZone player error:',
        error
      );


      showError(
        'Stream Unavailable',
        error.message ||
          'Unable to load this stream.',
        true
      );


      retryTimer =
        setTimeout(
          () => {

            start();

          },
          8000
        );

    }

  }


  /* =======================================================
     KEYBOARD SHORTCUTS
  ======================================================== */

  document.addEventListener(
    'keydown',
    event => {

      if (
        event.target.tagName ===
          'INPUT' ||
        event.target.tagName ===
          'SELECT' ||
        event.target.tagName ===
          'TEXTAREA'
      ) {
        return;
      }


      switch (
        event.key.toLowerCase()
      ) {

        case ' ':
        case 'k':

          event.preventDefault();

          togglePlay();

          break;


        case 'm':

          event.preventDefault();

          if (volumeButton) {

            volumeButton.click();

          }

          break;


        case 'f':

          event.preventDefault();

          if (fullscreenButton) {

            fullscreenButton.click();

          }

          break;


        case 'p':

          event.preventDefault();

          if (pipButton) {

            pipButton.click();

          }

          break;


        case 'escape':

          closePopup();

          break;

      }

    }
  );


  /* =======================================================
     PAGE VISIBILITY
  ======================================================== */

  document.addEventListener(
    'visibilitychange',
    () => {

      if (
        document.visibilityState ===
        'visible'
      ) {

        if (
          vid &&
          vid.paused &&
          !userPaused
        ) {

          vid.play().catch(
            () => {}
          );

        }

      }

    }
  );


  /* =======================================================
     START
  ======================================================== */

  showLoading();

  syncVolume();

  syncPlayIcon();

  syncFullscreen();

  applyFillMode(0);


  start();


})();
