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
  { key: "sports", url: "https://sonujson-v7.pages.dev/Data/sports.json" },
  { key: "directory", url: "https://allrounder3-0.pages.dev/id.json" },
  { key: "jtv2", url: "https://cdn.jsdelivr.net/gh/sportlive18/jio-tv-auto-update-playlist@main/jtv2.json" },
  { key: "willow_v4", url: "https://sonujson-v4.pages.dev/Data/willow.json" },
  { key: "prime_v4", url: "https://sonujson-v4.pages.dev/Data/prime.json" },
  { key: "willow_v5", url: "https://sonujson-v5.pages.dev/Data/willow.json" },
  { key: "sony_star", url: "https://sportlink-tv11.pages.dev/Star3.json" }
];

function collectRecords(node, out, source, depth = 0) {
  if (depth > 10 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectRecords(item, out, source, depth + 1);
    return;
  }
  if (typeof node !== "object") return;

  const name = node.name || node.title || node.channel_name || node.channelName ||
    node.channel || node.label || node.station || node.display_name || node.t;
  const id = node.id || node.channel_id || node.channelId || node.content_id || node.cid;
  const pageUrl = node.page_url || node.web_url || node.website || node.page || node.href;
  const externalUrl = node.url || node.link || node.stream_url || node.streamUrl ||
    node.m3u8 || node.hls || node.dash || node.mp4 || pageUrl;
  const safePage = typeof pageUrl === "string" && /^https?:\/\//i.test(pageUrl) ? pageUrl : "";
  const safeExternal = typeof externalUrl === "string" && /^https?:\/\//i.test(externalUrl) ? externalUrl : "";

  if (name || id) {
    out.push({
      name: String(name || id),
      id: id == null ? "" : String(id),
      pageUrl: safePage,
      externalUrl: safeExternal,
      source
    });
  }

  for (const [key, value] of Object.entries(node)) {
    if (!["url","link","stream_url","streamUrl","m3u8","hls","dash","mp4","page_url","web_url","website","page","href"].includes(key)) {
      collectRecords(value, out, source, depth + 1);
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
  const terms = q.split(" ").filter(Boolean);
  return records
    .map(item => {
      const n = normalize(item.name);
      const score = (n === q ? 100 : n.includes(q) || q.includes(n) ? 60 :
        terms.filter(term => n.includes(term)).length * 15);
      return { ...item, score };
    })
    .filter(item => item.score >= Math.max(15, terms.length * 10))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}


function firstName(message) {
  return message?.from?.first_name || message?.from?.username || "there";
}

async function handleText({ request, env, message }) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const userText = String(message.text || "").trim();
  if (!userId || !userText || message.from?.is_bot) return;
  if (message.chat.type === "private") return;

  await ensureTable(env.TELEGRAM_DB);
  const state = await getState(env.TELEGRAM_DB, chatId, userId);
  const value = normalize(userText);
  const name = firstName(message);
  const reply = (text) => send(env, chatId, text, message.message_id);

  if (/^\/(cancel|stop)(@\w+)?$/i.test(userText)) {
    await clearState(env.TELEGRAM_DB, chatId, userId);
    return reply("Theek hai! Request cancel kar di. Jab help chahiye, bas message karna. 🏏");
  }

  if (/^\/(start|ping)(@\w+)?$/i.test(userText)) {
    return reply("🤖 CRICZONE BOT online hai!\n\nLive channel, match schedule ya technical help chahiye? Apni requirement likho. Hindi / English dono supported hain.");
  }

  if (state?.step === "need_topic") {
    await saveState(env.TELEGRAM_DB, chatId, userId, "need_provider", userText, "");
    return reply("Samajh gaya, " + name + "! Kis broadcaster/channel par dekhna chahte ho?\n\nSony Sports, Star Sports, Willow, FanCode ya koi aur?");
  }

  if (state?.step === "need_provider") {
    await saveState(env.TELEGRAM_DB, chatId, userId, "search_channel", state.topic || "", userText);
    let allData = { records: [], feeds: [] };
    try { allData = await loadAllData(); }
    catch (error) { console.error("CRICZONE feed lookup failed", error); }
    const matches = findMatches(allData.records, userText);
    await clearState(env.TELEGRAM_DB, chatId, userId);
    if (matches.length) {
      return reply("Ye matching channel pages mile hain:\n" + matches.map((item, i) => (i + 1) + ". " + item.name + "\n" + (item.pageUrl || "https://criczone.pages.dev/")).join("\n\n") + "\n\nAgar exact channel nahi mila, uska naam bhejo.");
    }
    return reply("Abhi directory mein \"" + userText + "\" ka exact match nahi mila. Channel ka poora naam ya spelling bhejo, main dobara check karne mein help karunga.\n\n🌐 CRICZONE Website: https://criczone.pages.dev/");
  }

  const asksChannel = /\b(channel|live|stream|link|watch|dekhna|dekhu|dikha|sony|star sports|willow|fancode|jio|match)\b/.test(value);
  const asksHelp = /\b(help|problem|issue|not working|nahi chal|error|buffer|black screen)\b/.test(value);
  const greeting = /^(hi|hello|hey|hii|namaste|good morning|good evening|gm|hlo)$/.test(value);

  if (greeting) return reply("Hello " + name + "! 👋 CRICZONE group mein welcome. Live channel, match info ya technical help chahiye?");
  if (asksHelp) {
    await saveState(env.TELEGRAM_DB, chatId, userId, "need_topic", "technical_help", "");
    return reply("Main help karta hoon. Kaunsi problem aa rahi hai?\n1. Channel open nahi ho raha\n2. Video load/buffer ho raha hai\n3. Black screen\n4. Dusri problem\n\nProblem detail likho. /cancel se cancel kar sakte ho.");
  }
  if (asksChannel) {
    await saveState(env.TELEGRAM_DB, chatId, userId, "need_topic", "live_channel", "");
    return reply("Zaroor! 🏏 Kaunsa match ya sport dekhna hai? Team ya tournament ka naam batao. Phir broadcaster/channel select karenge.");
  }
  if (/\b(schedule|fixture|kab hai|when|timing|time table)\b/.test(value)) {
    return reply("Kis team ya tournament ka schedule chahiye? Naam batao, main available CRICZONE information ke hisaab se guide karunga.");
  }
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
