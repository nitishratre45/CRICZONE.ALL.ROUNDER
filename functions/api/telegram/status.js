const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}});
async function sign(value,token){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(token),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));return btoa(String.fromCharCode(...new Uint8Array(sig))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")}
export async function onRequestGet({request,env}){
  if(!env.BOT_TOKEN||!env.TELEGRAM_DB)return json({verified:false,error:"Verification service is not configured"},503);
  const nonce=new URL(request.url).searchParams.get("nonce")||"";
  if(!/^[a-f0-9]{32}$/i.test(nonce))return json({verified:false,error:"Invalid login request"},400);
  const row=await env.TELEGRAM_DB.prepare("SELECT status,telegram_user_id,expires_at FROM telegram_login_requests WHERE nonce=?").bind(nonce).first();
  const now=Math.floor(Date.now()/1000);
  if(!row||row.expires_at<now)return json({verified:false,expired:true},410);
  if(row.status==="pending_member"&&row.telegram_user_id){
    try {
      const check=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:"@criczonelive",user_id:Number(row.telegram_user_id)})});
      const result=await check.json();
      const member=check.ok&&result.ok&&(["member","administrator","creator"].includes(result.result?.status)||(result.result?.status==="restricted"&&result.result?.is_member===true));
      if(member){
        await env.TELEGRAM_DB.prepare("UPDATE telegram_login_requests SET status='verified',verified_at=? WHERE nonce=? AND telegram_user_id=?").bind(now,nonce,String(row.telegram_user_id)).run();
        row.status="verified";
      }
    } catch(error) { console.error("Auto membership check failed",error); }
  }
  if(row.status!=="verified"||!row.telegram_user_id)return json({verified:false,pending:true});
  // Re-check Telegram membership immediately before issuing a browser session.
  try {
    const check=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:"@criczonelive",user_id:Number(row.telegram_user_id)})});
    const result=await check.json();
    const stillMember=check.ok&&result.ok&&(["member","administrator","creator"].includes(result.result?.status)||(result.result?.status==="restricted"&&result.result?.is_member===true));
    if(!stillMember)return json({verified:false,membership_valid:false},403,{"Set-Cookie":"__Host-cz_tg_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict"});
  } catch(error) { console.error("Final membership check before session issue failed",error); return json({verified:false,error:"Membership verification temporarily unavailable"},503); }
  const exp=now+12*60*60;
  const payload=btoa(JSON.stringify({v:1,uid:String(row.telegram_user_id),exp,host:new URL(request.url).host})).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
  const cookie=payload+"."+await sign(payload,env.BOT_TOKEN);
  return json({verified:true,expires_at:exp},200,{"Set-Cookie":`__Host-cz_tg_session=${cookie}; Max-Age=43200; Path=/; HttpOnly; Secure; SameSite=Strict`});
}
export function onRequestPost(){return json({error:"Method not allowed"},405)}
