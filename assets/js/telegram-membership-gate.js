(function () {
  if (window.__CZ_NORMAL_CHANNEL_POPUP__) return;
  window.__CZ_NORMAL_CHANNEL_POPUP__ = true;

  const CHANNEL = "https://t.me/criczonelive";
  const PHOTO = "/photos/photo_2026-10-28_14-52-23.jpg";
  const messages = [
    { tag: "CRICZONE COMMUNITY", title: "Join Our Telegram Channel", text: "Get cricket updates, match alerts and the latest CRICZONE announcements in one place.", button: "Join Telegram Channel" },
    { tag: "MATCH DAY UPDATES", title: "Stay Close to Every Match", text: "Follow our Telegram channel for live match updates, important notices and cricket content.", button: "Join for Match Updates" },
    { tag: "DON'T MISS OUT", title: "Be Part of CRICZONE", text: "Join the official channel and stay connected with the CRICZONE cricket community.", button: "Join @criczonelive" }
  ];
  let step = 0, timer = 0, showing = false;
  const style = document.createElement("style");
  style.textContent = `
    #cz-normal-overlay{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:18px;padding-top:max(18px,env(safe-area-inset-top));padding-bottom:max(18px,env(safe-area-inset-bottom));background:rgba(3,7,13,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
    #cz-normal-overlay.cz-visible{display:flex;animation:czFade .2s ease}
    #cz-normal-card{position:relative;width:min(100%,390px);overflow:hidden;border:1px solid rgba(255,255,255,.13);border-radius:23px;background:linear-gradient(155deg,#182333,#0c121d 70%);color:#f8fafc;text-align:center;box-shadow:0 24px 80px #0009;animation:czRise .25s ease}
    #cz-normal-card .cz-photo{width:100%;height:clamp(210px,34vh,280px);display:block;object-fit:contain;object-position:center;background:#0c121d}
    /* Three deliberately different popup layouts */
    #cz-normal-overlay.cz-style-2{background:rgba(0,12,28,.86)}
    #cz-normal-overlay.cz-style-2 #cz-normal-card{border:1px solid #2367a8;border-radius:16px;background:linear-gradient(160deg,#102d4a,#071421);box-shadow:0 22px 70px #001b36aa}
    #cz-normal-overlay.cz-style-2 #cz-normal-card .cz-photo{height:clamp(230px,38vh,310px);object-fit:contain;object-position:center;background:#071421}
    #cz-normal-overlay.cz-style-2 #cz-normal-card .cz-content{padding:22px 24px 25px}
    #cz-normal-overlay.cz-style-2 #cz-normal-card .cz-tag{border:1px solid #3989c8;border-radius:6px;background:#123c60;color:#9bd8ff}
    #cz-normal-overlay.cz-style-2 #cz-normal-card .cz-join{border-radius:999px;background:#229ed9;color:white}
    #cz-normal-overlay.cz-style-3{background:rgba(4,8,15,.84);backdrop-filter:blur(15px)}
    #cz-normal-overlay.cz-style-3 #cz-normal-card{border:2px solid #d5a83c;border-radius:30px;background:linear-gradient(145deg,#fff8e8,#f1e4c9);color:#171717;box-shadow:0 24px 90px #000b}
    #cz-normal-overlay.cz-style-3 #cz-normal-card .cz-photo{height:clamp(190px,29vh,245px);object-fit:contain;object-position:center;background:#ead9b5}
    #cz-normal-overlay.cz-style-3 #cz-normal-card .cz-content{padding:24px 22px 25px}
    #cz-normal-overlay.cz-style-3 #cz-normal-card .cz-tag{border:0;border-radius:5px;background:#17283c;color:#ffdc83}
    #cz-normal-overlay.cz-style-3 #cz-normal-card p{color:#4e5660}
    #cz-normal-overlay.cz-style-3 #cz-normal-card .cz-join{border-radius:8px;background:#14283e;color:#fff;box-shadow:0 5px 14px #14283e33}
    #cz-normal-card .cz-content{transition:all .2s ease}
    #cz-normal-card:before{content:"";position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,#ffcf55,#f28a20);z-index:2}
    #cz-normal-card .cz-join{transition:transform .18s ease,filter .18s ease,box-shadow .18s ease;box-shadow:0 8px 22px #0003}
    #cz-normal-card .cz-join:active{transform:scale(.98);filter:brightness(.96)}
    #cz-normal-card .cz-join:focus-visible{outline:3px solid #fff;outline-offset:4px}
    #cz-normal-overlay.cz-style-2 #cz-normal-card{animation:czSlide .34s cubic-bezier(.2,.8,.2,1)}
    #cz-normal-overlay.cz-style-3 #cz-normal-card{animation:czPop .38s cubic-bezier(.2,.8,.2,1)}
    @keyframes czSlide{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
    @keyframes czPop{from{opacity:0;transform:scale(.92) rotate(-1deg)}to{opacity:1;transform:scale(1) rotate(0)}}
    @media(hover:hover){#cz-normal-card .cz-join:hover{transform:translateY(-2px);filter:brightness(1.06);box-shadow:0 12px 26px #0004}}
    #cz-normal-card .cz-content{padding:21px 22px 20px}
    #cz-normal-card .cz-tag{display:inline-block;padding:6px 10px;border:1px solid #66501e;border-radius:99px;background:#302612;color:#ffd36b;font-size:10px;font-weight:850;letter-spacing:1px}
    #cz-normal-card h2{margin:13px 0 9px;font-size:clamp(22px,6vw,27px);line-height:1.15;font-weight:850;letter-spacing:-.5px}
    #cz-normal-card p{margin:0 auto 18px;max-width:310px;color:#b4c0cf;font-size:14px;line-height:1.55}
    #cz-normal-card .cz-join{display:flex;min-height:49px;align-items:center;justify-content:center;width:100%;border-radius:12px;background:linear-gradient(135deg,#ffc94f,#ff941c);color:#17120a;font-weight:850;font-size:14px;text-decoration:none}
    #cz-normal-card .cz-later{display:block;margin:13px auto 0;padding:7px 12px;border:0;background:transparent;color:#a9b4c3;font-size:13px;font-weight:650;cursor:pointer}
    #cz-normal-card .cz-count{margin-top:8px;color:#78869a;font-size:11px}
    @keyframes czFade{from{opacity:0}to{opacity:1}}@keyframes czRise{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
    @media(max-width:380px){#cz-normal-card .cz-photo{height:clamp(190px,32vh,250px)}#cz-normal-card .cz-content{padding:18px 17px}}
    @media(prefers-reduced-motion:reduce){#cz-normal-overlay,#cz-normal-card{animation:none}}
  `;
  document.head.appendChild(style);
  const overlay=document.createElement("div");
  overlay.id="cz-normal-overlay";
  overlay.innerHTML='<section id="cz-normal-card" role="dialog" aria-modal="true" aria-labelledby="cz-normal-title"><img class="cz-photo" src="'+PHOTO+'" alt="CRICZONE cricket"><div class="cz-content"><span class="cz-tag" id="cz-normal-tag"></span><h2 id="cz-normal-title"></h2><p id="cz-normal-text"></p><a class="cz-join" id="cz-normal-join" href="'+CHANNEL+'" target="_blank" rel="noopener">Join Telegram Channel</a></div></section>';
  document.body.appendChild(overlay);
  const $=id=>document.getElementById(id);
  function closeStep(){
    overlay.classList.remove("cz-visible");
    document.body.style.overflow="";
    showing=false;
    step++;
    if(step<messages.length) showStep();
  }
  function showStep(){
    if(step>=messages.length||showing)return;
    const m=messages[step];
    overlay.classList.remove("cz-style-2","cz-style-3");
    if(step===1) overlay.classList.add("cz-style-2");
    if(step===2) overlay.classList.add("cz-style-3");
    $("cz-normal-tag").textContent=m.tag;
    $("cz-normal-title").textContent=m.title;
    $("cz-normal-text").textContent=m.text;
    $("cz-normal-join").textContent=m.button;
    overlay.classList.add("cz-visible");
    document.body.style.overflow="hidden";
    showing=true;
  }
  overlay.addEventListener("click",e=>{if(e.target===overlay)closeStep()});
  window.addEventListener("keydown",e=>{if(e.key==="Escape"&&showing)closeStep()});
  timer=window.setTimeout(showStep,5000);
})();