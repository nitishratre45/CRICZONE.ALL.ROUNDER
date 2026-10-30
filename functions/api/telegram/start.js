// POST /api/telegram/start - create a short-lived Telegram bot sign-in challenge.
async function handlePost({ request, env }) {
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) {
    return json({ ok: false, error: "Telegram sign-in is not configured yet." }, 503);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON request body." }, 400);
    }

    let returnUrl = "";
    try {
      const candidate = new URL(String(body?.return_url || ""));
      const currentOrigin = new URL(request.url).origin;
      if (candidate.protocol === "https:" && candidate.origin === currentOrigin) {
        returnUrl = candidate.href.slice(0, 1500);
      }
    } catch {}

    // Ensure the challenge table exists before applying the backwards-compatible migration.
    // This makes a fresh D1 database usable without requiring a manual SQL bootstrap.
    await env.TELEGRAM_DB.prepare(
      "CREATE TABLE IF NOT EXISTS telegram_login_requests (nonce TEXT PRIMARY KEY, status TEXT NOT NULL, telegram_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, return_url TEXT)"
    ).run();

    // Older installations may predate return_url. Ignore only the duplicate-column case.
    try {
      await env.TELEGRAM_DB.prepare("ALTER TABLE telegram_login_requests ADD COLUMN return_url TEXT").run();
    } catch (schemaError) {
      if (!String(schemaError?.message || schemaError).toLowerCase().includes("duplicate column")) {
        throw schemaError;
      }
    }

    const webhookSecret = await deriveWebhookSecret(env.BOT_TOKEN);
    const hook = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/setWebhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://criczone.pages.dev/api/telegram/webhook",
        secret_token: webhookSecret,
        allowed_updates: ["message", "chat_member", "callback_query"],
        drop_pending_updates: false
      })
    });
    const hookResult = await hook.json();
    if (!hook.ok || !hookResult.ok) {
      console.error("Telegram setWebhook failed:", hookResult.description || hook.status);
      return json({ ok: false, error: "Could not connect the Telegram bot. Check the bot token and webhook configuration." }, 503);
    }

    const nonce = crypto.randomUUID();
    const now = Date.now();
    // Prune expired challenges; verified rows remain available only until their 5-minute expiry.
    await env.TELEGRAM_DB.prepare("DELETE FROM telegram_login_requests WHERE expires_at <= ?").bind(now).run();
    await env.TELEGRAM_DB.prepare(
      "INSERT INTO telegram_login_requests (nonce, status, telegram_id, created_at, updated_at, expires_at, return_url) VALUES (?, 'pending', NULL, ?, ?, ?, ?)"
    ).bind(nonce, now, now, now + 5 * 60 * 1000, returnUrl || null).run();

    return json({
      ok: true,
      nonce,
      bot_url: "https://t.me/CRICZONE_ADMIN_BOT?start=" + nonce,
      expires_in: 300
    });
  } catch (error) {
    console.error("Telegram sign-in start failed:", error?.message || error);
    return json({ ok: false, error: "Could not start Telegram sign-in. Check the bot token and database configuration." }, 503);
  }
}

async function deriveWebhookSecret(token) {
  const bytes = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("criczone-telegram-webhook-v1:" + token)
  ));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

// Use the method-specific Pages handler so POST routing is explicit.
export async function onRequestPost(context) {
  return handlePost(context);
}

// Keep accidental GET requests explicit and JSON-formatted.
export async function onRequestGet() {
  return json({ ok: false, error: "Use POST to start Telegram sign-in." }, 405);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Allow": "POST, OPTIONS",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store"
    }
  });
}
