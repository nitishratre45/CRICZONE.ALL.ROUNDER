(() => {
"use strict";
const grid=document.getElementById("channels"),search=document.getElementById("search"),filters=document.getElementById("filters"),count=document.getElementById("count"),updated=document.getElementById("updated"),modal=document.getElementById("player-modal"),video=document.getElementById("video"),container=document.getElementById("video-container"),message=document.getElementById("player-message"),title=document.getElementById("player-title"),note=document.getElementById("player-note");
let channels=[],selectedGroup="all",hls=null,shakaPlayer=null,shakaOverlay=null,playToken=0;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const provider=g=>String(g||"Other").split("|")[0].trim()||"Other";
function renderFilters(){const groups=[...new Set(channels.map(c=>provider(c.group)))].sort();filters.innerHTML=["all",...groups].map(g=>'<button class="filter '+(selectedGroup===g?"active":"")+'" data-group="'+esc(g)+'">'+(g==="all"?"All channels":esc(g))+"</button>").join("")}
function render(){
 const q=search.value.trim().toLowerCase();
 const visible=channels.filter(c=>(selectedGroup==="all"||selectedGroup===provider(c.group))&&[c.name,c.tvg_name,c.tvg_id,c.group].some(v=>String(v||"").toLowerCase().includes(q)));
 count.textContent=visible.length;
 grid.innerHTML=visible.length?visible.map(c=>'<button class="channel-card" type="button" data-index="'+channels.indexOf(c)+'"><div class="thumb">'+(c.logo?'<img loading="lazy" src="'+esc(c.logo)+'" alt="" onerror="this.style.display=\'none\';this.parentElement.insertAdjacentHTML(\'beforeend\',\'<span class=&quot;thumb-fallback&quot;>▶</span>\')">':'<span class="thumb-fallback">▶</span>')+'<span class="provider">'+esc(provider(c.group))+'</span></div><div class="channel-name">'+esc(c.name||c.tvg_name||"Channel")+'</div><div class="card-bottom"><span>'+esc(String(c.stream_type||"stream").toUpperCase())+'</span><span class="open-label">OPEN ↗</span></div></button>').join(""):'<div class="state">No channels match your search.</div>';
}
async function stopPlayback(){
 if(hls){hls.destroy();hls=null}
 if(shakaOverlay){try{shakaOverlay.destroy()}catch(e){}shakaOverlay=null}
 if(shakaPlayer){try{await shakaPlayer.destroy()}catch(e){}shakaPlayer=null}
 video.pause();video.removeAttribute("src");video.load();video.controls=true;
}
function showError(text){message.textContent=text;message.classList.remove("hidden")}
function hideMessage(){message.classList.add("hidden")}
function parseClearKey(raw){
 if(!raw)return null;
 const parts=String(raw).trim().split(":");
 if(parts.length!==2||!parts[0]||!parts[1])return null;
 const kid=parts[0].replace(/-/g,"").toLowerCase(),key=parts[1].replace(/-/g,"").toLowerCase();
 if(!/^[a-f0-9]{32}$/.test(kid)||!/^[a-f0-9]{32}$/.test(key))return null;
 return {[kid]:key};
}
async function openChannel(c){
 const active=++playToken;
 title.textContent=c.name||c.tvg_name||"Channel";
 modal.classList.add("open");modal.setAttribute("aria-hidden","false");
 message.classList.remove("hidden");showError("Preparing player…");
 await stopPlayback();
 if(active!==playToken)return;
 const url=String(c.url||"").trim();
 if(!url){showError("No stream URL is available for this channel.");return}
 const isDash=String(c.stream_type||"").toLowerCase()==="dash"||/\.mpd(?:$|[?#])/i.test(url);
 const requestHeaders=c.request_headers&&Object.keys(c.request_headers).length>0;
 if(isDash){
  note.textContent="DASH playback uses Shaka Player. Encrypted streams require the provider's valid DRM license configuration.";
  if(!window.shaka){showError("Shaka Player could not load. Check your internet connection and reload.");return}
  try{
   shaka.polyfill.installAll();
   if(!shaka.Player.isBrowserSupported()){showError("This browser does not support Shaka DASH playback.");return}
   video.controls=false;
   shakaPlayer=new shaka.Player();
   await shakaPlayer.attach(video);
   if(active!==playToken)return;
   shakaOverlay=new shaka.ui.Overlay(shakaPlayer,container,video);
   shakaOverlay.configure({controlPanelElements:["play_pause","time_and_duration","spacer","mute","volume","fullscreen"],overflowMenuButtons:["quality","language","captions","playback_rate"]});
   const config={streaming:{lowLatencyMode:true,bufferingGoal:15,rebufferingGoal:3}};
   const clearKeys=parseClearKey(c.drm_key);
   if(clearKeys)config.drm={clearKeys};
   if(c.drm_license_url){config.drm=config.drm||{};config.drm.servers={"com.widevine.alpha":String(c.drm_license_url)}}
   shakaPlayer.configure(config);
   shakaPlayer.addEventListener("error",event=>{
    if(active!==playToken)return;
    const err=event.detail||{};
    showError("DASH playback error ("+(err.code||"unknown")+"). The stream may be offline, CORS-blocked, or require the provider's authorized DRM license.");
   });
   showError("Loading DASH stream…");
   await shakaPlayer.load(url);
   if(active!==playToken)return;
   hideMessage();video.play().catch(()=>{});
  }catch(err){
   if(active!==playToken)return;
   const detail=err&&err.code?" (code "+err.code+")":"";
   showError("Could not play this DASH stream"+detail+". Encrypted streams need valid provider-authorized DRM configuration.");
  }
  return;
 }
 note.textContent=requestHeaders
  ?"This playlist entry specifies custom User-Agent/Referer headers. Browsers restrict these headers; use the provider's authorized web player or an approved playback endpoint."
  :"HLS playback requires browser-accessible CORS and any provider-required authorization.";
 video.controls=true;
 if(!/\.m3u8(?:$|[?#])/i.test(url)){showError("This stream format is not supported by the player.");return}
 if(requestHeaders){showError("This channel needs provider-specific request headers that a normal browser player cannot set. Use its official/authorized player.");return}
 showError("Connecting to HLS stream…");
 if(video.canPlayType("application/vnd.apple.mpegurl")){
  video.src=url;
  video.addEventListener("loadedmetadata",()=>{if(active===playToken)hideMessage()},{once:true});
  video.addEventListener("error",()=>{if(active===playToken)showError("HLS stream unavailable. It may require provider authorization, CORS access, or may be offline.")},{once:true});
  video.play().catch(()=>{});
 }else if(window.Hls&&Hls.isSupported()){
  hls=new Hls({enableWorker:true,manifestLoadingTimeOut:20000,fragLoadingTimeOut:20000});
  hls.loadSource(url);hls.attachMedia(video);
  hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(active===playToken){hideMessage();video.play().catch(()=>{})}});
  hls.on(Hls.Events.ERROR,(_,d)=>{if(active===playToken&&d.fatal)showError("HLS playback failed. Check stream authorization, CORS and source availability.")});
 }else showError("HLS playback is not supported by this browser.");
}
grid.addEventListener("click",e=>{const card=e.target.closest("[data-index]");if(card)openChannel(channels[Number(card.dataset.index)])});
filters.addEventListener("click",e=>{const b=e.target.closest("[data-group]");if(!b)return;selectedGroup=b.dataset.group;renderFilters();render()});
search.addEventListener("input",render);
async function closePlayer(){playToken++;modal.classList.remove("open");modal.setAttribute("aria-hidden","true");await stopPlayback()}
document.getElementById("close-player").addEventListener("click",closePlayer);
modal.addEventListener("click",e=>{if(e.target===modal)closePlayer()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.classList.contains("open"))closePlayer()});
async function init(){
 try{
  const r=await fetch("channels.json?v="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw Error("HTTP "+r.status);
  const d=await r.json();
  channels=Array.isArray(d)?d:(Array.isArray(d.channels)?d.channels:[]);
  if(!channels.length)throw Error("The catalogue contains no channels");
  updated.textContent=d.updated_at?"Updated "+new Date(d.updated_at).toLocaleString():"Catalogue loaded";
  renderFilters();render();
 }catch(e){grid.innerHTML='<div class="state">Could not load channels.json: '+esc(e.message)+'</div>';updated.textContent="Catalogue unavailable"}
}
init();
})();