(() => {
  const $ = id => document.getElementById(id);
  const grid = $('channelGrid'), search = $('searchInput'), select = $('categorySelect');
  const video = $('video'), empty = $('playerEmpty');
  let channels = [], activeCategory = '', selectedId = null, hls = null, shakaPlayer = null;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getId = c => c.id || c.tvg_id || c.name + '|' + c.url;
  function status(message){ $('playerStatus').textContent = message; }
  function stopPlayer(){
    if(hls){hls.destroy();hls=null;}
    if(shakaPlayer){shakaPlayer.destroy().catch(()=>{});shakaPlayer=null;}
    video.pause(); video.removeAttribute('src'); video.load();
    video.onplaying=null; video.onerror=null;
  }
  function explainError(error){
    const code = error && (error.code || error.category) ? 'CODE '+(error.code || error.category)+' · ' : '';
    const raw = String(error && (error.message || error.code) || error || 'Unknown error').replace(/\\s+/g,' ').slice(0,54);
    const text = raw.toLowerCase();
    if(location.protocol==='https:' && text.includes('mixed')) return 'HTTP BLOCKED';
    if(text.includes('cors') || text.includes('cross-origin')) return 'CORS BLOCKED';
    if(text.includes('manifest') || text.includes('404') || text.includes('403')) return 'SOURCE UNAVAILABLE';
    if(text.includes('drm') || text.includes('license') || text.includes('encrypted')) return 'DRM / LICENSE REQUIRED';
    return (code+'ERROR '+raw).slice(0,64).toUpperCase();
  }
  async function play(c){
    if(!c.url){status('NO STREAM URL');return;}
    stopPlayer(); selectedId=getId(c);
    $('nowTitle').textContent=c.name || 'Selected channel';
    $('nowMeta').textContent=[c.category,c.language].filter(Boolean).join(' • ') || 'Live channel';
    empty.style.display='none'; status('LOADING');
    video.onplaying=()=>status('PLAYING');
    video.onerror=()=>status('SOURCE UNAVAILABLE');
    const url=String(c.url).trim();
    // Do not rewrite HTTP stream URLs to HTTPS: that changes the provider
    // endpoint and can produce misleading 403 responses. HTTPS pages cannot
    // play insecure HTTP media; the provider must supply a valid HTTPS URL.
    if(location.protocol==='https:' && /^http:\/\//i.test(url)){
      status('HTTP SOURCE BLOCKED · PROVIDER HTTPS URL REQUIRED');
      render();
      return;
    }
    const isDash=/\.mpd(?:$|\?)/i.test(url);
    const isHls=/\.m3u8?(?:$|\?)/i.test(url);
    try{
      if(isDash){
        if(!window.shaka || !shaka.Player.isBrowserSupported()){
          status('DASH NOT SUPPORTED'); render(); return;
        }
        shaka.polyfill.installAll();
        shakaPlayer=new shaka.Player();
        await shakaPlayer.attach(video);
        shakaPlayer.addEventListener('error',event=>{
          const detail=event.detail||{};
          const data=Array.isArray(detail.data)?detail.data:[];
          // Shaka error payloads vary by browser/plugin version. Search nested
          // response objects and numeric fields so HTTP 401/403 is not hidden.
          const findStatus=(value,depth=0)=>{
            if(depth>5||value==null) return 0;
            if(typeof value==='number'&&value>=100&&value<=599) return value;
            if(Array.isArray(value)){
              for(const item of value){const found=findStatus(item,depth+1);if(found)return found;}
              return 0;
            }
            if(typeof value==='object'){
              for(const key of ['status','statusCode','httpStatus','responseStatus']){
                const n=Number(value[key]);if(n>=100&&n<=599)return n;
              }
              for(const item of Object.values(value)){const found=findStatus(item,depth+1);if(found)return found;}
            }
            return 0;
          };
          const httpStatus=findStatus(data);
          if(httpStatus===401||httpStatus===403){
            status('HTTP '+httpStatus+' · SOURCE ACCESS DENIED');
          } else if(httpStatus===404){
            status('HTTP 404 · MANIFEST / SEGMENT NOT FOUND');
          } else if(httpStatus>=400){
            status('HTTP '+httpStatus+' · SOURCE REQUEST REJECTED');
          } else if(detail.code===1001){
            status('HTTP REQUEST FAILED · CHECK SOURCE ACCESS');
          } else if(detail.code===1002){
            status('BROWSER NETWORK / CORS BLOCK');
          } else if(detail.code===1003){
            status('STREAM REQUEST TIMEOUT');
          } else if(detail.code===6007){
            status('DRM LICENSE REQUEST FAILED');
          } else {
            status('DASH ERROR '+(detail.code||'UNKNOWN'));
          }
          console.warn('CRICZONE12 Shaka error details:',{code:detail.code,httpStatus,data:data.map((v,i)=>i===0&&typeof v==='string'?v.split('?')[0]:v)});
        });
        await shakaPlayer.load(url);
        await video.play();
      } else if(isHls && window.Hls && Hls.isSupported()){
        hls=new Hls({enableWorker:true,lowLatencyMode:true});
        hls.on(Hls.Events.ERROR,(_,data)=>{
          if(!data.fatal) return;
          const httpStatus=Number(data.response && data.response.code)||0;
          if(httpStatus===401||httpStatus===403) status('HTTP '+httpStatus+' · SOURCE ACCESS DENIED');
          else if(httpStatus===404) status('HTTP 404 · PLAYLIST / SEGMENT NOT FOUND');
          else if(data.type==='networkError') status('NETWORK / CORS ERROR · CHECK PROVIDER ACCESS');
          else status('HLS ERROR · '+String(data.details||'PLAYBACK FAILED').replace(/_/g,' ').toUpperCase());
          console.warn('CRICZONE12 HLS error details:',{type:data.type,details:data.details,httpStatus,url:data.url&&data.url.split('?')[0]});
        });
        hls.loadSource(url); hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>status('TAP PLAY TO START')));
      } else if(video.canPlayType('application/vnd.apple.mpegurl') && isHls){
        video.src=url; await video.play();
      } else {
        status('UNSUPPORTED STREAM FORMAT'); render(); return;
      }
      render();
    }catch(error){
      console.warn('CRICZONE12 playback error:',error);
      status(explainError(error));
    }
    render();
  }
  function render(){
    const q=search.value.trim().toLowerCase();
    const filtered=channels.filter(c=>(!activeCategory||c.category===activeCategory)&&[c.name,c.category,c.language,c.tvg_id].join(' ').toLowerCase().includes(q));
    $('resultCount').textContent=filtered.length.toLocaleString()+' channels';
    grid.innerHTML=filtered.map(c=>{
      const id=getId(c), logo=c.logo?'<img loading="lazy" src="'+safe(c.logo)+'" alt="" onerror="this.remove()">': '';
      const initials=safe((c.name||'TV').slice(0,2).toUpperCase());
      return '<button class="channel-card '+(id===selectedId?'selected':'')+'" data-id="'+safe(id)+'"><span class="logo">'+(logo||initials)+'</span><span class="channel-info"><b>'+safe(c.name||'Unnamed channel')+'</b><span>'+safe([c.category,c.language].filter(Boolean).join(' • ')||'Channel')+'</span></span></button>';
    }).join('')||'<div class="loading">No channels found.</div>';
    $('emptyState').hidden=filtered.length!==0;
    grid.querySelectorAll('.channel-card').forEach(btn=>btn.addEventListener('click',()=>{const c=channels.find(x=>getId(x)===btn.dataset.id);if(c)play(c);}));
  }
  function setCategory(cat){activeCategory=cat;select.value=cat;document.querySelectorAll('.chip').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));render();}
  async function loadChannelData(){
    // Import public channel metadata only. DRM keys/key IDs are deliberately ignored.
    try{
      const remote=await fetch('/api/channel-catalog',{cache:'no-store'});
      if(!remote.ok) throw new Error('Remote JSON HTTP '+remote.status);
      const payload=await remote.json();
      const rows=Array.isArray(payload)?payload:(Array.isArray(payload.channels)?payload.channels:null);
      if(!rows) throw new Error('Remote JSON format is not an array or {channels:[...]}');
      const imported=rows.map((item,index)=>({
        id:String(item.id||'remote-'+(index+1)),
        tvg_id:String(item.id||''),
        name:String(item.name||'Unnamed channel'),
        category:String(item.category||'Others'),
        language:String(item.language||''),
        logo:String(item.logo||''),
        url:String(item.url||'')
      })).filter(item=>item.name && item.url);
      if(!imported.length) throw new Error('No usable channel metadata in remote JSON');
      return imported;
    }catch(remoteError){
      console.warn('Remote channel JSON unavailable; using local catalogue:',remoteError.message);
      const fallback=await fetch('data/channels.json',{cache:'no-store'});
      if(!fallback.ok) throw new Error('Remote JSON unavailable and local catalogue HTTP '+fallback.status);
      const data=await fallback.json();
      return Array.isArray(data)?data:(data.channels||[]);
    }
  }
  async function init(){
    try{
      channels=await loadChannelData();
      $('totalCount').textContent=channels.length.toLocaleString();
      const cats=[...new Set(channels.map(c=>c.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      cats.forEach(cat=>select.add(new Option(cat,cat)));
      $('categoryChips').innerHTML=['All',...cats].map((cat,i)=>'<button class="chip '+(!i?'active':'')+'" data-cat="'+(i?safe(cat):'')+'">'+safe(cat)+'</button>').join('');
      document.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>setCategory(b.dataset.cat)));
      select.addEventListener('change',()=>setCategory(select.value));search.addEventListener('input',render);render();
    }catch(err){grid.innerHTML='<div class="loading">Channel data could not load. ('+safe(err.message)+')</div>';$('totalCount').textContent='0';}
  }
  init();
})();