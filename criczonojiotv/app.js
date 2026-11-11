(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const video = $("video");
  const grid = $("channelGrid");
  const PAGE_SIZE = 60;
  let channels = [], filtered = [], activeCategory = "All", visible = PAGE_SIZE, current = null, shakaPlayer = null, hlsPlayer = null, toastTimer;

  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function categoryCounts(list) {
    return [...new Set(list.map(c => (c.category || "Others").trim()))].sort((a,b) => a.localeCompare(b));
  }
  function renderCategories() {
    const nav = $("categoryNav");
    nav.innerHTML = "";
    const all = document.createElement("button");
    all.className = "category-chip" + (activeCategory === "All" ? " active" : "");
    all.textContent = "All channels"; all.dataset.category = "All"; nav.appendChild(all);
    categoryCounts(channels).forEach(name => {
      const btn = document.createElement("button");
      btn.className = "category-chip" + (activeCategory === name ? " active" : "");
      btn.textContent = name; btn.dataset.category = name; nav.appendChild(btn);
    });
    $("categoryCount").textContent = categoryCounts(channels).length;
  }
  function applyFilters() {
    const term = $("searchInput").value.trim().toLowerCase();
    filtered = channels.filter(c => {
      const category = (c.category || "Others").trim();
      const matchCategory = activeCategory === "All" || category === activeCategory;
      const matchText = !term || [c.name,c.category,c.tvg_id].some(v => String(v || "").toLowerCase().includes(term));
      return matchCategory && matchText;
    });
    if ($("sortSelect").value === "az") filtered.sort((a,b) => a.name.localeCompare(b.name));
    visible = PAGE_SIZE; renderGrid();
  }
  function renderGrid() {
    const items = filtered.slice(0, visible);
    $("resultCount").textContent = filtered.length.toLocaleString() + " channels";
    $("loadMore").hidden = visible >= filtered.length;
    if (!items.length) { grid.innerHTML = '<div class="empty">No channels found. Try another search or category.</div>'; return; }
    grid.innerHTML = items.map((c, i) => {
      const index = channels.indexOf(c);
      const name = escapeHTML(c.name || "Unknown channel");
      const logo = escapeHTML(c.logo || "");
      const category = escapeHTML(c.category || "Others");
      const selected = current && current.tvg_id === c.tvg_id ? " selected" : "";
      return '<button class="channel-card'+selected+'" data-index="'+index+'" aria-label="Play '+name+'"><span class="logo-box">'+(logo ? '<img loading="lazy" src="'+logo+'" alt="" onerror="this.remove();this.parentElement.innerHTML=\'<span class=&quot;logo-fallback&quot;>TV</span>\'">' : '<span class="logo-fallback">TV</span>')+'</span><span class="channel-name">'+name+'</span><span class="channel-category">'+category+'</span></button>';
    }).join("");
  }
  function cleanupPlayers() {
    if (hlsPlayer) { hlsPlayer.destroy(); hlsPlayer = null; }
    if (shakaPlayer) { shakaPlayer.destroy().catch(() => {}); shakaPlayer = null; }
    video.pause(); video.removeAttribute("src"); video.load();
  }
  async function playChannel(channel) {
    if (!channel || !channel.stream_url) return toast("Stream URL is missing for this channel.");
    current = channel;
    $("nowTitle").textContent = channel.name;
    $("nowCategory").textContent = (channel.category || "LIVE TV").toUpperCase();
    $("playerStatus").textContent = "CONNECTING";
    $("playerStatus").classList.remove("playing");
    $("playerPlaceholder").style.display = "flex";
    $("copyStream").disabled = false;
    renderGrid();
    $("playerSection").scrollIntoView({behavior:"smooth",block:"start"});
    cleanupPlayers();
    const url = channel.stream_url;
    try {
      if (/\.m3u8($|\?)/i.test(url)) {
        if (window.Hls && Hls.isSupported()) {
          hlsPlayer = new Hls({enableWorker:true,lowLatencyMode:true});
          hlsPlayer.loadSource(url); hlsPlayer.attachMedia(video);
          hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
          hlsPlayer.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) playerError("HLS playback error. The stream may be unavailable or blocked."); });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url; await video.play();
        } else playerError("This browser does not support HLS playback.");
      } else if (window.shaka && shaka.Player.isBrowserSupported()) {
        shakaPlayer = new shaka.Player();
        await shakaPlayer.attach(video);
        shakaPlayer.addEventListener("error", () => playerError("DASH playback error. The stream may require a supported DRM/license setup."));
        await shakaPlayer.load(url);
        await video.play().catch(() => {});
      } else {
        video.src = url;
        await video.play();
      }
    } catch (error) {
      console.warn("Playback failed:", error);
      playerError("Unable to play this stream. It may be offline, HTTP-blocked, CORS-restricted or DRM-protected.");
    }
  }
  function playerError(message) {
    $("playerStatus").textContent = "UNAVAILABLE";
    $("playerStatus").classList.remove("playing");
    $("playerPlaceholder").style.display = "flex";
    $("playerPlaceholder").innerHTML = '<div class="play-orb">!</div><strong>Playback unavailable</strong><span>'+escapeHTML(message)+'</span>';
    toast("Channel could not start");
  }
  video.addEventListener("playing", () => {
    $("playerPlaceholder").style.display = "none";
    $("playerStatus").textContent = "● LIVE";
    $("playerStatus").classList.add("playing");
  });
  video.addEventListener("error", () => { if (current) playerError("The browser could not decode this stream."); });
  grid.addEventListener("click", event => {
    const card = event.target.closest(".channel-card");
    if (card) playChannel(channels[Number(card.dataset.index)]);
  });
  $("categoryNav").addEventListener("click", event => {
    const btn = event.target.closest("[data-category]");
    if (!btn) return;
    activeCategory = btn.dataset.category; renderCategories(); applyFilters();
  });
  $("searchInput").addEventListener("input", applyFilters);
  $("sortSelect").addEventListener("change", applyFilters);
  $("loadMore").addEventListener("click", () => { visible += PAGE_SIZE; renderGrid(); });
  $("copyStream").addEventListener("click", async () => {
    if (!current) return;
    try { await navigator.clipboard.writeText(current.stream_url); toast("Stream URL copied"); }
    catch (_) { toast("Clipboard permission unavailable"); }
  });
  $("themeBtn").addEventListener("click", () => document.body.classList.toggle("light"));
  document.addEventListener("keydown", e => {
    if (e.key === "/" && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) { e.preventDefault(); $("searchInput").focus(); }
    if (e.key === "Escape") $("searchInput").blur();
  });
  async function init() {
    try {
      const response = await fetch("./channels.json", {cache:"no-store"});
      if (!response.ok) throw new Error("channels.json returned HTTP " + response.status);
      const data = await response.json();
      channels = Array.isArray(data) ? data : (data.channels || []);
      channels = channels.filter(c => c && c.name && c.stream_url);
      $("totalCount").textContent = channels.length.toLocaleString();
      renderCategories(); applyFilters();
    } catch (error) {
      console.error(error);
      grid.innerHTML = '<div class="empty">Could not load channels.json. Make sure it is in the same criczonojiotv folder as index.html.</div>';
      $("resultCount").textContent = "Playlist load failed";
    }
  }
  init();
})();