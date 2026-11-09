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
    const text = String(error && (error.message || error.code) || error || '').toLowerCase();
    if(location.protocol==='https:' && text.includes('mixed')) return 'HTTP BLOCKED';
    if(text.includes('cors') || text.includes('cross-origin')) return 'CORS BLOCKED';
    if(text.includes('manifest') || text.includes('404') || text.includes('403')) return 'SOURCE UNAVAILABLE';
    if(text.includes('drm') || text.includes('license') || text.includes('encrypted')) return 'DRM / LICENSE REQUIRED';
    return 'PLAYBACK ERROR';
  }
  async function play(c){
    if(!c.url){status('NO STREAM URL');return;}
    stopPlayer(); selectedId=getId(c);
    $('nowTitle').textContent=c.name || 'Selected channel';
    $('nowMeta').textContent=[c.category,c.language].filter(Boolean).join(' • ') || 'Live channel';
    empty.style.display='none'; status('LOADING');
    video.onplaying=()=>status('PLAYING');
    video.onerror=()=>status('SOURCE UNAVAILABLE');
    let url=c.url;
    // HTTPS pages cannot load HTTP media. Try the same endpoint over HTTPS;
    // the origin must support HTTPS and authorize browser playback.
    if(location.protocol==='https:' && url.startsWith('http://')) url='https://'+url.slice(7);
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
          status(detail.code===6007?'DRM / LICENSE REQUIRED':detail.code===1001?'NETWORK / CORS ERROR':'DASH ERROR '+(detail.code||''));
        });
        await shakaPlayer.load(url);
        await video.play();
      } else if(isHls && window.Hls && Hls.isSupported()){
        hls=new Hls({enableWorker:true,lowLatencyMode:true});
        hls.on(Hls.Events.ERROR,(_,data)=>{
          if(data.fatal) status(data.type==='networkError'?'NETWORK / CORS ERROR':'HLS ERROR');
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
  async function init(){
    try{
      const res=await fetch('data/channels.json',{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);
      const data=await res.json();channels=Array.isArray(data)?data:(data.channels||[]);
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