// POST /api/admin/session: exchange the admin key for a 24-hour HttpOnly session cookie.
// GET validates the existing session; DELETE logs out.
const COOKIE = "cz_admin_session";
const MAX_AGE = 24 * 60 * 60;
export async function onRequest({ request, env }) {
  const secret = env.ADMIN_DASHBOARD_KEY;
  if (!secret) return json({ ok:false, error:"Admin key is not configured in Production." }, 503);
  if (request.method === "POST") {
    let body; try { body = await request.json(); } catch { return json({ok:false,error:"Invalid request."},400); }
    if (!safeEqual(String(body?.key || ""), secret)) return json({ok:false,error:"Unauthorized. Check the Production admin key."},401);
    const exp = String(Math.floor(Date.now()/1000) + MAX_AGE);
    const signature = await sign(secret, exp);
    return new Response(JSON.stringify({ok:true,expires_at:Number(exp)}), {status:200,headers:{
      "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
      "Set-Cookie": COOKIE+"="+exp+"."+signature+"; Max-Age="+MAX_AGE+"; Path=/api/admin; Secure; HttpOnly; SameSite=Strict"
    }});
  }
  if (request.method === "DELETE") return new Response(JSON.stringify({ok:true}), {status:200,headers:{
    "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
    "Set-Cookie":COOKIE+"=; Max-Age=0; Path=/api/admin; Secure; HttpOnly; SameSite=Strict"
  }});
  if (request.method === "GET") {
    const valid = await validSession(request, secret);
    return json({ok:valid, expires_in: valid ? MAX_AGE : 0}, valid ? 200 : 401);
  }
  return json({ok:false,error:"Method not allowed."},405);
}
export async function validSession(request, secret) {
  const cookie = (request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="));
  if (!cookie) return false;
  const token = cookie.slice(COOKIE.length+1);
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0,dot), sig = token.slice(dot+1), expires = Number(exp);
  if (!/^\d{10}$/.test(exp) || !Number.isFinite(expires) || expires <= Math.floor(Date.now()/1000)) return false;
  return safeEqual(sig, await sign(secret, exp));
}
async function sign(secret, exp) {
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode("criczone-admin-session-v1:"+exp)));
  let binary=""; for(const b of bytes) binary+=String.fromCharCode(b);
  return btoa(binary).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
function safeEqual(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
