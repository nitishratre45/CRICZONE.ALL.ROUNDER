const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

const normalize = (value) => String(value || "").toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9\\s]/g, " ").replace(/\\s+/g, " ").trim();

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
  { key: "sports", url: "https://sonujson-v7.pages.dev/Data/sports.json" },
  { key: "directory", url: "https://allrounder3-0.pages.dev/id.json" },
  { key: "jtv2", url: "https://cdn.jsdelivr.net/gh/sportlive18/jio-tv-auto-update-playlist@main/jtv2.json" },
  { key: "willow_v4", url: "https://sonujson-v4.pages.dev/Data/willow.json" },
  { key: "prime_v4", url: "https://sonujson-v4.pages.dev/Data/prime.json" },
  { key: "willow_v5", url: "https://sonujson-v5.pages.dev/Data/willow.json" },
  { key: "sony_star", url: "https://sportlink-tv11.pages.dev/Star3.json" }
];

function collectRecords(node, out, source, depth = 0, folderPath = []) {
  if (depth > 12 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectRecords(item, out, source, depth + 1, folderPath);
    return;
  }
  if (typeof node !== "object") return;

  const pick = (...keys) => keys.map(k => node[k]).find(v => v !== undefined && v !== null && v !== "");
  const name = pick("name","title","channel_name","channelName","channel","label","station","display_name","t","contentName","event_name","team_name");
  const id = pick("id","channel_id","channelId","content_id","cid","event_id","team_id","key");
  const explicitFolder = pick("folder","folder_name","category","group","section","directory");
  const rawUrl = pick("page_url","web_url","website","page","href","url","link","channel_url","watch_url");
  const safeUrl = typeof rawUrl === "string" && /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
  const isMediaFile = /\.(m3u8|mpd|mp4|ts)(\?|$)/i.test(safeUrl);
  const folder = explicitFolder ? String(explicitFolder) : folderPath.filter(Boolean).join(" / ");

  if (name || id || safeUrl) {
    out.push({
      name: String(name || id || safeUrl),
      id: id == null ? "" : String(id),
      folder,
      url: safeUrl && !isMediaFile ? safeUrl : "",
      source
    });
  }

  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === "object") {
      const nextPath = Array.isArray(value) ? folderPath : [...folderPath, key];
      collectRecords(value, out, source, depth + 1, nextPath);
    }
  }
}

async function loadAllData() {
  const results = await Promise.all(DATA_FEEDS.map(async feed => {
    try {
      const response = await fetch(feed.url, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return { feed: feed.key, data: await response.json(), ok: true };
    } catch (error) {
      console.error("CRICZONE feed failed", feed.key, error);
      return { feed: feed.key, data: null, ok: false };
    }
  }));

  const records = [];
  for (const result of results) {
    if (result.ok) collectRecords(result.data, records, result.feed);
  }
  const seen = new Set();
  const unique = records.filter(item => {
    const key = normalize(item.name) + "|" + item.id + "|" + item.source;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { feeds: results.map(x => ({ name: x.feed, ok: x.ok })), records: unique };
}

function findMatches(records, query) {
  const q = normalize(query);
  if (!q) return [];
  let queryUrl = "";
  try { if (/^https?:\/\//i.test(String(query).trim())) queryUrl = new URL(String(query).trim()).href.toLowerCase(); } catch {}
  const terms = q.split(" ").filter(Boolean);
  const scored = records.map(item => {
    const n = normalize(item.name);
    const url = String(item.url || "").toLowerCase();
    let score = 0;
    if (queryUrl && (url === queryUrl || url.includes(queryUrl) || queryUrl.includes(url))) score = 150;
    else if (n === q) score = 120;
    else if (n.includes(q) || q.includes(n)) score = 85;
    else score = terms.reduce((sum, term) => sum + (n.includes(term) ? 20 : 0), 0);
    return { ...item, score };
  }).filter(item => item.score >= (queryUrl ? 100 : Math.max(20, terms.length * 15)));
  const unique = new Map();
  for (const item of scored.sort((x,y)=>y.score-x.score)) {
    const key = normalize(item.name) + "|" + (item.url || item.source);
    if (!unique.has(key)) unique.set(key,item);
  }
  return [...unique.values()].slice(0,8);
}

function firstName(message) {
  return message?.from?.first_name || message?.from?.username || "there";
}

async function handleText({ request, env, message }) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const userText = String(message.text || "").trim();
  if (!userId || !userText || message.from?.is_bot || message.chat.type === "private") return;

  await ensureTable(env.TELEGRAM_DB);
  const value = normalize(userText);
  const reply = (text) => send(env, chatId, text, message.message_id);

  if (/^\/(cancel|stop)(@\w+)?$/i.test(userText)) {
    await clearState(env.TELEGRAM_DB, chatId, userId);
    return reply("Cancelled.");
  }
  if (/^\/(start|ping)(@\w+)?$/i.test(userText)) {
    return reply("CRICZONE bot is online. Send a channel name, team name, or channel URL.");
  }

  const greeting = /^(hi|hello|hey|hii|good morning|good evening|gm)$/.test(value);
  if (greeting) return reply("Hello! Send a channel name, team name, or URL to find matching channel links.");

  const help = /\b(help|problem|issue|not working|error|buffer|black screen)\b/.test(value);
  if (help) return reply("Please describe the issue: channel not opening, buffering, or black screen.");

  let data;
  try { data = await loadAllData(); }
  catch (error) {
    console.error("CRICZONE data load error", error);
    return reply("Channel data is temporarily unavailable. Please try again shortly.");
  }

  const matches = findMatches(data.records, userText);
  if (matches.length) {
    const lines = matches.slice(0,5).map((item, i) => {
      const details = [];
      if (item.id) details.push("ID: " + item.id);
      if (item.folder) details.push("Folder: " + item.folder);
      if (item.source) details.push("Source: " + item.source);
      if (item.url) details.push(item.url);
      return (i + 1) + ". " + item.name + (details.length ? "\n" + details.join("\n") : "");
    });
    return reply("Matches found:\n" + lines.join("\n\n"));
  }

  if (/\b(schedule|fixture|score|result|vs|versus|playing|playing xi)\b/.test(value)) {
    return reply("No matching fixture found in the connected feeds. Try the full team or tournament name.");
  }
  return reply("No matching channel found. Try the full channel name or paste its URL.");
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
