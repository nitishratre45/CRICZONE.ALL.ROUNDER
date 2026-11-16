const ORIGIN = "https://criczone.pages.dev";
let cache = null, cacheAt = 0, cleanupDay = -1;
const cors = {"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin"};
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, max-age=0",...cors}});}
function validId(value,min=8,max=128){return typeof value==="string"&&value.length>=min&&value.length<=max&&/^[A-Za-z0-9._:-]+$/.test(value);}
function liveTimeout(env){return Math.max(15,Number(env.LIVE_VISITOR_TIMEOUT)||75);}
function sessionTimeout(env){return Math.max(60,Number(env.SESSION_TIMEOUT)||1800);}
async function stats(env){
 const now=Date.now();if(cache&&now-cacheAt<15000)return cache;
 const cutoff=Math.floor(now/1000)-liveTimeout(env);
 const q=await env.DB.prepare("SELECT (SELECT total_visits FROM visitor_totals WHERE id=1) AS total_visits,(SELECT json_group_array(visitor_id) FROM visitor_sessions WHERE last_seen>=?) AS live_visitor_ids").bind(cutoff).run();
 const row=q.results?.[0]||{};let ids=[];try{ids=JSON.parse(row.live_visitor_ids||"[]");if(!Array.isArray(ids))ids=[];}catch{ids=[];}
 cache={total_visits:Number(row.total_visits||0),live_visitors:ids.length,live_visitor_ids:ids};cacheAt=now;return cache;
}
async function cleanup(env,now){
 const day=Math.floor(now/86400);
 if(now%86400>=30||day===cleanupDay)return;
 cleanupDay=day;
 try{await env.DB.batch([
  env.DB.prepare("DELETE FROM visitor_visit_events WHERE event_created_at<?").bind(now-172800),
  env.DB.prepare("DELETE FROM visitor_sessions WHERE last_seen<?").bind(now-86400),
  env.DB.prepare("DELETE FROM visitor_visit_requests WHERE created_at<?").bind(now-604800)
 ]);}catch(e){console.error("counter_cleanup_failed",String(e));}
}
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get("Origin")||"";
 const serverIndex=Math.max(0,Math.min(6,Number(env.SERVER_INDEX)||0));
 if(request.method==="OPTIONS")return origin===ORIGIN?new Response(null,{status:204,headers:cors}):reply({error:"Forbidden"},403);
 if(origin&&origin!==ORIGIN)return reply({error:"Forbidden"},403);
 if(url.pathname==="/api/stats"&&request.method==="GET"){
  try{return reply({...await stats(env),counter_api:"v5-independent-atomic",server_index:serverIndex});}
  catch(e){console.error("counter_stats_failed",String(e));return reply({error:"stats unavailable"},503);}
 }
 if(origin!==ORIGIN)return reply({error:"Forbidden"},403);
 if(url.pathname==="/api/ready"&&request.method==="GET"){
  try{await env.DB.prepare("SELECT total_visits FROM visitor_totals WHERE id=1").first();return reply({status:"ready",server_index:serverIndex});}
  catch(e){return reply({status:"not_ready",error:String(e)},503);}
 }
 if(url.pathname==="/api/sync-total"&&request.method==="POST")return reply({error:"Cross-server sync disabled; totals are independent"},410);
 if(url.pathname==="/api/visit"&&request.method==="POST"){
  let body;try{body=await request.json();}catch{return reply({error:"Invalid JSON"},400);}
  if(!validId(body?.visitor_id))return reply({error:"Invalid visitor_id"},400);
  const countVisit=body.count_visit===true;
  if(countVisit&&!validId(body.request_id,12,100))return reply({error:"Valid request_id required"},400);
  const now=Math.floor(Date.now()/1000);
  const sessionStmt=env.DB.prepare("INSERT INTO visitor_sessions(visitor_id,session_started_at,last_seen) VALUES(?,?,?) ON CONFLICT(visitor_id) DO UPDATE SET session_started_at=CASE WHEN excluded.last_seen-visitor_sessions.last_seen>=? THEN excluded.session_started_at ELSE visitor_sessions.session_started_at END,last_seen=excluded.last_seen").bind(body.visitor_id,now,now,sessionTimeout(env));
  try{
   let counted=false,total=null;
   if(countVisit){
    const writes=await env.DB.batch([
     sessionStmt,
     env.DB.prepare("INSERT OR IGNORE INTO visitor_visit_requests(request_id,created_at) VALUES(?,?)").bind(body.request_id,now),
     env.DB.prepare("UPDATE visitor_totals SET total_visits=total_visits+1 WHERE id=1 AND changes()=1"),
     env.DB.prepare("INSERT INTO visitor_visit_events(visitor_id,event_created_at) SELECT ?,? WHERE changes()=1").bind(body.visitor_id,now)
    ]);
    counted=Number(writes[1]?.meta?.changes||0)>0;
    const row=await env.DB.prepare("SELECT total_visits FROM visitor_totals WHERE id=1").first();
    total=Number(row?.total_visits||0);
   }else await sessionStmt.run();
   cache=null;cacheAt=0;await cleanup(env,now);
   return reply({ok:true,counted,total_visits:total,server_index:serverIndex});
  }catch(e){console.error("counter_visit_write_failed",String(e));return reply({error:"visit temporarily unavailable"},503);}
 }
 return reply({error:"Not found"},404);
}};
