const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
export async function onRequestGet({request,env}){
 const key=env.ADMIN_DASHBOARD_KEY||env.TELEGRAM_ADMIN_KEY;
 if(!key||request.headers.get("X-Admin-Key")!==key)return json({error:"Unauthorized"},401);
 if(!env.TELEGRAM_DB)return json({error:"TELEGRAM_DB is not configured"},503);
 try{
  const db=env.TELEGRAM_DB;
  for(const col of ["telegram_username TEXT","telegram_first_name TEXT","telegram_last_name TEXT"]){
   try{await db.prepare("ALTER TABLE telegram_login_requests ADD COLUMN "+col).run()}catch(e){if(!/duplicate column/i.test(String(e)))throw e}
  }
  const totals=await db.prepare("SELECT COUNT(DISTINCT telegram_user_id) AS verified_members,COUNT(*) AS successful_verifications,MAX(verified_at) AS last_verified_at FROM telegram_login_requests WHERE telegram_user_id IS NOT NULL AND verified_at IS NOT NULL AND status IN ('verified','completed')").first();
  let users=await db.prepare("SELECT telegram_user_id AS user_id,MAX(telegram_username) AS username,MAX(telegram_first_name) AS first_name,MAX(telegram_last_name) AS last_name,MAX(verified_at) AS verified_at,COUNT(*) AS verification_count FROM telegram_login_requests WHERE telegram_user_id IS NOT NULL AND verified_at IS NOT NULL AND status IN ('verified','completed') GROUP BY telegram_user_id ORDER BY MAX(verified_at) DESC LIMIT 500").all();
  let rows=users.results||[];
  // Backfill names for older verification records. Telegram's getChatMember response
  // includes the current public profile for users who are still accessible in the channel.
  if(env.BOT_TOKEN&&rows.length){
   const missing=rows.filter(u=>!u.first_name&&!u.username);
   for(let i=0;i<missing.length;i+=8){
    await Promise.all(missing.slice(i,i+8).map(async u=>{
     try{
      const response=await fetch("https://api.telegram.org/bot"+env.BOT_TOKEN+"/getChatMember",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:"@criczonelive",user_id:Number(u.user_id)})});
      const payload=await response.json(),profile=payload?.ok?payload.result?.user:null;
      if(!profile)return;
      u.username=profile.username||null;u.first_name=profile.first_name||null;u.last_name=profile.last_name||null;
      await db.prepare("UPDATE telegram_login_requests SET telegram_username=?,telegram_first_name=?,telegram_last_name=? WHERE telegram_user_id=?").bind(u.username,u.first_name,u.last_name,String(u.user_id)).run();
     }catch(error){console.error("Telegram profile backfill failed",u.user_id,error)}
    }));
   }
  }
  return json({ok:true,verified_members:Number(totals?.verified_members||0),successful_verifications:Number(totals?.successful_verifications||0),last_verified_at:totals?.last_verified_at||null,users:rows});
 }catch(error){console.error("Telegram verification stats failed",error);return json({error:"Could not load verification statistics"},500)}
}
export function onRequestPost(){return json({error:"Method not allowed"},405)}
