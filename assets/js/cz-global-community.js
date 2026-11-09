/* CRICZONE Global Loading + Community Popup — shared across all site folders */
(function () {
  if (window.__CZ_GLOBAL_COMMUNITY__) return;
  window.__CZ_GLOBAL_COMMUNITY__ = true;

  var photos = [
    { name: "ROHIT SHARMA", src: "https://www.bcci.tv/_next/image?q=75&url=%2Fapi%2Fteam-assets%3Fpathname%3Dsquad%252F11326.png%26brand%3Dbcci%26fallback%3Dfallback-player-men&w=3840" },
    { name: "VIRAT KOHLI", src: "https://static-files.cricket-australia.pulselive.com/headshots/440/10917-camedia.png" }
  ];
  var telegram = "https://t.me/+pN15_8gc54s2NDU1";
  var style = document.createElement("style");
  style.textContent = `
    #cz-global-loader{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 48%,#17112c 0%,#090910 42%,#050509 100%);color:#f7f5ff;font-family:Inter,system-ui,sans-serif;opacity:1;visibility:visible;transition:opacity .45s,visibility .45s}
    #cz-global-loader.cz-hide{opacity:0;visibility:hidden;pointer-events:none}
    #cz-global-loader .cz-load-inner{width:min(82vw,330px);text-align:center}
    #cz-global-loader .cz-photo-frame{width:126px;height:126px;margin:0 auto 25px;border-radius:30px;padding:2px;background:linear-gradient(135deg,#8b5cf6,#2563eb,#a855f7);box-shadow:0 0 65px #7138d755;overflow:hidden}
    #cz-global-loader img{width:100%;height:100%;display:block;object-fit:cover;object-position:center 20%;border-radius:28px;background:#171722;transition:opacity .25s}
    #cz-global-loader .cz-load-brand{font-size:27px;font-weight:900;letter-spacing:5px;margin:0 0 10px}
    #cz-global-loader .cz-load-caption{font-size:11px;letter-spacing:3px;color:#9a91b1;text-transform:uppercase}
    #cz-global-loader .cz-load-track{height:4px;border-radius:20px;background:#ffffff12;margin:34px auto 0;overflow:hidden;width:82%}
    #cz-global-loader .cz-load-track:after{content:"";display:block;height:100%;width:38%;border-radius:20px;background:linear-gradient(90deg,#8b5cf6,#3478ff);animation:cz-load-progress 1.25s ease-in-out infinite alternate}
    @keyframes cz-load-progress{from{transform:translateX(-110%)}to{transform:translateX(270%)}}
    #cz-global-community{position:fixed;inset:0;z-index:2147483645;display:grid;place-items:center;padding:18px;background:#05050bdc;backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px);opacity:0;visibility:hidden;transition:opacity .28s,visibility .28s;font-family:Inter,system-ui,sans-serif;color:#f8f7ff}
    #cz-global-community.cz-show{opacity:1;visibility:visible}
    #cz-global-community .cz-community-card{position:relative;width:min(100%,440px);padding:30px 22px 25px;text-align:center;border:1px solid #ffffff20;border-radius:30px;background:radial-gradient(ellipse at 50% 0%,#6d36a52b,transparent 55%),linear-gradient(145deg,#171323,#090a12 78%);box-shadow:0 25px 90px #000a,0 0 45px #7138d51c;transform:translateY(15px) scale(.98);transition:transform .28s}
    #cz-global-community.cz-show .cz-community-card{transform:none}
    #cz-global-community .cz-community-close{position:absolute;right:13px;top:13px;width:36px;height:36px;border:1px solid #ffffff25;border-radius:50%;background:#ffffff0b;color:#ddd;font-size:23px;cursor:pointer}
    #cz-global-community .cz-community-photo{width:90px;height:90px;margin:4px auto 16px;border-radius:24px;overflow:hidden;border:1px solid #ffffff22;box-shadow:0 0 32px #7040b933}
    #cz-global-community .cz-community-photo img{width:100%;height:100%;object-fit:cover;object-position:center 20%;display:block}
    #cz-global-community .cz-community-tag{display:inline-block;margin-bottom:12px;padding:8px 14px;border:1px solid #8b5cf64a;border-radius:30px;background:#6d36a51b;color:#c8b2ff;font-size:10px;font-weight:900;letter-spacing:1.6px}
    #cz-global-community h2{font-size:clamp(23px,6vw,30px);line-height:1.15;margin:0;font-weight:850;letter-spacing:-.7px}
    #cz-global-community .cz-community-copy{color:#aaa6b8;font-size:14px;line-height:1.55;margin:12px auto 22px;max-width:310px}
    #cz-global-community .cz-community-cats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
    #cz-global-community .cz-community-cat{padding:15px 5px 12px;border:1px solid #ffffff12;border-radius:18px;background:#ffffff08;color:#c8c4d3;font-size:12px}
    #cz-global-community .cz-community-cat b{display:block;font-size:25px;margin-bottom:5px}
    #cz-global-community .cz-community-join{min-height:58px;display:flex;align-items:center;justify-content:center;gap:12px;border-radius:17px;background:linear-gradient(105deg,#7838e8,#285fe9);color:#fff;text-decoration:none;font-size:14px;font-weight:900;letter-spacing:.8px;box-shadow:0 12px 30px #4934d94a}
    #cz-global-community .cz-community-join span:first-child{font-size:22px}
    #cz-global-community .cz-community-foot{margin:20px 0 0;color:#666173;font-size:10px;letter-spacing:3px;font-weight:800}
    @media(max-width:380px){#cz-global-community .cz-community-card{padding:26px 16px 21px}#cz-global-community .cz-community-cats{gap:7px}#cz-global-community .cz-community-cat{padding:12px 3px;font-size:11px}}
    @media(prefers-reduced-motion:reduce){#cz-global-loader,#cz-global-community,#cz-global-community .cz-community-card{transition:none}#cz-global-loader .cz-load-track:after{animation:none}}
  `;
  document.head.appendChild(style);

  function removeLegacyPopups() {
    ["cz-tg-local-modal","cz5-tg-modal","telegramModal","tgOverlay"].forEach(function(id){
      var el=document.getElementById(id); if(el) el.remove();
    });
  }
  removeLegacyPopups();
  var legacyObserver = new MutationObserver(removeLegacyPopups);
  legacyObserver.observe(document.documentElement,{childList:true,subtree:true});

  var loader=document.createElement("div");
  loader.id="cz-global-loader";
  loader.innerHTML='<div class="cz-load-inner"><div class="cz-photo-frame"><img alt="Indian cricket star" /></div><div class="cz-load-brand">CRICZONE</div><div class="cz-load-caption">CONNECTING TO CRICZONE...</div><div class="cz-load-track"></div></div>';
  document.documentElement.appendChild(loader);
  var loadImg=loader.querySelector("img");
  var photoIndex=0;
  function setPhoto(index){
    photoIndex=index%photos.length;
    loadImg.style.opacity="0";
    window.setTimeout(function(){loadImg.src=photos[photoIndex].src;loadImg.alt=photos[photoIndex].name;loadImg.style.opacity="1";},180);
  }
  setPhoto(0);
  var rotateTimer=window.setInterval(function(){setPhoto(photoIndex+1);},2300);

  var popup=document.createElement("div");
  popup.id="cz-global-community";
  popup.innerHTML='<section class="cz-community-card" role="dialog" aria-modal="true" aria-labelledby="cz-community-title"><button class="cz-community-close" type="button" aria-label="Close">×</button><div class="cz-community-photo"><img alt="CRICZONE community" /></div><div class="cz-community-tag">✦ CRICZONE COMMUNITY</div><h2 id="cz-community-title">Join Our Channels</h2><p class="cz-community-copy">For Clips, Links and Premium Contents</p><div class="cz-community-cats"><div class="cz-community-cat"><b>🎬</b>Clips</div><div class="cz-community-cat"><b>🔗</b>Links</div><div class="cz-community-cat"><b>⭐</b>Premium</div></div><a class="cz-community-join" href="'+telegram+'" target="_blank" rel="noopener noreferrer"><span>✈</span><span>JOIN TELEGRAM</span><span>➜</span></a><div class="cz-community-foot">CRICZONE • COMMUNITY</div></section>';
  document.documentElement.appendChild(popup);
  var popupImg=popup.querySelector(".cz-community-photo img");
  var popupPhotoIndex=0;
  function setPopupPhoto(index){popupPhotoIndex=index%photos.length;popupImg.src=photos[popupPhotoIndex].src;popupImg.alt=photos[popupPhotoIndex].name;}
  setPopupPhoto(0);
  var popupRotate=window.setInterval(function(){setPopupPhoto(popupPhotoIndex+1);},3000);

  function closePopup(){popup.classList.remove("cz-show");}
  /* Dismiss only through the explicit close button. */
  popup.querySelector(".cz-community-close").addEventListener("click",closePopup);

  /* Fade the loader out just before the 5-second mark; reveal the popup at 5 seconds. */
  window.setTimeout(function(){
    window.clearInterval(rotateTimer);
    loader.classList.add("cz-hide");
  },4550);
  window.setTimeout(function(){
    popup.classList.add("cz-show");
  },5000);
  window.addEventListener("pagehide",function(){window.clearInterval(rotateTimer);window.clearInterval(popupRotate);legacyObserver.disconnect();});
})();