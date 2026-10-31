const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
export async function onRequestGet({request,env}){
 const key=env.ADMIN_DASHBOARD_KEY||env.TELEGRAM_ADMIN_KEY;
 if(!key||request.headers.get("X-Admin-Key")!==key)return json({error:"Unauthorized"},401);
 if(!env.TELEGRAM_DB)return json({error:"TELEGRAM_DB is not configured"},503);
 try{
  const db=env.TELEGRAM_DB;
  const totals=await db.prepare("SELECT COUNT(DISTINCT telegram_user_id) AS verified_members, COUNT(*) AS successful_verifications, MAX(verified_at) AS last_verified_at FROM telegram_login_requests WHERE telegram_user_id IS NOT NULL AND verified_at IS NOT NULL AND status IN ('verified','completed')").first();
  return json({ok:true,verified_members:Number(totals?.verified_members||0),successful_verifications:Number(totals?.successful_verifications||0),last_verified_at:totals?.last_verified_at||null});
 }catch(error){console.error("Telegram verification stats failed",error);return json({error:"Could not load verification statistics"},500)}
}
export function onRequestPost(){return json({error:"Method not allowed"},405)}
