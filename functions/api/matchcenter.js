const KEY="matches";
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const INDIA_NZ_STREAMS=[
  {name:"Hindi HD",url:"https://criczone.pages.dev/criczone/?id=892"},
  {name:"English HD",url:"https://criczone.pages.dev/criczone/?id=162"},
  {name:"Sony All Channels",url:"https://criczone.pages.dev/criczonesony/"},
  {name:"Sony LIV — All Languages",url:"https://criczone.pages.dev/criczonesony/?view=events"},
  {name:"Willow Web",url:"https://criczone.pages.dev/criczonebuzz/?id=B0HNH5B25Z"},
  {name:"iOS — Hindi HD",url:"https://criczone.pages.dev/criczone1/?id=s3"},
  {name:"iOS — English HD",url:"https://criczone.pages.dev/criczone1/?id=s1"}
];
function withIndiaNzChannels(matches) {
  return matches.map(m=>{
    const a=String(m?.teamA?.name||"").trim().toLowerCase();
    const b=String(m?.teamB?.name||"").trim().toLowerCase();
    const title=String(m?.title||"").trim().toLowerCase();
    const isIndia=a==="india"||b==="india"||title.includes("ind")||title.includes("india");
    const isNz=a==="new zealand"||b==="new zealand"||a==="nz"||b==="nz"||title.includes("nz")||title.includes("new zealand");
    if(!isIndia||!isNz) return m;
    const existing=Array.isArray(m.streams)?m.streams:[];
    const seen=new Set(existing.map(s=>String(s?.url||"").trim()).filter(Boolean));
    const added=INDIA_NZ_STREAMS.filter(s=>!seen.has(s.url));
    return {...m,streams:[...existing,...added]};
  });
}
export async function onRequestGet({env}) {
  if(!env.MATCHCENTER_KV) return reply({ok:false,storage:"json-fallback",error:"MATCHCENTER_KV binding is not configured"});
  try { const raw=await env.MATCHCENTER_KV.get(KEY); const matches=raw?JSON.parse(raw):[]; return reply({ok:true,matches:withIndiaNzChannels(matches)}); }
  catch { return reply({ok:false,error:"Could not read match storage"},500); }
}
export async function onRequestPost({request,env}) {
  if(!env.MATCHCENTER_KV) return reply({ok:false,error:"Match storage is not configured. Add the MATCHCENTER_KV binding in Cloudflare Pages."},503);
  if(!request.headers.get("content-type")?.includes("application/json")) return reply({ok:false,error:"JSON body required"},415);
  const length=Number(request.headers.get("content-length")||0); if(length>8_000_000) return reply({ok:false,error:"Upload is too large. Compress images and try again."},413); let body; try { body=await request.json(); } catch { return reply({ok:false,error:"Invalid JSON"},400); }
  if(JSON.stringify(body).length>8_000_000) return reply({ok:false,error:"Upload is too large. Reduce poster image sizes."},413); const matches=Array.isArray(body)?body:body.matches;
  if(!Array.isArray(matches)||matches.length>300) return reply({ok:false,error:"Expected a matches array (maximum 300)"},400);
  const clean=[];
  for(const m of matches) {
    if(!m||typeof m!=="object"||!m.id||!m.teamA?.name||!m.teamB?.name) return reply({ok:false,error:"Each match needs id and both team names"},400);
    const streams=Array.isArray(m.streams)?m.streams.slice(0,100).map(s=>({name:String(s.name||"Stream").slice(0,80),url:String(s.url||"").slice(0,2000)})).filter(s=>/^https?:\/\//i.test(s.url)):[];
    clean.push({id:String(m.id).slice(0,100),title:String(m.title||"").slice(0,180),tournament:String(m.tournament||"").slice(0,140),teamA:{name:String(m.teamA.name).slice(0,100),logo:String(m.teamA.logo||"").slice(0,1000)},teamB:{name:String(m.teamB.name).slice(0,100),logo:String(m.teamB.logo||"").slice(0,1000)},date:String(m.date||"").slice(0,60),time:String(m.time||"").slice(0,60),venue:String(m.venue||"").slice(0,140),status:["live","upcoming","completed"].includes(m.status)?m.status:"upcoming",poster:String(m.poster||"").slice(0,900000),featured:!!m.featured,streams});
  }
  try { await env.MATCHCENTER_KV.put(KEY,JSON.stringify(clean)); return reply({ok:true,count:clean.length,savedAt:new Date().toISOString()}); }
  catch { return reply({ok:false,error:"Could not save matches"},500); }
}