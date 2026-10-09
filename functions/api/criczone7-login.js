const encoder = new TextEncoder();

async function sign(secret) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode("criczone7-access-v1"));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function loginPage(message) {
  const safe = String(message).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CricZone7 Login</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050b10;color:#fff;font-family:system-ui;padding:22px}.card{width:min(100%,390px);padding:28px;border:1px solid #00d9ff55;border-radius:20px;background:#071118;text-align:center}input,button{width:100%;height:48px;border-radius:10px;margin-top:12px;box-sizing:border-box}input{padding:12px;background:#02080c;border:1px solid #28424c;color:white;font-size:16px}button{border:0;background:linear-gradient(135deg,#00d9ff,#008cff);font-weight:900;cursor:pointer}.error{color:#ff8181}</style></head><body><form class="card" method="post" action="/api/criczone7-login"><h2>CRICZONE</h2><p>Enter the password to access the player</p><input name="password" type="password" placeholder="Enter password" required autofocus><button>Unlock Player</button><p class="error">${safe}</p></form></body></html>`, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function onRequestPost({ request, env }) {
  if (!env.CRICZONE7_PASSWORD || !env.CRICZONE7_SECRET) {
    return new Response("Authentication is not configured. Set CRICZONE7_PASSWORD and CRICZONE7_SECRET in Cloudflare Pages settings.", { status: 503 });
  }
  let form;
  try { form = await request.formData(); } catch { return loginPage("Invalid request."); }
  const supplied = String(form.get("password") || "");
  if (supplied.length > 200 || supplied !== env.CRICZONE7_PASSWORD) {
    return loginPage("Incorrect password. Please try again.");
  }
  const token = await sign(env.CRICZONE7_SECRET);
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/criczone7/",
      "Set-Cookie": `cz7_auth=${token}; Path=/criczone7; HttpOnly; Secure; SameSite=Strict`,
      "Cache-Control": "no-store"
    }
  });
}
