const CHANNEL = "@criczonelive";
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
async function expectedSecret(token) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))); }
async function tg(token, method, data) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const d = await r.json(); if (!r.ok || !d.ok) throw new Error(d.description || "Telegram API error"); return d.result;
}
export async function onRequestPost({ request, env }) {
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) return json({ ok: false }, 500);
  const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  if (supplied !== await expectedSecret(env.BOT_TOKEN)) return json({ error: "Unauthorized" }, 401);
  let update; try { update = await request.json(); } catch { return json({ error: "Bad update" }, 400); }
  const msg = update.message; if (!msg?.text || !msg.from?.id || !msg.chat?.id) return json({ ok: true });
  const text = msg.text.trim();
  const command = text.split(/\s+/)[0].split("@")[0].toLowerCase();
  const match = text.match(/^\/start\s+([a-f0-9]{32})$/i);

  // Normal chat commands and messages should always receive a helpful reply.
  if (!match) {
    let reply;
    if (command === "/start") {
      reply = "👋 Welcome to CRICZONE!\\n\\nMain CRICZONE assistant hoon. Aap normal message bhej sakte hain.\\n\\nCommands:\\n/start - Start bot\\n/help - Help\\n/channel - Telegram channel link\\n/verify - Website membership verification ka tarika";
    } else if (command === "/help") {
      reply = "ℹ️ CRICZONE Bot Help\\n\\n• /channel — Official Telegram channel\\n• /verify — Website par 12-hour membership unlock kaise karein\\n• Website unlock ke liye CRICZONE page par Continue with Telegram Bot dabayein.\\n\\nAap apna sawal normal chat mein bhi bhej sakte hain.";
    } else if (command === "/channel") {
      reply = "📢 Official CRICZONE channel: https://t.me/criczonelive";
    } else if (command === "/verify") {
      reply = "🔐 Membership verify karne ke liye CRICZONE website kholiye, popup mein Join @criczonelive dabaiye, channel join kijiye, phir Continue with Telegram Bot dabaiye.";
    } else {
      reply = "💬 Aapka message mil gaya!\\n\\nCRICZONE Bot active hai. Website membership unlock ke liye /verify bhejein, channel link ke liye /channel, ya help ke liye /help bhejein.";
    }
    await tg(env.BOT_TOKEN, "sendChatAction", { chat_id: msg.chat.id, action: "typing" }).catch(() => {});
    await tg(env.BOT_TOKEN, "sendMessage", { chat_id: msg.chat.id, text: reply, disable_web_page_preview: true });
    return json({ ok: true, handled: "normal_message" });
  }
  const nonce = match[1];
  const row = await env.TELEGRAM_DB.prepare("SELECT nonce, return_url, expires_at, status FROM telegram_login_requests WHERE nonce = ?").bind(nonce).first();
  const now = Math.floor(Date.now() / 1000);
  if (!row || row.expires_at < now) {
    await tg(env.BOT_TOKEN, "sendMessage", { chat_id: msg.chat.id, text: "Login link expire ho gaya hai. Website par wapas jaakar dobara Continue karein." }); return json({ ok: true });
  }
  let member = false;
  try {
    const info = await tg(env.BOT_TOKEN, "getChatMember", { chat_id: CHANNEL, user_id: msg.from.id });
    member = ["member", "administrator", "creator"].includes(info.status) || (info.status === "restricted" && info.is_member === true);
  } catch (e) { console.error("getChatMember failed", e); }
  if (!member) {
    await tg(env.BOT_TOKEN, "sendMessage", { chat_id: msg.chat.id, text: "❌ Aap @criczonelive channel ke member nahi hain. Pehle channel join karein, phir neeche Verify Membership button dabayein.", reply_markup: { inline_keyboard: [[{ text: "Join @criczonelive", url: "https://t.me/criczonelive" }], [{ text: "Verify Membership", url: `https://t.me/CRICZONE_ADMIN_BOT?start=${nonce}` }]] } });
    return json({ ok: true });
  }
  await env.TELEGRAM_DB.prepare("UPDATE telegram_login_requests SET status='verified', telegram_user_id=?, verified_at=? WHERE nonce=?").bind(String(msg.from.id), now, nonce).run();
  const returnLink = `${new URL(request.url).origin}/api/telegram/complete?nonce=${encodeURIComponent(nonce)}`;
  await tg(env.BOT_TOKEN, "sendMessage", { chat_id: msg.chat.id, text: "✅ Membership verified! Neeche button dabakar apni CRICZONE website par wapas jaiye. 12 ghante ka unlock activate ho jayega.", reply_markup: { inline_keyboard: [[{ text: "Return to CRICZONE", url: returnLink }]] } });
  return json({ ok: true });
}
export function onRequestGet() { return json({ error: "Method not allowed" }, 405); }
