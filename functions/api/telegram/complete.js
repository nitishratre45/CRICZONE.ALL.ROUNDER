const json = (data, status = 400) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
async function sign(value, token) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
export async function onRequestGet({ request, env }) {
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) return json({ error: "Server configuration missing" }, 500);
  const url = new URL(request.url), nonce = url.searchParams.get("nonce") || "";
  if (!/^[a-f0-9]{32}$/i.test(nonce)) return json({ error: "Invalid verification link" });
  const row = await env.TELEGRAM_DB.prepare("SELECT return_url,status,expires_at,telegram_user_id FROM telegram_login_requests WHERE nonce=?").bind(nonce).first();
  const now = Math.floor(Date.now() / 1000);
  if (!row || row.status !== "verified" || row.expires_at < now || !row.telegram_user_id) return json({ error: "Membership not verified or link expired. Return to website and try again." });
  const target = new URL(row.return_url);
  if (target.origin !== url.origin || target.protocol !== "https:") return json({ error: "Invalid return destination" });
  // Re-check membership at the exact moment the return link is redeemed.
  try {
    const check=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:"@criczonelive",user_id:Number(row.telegram_user_id)})});
    const result=await check.json();
    const stillMember=check.ok&&result.ok&&(["member","administrator","creator"].includes(result.result?.status)||(result.result?.status==="restricted"&&result.result?.is_member===true));
    if(!stillMember)return json({error:"Channel membership is no longer active. Rejoin and verify again."},403);
  } catch(error) { console.error("Membership check before return-link redemption failed",error); return json({error:"Membership verification is temporarily unavailable. Please retry."},503); }
  // Atomically consume the login nonce to prevent replay or double redemption.
  const claimed=await env.TELEGRAM_DB.prepare("UPDATE telegram_login_requests SET status='completed' WHERE nonce=? AND status='verified' AND expires_at>=?").bind(nonce,now).run();
  if((claimed.meta?.changes??0)!==1)return json({error:"This verification link has already been used or expired."},410);
  const expires = now + 12 * 60 * 60;
  const payload = btoa(JSON.stringify({ v: 1, uid: row.telegram_user_id, exp: expires, host: url.host })).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const cookieValue = `${payload}.${await sign(payload, env.BOT_TOKEN)}`;
  return new Response(null, { status: 302, headers: { "Location": target.href, "Set-Cookie": `__Host-cz_tg_session=${cookieValue}; Max-Age=43200; Path=/; HttpOnly; Secure; SameSite=Strict`, "Cache-Control": "no-store" } });
}
