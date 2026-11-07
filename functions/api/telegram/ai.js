const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

const normalize = (value) => String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

async function send(env, chatId, text, replyTo) {
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(replyTo ? { reply_to_message_id: replyTo, allow_sending_without_reply: true } : {})
    })
  });
  const result = await response.json();
  if (!result.ok) console.error("Telegram sendMessage error", result);
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
  return await db.prepare("SELECT * FROM telegram_ai_conversations WHERE chat_id = ? AND user_id = ?")
    .bind(String(chatId), String(userId)).first();
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
  { key: "fancode", folder: "criczonefancode", url: "https://sportlink-fancode10.pages.dev/fan.json" },
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
  criczonefancode: "https://criczone.pages.dev/criczonefancode/",
  sony: "https://criczone.pages.dev/sony/",
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

function findMatches(records, query) {
  const q = normalize(query);
  if (!q) return [];

  let queryUrl = "";
  try {
    if (/^https?:\/\//i.test(String(query).trim())) queryUrl = new URL(String(query).trim()).href.toLowerCase();
  } catch {}

  if (queryUrl) {
    return records
      .filter(item => {
        const url = String(item.page_url || item.url || "").toLowerCase();
        return url && (url === queryUrl || url.includes(queryUrl) || queryUrl.includes(url));
      })
      .slice(0, 4);
  }

  const queryTokens = q.split(" ").filter(Boolean);
  const genericNames = new Set(["sony", "sony 3", "sony 1", "star", "sports", "sport", "live", "tv", "channel"]);
  const candidates = [];

  for (const item of records) {
    const name = String(item.name || "").trim();
    const normalizedName = normalize(name);
    if (!normalizedName || genericNames.has(normalizedName)) continue;

    const nameTokens = normalizedName.split(" ").filter(Boolean);
    // A one-word brand search must not return generic IDs/aliases such as "SONY".
    if (queryTokens.length === 1 && nameTokens.length < 2) continue;

    const missing = queryTokens.filter(token => !nameTokens.some(part => part === token || part.startsWith(token)));
    if (missing.length) continue;

    let score = 100;
    if (normalizedName === q) score += 1000;
    else if (normalizedName.startsWith(q)) score += 250;
    else score += queryTokens.length * 30;

    // Prefer descriptive channel names over short aliases and generic directory entries.
    score += Math.min(nameTokens.length, 7);
    if (/\b(hd|fhd|4k|hindi|english|ten|sports)\b/i.test(name)) score += 15;

    candidates.push({ ...item, _score: score, _normalizedName: normalizedName });
  }

  candidates.sort((a, b) => b._score - a._score);

  // Collapse duplicate names across feeds; keep the best-ranked source record.
  const unique = new Map();
  for (const item of candidates) {
    if (!unique.has(item._normalizedName)) unique.set(item._normalizedName, item);
  }

  return [...unique.values()].slice(0, 4).map(({ _score, _normalizedName, ...item }) => item);
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
  const reply = (text) => send(env, chatId, text, message.message_id);

  // Ignore ordinary chat; this assistant only answers identifiable cricket/channel requests.
  const casual = /^(thanks?|thank you|thankyou|thanku|thx|ty|welcome|ok|okay|k|hmm|acha|achha|ho gaya|ho gya|done|great|nice|good|❤️+|🙏+|👍+|😊+|😍+)$/i;
  if (casual.test(value)) return;

  if (/^\/(cancel|stop)(@\w+)?$/i.test(userText)) {
    await clearState(env.TELEGRAM_DB, chatId, userId);
    return reply("Cancelled.");
  }
  if (/^\/(start|ping)(@\w+)?$/i.test(userText)) {
    return reply("CRICZONE is online. Send a match, team-vs-team query, channel name, or part of a channel name.");
  }
  if (/^\/help(@\w+)?$/i.test(userText)) {
    return reply("Send a match like India vs New Zealand, or a channel name like Sony Sports. I will ask which channel you want if needed.");
  }

  const state = await getState(env.TELEGRAM_DB, chatId, userId);
  let data;
  try {
    data = await loadAllData(request);
  } catch (error) {
    console.error("CRICZONE data load error", error);
    return reply("Channel data is temporarily unavailable. Please try again shortly.");
  }
  if (!data.records.length && !data.matches.length) {
    return reply("The channel list is currently empty or unavailable. Please contact the CRICZONE admin.");
  }

  // A standalone "Sony" request returns the complete Sony channel directory.
  // Use only the two Sony source folders and always share the Sony page base URL.
  if (value === "sony") {
    await clearState(env.TELEGRAM_DB, chatId, userId);
    const sonyNames = [...new Map(
      data.records
        .filter(item => ["sony", "criczonesony"].includes(String(item.folder || "").toLowerCase()))
        .map(item => String(item.name || "").trim())
        .filter(name => name && normalize(name) !== "sony")
        .map(name => [normalize(name), name])
    ).values()].sort((a, b) => a.localeCompare(b));
    if (!sonyNames.length) {
      return reply("Sony channel list is temporarily unavailable. Please try again shortly.");
    }
    return reply("SONY CHANNELS (" + sonyNames.length + ")\\n" +
      sonyNames.map((name, index) => (index + 1) + ". " + name).join("\\n") +
      "\\n\\nAll Sony channels: https://criczone.pages.dev/sony/");
  }

  // Team-vs-team query: show matching channel names first; user chooses a name to receive its page URL.
  const isTeamMatchQuery = /\\b(vs|versus|v)\\b/i.test(userText);
  if (isTeamMatchQuery) {
    const teamTokens = value.split(/\\s+(?:vs|versus|v)\\s+/).flatMap(side => {
      const aliases = { ind: "india", nz: "new zealand", aus: "australia", eng: "england", pak: "pakistan", sa: "south africa", sl: "sri lanka", ban: "bangladesh", wi: "west indies" };
      return side.split(" ").filter(Boolean).map(token => aliases[token] || token);
    }).flatMap(token => token.split(" ")).filter(token => !["the","of","in","a","an"].includes(token));
    const channelCandidates = data.records.filter(item => {
      const nameTokens = normalize(item.name).split(" ").filter(Boolean);
      return teamTokens.length > 0 && teamTokens.every(token =>
        nameTokens.some(candidate => closeWord(token, candidate))
      );
    });
    const uniqueChannels = [...new Map(channelCandidates.map(item => [normalize(item.name), item])).values()].slice(0, 20);
    if (uniqueChannels.length) {
      await saveState(env.TELEGRAM_DB, chatId, userId, "awaiting_channel", userText, "");
      return reply("CHANNELS SHOWING " + userText + "\\n\\n" +
        uniqueChannels.map((item, index) => (index + 1) + ". " + item.name).join("\\n") +
        "\\n\\nSend a channel name to get its CRICZONE link.");
    }
  }

  // "Willow" alone lists the current fixtures from the Willow JSON, not channel aliases.
  if (value === "willow" || value === "willow matches" || value === "willow match") {
    await clearState(env.TELEGRAM_DB, chatId, userId);
    const fixtures = (data.matches || []).filter(item => item.id && item.name &&
      String(item.folder || "").toLowerCase() === "criczonebuzz").slice(0, 12);
    if (!fixtures.length) return reply("Willow match data is temporarily unavailable. Please try again shortly.");
    const lines = fixtures.map((item, index) =>
      (index + 1) + ". " + item.name +
      "\nCRICZONE Match: https://criczone.pages.dev/criczonebuzz/?id=" + encodeURIComponent(item.id) +
      "\nWillow Web: https://criczone.pages.dev/criczonebuzz/"
    );
    return reply("WILLOW MATCHES (" + fixtures.length + ")\n\n" + lines.join("\n\n"));
  }

  // Resolve Willow fixtures by event name and expose the CRICZONE ID route plus Willow web.
  const willowMatches = findWillowMatches(data.matches || [], userText);
  if (willowMatches.length) {
    await clearState(env.TELEGRAM_DB, chatId, userId);
    const lines = willowMatches.map((item, index) => {
      const matchUrl = "https://criczone.pages.dev/criczonebuzz/?id=" + encodeURIComponent(item.id);
      return (index + 1) + ". " + item.name +
        "\nCRICZONE Match: " + matchUrl +
        "\nWillow Web: https://criczone.pages.dev/criczonebuzz/";
    });
    return reply("WILLOW MATCH FOUND\n\n" + lines.join("\n\n"));
  }

  // A match query starts a short, user-specific follow-up flow.
  const isMatchQuery = /\b(vs|versus)\b/i.test(userText) ||
    (/\b(live|playing|match|cricket)\b/i.test(value) && /\b(india|ind|nz|new zealand|australia|aus|england|eng|pakistan|pak|south africa|sa|sri lanka|sl|bangladesh|ban|west indies|wi)\b/i.test(value));

  if (state?.step === "awaiting_channel") {
    const channelMatches = findMatches(data.records, userText);
    if (!channelMatches.length) {
      return reply("I couldn't find that channel in the source list. Try another part of its name.");
    }
    await clearState(env.TELEGRAM_DB, chatId, userId);
    if (/fancode/i.test(userText)) {
      const item = channelMatches.find(row => /fancode/i.test(String(row.folder || "") + " " + String(row.name || ""))) || channelMatches[0];
      return reply("FANCODE\nhttps://criczone.pages.dev/criczonefancode/");
    }
    const lines = channelMatches.slice(0, 4).map((item, i) => {
      const pageUrl = item.page_url || item.url || "";
      return (i + 1) + ". " + item.name + (pageUrl ? "\n" + pageUrl : "");
    });
    return reply("Channel matches for " + state.topic + ":\n" + lines.join("\n\n"));
  }

  if (isMatchQuery) {
    await clearState(env.TELEGRAM_DB, chatId, userId);
    return reply("I couldn't find that match in the Willow JSON. Try the team names, for example: India vs New Zealand.");
  }

  const channelMatches = findMatches(data.records, userText);
  if (channelMatches.length) {
    if (/fancode/i.test(userText)) {
      return reply("FANCODE\nhttps://criczone.pages.dev/criczonefancode/");
    }
    const lines = channelMatches.slice(0, 4).map((item, i) => {
      const pageUrl = item.page_url || item.url || "";
      return (i + 1) + ". " + item.name + (pageUrl ? "\n" + pageUrl : "");
    });
    return reply("Channel matches:\n" + lines.join("\n\n"));
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
  const message = update?.message || update?.edited_message;
  if (message?.chat?.type && message.chat.type !== "private") {
    try { await handleText({ request, env, message }); }
    catch (error) { console.error("CRICZONE rule-based assistant error", error); }
  }
  return json({ ok: true, received: true });
}

export async function onRequestGet() {
  return json({ ok: true, service: "CRICZONE rule-based group assistant", ai: false });
}
