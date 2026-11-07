const PAGES = {
  criczone:"https://criczone.pages.dev/criczone/",
  criczone1:"https://criczone.pages.dev/criczone1/",
  criczone2:"https://criczone.pages.dev/criczone2/",
  criczone3:"https://criczone.pages.dev/criczone3/",
  criczonebuzz:"https://criczone.pages.dev/criczonebuzz/",
  criczonefancode:"https://criczone.pages.dev/criczonefancode/",
  sony:"https://criczone.pages.dev/sony/",
  criczonesony:"https://criczone.pages.dev/criczonesony/"
};
const norm = v => String(v ?? "").normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const first = (o, keys) => { for (const k of keys) if (typeof o?.[k] === "string" || typeof o?.[k] === "number") { const v=String(o[k]).trim(); if(v) return v; } return ""; };
function arrays(payload) {
  const out=[];
  const queue=[{v:payload,d:0}];
  const seen=new Set();
  const keys=new Set(["channels","streams","data","results","items","list","iframes","tv","matches","events","fixtures","live","upcoming"]);
  while(queue.length) {
    const {v,d}=queue.shift();
    if(!v || typeof v!=="object" || seen.has(v) || d>4) continue;
    seen.add(v);
    if(Array.isArray(v)) { if(v.length && v.every(x=>x && typeof x==="object" && !Array.isArray(x))) out.push(v); continue; }
    // Match root keys case-insensitively: Willow source uses "Matches" with a capital M.\n    for(const [key,value] of Object.entries(v)) if(value && typeof value==="object" && keys.has(String(key).toLowerCase())) queue.push({v:value,d:d+1});
    const vals=Object.values(v);
    if(vals.length && vals.every(x=>x && typeof x==="object" && !Array.isArray(x))) out.push(vals);
  }
  return out;
}
function channelRows(payload, feed) {
  const rows=[];
  for(const list of arrays(payload)) for(let i=0;i<list.length;i++) {
    const x=list[i]; if(!x || typeof x!=="object") continue;
    const eventTitle=first(x,["event_name","match_title","match","fixture"]);
    const eventId=first(x,["id","match_id","event_id","fixture_id"]);
    if(eventTitle && eventId) {
      rows.push({type:"match",name:eventTitle,id:eventId,home_team:"",away_team:"",tournament:first(x,["tournament","competition","series","league"]),folder:feed.folder,json:feed.key,page_url:PAGES.criczonebuzz});
      continue;
    }
    const name=first(x,["name","title","channel_name","channelName","channel","label","station","display_name","contentName"]);
    const id=first(x,["id","channel_id","channelId","content_id","cid","key"]);
    const category=first(x,["category","genre","group","group_title","groupTitle"]);
    const playable=first(x,["iframeSrc","iframe_src","iframe_url","embedUrl","embed_url","stream_url","streamUrl","m3u8","mpd","src","url","link"]);
    const explicitPage=first(x,["page_url","web_url","website","channel_url","watch_url"]);
    // Do not treat arbitrary nested objects, team names, or logo records as channels.
    if(!name || !(id || playable || explicitPage)) continue;
    const isMedia=/\.(m3u8|mpd|mp4|ts)(\?|$)/i.test(playable);
    const basePage=/^https?:\/\//i.test(explicitPage) && !/\.(m3u8|mpd|mp4|ts)(\?|$)/i.test(explicitPage) ? explicitPage : PAGES[feed.folder];
    const isFancode = feed.key === "fancode" || feed.folder === "criczonefancode";
    const isCricbuzz = /cricbuzz/i.test(name);
    const page = isFancode ? PAGES.criczonefancode : (isCricbuzz ? PAGES.criczonebuzz : (basePage && id ? basePage + (basePage.includes("?") ? "&" : "?") + "id=" + encodeURIComponent(id) : basePage));
    rows.push({type:"channel",name,id,category,folder:feed.folder,json:feed.key,page_url:page});
  }
  return rows;
}
function matchRows(payload, feed) {
  const rows=[];
  for(const list of arrays(payload)) for(const x of list) {
    if(!x || typeof x!=="object") continue;
    const title=first(x,["event_name","title","match_title","match","name","fixture"]);
    const id=first(x,["id","match_id","event_id","fixture_id"]);
    const home=first(x,["home_team","homeTeam","team1","team_a","localteam"]);
    const away=first(x,["away_team","awayTeam","team2","team_b","visitorteam"]);
    const tournament=first(x,["tournament","competition","series","league"]);
    if(!title || !(home || away || id)) continue;
    rows.push({type:"match",name:title,id,home_team:home,away_team:away,tournament,folder:feed.folder,json:feed.key,page_url:PAGES[feed.folder]});
  }
  return rows;
}
function m3uRows(text, feed) {
  const rows=[]; let cur=null;
  for(const line0 of String(text||"").split(/\r?\n/)) {
    const line=line0.trim(); if(!line) continue;
    if(line.startsWith("#EXTINF:")) {
      const comma=line.lastIndexOf(",");
      const attrs=comma>=0?line.slice(8,comma):line.slice(8);
      cur={name:comma>=0?line.slice(comma+1).trim():"",id:attrs.match(/tvg-id="([^"]*)"/i)?.[1]||"",category:attrs.match(/group-title="([^"]*)"/i)?.[1]||""};
    } else if(line.startsWith("#EXTGRP:") && cur) cur.category=line.slice(8).trim();
    else if(/^https?:\/\//i.test(line) && cur) {
      if(cur.name) rows.push({type:"channel",...cur,folder:feed.folder,json:feed.key,page_url:PAGES[feed.folder]});
      cur=null;
    }
  }
  return rows;
}
export async function onRequestGet({ request }) {
  const origin = new URL(request.url).origin;
  const manifestResponse = await fetch(origin + "/telegram-sources.json", { headers: { Accept: "application/json" } });
  if (!manifestResponse.ok) return Response.json({ error: "Source registry unavailable", status: manifestResponse.status }, { status: 503 });
  const manifest = await manifestResponse.json();
  const feeds = Array.isArray(manifest.sources) ? manifest.sources.filter(feed => feed && feed.enabled !== false && typeof feed.url === "string" && /^https?:\/\//i.test(feed.url) && typeof feed.key === "string" && typeof feed.folder === "string") : [];
  const results=await Promise.all(feeds.map(async feed=>{
    try {
      const r=await fetch(feed.url,{headers:{Accept:feed.kind==="m3u"?"text/plain,application/json,*/*":"application/json"},signal:AbortSignal.timeout(12000)});
      if(!r.ok) throw new Error("HTTP "+r.status);
      const payload=feed.kind==="m3u"?await r.text():await r.json();
      let rows=[];
      if(feed.kind==="m3u") rows=m3uRows(payload,feed);
      else if(feed.kind==="matches") rows=matchRows(payload,feed);
      else if(feed.kind!=="logos") rows=channelRows(payload,feed);
      return {feed:feed.key,ok:true,rows};
    } catch(e) { console.error("Canonical feed error",feed.key,e); return {feed:feed.key,ok:false,error:String(e)}; }
  }));
  const channels=[],matches=[],seenChannels=new Set(),seenMatches=new Set();
  for(const result of results) for(const row of result.rows||[]) {
    const key=row.type==="channel"?norm(row.name)+"|"+row.id+"|"+row.folder:norm(row.name)+"|"+row.id;
    const seen=row.type==="channel"?seenChannels:seenMatches;
    if(seen.has(key)) continue; seen.add(key);
    (row.type==="channel"?channels:matches).push(row);
  }
  // Merge the manually curated CRICZONE directory (ID + name + folder + page URL).
  // This registry intentionally contains no upstream stream URLs, cookies or DRM keys.
  try {
    const directoryResponse = await fetch(origin + "/telegram-channels.json", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
    if (directoryResponse.ok) {
      const directory = await directoryResponse.json();
      for (const item of Array.isArray(directory.channels) ? directory.channels : []) {
        const id = String(item.id || "").trim();
        const name = String(item.name || "").trim();
        const folder = String(item.folder || "criczone").trim();
        const pageUrl = String(item.url || "").trim();
        const safeFolder = /^(?:criczone|criczone1)$/.test(folder);
        const expectedUrl = "https://criczone.pages.dev/" + folder + "/?id=" + encodeURIComponent(id);
        if (!id || !name || !safeFolder || !/^[A-Za-z0-9_-]+$/.test(id) || pageUrl !== expectedUrl) continue;
        const key = norm(name) + "|" + id + "|" + folder;
        if (seenChannels.has(key)) continue;
        seenChannels.add(key);
        channels.push({ type: "channel", name, id, category: "", folder, json: "manual_directory", page_url: pageUrl });
      }
    }
  } catch (error) {
    console.error("Curated channel directory unavailable", error);
  }

  return Response.json({version:1,generated_at:new Date().toISOString(),summary:{channels:channels.length,matches:matches.length,feeds_ok:results.filter(x=>x.ok).length,feeds_failed:results.filter(x=>!x.ok).length},sources:results.map(x=>({feed:x.feed,ok:x.ok,count:(x.rows||[]).length})),channels,matches},{headers:{"Cache-Control":"public, max-age=60","Content-Type":"application/json; charset=utf-8"}});
}
