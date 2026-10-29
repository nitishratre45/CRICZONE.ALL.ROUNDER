// POST /api/telegram/webhook
// Set Telegram webhook URL to https://criczone.pages.dev/api/telegram/webhook
// using BOT_TOKEN and secret_token=TELEGRAM_WEBHOOK_SECRET via Telegram setWebhook.
const CHANNEL = "@criczonelive";

export async function onRequestPost({ request, env }) {
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) {
    return json({ ok: false }, 503);
  }
  if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== await webhookSecret(env.BOT_TOKEN)) {
    return json({ ok: false }, 401);
  }
  let update;
  try { update = await request.json(); } catch { return json({ ok: false }, 400); }
  // Record channel membership changes when Telegram sends chat_member updates.
  const memberUpdate = update?.chat_member;
  if (memberUpdate && String(memberUpdate.chat?.username || "").toLowerCase() === "criczonelive") {
    const from = memberUpdate.new_chat_member?.user || memberUpdate.from;
    const oldStatus = String(memberUpdate.old_chat_member?.status || "");
    const newStatus = String(memberUpdate.new_chat_member?.status || "");
    const joined = ["member", "administrator", "creator"].includes(newStatus) || (newStatus === "restricted" && memberUpdate.new_chat_member?.is_member === true);
    const wasMember = ["member", "administrator", "creator"].includes(oldStatus) || (oldStatus === "restricted" && memberUpdate.old_chat_member?.is_member === true);
    try {
      await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_channel_activity (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL, first_name TEXT, last_name TEXT, username TEXT, event_type TEXT NOT NULL, event_at TEXT NOT NULL, old_status TEXT, new_status TEXT)").run();
      await env.TELEGRAM_DB.prepare("INSERT INTO telegram_channel_activity (telegram_id, first_name, last_name, username, event_type, event_at, old_status, new_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(String(from?.id || memberUpdate.new_chat_member?.user?.id || ""), String(from?.first_name || "").slice(0,80), String(from?.last_name || "").slice(0,80), String(from?.username || "").slice(0,80), joined && !wasMember ? "joined" : (!joined && wasMember ? "left" : "membership_changed"), new Date().toISOString(), oldStatus, newStatus).run();
    } catch (error) { console.error("Channel membership audit write failed:", error?.message || error); }

    // Route website sign-ins back to the website after a new channel join.
    // Only ordinary Telegram users should receive the category menu here.
    if (joined && !wasMember && from?.id) {
      try {
        const websiteLogin = await env.TELEGRAM_DB.prepare(
          "SELECT nonce, return_url FROM telegram_login_requests WHERE telegram_id = ? AND status IN ('pending','not_member') AND expires_at > ? AND return_url IS NOT NULL AND return_url != '' ORDER BY created_at DESC LIMIT 1"
        ).bind(String(from.id), Date.now()).first();

        if (websiteLogin?.nonce && websiteLogin.return_url) {
          await env.TELEGRAM_DB.prepare(
            "UPDATE telegram_login_requests SET status = 'verified', telegram_id = ?, updated_at = ? WHERE nonce = ? AND status IN ('pending','not_member') AND expires_at > ?"
          ).bind(String(from.id), Date.now(), websiteLogin.nonce, Date.now()).run();

          await sendMessage(env.BOT_TOKEN, from.id,
            "✅ Membership verified! Your CRICZONE website access is ready. Tap below to return to the website.",
            { inline_keyboard: [[{
              text: "↩️ Return to the website",
              url: addLoginNonce(websiteLogin.return_url, websiteLogin.nonce)
            }]] }
          );
        } else {
          // Normal channel joiners keep the existing category-menu experience.
          await createCategorySession(env, from.id);
          await sendCategoryMenu(env.BOT_TOKEN, from.id, env);
        }
      } catch (error) {
        console.error("Auto-routing after channel join failed:", error?.message || error);
      }
    }
    return json({ ok: true });
  }

  const callback = update?.callback_query;
  if (callback?.id) {
    const callbackData = String(callback.data || "");
    if (callbackData === "back:categories" && callback.from?.id && callback.message?.chat?.id) {
      const userId = callback.from.id;
      const chatId = callback.message.chat.id;
      try {
        await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/answerCallbackQuery", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callback.id, text: "Opening categories…" })
        });
        const session = await env.TELEGRAM_DB.prepare("SELECT expires_at FROM telegram_category_sessions WHERE telegram_id = ?").bind(String(userId)).first();
        if (!session || Number(session.expires_at) <= Date.now()) {
          await sendMessage(env.BOT_TOKEN, chatId, "Your CRICZONE bot session expired. Send /start to verify again.");
        } else {
          await sendCategoryMenu(env.BOT_TOKEN, chatId, env);
        }
      } catch (error) {
        console.error("Telegram category back navigation failed:", error?.message || error);
        await sendMessage(env.BOT_TOKEN, chatId, "Categories load nahi ho paayi. Please try again.");
      }
      return json({ ok: true });
    }
    const categoryMatch = callbackData.match(/^category:([a-z0-9]+(?:-[a-z0-9]+)*)$/);
    if (categoryMatch && callback.from?.id && callback.message?.chat?.id) {
      const userId = callback.from.id;
      const chatId = callback.message.chat.id;
      const category = categoryMatch[1];
      try {
        await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/answerCallbackQuery", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callback.id, text: "Checking your membership…" })
        });
        const check = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getChatMember", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: CHANNEL, user_id: Number(userId) })
        });
        const data = await check.json();
        const s = data?.result?.status;
        const member = check.ok && data.ok && data.result &&
          (["creator", "administrator", "member"].includes(s) || (s === "restricted" && data.result.is_member === true));
        if (!member) {
          await env.TELEGRAM_DB.prepare("DELETE FROM telegram_category_sessions WHERE telegram_id = ?").bind(String(userId)).run();
          await sendMessage(env.BOT_TOKEN, chatId, "Membership is not active. Join @criczonelive and use /start to verify again.");
          return json({ ok: true });
        }
        const session = await env.TELEGRAM_DB.prepare("SELECT expires_at FROM telegram_category_sessions WHERE telegram_id = ?").bind(String(userId)).first();
        if (!session || Number(session.expires_at) <= Date.now()) {
          await sendMessage(env.BOT_TOKEN, chatId, "Your CRICZONE bot session expired. Send /start to verify again.");
          return json({ ok: true });
        }
        const categoryInfo = await env.TELEGRAM_DB.prepare("SELECT name, emoji FROM telegram_categories WHERE slug = ?").bind(category).first();
        if (!categoryInfo) {
          await sendMessage(env.BOT_TOKEN, chatId, "This category is no longer available. Send /start to see the current categories.");
          return json({ ok: true });
        }
        const rows = await env.TELEGRAM_DB.prepare("SELECT channel_name, url FROM telegram_category_links WHERE category = ? ORDER BY channel_name").bind(category).all();
        const links = rows.results || [];
        if (!links.length) {
          await sendMessage(env.BOT_TOKEN, chatId, categoryInfo.name + " ke links abhi Admin Page se add nahi kiye gaye.");
        } else {
          await sendMessage(env.BOT_TOKEN, chatId, "✅ Verified member · " + categoryInfo.name + "\nAapke selected category ke links:", {
            inline_keyboard: [
              ...(await Promise.all(links.map(async item => [{ text: String(item.channel_name).slice(0, 60), url: await createChannelAccessUrl(env.BOT_TOKEN, userId, Number(session.expires_at), item.url) }]))),
              [{ text: "⬅️ Back to Categories", callback_data: "back:categories" }]
            ]
          });
        }
      } catch (error) {
        console.error("Telegram category request failed:", error?.message || error);
        await sendMessage(env.BOT_TOKEN, chatId, "Membership check ya links load nahi ho paaye. Thodi der baad try karein.");
      }
      return json({ ok: true });
    }
    const verifyMatch = callbackData.match(/^verify_join:([a-f0-9-]{36})$/i);
    try {
      await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/answerCallbackQuery", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callback.id, text: "Checking channel membership…" })
      });
    } catch {}
    if (verifyMatch && callback.from?.id && callback.message?.chat?.id) {
      const nonce = verifyMatch[1];
      const chatId = callback.message.chat.id;
      const userId = callback.from.id;
      try {
        const pending = await env.TELEGRAM_DB.prepare(
          "SELECT nonce, status, telegram_id, return_url FROM telegram_login_requests WHERE nonce = ? AND expires_at > ?"
        ).bind(nonce, Date.now()).first();
        if (!pending) {
          await sendMessage(env.BOT_TOKEN, chatId, "This sign-in link expired. Return to CRICZONE and tap Continue with Telegram Bot again.");
          return json({ ok: true });
        }
        // The channel-join event may already have verified this website login and
        // sent the return button. Make repeated taps safe instead of saying expired.
        if (pending.status === "verified" && pending.return_url && String(pending.telegram_id) === String(userId)) {
          await sendMessage(env.BOT_TOKEN, chatId, "✅ Membership already verified. Return to your CRICZONE website:", {
            inline_keyboard: [[{ text: "↩️ Return to the website", url: addLoginNonce(pending.return_url, nonce) }]]
          });
          return json({ ok: true });
        }
        if (!["pending", "not_member"].includes(pending.status)) {
          await sendMessage(env.BOT_TOKEN, chatId, "This sign-in request is no longer active. Return to CRICZONE and try again.");
          return json({ ok: true });
        }
        const memberResponse = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getChatMember", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: CHANNEL, user_id: Number(userId) })
        });
        const memberData = await memberResponse.json();
        if (!memberResponse.ok || !memberData.ok || !memberData.result) {
          await sendMessage(env.BOT_TOKEN, chatId, "I couldn't check membership right now. Please tap Verify membership again in a moment.");
          return json({ ok: true });
        }
        const memberStatus = memberData.result.status;
        const isMember = ["creator", "administrator", "member"].includes(memberStatus) ||
          (memberStatus === "restricted" && memberData.result.is_member === true);
        if (!isMember) {
          await sendMessage(env.BOT_TOKEN, chatId, "I still can't see that you've joined @criczonelive. Join the channel first, then tap “I've Joined — Verify” below.", {
            inline_keyboard: [
              [{ text: "📢 Join @criczonelive", url: "https://t.me/criczonelive" }],
              [{ text: "✅ I've Joined — Verify", callback_data: "verify_join:" + nonce }]
            ]
          });
          return json({ ok: true });
        }
        await env.TELEGRAM_DB.prepare(
          "UPDATE telegram_login_requests SET status = 'verified', telegram_id = ?, updated_at = ? WHERE nonce = ? AND status IN ('pending','not_member')"
        ).bind(String(userId), Date.now(), nonce).run();
        if (!pending.return_url) {
          await createCategorySession(env, userId);
          await sendCategoryMenu(env.BOT_TOKEN, chatId, env);
        } else {
          await sendMessage(env.BOT_TOKEN, chatId, "Membership verified ✅ Return to CRICZONE; the website will unlock automatically.", {
            inline_keyboard: [[{ text: "↩️ Return to the website", url: addLoginNonce(pending.return_url, nonce) }]]
          });
        }
      } catch (error) {
        console.error("Telegram join verification callback failed:", error?.message || error);
        await sendMessage(env.BOT_TOKEN, chatId, "Verification couldn't finish right now. Please try again.");
      }
    }
    return json({ ok: true });
  }

  const message = update?.message;
  const chatId = message?.chat?.id;
  const from = message?.from;
  const userId = from?.id;
  const text = String(message?.text || "");
  if (!chatId || !userId) return json({ ok: true });

  // Save every /start event, even when it was not launched from the website.
  const startMatch = text.match(/^\/start(?:\s+(.+))?$/i);
  if (startMatch && !startMatch[1] && env.TELEGRAM_DB) {
    try {
      await env.TELEGRAM_DB.prepare(
        "INSERT INTO telegram_bot_starts (telegram_id, first_name, last_name, username, language_code, start_payload, started_at, chat_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        String(userId),
        String(from.first_name || "").slice(0, 80),
        String(from.last_name || "").slice(0, 80),
        String(from.username || "").slice(0, 80),
        String(from.language_code || "").slice(0, 20),
        String(startMatch[1] || "").slice(0, 100),
        new Date().toISOString(),
        String(message.chat.type || "").slice(0, 30)
      ).run();
    } catch (error) {
      console.error("Telegram bot-start audit write failed:", error?.message || error);
    }
  }

  const match = text.match(/^\/start\s+([a-f0-9-]{36})$/i);
  if (!match) {
    if (startMatch && !startMatch[1]) {
      try {
        await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_channel_click_tokens (token TEXT PRIMARY KEY, telegram_id TEXT NOT NULL, first_name TEXT, last_name TEXT, username TEXT, created_at TEXT NOT NULL, clicked_at TEXT)").run();
        await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_category_sessions (telegram_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)").run();
        await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_category_links (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, channel_name TEXT NOT NULL, url TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
        const token = crypto.randomUUID();
        await env.TELEGRAM_DB.prepare("INSERT INTO telegram_channel_click_tokens (token, telegram_id, first_name, last_name, username, created_at, clicked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)").bind(token, String(userId), String(from.first_name || "").slice(0,80), String(from.last_name || "").slice(0,80), String(from.username || "").slice(0,80), new Date().toISOString()).run();
        const check = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getChatMember", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: CHANNEL, user_id: Number(userId) })
        });
        const data = await check.json();
        const s = data?.result?.status;
        const member = check.ok && data.ok && data.result &&
          (["creator", "administrator", "member"].includes(s) || (s === "restricted" && data.result.is_member === true));
        if (member) {
          await createCategorySession(env, userId);
          await sendCategoryMenu(env.BOT_TOKEN, chatId, env);
        } else {
          const nonce = crypto.randomUUID();
          const now = Date.now();
          await env.TELEGRAM_DB.prepare("INSERT INTO telegram_login_requests (nonce, status, telegram_id, created_at, updated_at, expires_at, return_url) VALUES (?, 'not_member', ?, ?, ?, ?, NULL)").bind(nonce, String(userId), now, now, now + 10 * 60 * 1000).run();
          await sendMessage(env.BOT_TOKEN, chatId, "Welcome to CRICZONE! Join @criczonelive, then tap Verify membership. Once verified, you'll get the four channel categories.", {
            inline_keyboard: [
              [{ text: "📢 Join @criczonelive", url: "https://t.me/criczonelive" }],
              [{ text: "✅ Verify membership", callback_data: "verify_join:" + nonce }]
            ]
          });
        }
      } catch (error) { console.error("Telegram ordinary start failed:", error?.message || error); await sendMessage(env.BOT_TOKEN, chatId, "CRICZONE verification is temporarily unavailable. Please try /start again."); }
    }
    return json({ ok: true });
  }
  const nonce = match[1];
  try {
    const pending = await env.TELEGRAM_DB.prepare(
      "SELECT nonce, return_url FROM telegram_login_requests WHERE nonce = ? AND status = 'pending' AND expires_at > ?"
    ).bind(nonce, Date.now()).first();
    if (!pending) {
      await sendMessage(env.BOT_TOKEN, chatId, "This sign-in link expired. Return to CRICZONE and try again.");
      return json({ ok: true });
    }

    const response = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getChatMember", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHANNEL, user_id: Number(userId) })
    });
    const data = await response.json();
    if (!response.ok || !data.ok || !data.result) {
      await sendMessage(env.BOT_TOKEN, chatId, "I couldn't check your channel membership. Please try again in CRICZONE.");
      return json({ ok: true });
    }
    const status = data.result.status;
    const member = ["creator", "administrator", "member"].includes(status) ||
      (status === "restricted" && data.result.is_member === true);
    if (!member) {
      await env.TELEGRAM_DB.prepare(
        "UPDATE telegram_login_requests SET status = 'not_member', telegram_id = ?, updated_at = ? WHERE nonce = ? AND status = 'pending'"
      ).bind(String(userId), Date.now(), nonce).run();
      await sendMessage(env.BOT_TOKEN, chatId, "Please join @criczonelive first. After joining, tap “I've Joined — Verify” below; I'll check your membership and send you back to CRICZONE.", {
        inline_keyboard: [
          [{ text: "📢 Join @criczonelive", url: "https://t.me/criczonelive" }],
          [{ text: "✅ I've Joined — Verify", callback_data: "verify_join:" + nonce }]
        ]
      });
      return json({ ok: true });
    }
    await env.TELEGRAM_DB.prepare(
      "UPDATE telegram_login_requests SET status = 'verified', telegram_id = ?, updated_at = ? WHERE nonce = ? AND status = 'pending'"
    ).bind(String(userId), Date.now(), nonce).run();
    // Store successful membership verification for the private admin's verified-member list.
    await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_verified_members (telegram_id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, username TEXT, verified_at TEXT NOT NULL, channel_status TEXT NOT NULL, return_url TEXT)").run();
    await env.TELEGRAM_DB.prepare("INSERT INTO telegram_verified_members (telegram_id, first_name, last_name, username, verified_at, channel_status, return_url) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET first_name=excluded.first_name, last_name=excluded.last_name, username=excluded.username, verified_at=excluded.verified_at, channel_status=excluded.channel_status, return_url=excluded.return_url").bind(String(userId), String(from.first_name || "").slice(0,80), String(from.last_name || "").slice(0,80), String(from.username || "").slice(0,80), new Date().toISOString(), String(status), pending.return_url || "").run();
    await sendMessage(env.BOT_TOKEN, chatId, "Membership verified ✅ Return to CRICZONE; your player access will unlock automatically.", pending.return_url ? { inline_keyboard: [[{ text: "↩️ Return to the website", url: pending.return_url }]] } : undefined);
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 500);
  }
}

async function createChannelAccessUrl(token, userId, sessionExpiresAt, targetValue) {
  try {
    const target = new URL(String(targetValue));
    if (target.protocol !== "https:" || !["criczone.pages.dev", "criczone.online", "www.criczone.online"].includes(target.hostname.toLowerCase())) {
      return targetValue;
    }
    const now = Math.floor(Date.now() / 1000);
    const expires = Math.min(Math.floor(Number(sessionExpiresAt) / 1000), now + 10 * 60);
    if (!Number.isFinite(expires) || expires <= now) return targetValue;
    const canonical = String(userId) + "\n" + String(expires) + "\n" + target.href;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical)));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const signature = btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const bridge = new URL("https://criczone.pages.dev/api/telegram/open");
    bridge.searchParams.set("uid", String(userId));
    bridge.searchParams.set("exp", String(expires));
    bridge.searchParams.set("target", target.href);
    bridge.searchParams.set("sig", signature);
    return bridge.href;
  } catch {
    return targetValue;
  }
}

async function createCategorySession(env, userId) {
  await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_category_sessions (telegram_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)").run();
  const now = Date.now();
  await env.TELEGRAM_DB.prepare("INSERT INTO telegram_category_sessions (telegram_id, created_at, expires_at) VALUES (?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET created_at=excluded.created_at, expires_at=excluded.expires_at").bind(String(userId), now, now + 12 * 60 * 60 * 1000).run();
}
async function sendCategoryMenu(token, chatId, env) {
  await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_categories (slug TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '📁', created_at TEXT NOT NULL)").run();
  const result = await env.TELEGRAM_DB.prepare("SELECT slug,name,emoji FROM telegram_categories ORDER BY name COLLATE NOCASE").all();
  let categories = result.results || [];
  if (!categories.length) categories = [
    {slug:"sony",name:"Sony",emoji:"📺"},{slug:"fancode",name:"FanCode",emoji:"🏏"},
    {slug:"star-sports",name:"Star Sports",emoji:"⭐"},{slug:"willow",name:"Willow",emoji:"🇺🇸"}
  ];
  const buttons = [];
  for (let i=0;i<categories.length;i+=2) buttons.push(categories.slice(i,i+2).map(c=>({text:(c.emoji||"📁")+" "+c.name,callback_data:"category:"+c.slug})));
  await sendMessage(token, chatId, "✅ MEMBERSHIP VERIFIED\n\n🎉 Your CRICZONE access is active for the next 12 hours.\n\n👇 Select your preferred channel category below:", {inline_keyboard:buttons});
}
async function sendMessage(token, chatId, text, replyMarkup) {
  await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) })
  });
}
function addLoginNonce(returnUrl, nonce) {
  try {
    const url = new URL(returnUrl);
    url.searchParams.set("cz_tg_login_nonce", nonce);
    return url.href;
  } catch {
    return returnUrl;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"
  }});
}

async function webhookSecret(token) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("criczone-telegram-webhook-v1:" + token)));
  let binary = ""; for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
