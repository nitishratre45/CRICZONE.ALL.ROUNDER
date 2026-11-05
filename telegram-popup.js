(function(){
  "use strict";
  if (window.__CZ_COMMUNITY_POPUP__) return;
  window.__CZ_COMMUNITY_POPUP__ = true;
  var TEMPLATE="/telegram-popup.html", STYLE="/telegram-popup.css", LINK="https://t.me/+pN15_8gc54s2NDU1";
  function start(){
    if(document.getElementById("cz-community-backdrop")) return;
    var css=document.createElement("link");css.rel="stylesheet";css.href=STYLE+"?v=1";document.head.appendChild(css);
    fetch(TEMPLATE+"?v=1",{credentials:"same-origin"}).then(function(r){if(!r.ok)throw new Error("popup template unavailable");return r.text();}).then(function(markup){
      var holder=document.createElement("div");holder.innerHTML=markup;var backdrop=holder.firstElementChild;if(!backdrop)return;document.body.appendChild(backdrop);
      var modal=backdrop.querySelector(".cz-community-modal"),close=backdrop.querySelector(".cz-community-close"),join=backdrop.querySelector(".cz-community-join");
      join.href=LINK;
      var index=Number(sessionStorage.getItem("czPopupDesignIndex")||"0")%3;
      modal.classList.remove("cz-style-1","cz-style-2","cz-style-3");modal.classList.add("cz-style-"+(index+1));
      sessionStorage.setItem("czPopupDesignIndex",String((index+1)%3));
      function hide(){backdrop.classList.remove("cz-visible");setTimeout(function(){backdrop.remove();},280);}
      close.addEventListener("click",hide);
      backdrop.addEventListener("click",function(e){if(e.target===backdrop)hide();});
      document.addEventListener("keydown",function esc(e){if(e.key==="Escape"){hide();document.removeEventListener("keydown",esc);}});
      window.setTimeout(function(){backdrop.hidden=false;requestAnimationFrame(function(){backdrop.classList.add("cz-visible");});},30);
    }).catch(function(err){console.warn("CRICZONE popup:",err);window.__CZ_COMMUNITY_POPUP__=false;});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(start,5000);},{once:true});
  else setTimeout(start,5000);
})();