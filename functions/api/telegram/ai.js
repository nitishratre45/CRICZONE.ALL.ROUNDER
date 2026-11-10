const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

const normalize = (value) => String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

let botMemoryCache = null;
let botMemoryCacheAt = 0;
async function loadBotMemory(request) {
  const now = Date.now();
  if (botMemoryCache && now - botMemoryCacheAt < 5 * 60 * 1000) return botMemoryCache;
  try {
    const origin = new URL(request.url).origin;
    const response = await fetch(origin + "/telegram-memory.json", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error("Memory JSON HTTP " + response.status);
    const memory = await response.json();
    if (!memory || memory.version !== 1 || !Array.isArray(memory.providers)) throw new Error("Invalid Telegram memory JSON");
    botMemoryCache = memory;
    botMemoryCacheAt = now;
    return memory;
  } catch (error) {
    console.error("Telegram memory load failed; using built-in defaults", error);
    return { providers: [
      { name: "Sony Sports", aliases: ["sony sports"], sources: ["sony_playlist"], name_pattern: "^(sony sports|sony ten)\\b" },
      { name: "Star Sports", aliases: ["star sports"], sources: ["sony_star"], name_pattern: "^star sports\\b" },
      { name: "FanCode", aliases: ["fancode"], sources: ["fancode"], name_pattern: "fancode" },
      { name: "Willow", aliases: ["willow"], sources: ["willow_v4", "willow_v5"], name_pattern: "willow" },
      { name: "Sky", aliases: ["sky"], sources: ["sky"], name_pattern: "\\bsky\\b" },
      { name: "Fox", aliases: ["fox"], sources: ["fox"], name_pattern: "\\bfox\\b" },
      { name: "TNT", aliases: ["tnt"], sources: ["tnt"], name_pattern: "\\btnt\\b" }
    ] };
  }
}


function buildChannelKeyboard(items, fallbackLabel = "Open channel") {
  const rows = [];
  const seen = new Set();
  for (const item of items || []) {
    const url = String(item?.page_url || item?.url || "").trim();
    if (!/^https:\/\/(?:criczone\.pages\.dev|t\.me)\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    const label = String(item?.name || fallbackLabel).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 64) || fallbackLabel;
    rows.push([{ text: label, url }]);
    if (rows.length >= 30) break;
  }
  return rows.length ? { inline_keyboard: rows } : null;
}

function buildInlineLinkKeyboard(text) {
  const lines = String(text || "").split(/\r?\n/);
  const rows = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const urlMatch = lines[i].match(/https:\/\/[^\s<>]+/i);
    if (!urlMatch) continue;
    const url = urlMatch[0].replace(/[),.]+$/, "");
    if (seen.has(url)) continue;
    if (!/^https:\/\/(?:criczone\.pages\.dev|t\.me)\//i.test(url)) continue;
    seen.add(url);
    let label = "";
    for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
      const candidate = lines[j].replace(/^\s*\d+[.)]\s*/, "").replace(/^🌐\s*Open in Chrome:\s*/i, "").trim();
      if (candidate && !/^🌐/u.test(candidate) && !/^OPEN IN CHROME/i.test(candidate)) { label = candidate; break; }
    }
    // Preserve the complete channel name on the button.
    // Only remove list numbering and normalize repeated whitespace.
    label = (label || "Open channel")
      // Telegram inline keyboard button text is plain text, not HTML.
      // Strip formatting tags inherited from the explanatory line above each URL.
      .replace(/<[^>]*>/g, "")
      .replace(/^\s*\d+[.)]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    // Telegram inline button labels support up to 64 characters.
    // Keep full names whenever they fit the Bot API limit.
    if (label.length > 64) label = label.slice(0, 64).trimEnd();
    const button = { text: label, url };
    // Telegram does not expose screen width to bots, so use one full-width
    // button per row. This is the safest layout across narrow phones and desktop.
    rows.push([button]);
    if (rows.length >= 30) break;
  }
  return rows.length ? { inline_keyboard: rows } : null;
}
async function send(env, chatId, text, replyTo, replyMarkup, parseMode) {
  // Telegram sendMessage accepts at most 4096 characters. Split on line boundaries.
  const source = String(text || "");
  const keyboard = replyMarkup || buildInlineLinkKeyboard(source);
  // Always show the explanatory message above the inline keyboard.
  // Hiding it behind an invisible separator made buttons appear without context.
  const displaySource = source;
  const chunks = [];
  let remaining = displaySource;
  while (remaining.length > 3900) {
    let cut = remaining.lastIndexOf("\n", 3900);
    if (cut < 1000) cut = 3900;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n+/, "");
  }
  if (remaining || !chunks.length) chunks.push(remaining);

  let result = { ok: true };
  for (let index = 0; index < chunks.length; index++) {
    const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunks[index],
        ...(parseMode ? { parse_mode: parseMode } : {}),
        disable_web_page_preview: true,
        ...(index === 0 && keyboard ? { reply_markup: keyboard } : {}),
        ...(index === 0 && replyTo ? { reply_to_message_id: replyTo, allow_sending_without_reply: true } : {})
      })
    });
    result = await response.json();
    if (!response.ok || !result.ok) {
      console.error("Telegram sendMessage error", result);
      return result;
    }
  }
  return result;
}

async function ensureTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS telegram_ai_conversations (
    chat_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    step TEXT NOT NULL DEFAULT '',
    topic TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (chat_id, user_id)
  )`).run();
}

async function getState(db, chatId, userId) {
  const state = await db.prepare("SELECT * FROM telegram_ai_conversations WHERE chat_id = ? AND user_id = ?")
    .bind(String(chatId), String(userId)).first();
  // Conversation choices expire after 30 minutes so old selections cannot hijack new requests.
  if (state && Number(state.updated_at || 0) < Math.floor(Date.now() / 1000) - 1800) {
    await clearState(db, chatId, userId);
    return null;
  }
  return state;
}

async function getRecentSonyState(db, chatId) {
  // Anonymous-admin mode can change Telegram's sender identity between messages.
  return await db.prepare(`SELECT * FROM telegram_ai_conversations
    WHERE chat_id = ? AND lower(provider) = 'sony sports' AND updated_at >= ?
    ORDER BY updated_at DESC LIMIT 1`)
    .bind(String(chatId), Math.floor(Date.now() / 1000) - 1800).first();
}

async function saveState(db, chatId, userId, step, topic = "", provider = "") {
  await db.prepare(`INSERT INTO telegram_ai_conversations (chat_id,user_id,step,topic,provider,updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(chat_id,user_id) DO UPDATE SET step=excluded.step,topic=excluded.topic,provider=excluded.provider,updated_at=excluded.updated_at`)
    .bind(String(chatId), String(userId), step, topic, provider, Math.floor(Date.now()/1000)).run();
}

async function clearState(db, chatId, userId) {
  await db.prepare("DELETE FROM telegram_ai_conversations WHERE chat_id = ? AND user_id = ?")
    .bind(String(chatId), String(userId)).run();
}

const DATA_FEEDS = [
  { key: "sports_v7", folder: "criczone", url: "https://sonujson-v7.pages.dev/Data/sports.json" },
  { key: "directory_v3", folder: "criczone2", url: "https://allrounder3-0.pages.dev/id.json" },
  { key: "directory_v1", folder: "criczone1", url: "https://sportlink-json.pages.dev/id.json" },
  { key: "sports_v5", folder: "criczone3", url: "https://sonujson-v5.pages.dev/Data/sports.json" },
  { key: "willow_v4", folder: "criczonebuzz", url: "https://sonujson-v4.pages.dev/Data/willow.json" },
  { key: "prime_v4", folder: "criczonebuzz", url: "https://sonujson-v4.pages.dev/Data/prime.json" },
  { key: "willow_v5", folder: "criczonebuzz", url: "https://sonujson-v5.pages.dev/Data/willow.json" },
  { key: "fancode", folder: "fancodeweb", url: "https://sportlink-fancode10.pages.dev/fan.json" },
  { key: "sony_star", folder: "criczonesony", url: "https://sportlink-tv11.pages.dev/Star3.json" },
  { key: "sony_playlist", folder: "sony", url: "https://sportlink-jtv.pages.dev/sony3.m3u", format: "m3u" },
  { key: "sony_playlist_backup", folder: "criczonesony", url: "https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sony.m3u", format: "m3u" },
  { key: "jtv2", folder: "criczone2", url: "https://cdn.jsdelivr.net/gh/sportlive18/jio-tv-auto-update-playlist@main/jtv2.json" },
  { key: "sports_logos", folder: "criczonesony", url: "https://aryanstreams2.pages.dev/data/sports.json" }
];

const FOLDER_URLS = {
  criczone: "https://criczone.pages.dev/criczone/",
  criczone1: "https://criczone.pages.dev/criczone1/",
  criczone2: "https://criczone.pages.dev/criczone2/",
  criczone3: "https://criczone.pages.dev/criczone3/",
  criczonebuzz: "https://criczone.pages.dev/criczonebuzz/",
  fancodeweb: "https://criczone.pages.dev/fancodeweb/",
  criczonefancode: "https://criczone.pages.dev/criczonefancode/",
  sony: "https://criczone.pages.dev/criczonesony/",
  criczonesony: "https://criczone.pages.dev/criczonesony/"
};

function parseM3U(text, feed) {
  const records = [];
  let current = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      const comma = line.lastIndexOf(",");
      const attrs = comma >= 0 ? line.slice(8, comma) : line.slice(8);
      const name = comma >= 0 ? line.slice(comma + 1).trim() : "";
      const id = attrs.match(/tvg-id="([^"]*)"/i)?.[1] || "";
      const group = attrs.match(/group-title="([^"]*)"/i)?.[1] || "General";
      const logo = attrs.match(/tvg-logo="([^"]*)"/i)?.[1] || "";
      current = { name: name || id || "Unknown channel", id, folder: feed.folder, category: group, logo, url: FOLDER_URLS[feed.folder] || "", source: feed.key };
    } else if (line.startsWith("#EXTGRP:") && current) {
      current.category = line.slice(8).trim() || current.category;
    } else if (/^https?:\/\//i.test(line) && current) {
      // Keep the upstream media URL private; expose the channel's folder page instead.
      records.push(current);
      current = null;
    }
  }
  return records;
}

function collectRecords(node, out, feed, depth = 0, folderPath = []) {
  if (depth > 12 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectRecords(item, out, feed, depth + 1, folderPath);
    return;
  }
  if (typeof node !== "object") return;

  const pick = (...keys) => keys.map(k => node[k]).find(v => v !== undefined && v !== null && v !== "");
  const name = pick("name","title","channel_name","channelName","channel","label","station","display_name","t","contentName","event_name","team_name","match","event");
  const id = pick("id","channel_id","channelId","content_id","cid","event_id","team_id","key","match_id","fixture_id");
  const category = pick("category","genre","group","sport","tournament","competition");
  const rawUrl = pick("page_url","web_url","website","page","href","channel_url","watch_url","iframeSrc","iframe_src","embedUrl","embed_url");
  const safeUrl = typeof rawUrl === "string" && /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
  const streamOnly = typeof safeUrl === "string" && /\.(m3u8|mpd|mp4|ts)(\?|$)/i.test(safeUrl);
  const folder = String(pick("folder","folder_name","directory") || feed.folder || folderPath.filter(Boolean).join(" / "));
  const url = safeUrl && !streamOnly ? safeUrl : (FOLDER_URLS[feed.folder] || "https://criczone.pages.dev/");

  if (name || id) {
    out.push({
      name: String(name || id),
      id: id == null ? "" : String(id),
      folder,
      category: category == null ? "" : String(category),
      url,
      source: feed.key
    });
  }

  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === "object") {
      const nextPath = Array.isArray(value) ? folderPath : [...folderPath, key];
      collectRecords(value, out, feed, depth + 1, nextPath);
    }
  }
}

async function loadAllData(request) {
  const origin = new URL(request.url).origin;
  const response = await fetch(origin + "/api/telegram/database", {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("Canonical database HTTP " + response.status);
  const database = await response.json();
  if (!database || !Array.isArray(database.channels) || !Array.isArray(database.matches)) {
    throw new Error("Canonical database has an invalid schema");
  }
  return {
    records: database.channels,
    matches: database.matches,
    summary: database.summary
  };
}

function findMatches(records, query, provider = "") {
  const q = normalize(query);
  if (!q) return [];
  const providerKey = normalize(provider);
  const queryTokens = q.split(" ").filter(Boolean);
  const genericNames = new Set(["sony", "star", "sports", "sport", "live", "tv", "channel"]);
  const candidates = [];

  for (const item of records) {
    const name = String(item.name || "").trim();
    const normalizedName = normalize(name);
    if (!normalizedName || genericNames.has(normalizedName)) continue;
    const haystack = normalize([item.name, item.folder, item.category, item.json, item.source].join(" "));
    if (providerKey && !haystack.includes(providerKey)) continue;
    const nameTokens = normalizedName.split(" ").filter(Boolean);
    const missing = queryTokens.filter(token =>
      !nameTokens.some(part => part === token || part.startsWith(token) || closeWord(token, part))
    );
    if (missing.length) continue;
    let score = normalizedName === q ? 10000 : 0;
    if (normalizedName.startsWith(q)) score += 500;
    score += queryTokens.length * 30 + Math.min(nameTokens.length, 10);
    candidates.push({ ...item, _score: score, _normalizedName: normalizedName });
  }
  candidates.sort((a, b) => b._score - a._score);
  const unique = new Map();
  for (const item of candidates) {
    if (!unique.has(item._normalizedName)) unique.set(item._normalizedName, item);
  }
  return [...unique.values()].slice(0, 30).map(({ _score, _normalizedName, ...item }) => item);
}

function editDistance(a, b) {
  const left = String(a || ""), right = String(b || "");
  if (Math.abs(left.length - right.length) > 2) return 99;
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function closeWord(a, b) {
  if (!a || !b) return false;
  if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
  const limit = Math.min(a.length, b.length) >= 7 ? 2 : (Math.min(a.length, b.length) >= 4 ? 1 : 0);
  return limit > 0 && editDistance(a, b) <= limit;
}

function findWillowMatches(matches, query) {
  const normalized = normalize(query)
    .replace(/\bnewzealand\b/g, "new zealand")
    .replace(/\bsouthafrica\b/g, "south africa")
    .replace(/\bsrilanka\b/g, "sri lanka")
    .replace(/\bwestindies\b/g, "west indies");
  const parts = normalized.split(/\s+(?:vs|versus|v)\s+/).filter(Boolean);
  const aliases = {
    ind: ["india"], india: ["india"], nz: ["new zealand"], "new zealand": ["new zealand"],
    aus: ["australia"], australia: ["australia"], eng: ["england"], england: ["england"],
    pak: ["pakistan"], pakistan: ["pakistan"], sa: ["south africa"], "south africa": ["south africa"],
    sl: ["sri lanka"], "sri lanka": ["sri lanka"], ban: ["bangladesh"], bangladesh: ["bangladesh"],
    wi: ["west indies"], "west indies": ["west indies"]
  };
  const sideMatches = (eventName, side) => {
    const expanded = aliases[side] || [side];
    const eventTokens = normalize(eventName).split(" ").filter(Boolean);
    return expanded.some(term => {
      const wanted = normalize(term).split(" ").filter(Boolean);
      return wanted.every(word => eventTokens.some(candidate => closeWord(word, candidate)));
    });
  };

  let found = [];
  if (parts.length === 2) {
    found = matches.filter(item => sideMatches(item.name, parts[0]) && sideMatches(item.name, parts[1]));
  } else {
    const tokens = normalized.split(" ").filter(t => !["match","live","cricket","today","the","of","in","a","an"].includes(t));
    found = matches.filter(item => tokens.length && tokens.every(token => {
      const expanded = aliases[token] || [token];
      return expanded.some(term => normalize(term).split(" ").every(word =>
        normalize(item.name).split(" ").some(candidate => closeWord(word, candidate))
      ));
    }));
  }
  return found.slice(0, 5);
}

function firstName(message) {
  return message?.from?.first_name || message?.from?.username || "there";
}

async function handleText({ request, env, message }) {
  const chatId = message.chat.id;
  // Anonymous group admins are represented by sender_chat (and often GroupAnonymousBot).
  // Use the sender_chat ID as a stable state key when Telegram hides the real user ID.
  const userId = message.sender_chat?.id ? "sender_chat:" + message.sender_chat.id : message.from?.id;
  const userText = String(message.text || "").trim();
  if (!userId || !userText || (message.from?.is_bot && !message.sender_chat) || message.chat.type === "private") return;

  await ensureTable(env.TELEGRAM_DB);
  const value = normalize(userText);
  const memory = await loadBotMemory(request);
  const reply = (text, replyMarkup, parseMode) => send(env, chatId, text, message.message_id, replyMarkup, parseMode);

  // Respond warmly to gratitude without loading channel feeds or changing conversation state.
  const gratitude = /^(?:thanks?|thank\s*u|thank\s+you|thankyou|thanku|thnks|thx|ty|many\s+thanks|thanks\s+a\s+lot|thank\s+you\s+so\s+much|thankyou\s+so\s+much|shukriya|dhanyawad)(?:\s+(?:so\s+much|a\s+lot|bro|bhai|dear|❤️+|🙏+))*[.!\s❤️🙏😊]*$/i;
  if (gratitude.test(userText.trim())) {
    return reply("❤️ <b>You’re most welcome!</b> 😊\n\n<i>We’re happy to have you in the CRICZONE family.</i>\n\n<blockquote>Enjoy the cricket! 🏏💙</blockquote>", undefined, "HTML");
  }

  const greeting = /^(?:hi|hello|hellow|helo|hey|hii+|helo+|namaste|good morning|good afternoon|good evening)[.!\\s😊👋❤️]*$/i;
  if (greeting.test(userText.trim())) {
    return reply("👋 <b>Welcome to CRICZONE!</b> 🏏\n\n<i>Your cricket channel finder is ready.</i>\n\nSend a channel name or broadcaster, or type <code>match</code> to find a match.\n\n<blockquote>Example: <b>India vs New Zealand</b></blockquote>🌐 I’ll find the CRICZONE link for you.", undefined, "HTML");
  }

  // Ask for the teams when someone sends only the word "match".
  // A complete query such as "India vs New Zealand" continues to the match finder below.
  if (/^(?:match|matches)$/i.test(value)) {
    const matchPrompt =
      "🏏 <b>Which match are you looking for?</b>\n\n" +
      "<i>Please send the team names.</i>\n\n" +
      "<blockquote>Example: <code>India vs New Zealand</code></blockquote>";
    return reply(matchPrompt, undefined, "HTML");
  }

  // Ignore ordinary chat; this assistant only answers identifiable cricket/channel requests.
  const casual = /^(?:welcome|ok|okay|k|hmm|acha|achha|ho gaya|ho gya|done|great|nice|good|❤️+|🙏+|👍+|😊+|😍+)$/i;
  if (casual.test(value)) return;

  if (/^\/(cancel|stop)(@\w+)?$/i.test(userText)) {
    await clearState(env.TELEGRAM_DB, chatId, userId);
    return reply("✅ <b>Request cancelled</b>\n\n<i>Your current search has been cleared.</i>", undefined, "HTML");
  }
  if (/^\/(start|ping)(@\w+)?$/i.test(userText)) {
    return reply("🟢 <b>CRICZONE BOT IS ONLINE</b>\n\n<i>What would you like to find?</i>\n\n• Send a team matchup\n• Send a broadcaster name\n• Send a channel name\n\n<blockquote>Example: <code>India vs New Zealand</code></blockquote>", undefined, "HTML");
  }
  if (/^\/help(@\w+)?$/i.test(userText)) {
    return reply("📖 <b>CRICZONE HELP</b>\n\n<i>Search for cricket channels in a few simple ways:</i>\n\n🏏 <b>Match:</b> <code>India vs New Zealand</code>\n📺 <b>Broadcaster:</b> <code>Sony Sports</code>\n🔎 <b>Channel:</b> <code>Sony Sports Ten 1 HD</code>\n\n<blockquote>Choose a broadcaster button to see its available channels.</blockquote>", undefined, "HTML");
  }

  const state = await getState(env.TELEGRAM_DB, chatId, userId);
  let data;
  try {
    data = await loadAllData(request);
  } catch (error) {
    console.error("CRICZONE data load error", error);
    return reply("⚠️ <b>Channel data temporarily unavailable</b>\n\n<i>Please try again in a little while.</i>", undefined, "HTML");
  }
  if (!data.records.length && !data.matches.length) {
    return reply("⚠️ <b>Channel list unavailable</b>\n\n<i>The channel directory is empty or temporarily unavailable.</i>\n\n<blockquote>Please contact a CRICZONE admin for help.</blockquote>", undefined, "HTML");
  }

  // A standalone "Sony" request returns the complete Sony channel directory.
  // Use only the two Sony source folders and always share the Sony page base URL.
  if (value === "sony") {
    await clearState(env.TELEGRAM_DB, chatId, userId);
    return reply("📺 <b>SONY SPORTS DIRECTORY</b>\n\n<i>Explore all available Sony Sports channels in one place.</i>\n\n<blockquote>Tap the button below to open the complete directory. 🏏</blockquote>", buildChannelKeyboard([{ name: "📺 OPEN SONY DIRECTORY", page_url: "https://criczone.pages.dev/criczonesony/" }]), "HTML");
  }

  if (/^(?:fancode|fan code)\\s+web$/i.test(value)) {
    await clearState(env.TELEGRAM_DB, chatId, userId);
      return reply("🎬 <b>FANCODE WEB</b>\n\n<i>Explore the available FanCode channels on CRICZONE.</i>\n\n<blockquote>Tap the button below to open FanCode. 🔗</blockquote>", buildChannelKeyboard([{ name: "🎬 FANCODE WEB (PRIMARY)", page_url: "https://criczone.pages.dev/fancodeweb/" }, { name: "🛟 OLD FANCODE WEB (BACKUP)", page_url: "https://criczone.pages.dev/criczonefancode/" }]), "HTML");
  }

  // Willow and Cricbuzz share the CRICZONE Buzz page. Reply with this folder URL only.
  if (/^(?:willow|willow channels|cricbuzz|cricbuzz channels)$/i.test(value)) {
    await clearState(env.TELEGRAM_DB, chatId, userId);
    return reply("🏏 <b>CRICZONE BUZZ</b>\n\n<i>Open Willow and Cricbuzz coverage:</i>\nhttps://criczone.pages.dev/criczonebuzz/", undefined, "HTML");
  }

  // Match search works for any teams and uses all channel feeds, not only Willow fixtures.
  const isTeamMatchQuery = /\b(?:vs|versus|v|against)\b/i.test(value);
  const providerDefinitions = memory.providers.map(provider => ({
    ...provider,
    keys: Array.isArray(provider.aliases) ? provider.aliases : [provider.name.toLowerCase()],
    namePattern: new RegExp(provider.name_pattern || provider.name, "i")
  }));
  // Provider matching is based on the actual channel name, never folder/source metadata.
  // This prevents "Sony Sports" from matching unrelated Sony TV channels or match-labelled aliases.
  const getProviderChannels = (provider) => {
    // Curated provider entries are authoritative and avoid incomplete feed merges.
    if (Array.isArray(provider.channel_entries)) {
      return provider.channel_entries
        .filter(item => item && item.id && item.name && item.url)
        .map(item => ({ type: "channel", id: String(item.id), name: item.name, folder: item.folder || "criczone", json: "manual_directory", page_url: item.url }));
    }
    // Sony primary list comes directly from memory JSON: exactly five curated entries.
    if (normalize(provider.name) === "sony sports" && Array.isArray(memory.sony_channel_sets?.primary)) {
      return memory.sony_channel_sets.primary
        .filter(item => item && item.id && item.name && item.url)
        .map(item => ({ type: "channel", id: String(item.id), name: item.name, folder: item.folder || "criczone1", page_url: item.url }));
    }
    const allowedSources = Array.isArray(provider.sources) ? new Set(provider.sources) : null;
    const allowedChannelKeys = Array.isArray(provider.channel_keys) ? new Set(provider.channel_keys.map(String)) : null;
    const rows = data.records.filter(item =>
      item.type !== "match" && item.name && item.page_url &&
      (!allowedSources || allowedSources.has(String(item.json || ""))) &&
      (!allowedChannelKeys || allowedChannelKeys.has(String(item.folder || "criczone") + "|" + String(item.id || ""))) &&
      provider.namePattern.test(String(item.name).trim()) &&
      !/\\b(?:ind|india|nz|new zealand|match|vs|versus)\\b/i.test(String(item.name))
    );
    return [...new Map(rows.map(item => [normalize(item.name), item])).values()]
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  };
  // Build one searchable index from live feeds plus trusted curated memory entries.
  // This lets exact channel-name lookups work even when an upstream feed is temporarily incomplete.
  const curatedSearchRecords = [];
  for (const provider of providerDefinitions) {
    for (const item of Array.isArray(provider.channel_entries) ? provider.channel_entries : []) {
      if (item?.id && item?.name && item?.url) curatedSearchRecords.push({
        type: "channel", id: String(item.id), name: item.name,
        folder: item.folder || "criczone", json: "manual_directory", page_url: item.url
      });
    }
  }
  for (const item of [
    ...(Array.isArray(memory.sony_channel_sets?.primary) ? memory.sony_channel_sets.primary : []),
    ...(Array.isArray(memory.sony_channel_sets?.backup) ? memory.sony_channel_sets.backup : [])
  ]) {
    if (item?.id && item?.name && item?.url) curatedSearchRecords.push({
      type: "channel", id: String(item.id), name: item.name,
      folder: item.folder || "criczone", json: "manual_directory", page_url: item.url
    });
  }
  const channelSearchRecords = [...new Map(
    [...data.records, ...curatedSearchRecords]
      .filter(item => item && item.type !== "match" && item.name && (item.page_url || item.url))
      .map(item => [String(item.folder || "criczone") + "|" + String(item.id || "") + "|" + normalize(item.name), item])
  ).values()];

  const providerHasChannels = (provider) => getProviderChannels(provider).length > 0;

  // Detect broadcaster intent anywhere in a natural group message, not only exact names
  // or English "link" requests. Keep specific numbered channel searches on the normal matcher.
  const mentionedProvider = providerDefinitions.find(provider => {
    const aliases = [...(provider.keys || []), provider.name]
      .map(normalize).filter(Boolean)
      .sort((a, b) => b.length - a.length);
    const paddedText = " " + value + " ";
    return aliases.some(alias => paddedText.includes(" " + alias + " "));
  });
  const asksForBroadcaster = /\\b(?:link|url|website|web|send|show|give|chahiye|chaiye|bhejo|bhej|do|dikhao|open|watch|live|channel|channels|stream|ka|ki|ke|kaha|kahan|mil|milega|please)\\b/i.test(userText);
  const hasSpecificChannelNumber = /\\b(?:[1-9]|ten\\s*[1-5]|select\\s*[12]|\\d{3,})\\b/i.test(value);
  if (mentionedProvider && !hasSpecificChannelNumber &&
      (asksForBroadcaster || value === normalize(mentionedProvider.name) ||
       (mentionedProvider.keys || []).some(key => value === normalize(key)))) {
    await clearState(env.TELEGRAM_DB, chatId, userId);
    if (normalize(mentionedProvider.name) === "sony sports") {
      return reply("📺 <b>SONY SPORTS DIRECTORY</b>\\n\\n<i>Explore all available Sony Sports channels and live events in one place.</i>\\n\\n<blockquote>Tap below to open the Sony Sports website. 🏏</blockquote>",
        buildChannelKeyboard([{ name: "📺 OPEN SONY SPORTS WEBSITE", page_url: "https://criczone.pages.dev/criczonesony/" }]), "HTML");
    }
    const list = getProviderChannels(mentionedProvider);
    if (list.length) {
      const buttons = list.filter(item => item.name && (item.page_url || item.url))
        .map(item => [{ text: String(item.name).slice(0, 64), url: item.page_url || item.url }]);
      const key = normalize(mentionedProvider.name);
      if (key === "fancode") {
        buttons.push([{ text: "🎬 FanCode Web (Primary)", url: "https://criczone.pages.dev/fancodeweb/" }]);
        buttons.push([{ text: "🛟 Old FanCode Web (Backup)", url: "https://criczone.pages.dev/criczonefancode/" }]);
      }
      const title = mentionedProvider.name.toUpperCase();
      return reply("📺 <b>" + title + " CHANNELS (" + list.length + ")</b>\\n\\n<i>I found the available " + title + " options. Choose one below to open it.</i>", { inline_keyboard: buttons }, "HTML");
    }
    return reply("⚠️ <b>" + mentionedProvider.name.toUpperCase() + " options are temporarily unavailable</b>\\n\\n<i>Please try again shortly.</i>", undefined, "HTML");
  }

  // Natural-language broadcaster link requests, e.g. "Sony HD link?" or "Fox hd link".
  const linkIntent = /\b(?:link|url|website|web|send|show|give|hd|4k)\b/i.test(userText);
  const channelQuery = userText
    .replace(/\b(?:link|url|website|web|send|show|give|please|hd|4k)\b/gi, " ")
    .replace(/[?!.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (linkIntent) {
    const requestedProvider = providerDefinitions.find(provider =>
      provider.keys.some(key => {
        const alias = normalize(key);
        return alias && (value === alias || value.startsWith(alias + " "));
      })
    );
    if (requestedProvider) {
      const remainder = value.replace(normalize(requestedProvider.name), " ").trim();
      const hasSpecificChannelNumber = /\b(?:[1-9]|ten\s*[1-5]|select\s*[12])\b/i.test(remainder);
      if (!hasSpecificChannelNumber) {
        const list = getProviderChannels(requestedProvider);
        if (list.length) {
          await clearState(env.TELEGRAM_DB, chatId, userId);
          const buttons = list.filter(item => item.name && (item.page_url || item.url))
            .map(item => [{ text: String(item.name).slice(0, 64), url: item.page_url || item.url }]);
          const providerKey = normalize(requestedProvider.name);
          if (providerKey === "fancode") {
            buttons.push([{ text: "🎬 FanCode Web (Primary)", url: "https://criczone.pages.dev/fancodeweb/" }]);
            buttons.push([{ text: "🛟 Old FanCode Web (Backup)", url: "https://criczone.pages.dev/criczonefancode/" }]);
          }
          if (providerKey === "sony sports") buttons.push([{ text: "Sony Web", url: "https://criczone.pages.dev/criczonesony/" }]);
          const message = "📺 <b>" + requestedProvider.name.toUpperCase() + " CHANNELS (" + list.length + ")</b>\n\n<i>Choose a channel button below to open it.</i>";
          return reply(message, { inline_keyboard: buttons }, "HTML");
        }
      }
    }
  }

  if (isTeamMatchQuery) {
    const availableProviders = providerDefinitions.filter(provider => providerHasChannels(provider));
    await saveState(env.TELEGRAM_DB, chatId, userId, "awaiting_provider", userText, "");
    if (!availableProviders.length) {
      return reply("⚠️ <b>No broadcasters available right now</b>\n\n<i>The connected channel feeds did not return any broadcaster channels.</i>\n\nPlease try again shortly.", undefined, "HTML");
    }
    const providerKeyboard = {
      inline_keyboard: availableProviders.map(provider => [{
        text: provider.name,
        callback_data: "provider:" + provider.name
      }])
    };
    const safeMatchName = userText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const matchMessage =
      "🏏 <b>CRICZONE MATCH FINDER</b>\n\n" +
      "🏆 <b>" + safeMatchName + "</b>\n\n" +
      "📺 <b>Choose your broadcaster</b>\n" +
      "<i>Select a button below to view available channels.</i>\n" +
      "<i>Or type a broadcaster name, e.g. Sony Sports.</i>";
    return reply(matchMessage, providerKeyboard, "HTML");
  }

  // Show Sony alternate links only after the user reports primary playback trouble.
  const sonyFailureReport = /\b(?:not\s+working|does\s+not\s+work|doesnt\s+work|not\s+playing|not\s+opening|not\s+loading|nhi\s+chal(?:\s+raha)?|nahi\s+chal(?:\s+raha|\s+rha)?|nahin\s+chal(?:\s+raha)?|kaam\s+nahi\s+kar|work\s+nahi|backup|alternate)\b/i.test(value);
  const recentSonyState = sonyFailureReport
    ? (state?.provider && normalize(state.provider) === "sony sports"
      ? state
      : await getRecentSonyState(env.TELEGRAM_DB, chatId))
    : null;
  if (sonyFailureReport && (normalize(recentSonyState?.provider || "") === "sony sports" ||
      /\bsony\s+sports\b/i.test(String(recentSonyState?.topic || "")) ||
      /\bsony\s+sports\b/i.test(userText))) {
    const backups = (memory.sony_channel_sets?.backup || [])
      .filter(item => item && item.id && item.name && item.url);
    if (backups.length) {
      await saveState(env.TELEGRAM_DB, chatId, userId, "awaiting_channel", recentSonyState?.topic || "Sony Sports", "Sony Sports");
      const backupButtons = backups.map(item => [{ text: String(item.name).slice(0, 64), url: item.url }]);
      return reply("📺 <b>SONY SPORTS BACKUP CHANNELS (" + backups.length + ")</b>\n\n<i>Choose a backup channel below.</i>", { inline_keyboard: backupButtons }, "HTML");
    }
    return reply("⚠️ <b>Sony backup channels unavailable</b>\n\n<i>Please try again later. The backup directory may be temporarily offline.</i>", undefined, "HTML");
  }

  const requestedProvider = providerDefinitions.find(provider =>
    normalize(provider.name) === value ||
    provider.keys.some(key => normalize(key) === value)
  );

  // Allow a provider name to be queried directly, even without a preceding match query.
  // Exact "sony" is handled above as the Sony folder shortcut; "sony sports" lists sports channels.
  if (requestedProvider && (state?.step === "awaiting_provider" || value !== "sony")) {
    const unique = getProviderChannels(requestedProvider);
    if (unique.length) {
      await saveState(env.TELEGRAM_DB, chatId, userId, "awaiting_channel", state?.topic || "", requestedProvider.name);
      const channelButtons = unique
        .filter(item => (item.page_url || item.url) && item.name)
        .map(item => [{ text: String(item.name).slice(0, 64), url: item.page_url || item.url }]);
      if (normalize(requestedProvider.name) === "fancode") {
        channelButtons.push([{ text: "🎬 FanCode Web (Primary)", url: "https://criczone.pages.dev/fancodeweb/" }]);
        channelButtons.push([{ text: "🛟 Old FanCode Web (Backup)", url: "https://criczone.pages.dev/criczonefancode/" }]);
      }
      const channelKeyboard = channelButtons.length ? { inline_keyboard: channelButtons } : undefined;
      const channelMessage =
        "📺 <b>" + requestedProvider.name.toUpperCase() + " CHANNELS (" + unique.length + ")</b>\n\n" +
        "<i>Choose a channel below to open it in Chrome.</i>";
      return reply(channelMessage, channelKeyboard, "HTML");
    }
    return reply("⚠️ <b>No " + requestedProvider.name.toUpperCase() + " channels found</b>\n\n<i>There are no matching channels in the current directory right now.</i>", undefined, "HTML");
  }

  if (state?.step === "awaiting_provider") {
    const selectedProvider = providerDefinitions.find(provider =>
      normalize(provider.name) === value ||
      provider.keys.some(key => normalize(key) === value)
    );
    if (selectedProvider) {
      const unique = getProviderChannels(selectedProvider);
      if (unique.length) {
        await saveState(env.TELEGRAM_DB, chatId, userId, "awaiting_channel", state.topic, selectedProvider.name);
        const buttons = unique.filter(item => item.name && (item.page_url || item.url))
          .map(item => [{ text: String(item.name).slice(0, 64), url: item.page_url || item.url }]);
        const selectedProviderKey = normalize(selectedProvider.name);
        if (selectedProviderKey === "fancode") {
          buttons.push([{ text: "🎬 FanCode Web (Primary)", url: "https://criczone.pages.dev/fancodeweb/" }]);
          buttons.push([{ text: "🛟 Old FanCode Web (Backup)", url: "https://criczone.pages.dev/criczonefancode/" }]);
        }
        if (selectedProviderKey === "sony sports") buttons.push([{ text: "Sony Web", url: "https://criczone.pages.dev/criczonesony/" }]);
        const message = "📺 <b>" + selectedProvider.name.toUpperCase() + " CHANNELS (" + unique.length + ")</b>\n\n<i>Choose a channel button below to open it.</i>";
        return reply(message, { inline_keyboard: buttons }, "HTML");
      }
      return reply("⚠️ <b>No " + selectedProvider.name.toUpperCase() + " channels found</b>\n\n<i>The current feeds did not return channels for this broadcaster.</i>", undefined, "HTML");
    }
  }

  if (state?.step === "awaiting_channel") {
    // First respect the selected provider; if stale or incomplete group state filters it out,
    // retry globally so a fully-qualified channel name still works in every group.
    let channelMatches = findMatches(channelSearchRecords, channelQuery || userText, state.provider || "");
    if (!channelMatches.length) channelMatches = findMatches(channelSearchRecords, channelQuery || userText);
    if (!channelMatches.length) {
      return reply("❌ <b>Channel not found</b>\n\n<i>I couldn’t find that channel in the CRICZONE source list.</i>\n\nPlease try another part of the channel name, for example:\n<code>Sony Sports Ten 1</code>\n\n<blockquote>Tip: You can also send a broadcaster name like <b>Sony Sports</b> or <b>FanCode</b>.</blockquote>", undefined, "HTML");
    }
    await clearState(env.TELEGRAM_DB, chatId, userId);
    if (/fancode/i.test(userText)) {
      const item = channelMatches.find(row => /fancode/i.test(String(row.folder || "") + " " + String(row.name || ""))) || channelMatches[0];
      return reply("🎬 <b>FANCODE WEB</b>\n\n<i>Open the FanCode page:</i>\nhttps://criczone.pages.dev/fancodeweb/", undefined, "HTML");
    }
    // Once a user chooses a channel name, return only the single best matching channel URL.
    const exact = channelMatches.find(item => normalize(item.name) === normalize(userText));
    const selected = exact || channelMatches[0];
    const pageUrl = selected.page_url || selected.url || "";
    if (!pageUrl) return reply("⚠️ <b>Channel page unavailable</b>\n\n<i>I found </i><b>" + selected.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</b><i>, but its CRICZONE page URL is missing.</i>", undefined, "HTML");
    return reply("📺 <b>CHANNEL READY</b>\n\n<code>" + selected.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</code>\n\n<blockquote><i>Tap the button below to open this channel.</i> 🔗</blockquote>", buildChannelKeyboard([selected]), "HTML");
  }

  const channelMatches = findMatches(channelSearchRecords, channelQuery || userText);
  if (channelMatches.length) {
    if (/fancode/i.test(userText)) {
      return reply("🎬 <b>FANCODE WEB</b>\n\n<i>Open the FanCode page:</i>\nhttps://criczone.pages.dev/fancodeweb/", undefined, "HTML");
    }
    const matches = channelMatches.slice(0, 4);
    const lines = matches.map((item, i) => "<b>" + (i + 1) + ".</b> <code>" + String(item.name || "Channel").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</code>");
    return reply("🔎 <b>CHANNEL MATCHES</b>\n\n<i>Here are the closest matches for your search:</i>\n\n" + lines.join("\n") + "\n\n<blockquote>Choose a channel button below to open it. 🔗</blockquote>", buildChannelKeyboard(matches), "HTML");
    return reply("🔎 <b>CHANNEL MATCHES</b>\n\n<i>Choose the channel link that matches your search:</i>\n\n" + lines.join("\n\n"));
  }

  // Give useful guidance for likely channel searches instead of a confusing generic error.
  if (userText.length >= 3 && /\\b(?:sports|sport|channel|hd|4k|cricket|sony|star|sky|fox|tnt|willow|fancode)\\b/i.test(userText)) {
    return reply("❌ <b>No exact channel match found</b> 🤔\n\n<i>Try a shorter or more specific channel name.</i>\n\n<blockquote>Example: <code>Star Sports 2</code>\nSend /help to see search examples.</blockquote>", undefined, "HTML");
  }

  // Do not interrupt unrelated group conversation.
  return;
}

export async function onRequestPost({ request, env }) {
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
    return json({ ok: false, error: "Unauthorized webhook request" }, 401);
  }
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) {
    return json({ ok: false, error: "BOT_TOKEN or TELEGRAM_DB binding missing" }, 503);
  }
  let update;
  try { update = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  // Notify users when they leave the configured CRICZONE channel.
  // Telegram sends chat_member updates only when the webhook subscribes to them.
  const memberUpdate = update?.chat_member;
  if (memberUpdate?.chat?.type === "channel" && memberUpdate?.old_chat_member && memberUpdate?.new_chat_member) {
    const oldStatus = String(memberUpdate.old_chat_member.status || "");
    const newStatus = String(memberUpdate.new_chat_member.status || "");
    const wasMember = ["member", "administrator", "creator", "restricted"].includes(oldStatus);
    const isNoLongerMember = ["left", "kicked"].includes(newStatus);
    const user = memberUpdate.new_chat_member.user;
    if (wasMember && isNoLongerMember && user?.id && !user.is_bot) {
      try {
        const notice = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: user.id,
            text: "👋 <b>WE’RE SORRY TO SEE YOU GO!</b> 💙\n\n<i>We noticed that you’ve left the CRICZONE family.</i>\n\nThank you for being part of our cricket community. Your support means a lot to us! ❤️\n\n<blockquote>🏏 <b>Once a CRICZONE member, always a part of our cricket family.</b>\n\nWhenever you wish to return, our doors are always open for you.</blockquote>\n\n<code>CRICZONE • LIVE THE GAME</code>\n\n👇 <i>Tap the button below whenever you want to rejoin.</i>",
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [[{
                text: "📢 REJOIN CRICZONE",
                url: "https://t.me/+zAubvy7Li2VmMWY9"
              }]]
            }
          })
        });
        const result = await notice.json();
        if (!notice.ok || !result.ok) {
          console.warn("CRICZONE leave notification could not be delivered", result);
        }
      } catch (error) {
        console.warn("CRICZONE leave notification failed", error);
      }
    }
    return json({ ok: true, received: true, member_update: true });
  }

  // Automatically approve Telegram channel join requests.
  // The bot must be an administrator in the channel with the invite-users right.
  const joinRequest = update?.chat_join_request;
  if (joinRequest?.chat?.type === "channel" && joinRequest?.from?.id) {
    try {
      const approval = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/approveChatJoinRequest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: joinRequest.chat.id,
          user_id: joinRequest.from.id
        })
      });
      const result = await approval.json();
      if (!approval.ok || !result.ok) {
        console.error("CRICZONE channel join-request approval failed", result);
        return json({ ok: false, error: "Channel join request approval failed" }, 500);
      }
      console.log("CRICZONE channel join request approved", {
        chat_id: joinRequest.chat.id,
        user_id: joinRequest.from.id
      });
      // Send the newly approved member a private welcome message.
      // Telegram only allows bot-initiated DMs if the user has previously started the bot;
      // a DM failure must not undo or retry an already successful channel approval.
      try {
        const notice = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: joinRequest.from.id,
            text: "🎉 <b>WELCOME TO CRICZONE!</b>\n\n✅ Your request has been approved and you are now a channel member.\n\n🏏 Stay connected for cricket updates and live channel links.\n\n👇 <i>Tap the button below to open our Telegram channel.</i>",
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                [{
                  text: "📢 JOIN CRICZONE CHANNEL",
                  url: "https://t.me/+zAubvy7Li2VmMWY9"
                }],
                [{
                  text: "💙 JOIN CRICZONE HUB",
                  url: "https://t.me/criczonehubb"
                }]
              ]
            }
          })
        });
        const noticeResult = await notice.json();
        if (!notice.ok || !noticeResult.ok) {
          console.warn("CRICZONE approved member DM could not be delivered", noticeResult);
        }
      } catch (noticeError) {
        console.warn("CRICZONE approved member DM failed", noticeError);
      }
    } catch (error) {
      console.error("CRICZONE channel join-request approval error", error);
      return json({ ok: false, error: "Channel join request approval failed" }, 500);
    }
    return json({ ok: true, received: true, join_request_approved: true });
  }

  const callback = update?.callback_query;
  if (callback) {
    const callbackData = String(callback.data || "");
    try {
      await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/answerCallbackQuery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callback.id })
      });
      if (callbackData.startsWith("provider:") && callback.message?.chat?.type && callback.message.chat.type !== "private") {
        const message = {
          message_id: callback.message.message_id,
          chat: callback.message.chat,
          from: callback.from,
          text: callbackData.slice("provider:".length)
        };
        await handleText({ request, env, message });
      }
    } catch (error) {
      console.error("CRICZONE callback processing error", error);
      return json({ ok: false, error: "Callback processing failed" }, 500);
    }
    return json({ ok: true, received: true });
  }

  const message = update?.message || update?.edited_message;
  if (message?.chat?.type && message.chat.type !== "private") {
    try {
      await handleText({ request, env, message });
    }
    catch (error) {
      console.error("CRICZONE rule-based assistant error", error);
      // Return a retryable error instead of silently acknowledging a failed update.
      return json({ ok: false, error: "Assistant processing failed" }, 500);
    }
  }
  return json({ ok: true, received: true });
}

export async function onRequestGet() {
  return json({ ok: true, service: "CRICZONE rule-based group assistant", ai: false });
}
