/* CRICZONE Global Loading + Community Popup — shared across all site folders */
(function () {
  if (window.__CZ_GLOBAL_COMMUNITY__) return;
  window.__CZ_GLOBAL_COMMUNITY__ = true;

  var photos = [
    { name: "ROHIT SHARMA", src: "https://www.bcci.tv/_next/image?q=75&url=%2Fapi%2Fteam-assets%3Fpathname%3Dsquad%252F11326.png%26brand%3Dbcci%26fallback%3Dfallback-player-men&w=3840" },
    { name: "VIRAT KOHLI", src: "https://static-files.cricket-australia.pulselive.com/headshots/440/10917-camedia.png" }
  ];
  var telegram = "https://t.me/+pN15_8gc54s2NDU1";

  /* Replace cricket emoji in site navbar/brand marks with rotating player portraits. */
  var logoPhotoIndex = 0;
  function updateBrandPhotos(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var candidates = scope.querySelectorAll(".cz-brand-mark,.brand-mark,.brand-icon,.logo-icon,[class*='brand-mark']");
    candidates.forEach(function (el) {
      if (el.dataset.czPlayerLogo === "1") return;
      var hasCricketEmoji = (el.textContent || "").trim() === "🏏";
      var isLogoContainer = /brand-mark|brand-icon|logo-icon/i.test(el.className || "");
      if (!hasCricketEmoji && !isLogoContainer) return;
      if (!hasCricketEmoji && el.querySelector("img,svg")) return;
      el.dataset.czPlayerLogo = "1";
      el.classList.add("cz-player-brand-photo");
      var img = document.createElement("img");
      img.className = "cz-player-brand-img";
      img.alt = photos[logoPhotoIndex].name;
      img.src = photos[logoPhotoIndex].src;
      el.replaceChildren(img);
    });
  }
  var brandPhotoStyle = document.createElement("style");
  brandPhotoStyle.textContent = ".cz-player-brand-photo{overflow:hidden!important;padding:0!important}.cz-player-brand-photo{border:1px solid rgba(116,231,178,.48)!important;box-shadow:0 0 0 2px rgba(116,231,178,.08),0 5px 16px rgba(0,0,0,.28)!important;background:#10251c!important}.cz-player-brand-img{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:center 20%!important;border-radius:inherit!important;opacity:1;transition:opacity .22s ease,transform .35s ease!important}.cz-player-brand-photo:hover .cz-player-brand-img{transform:scale(1.06)}@media(prefers-reduced-motion:reduce){.cz-player-brand-img{transition:none!important}.cz-player-brand-photo:hover .cz-player-brand-img{transform:none}}";
  document.head.appendChild(brandPhotoStyle);
  updateBrandPhotos(document);
  var brandObserver = new MutationObserver(function(){ updateBrandPhotos(document); });
  brandObserver.observe(document.documentElement,{childList:true,subtree:true});
  window.setInterval(function(){
    logoPhotoIndex = (logoPhotoIndex + 1) % photos.length;
    document.querySelectorAll(".cz-player-brand-img").forEach(function(img){
      img.style.opacity = "0.35";
      window.setTimeout(function(){img.src=photos[logoPhotoIndex].src;img.alt=photos[logoPhotoIndex].name;img.style.opacity="1";},140);
    });
  },1000);
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
    #cz-global-community .cz-community-join{min-height:60px;display:flex;align-items:center;justify-content:center;gap:12px;border:1px solid #a9baff55;border-radius:17px;background:linear-gradient(105deg,#7838e8,#285fe9 58%,#168bd4);color:#fff;text-decoration:none;font-size:14px;font-weight:900;letter-spacing:.8px;box-shadow:0 12px 30px #4934d94a;transition:transform .2s ease,filter .2s ease,box-shadow .2s ease}
    #cz-global-community .cz-community-join:hover{transform:translateY(-2px);filter:brightness(1.1);box-shadow:0 16px 36px #4934d977}
    #cz-global-community .cz-community-join:focus-visible,#cz-global-community .cz-community-close:focus-visible{outline:2px solid #d5ef7b;outline-offset:4px}
    #cz-global-community .cz-community-join span:first-child{font-size:22px}
    #cz-global-community .cz-community-foot{margin:16px 0 0;color:#89839d;font-size:10px;letter-spacing:1.5px;font-weight:800}
    #cz-global-community .cz-community-trust{margin:9px 0 0;color:#aaa6b8;font-size:11px;line-height:1.4}
    #cz-global-community .cz-community-cat{transition:transform .2s ease,border-color .2s ease,background .2s ease}
    #cz-global-community .cz-community-cat:hover{transform:translateY(-2px);border-color:#8b5cf64a;background:#8b5cf615}
    @media(max-height:650px){#cz-global-community{align-items:start;overflow-y:auto}#cz-global-community .cz-community-card{margin:auto;padding:22px 18px}#cz-global-community .cz-community-photo{width:68px;height:68px;margin-bottom:10px}#cz-global-community .cz-community-copy{margin:8px auto 14px}#cz-global-community .cz-community-cats{margin-bottom:14px}#cz-global-community .cz-community-foot{margin-top:12px}}
    @media(max-width:380px){#cz-global-community .cz-community-card{padding:26px 16px 21px}#cz-global-community .cz-community-cats{gap:7px}#cz-global-community .cz-community-cat{padding:12px 3px;font-size:11px}}
    /* Hard viewport centering: prevent popup clipping on narrow screens and short viewports */
    #cz-global-community{position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:0!important;width:100vw!important;height:100vh!important;height:100dvh!important;min-width:0!important;max-width:100vw!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow-x:hidden!important;overflow-y:auto!important;padding:16px!important}
    #cz-global-community .cz-community-card{display:block!important;flex:0 1 440px!important;width:100%!important;max-width:440px!important;min-width:0!important;max-height:calc(100dvh - 32px)!important;margin:0 auto!important;box-sizing:border-box!important;overflow-y:auto!important;overscroll-behavior:contain}
    #cz-global-community .cz-community-cats{width:100%;grid-template-columns:repeat(3,minmax(0,1fr))}
    #cz-global-community .cz-community-cat{min-width:0;overflow-wrap:anywhere}
    @media(max-width:560px){
      #cz-global-community{padding:12px!important}
      #cz-global-community .cz-community-card{flex-basis:auto;width:100%!important;max-width:420px!important;max-height:calc(100dvh - 24px)!important;padding:24px 16px 20px!important;border-radius:22px}
      #cz-global-community .cz-community-photo{width:76px;height:76px;margin:2px auto 12px}
      #cz-global-community .cz-community-copy{margin:9px auto 16px;font-size:13px}
      #cz-global-community .cz-community-cat{padding:12px 4px 10px;font-size:11px}
      #cz-global-community .cz-community-cat b{font-size:22px}
      #cz-global-community .cz-community-join{min-height:54px;font-size:12px}
    }
    @media(max-height:620px){
      #cz-global-community{align-items:flex-start!important}
      #cz-global-community .cz-community-card{margin:auto!important;max-height:calc(100dvh - 24px)!important;padding:17px 16px!important}
      #cz-global-community .cz-community-photo{width:58px;height:58px;margin:0 auto 8px}
      #cz-global-community .cz-community-tag{margin-bottom:7px;padding:6px 10px}
      #cz-global-community .cz-community-copy{margin:7px auto 10px}
      #cz-global-community .cz-community-cats{margin-bottom:11px}
      #cz-global-community .cz-community-foot{margin-top:9px}
    }
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
  var rotateTimer=window.setInterval(function(){setPhoto(photoIndex+1);},1000);

  var popup=document.createElement("div");
  popup.id="cz-global-community";
  popup.innerHTML='<section class="cz-community-card" role="dialog" aria-modal="true" aria-labelledby="cz-community-title"><button class="cz-community-close" type="button" aria-label="Close">×</button><div class="cz-community-photo"><img alt="CRICZONE community" /></div><div class="cz-community-tag">✦ CRICZONE COMMUNITY</div><h2 id="cz-community-title">Join Our Channels</h2><p class="cz-community-copy">For Clips, Links and Premium Contents</p><div class="cz-community-cats"><div class="cz-community-cat"><b>🎬</b>Clips</div><div class="cz-community-cat"><b>🔗</b>Links</div><div class="cz-community-cat"><b>⭐</b>Premium</div></div><a class="cz-community-join" href="'+telegram+'" target="_self" rel="noopener noreferrer" role="button" aria-label="Open CRICZONE Telegram invite"><span>✈</span><span>JOIN TELEGRAM</span><span>➜</span></a><div class="cz-community-foot">CRICZONE • COMMUNITY</div><p class="cz-community-trust">Free to join · Get updates in our Telegram community</p></section>';
  document.documentElement.appendChild(popup);
  var popupImg=popup.querySelector(".cz-community-photo img");
  var popupPhotoIndex=0;
  function setPopupPhoto(index){popupPhotoIndex=index%photos.length;popupImg.src=photos[popupPhotoIndex].src;popupImg.alt=photos[popupPhotoIndex].name;}
  setPopupPhoto(0);
  var popupRotate=window.setInterval(function(){setPopupPhoto(popupPhotoIndex+1);},3000);

  function closePopup(){popup.classList.remove("cz-show");}
  /* Navigate directly to the invite in the same tab so desktop Telegram/browser handoff is not blocked as a popup. */
  var joinLink=popup.querySelector(".cz-community-join");
  joinLink.addEventListener("click",function(event){
    event.preventDefault();
    window.location.assign(telegram);
  });

  /* Dismiss only through the explicit close button. */
  popup.querySelector(".cz-community-close").addEventListener("click",closePopup);

  /* Hide the loading screen after 2 seconds; show the community popup at 5 seconds. */
  window.setTimeout(function(){
    window.clearInterval(rotateTimer);
    loader.classList.add("cz-hide");
  },2000);
  window.setTimeout(function(){
    popup.classList.add("cz-show");
    popup.querySelector(".cz-community-close").focus({preventScroll:true});
  },5000);
  window.addEventListener("pagehide",function(){window.clearInterval(rotateTimer);window.clearInterval(popupRotate);legacyObserver.disconnect();});
})();