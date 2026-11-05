(function(){
  "use strict";
  if(window.__CZ_COMMUNITY_POPUP__)return;
  window.__CZ_COMMUNITY_POPUP__=true;
  var TEMPLATE="/telegram-popup.html",STYLE="/telegram-popup.css",LINK="https://t.me/+pN15_8gc54s2NDU1";
  var shown=0,maxPopups=3,stopped=false,markupCache="";
  function load(){
    var css=document.createElement("link");css.rel="stylesheet";css.href=STYLE+"?v=2";document.head.appendChild(css);
    fetch(TEMPLATE+"?v=2",{credentials:"same-origin"}).then(function(r){if(!r.ok)throw new Error("Popup template unavailable");return r.text();}).then(function(html){
      markupCache=html;
      window.setTimeout(showNext,5000);
    }).catch(function(err){console.warn("CRICZONE community popup:",err);window.__CZ_COMMUNITY_POPUP__=false;});
  }
  function showNext(){
    if(stopped||shown>=maxPopups||!markupCache)return;
    var holder=document.createElement("div");holder.innerHTML=markupCache;
    var backdrop=holder.firstElementChild;if(!backdrop)return;
    document.body.appendChild(backdrop);
    var modal=backdrop.querySelector(".cz-community-modal");
    var close=backdrop.querySelector(".cz-community-close");
    var join=backdrop.querySelector(".cz-community-join");
    var design=(shown%3)+1;shown++;
    modal.classList.remove("cz-style-1","cz-style-2","cz-style-3");
    modal.classList.add("cz-style-"+design);
    join.href=LINK;
    var finished=false;
    function dismiss(continueSequence){
      if(finished)return;finished=true;
      backdrop.classList.remove("cz-visible");
      window.setTimeout(function(){backdrop.remove();},280);
      if(continueSequence&&shown<maxPopups&&!stopped){
        window.setTimeout(showNext,5000);
      }
    }
    close.addEventListener("click",function(){dismiss(true);});
    backdrop.addEventListener("click",function(e){if(e.target===backdrop)dismiss(true);});
    join.addEventListener("click",function(){stopped=true;dismiss(false);});
    function onKey(e){if(e.key==="Escape"&&!finished){dismiss(true);document.removeEventListener("keydown",onKey);}}
    document.addEventListener("keydown",onKey);
    backdrop.hidden=false;
    window.requestAnimationFrame(function(){backdrop.classList.add("cz-visible");});
  }
  function init(){if(!document.body)return;load();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();