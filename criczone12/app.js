(() => {
  const $ = id => document.getElementById(id);
  const grid = $('channelGrid'), search = $('searchInput'), select = $('categorySelect');
  const video = $('video'), empty = $('playerEmpty');
  let channels = [], activeCategory = '', selectedId = null, hls = null;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getId = c => c.id || c.tvg_id || c.name + '|' + c.url;
  function stopPlayer(){ if(hls){hls.destroy();hls=null;} video.pause(); video.removeAttribute('src'); video.load(); }
  function play(c){
    if(!c.url){$('playerStatus').textContent='NO STREAM';return;}
    stopPlayer(); selectedId=getId(c); $('nowTitle').textContent=c.name || 'Selected channel';
    $('nowMeta').textContent=[c.category,c.language].filter(Boolean).join(' • ') || 'Live channel';
    $('playerStatus').textContent='LOADING'; empty.style.display='none';
    const url=c.url;
    if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;video.play().catch(()=>{});}
    else if(window.Hls && Hls.isSupported() && /\.m3u8?(?:$|\?)/i.test(url)){
      hls=new Hls({enableWorker:true,lowLatencyMode:true});hls.loadSource(url);hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>{}));
      hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)$('playerStatus').textContent='PLAYBACK ERROR';});
    } else { video.src=url; video.play().catch(()=>{$('playerStatus').textContent='UNSUPPORTED / BLOCKED';}); }
    video.onplaying=()=>$('playerStatus').textContent='PLAYING';
    video.onerror=()=>$('playerStatus').textContent='UNAVAILABLE';
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
      cats.forEach(cat=>{select.add(new Option(cat,cat));});
      $('categoryChips').innerHTML=['All',...cats].map((cat,i)=>'<button class="chip '+(!i?'active':'')+'" data-cat="'+(i?safe(cat):'')+'">'+safe(cat)+'</button>').join('');
      document.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>setCategory(b.dataset.cat)));
      select.addEventListener('change',()=>setCategory(select.value));search.addEventListener('input',render);render();
    }catch(err){grid.innerHTML='<div class="loading">Channel data could not load. Run the Python extractor and publish data/channels.json. ('+safe(err.message)+')</div>';$('totalCount').textContent='0';}
  }
  init();
})();