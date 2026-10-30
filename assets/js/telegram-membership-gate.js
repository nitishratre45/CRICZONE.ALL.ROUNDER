(() => {
  if (window.__CZ_TELEGRAM_GATE__) return;
  window.__CZ_TELEGRAM_GATE__ = true;
  const API="/api/telegram", JOIN="https://t.me/criczonelive";
  const COOLDOWN_KEY="cz_gate_api_cooldown_until";
  let popupEnabled=true;
  try{const cfg=await fetch(API+"/settings",{credentials:"same-origin",cache:"no-store"});if(cfg.ok){const d=await cfg.json();popupEnabled=d.popup_enabled===true}}catch{}
  const nextUtcReset=()=>{const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1,0,0,5)};
  const coolingDown=()=>{try{const until=Number(localStorage.getItem(COOLDOWN_KEY)||0);if(until>Date.now())return true;localStorage.removeItem(COOLDOWN_KEY)}catch{}return false};
  const setCooldown=()=>{try{localStorage.setItem(COOLDOWN_KEY,String(nextUtcReset()))}catch{}};
  const isLimitResponse=(status,text)=>status===1046||status===429||status===1027||/error\s*(1046|1027)|temporarily rate limited|reached their plan limits|daily request limit/i.test(String(text||"").slice(0,12000));
  const css=`
  #cz-tg-gate{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(2,8,6,.78);backdrop-filter:blur(9px);font-family:system-ui,-apple-system,Segoe UI,sans-serif}
  #cz-tg-gate.cz-open{display:flex}#cz-tg-card{position:relative;width:min(100%,410px);padding:28px 23px 22px;border:1px solid rgba(255,255,255,.13);border-radius:22px;background:linear-gradient(145deg,#14231b,#09120e);color:#f4fff7;box-shadow:0 25px 90px #0009;text-align:center}
  #cz-tg-card .cz-badge{display:inline-flex;padding:7px 12px;border-radius:99px;background:#173b2a;color:#8df0b2;font-size:11px;font-weight:800;letter-spacing:1px}
  #cz-tg-card h2{margin:16px 0 8px;font-size:25px;line-height:1.15}#cz-tg-card p{margin:0 auto 18px;color:#a9b9af;font-size:13px;line-height:1.6}
  #cz-tg-card .cz-btn{display:flex;width:100%;min-height:48px;align-items:center;justify-content:center;margin-top:10px;border:0;border-radius:12px;background:#24a1de;color:white;font-size:14px;font-weight:800;text-decoration:none;cursor:pointer}
  #cz-tg-card .cz-btn.cz-join{background:#218b56}#cz-tg-card .cz-small{margin-top:14px;color:#718078;font-size:10px}#cz-tg-card .cz-error{min-height:17px;margin-top:9px;color:#ffb4a8;font-size:12px}
  `;
  const style=document.createElement("style");style.textContent=css;document.head.appendChild(style);
  const root=document.createElement("div");root.id="cz-tg-gate";
  root.innerHTML=`<section id="cz-tg-card" role="dialog" aria-modal="true" aria-labelledby="cz-tg-title"><span class="cz-badge">CRICZONE MEMBER ACCESS</span><h2 id="cz-tg-title">Unlock for 12 Hours</h2><p>Join our Telegram channel and verify your membership with our official bot to continue watching.</p><a class="cz-btn cz-join" href="${JOIN}" target="_blank" rel="noopener">Join @criczonelive</a><button class="cz-btn" id="cz-tg-continue" type="button">Continue with Telegram Bot</button><div class="cz-error" id="cz-tg-error" aria-live="polite"></div><div class="cz-small">Membership unlock remains active for 12 hours on this website.</div></section>`;
  document.body.appendChild(root);
  const show=()=>{if(!popupEnabled||coolingDown())return;root.classList.add("cz-open");document.body.style.overflow="hidden"};
  const hide=()=>{root.classList.remove("cz-open");document.body.style.overflow=""};
  let verified=false,started=false,apiUnavailable=coolingDown();
  async function check(){
    if(apiUnavailable||coolingDown())return {verified:false,unavailable:true};
    try{
      const r=await fetch(API+"/session",{credentials:"same-origin",cache:"no-store"});
      const raw=await r.text();
      if(isLimitResponse(r.status,raw)){setCooldown();apiUnavailable=true;hide();return {verified:false,unavailable:true}}
      let d;try{d=JSON.parse(raw)}catch{if(!r.ok){apiUnavailable=true;hide();return {verified:false,unavailable:true}}throw new Error("Invalid session response")}
      if(r.status===429||r.status>=500){apiUnavailable=true;hide();return {verified:false,unavailable:true}}
      return {verified:d.verified===true,unavailable:false};
    }catch{return {verified:false,unavailable:true}}
  }
  async function trigger(){if(!popupEnabled||verified||apiUnavailable||coolingDown()||root.classList.contains("cz-open"))return;const s=await check();if(s.verified){verified=true;return}if(s.unavailable)return;show()}
  check().then(s=>{verified=s.verified;apiUnavailable=s.unavailable;if(!verified&&!apiUnavailable)window.setTimeout(trigger,5000)});
  document.getElementById("cz-tg-continue").addEventListener("click",async()=>{
    if(started||apiUnavailable||coolingDown())return;started=true;
    const btn=document.getElementById("cz-tg-continue"),error=document.getElementById("cz-tg-error");btn.textContent="Connecting to Telegram…";btn.disabled=true;error.textContent="";
    try{
      const r=await fetch(API+"/start",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({return_url:location.href})});
      const raw=await r.text();if(isLimitResponse(r.status,raw)){setCooldown();apiUnavailable=true;hide();return}
      let d={};try{d=JSON.parse(raw)}catch{throw new Error("Telegram API returned an invalid response. Please try again later.")}
      if(!r.ok||!d.bot_url)throw new Error(d.error||`Could not start Telegram verification (HTTP ${r.status})`);
      const tab=window.open(d.bot_url,"_blank","noopener");if(!tab)location.href=d.bot_url;
    }catch(e){error.textContent=e.message||"Please try again.";btn.textContent="Continue with Telegram Bot";btn.disabled=false;started=false}
  });
  window.addEventListener("pageshow",async()=>{const s=await check();if(s.verified){verified=true;hide()}});
  window.addEventListener("focus",async()=>{const s=await check();if(s.verified){verified=true;hide()}});
  window.addEventListener("popstate",async()=>{const s=await check();if(s.verified){verified=true;hide()}});
})();
