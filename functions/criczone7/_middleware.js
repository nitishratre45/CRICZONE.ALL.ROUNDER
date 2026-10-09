const COOKIE_NAME = "cz7_auth";
const encoder = new TextEncoder();

async function sign(secret) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode("criczone7-access-v1"));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function cookieValue(request, name) {
  const header = request.headers.get("Cookie") || "";
  const part = header.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return part ? part.slice(name.length + 1) : "";
}

function loginPage(message = "") {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>CricZone7 Login</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 20% 10%,#10313a,#050b10 48%,#000);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#fff}.card{width:min(100%,390px);padding:30px 26px;border:1px solid #00d9ff44;border-radius:22px;background:#071118f2;box-shadow:0 25px 80px #0009;text-align:center}.logo{font-size:25px;font-weight:950;letter-spacing:1px;margin-bottom:8px}.logo span{color:#00d9ff}p{color:#a9bac4;font-size:14px;margin:0 0 22px}input{width:100%;height:48px;padding:0 14px;border-radius:12px;border:1px solid #28424c;background:#02080c;color:#fff;font-size:16px;outline:none}input:focus{border-color:#00d9ff;box-shadow:0 0 0 3px #00d9d922}button{width:100%;height:48px;margin-top:13px;border:0;border-radius:12px;background:linear-gradient(135deg,#00d9ff,#008cff);color:#001018;font-size:15px;font-weight:900;cursor:pointer}.error{min-height:20px;margin-top:12px;color:#ff8181;font-size:13px}</style></head><body><form class="card" method="post" action="/api/criczone7-login"><div class="logo">CRIC<span>ZONE</span></div><p>Enter the password to access the player</p><input name="password" type="password" placeholder="Enter password" autocomplete="current-password" required autofocus><button type="submit">Unlock Player</button><div class="error" role="status">${message}</div></form></body></html>`, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" }
  });
}

export async function onRequest({ request, env, next }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  if (!env.CRICZONE7_PASSWORD || !env.CRICZONE7_SECRET) {
    return new Response("CricZone7 protection is not configured. Set CRICZONE7_PASSWORD and CRICZONE7_SECRET in Cloudflare Pages settings.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
  const expected = await sign(env.CRICZONE7_SECRET);
  if (cookieValue(request, COOKIE_NAME) !== expected) return loginPage();
  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
