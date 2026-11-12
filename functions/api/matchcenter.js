const KEY="matches";
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
export async function onRequestGet({env}) {
  if(!env.MATCHCENTER_KV) return reply({ok:false,storage:"json-fallback",error:"MATCHCENTER_KV binding is not configured"});
  try { const raw=await env.MATCHCENTER_KV.get(KEY); return reply({ok:true,matches:raw?JSON.parse(raw):[]}); }
  catch { return reply({ok:false,error:"Could not read match storage"},500); }
}
export async function onRequestPost({request,env}) {
  if(!env.MATCHCENTER_KV) return reply({ok:false,error:"Match storage is not configured. Add the MATCHCENTER_KV binding in Cloudflare Pages."},503);
  if(!request.headers.get("content-type")?.includes("application/json")) return reply({ok:false,error:"JSON body required"},415);
  let body; try { body=await request.json(); } catch { return reply({ok:false,error:"Invalid JSON"},400); }
  const matches=Array.isArray(body)?body:body.matches;
  if(!Array.isArray(matches)||matches.length>300) return reply({ok:false,error:"Expected a matches array (maximum 300)"},400);
  const clean=[];
  for(const m of matches) {
    if(!m||typeof m!=="object"||!m.id||!m.teamA?.name||!m.teamB?.name) return reply({ok:false,error:"Each match needs id and both team names"},400);
    const streams=Array.isArray(m.streams)?m.streams.slice(0,20).map(s=>({name:String(s.name||"Stream").slice(0,80),quality:String(s.quality||"").slice(0,40),url:String(s.url||"").slice(0,2000)})).filter(s=>/^https?:\/\//i.test(s.url)):[];
    clean.push({id:String(m.id).slice(0,100),title:String(m.title||"").slice(0,180),tournament:String(m.tournament||"").slice(0,140),teamA:{name:String(m.teamA.name).slice(0,100),logo:String(m.teamA.logo||"").slice(0,1000)},teamB:{name:String(m.teamB.name).slice(0,100),logo:String(m.teamB.logo||"").slice(0,1000)},date:String(m.date||"").slice(0,60),time:String(m.time||"").slice(0,60),venue:String(m.venue||"").slice(0,140),status:["live","upcoming","completed"].includes(m.status)?m.status:"upcoming",poster:String(m.poster||"").slice(0,1200),featured:!!m.featured,streams});
  }
  try { await env.MATCHCENTER_KV.put(KEY,JSON.stringify(clean)); return reply({ok:true,count:clean.length,savedAt:new Date().toISOString()}); }
  catch { return reply({ok:false,error:"Could not save matches"},500); }
}