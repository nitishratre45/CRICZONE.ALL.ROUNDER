(function(){
  "use strict";
  if(window.__CZ_COMMUNITY_POPUP__)return;
  window.__CZ_COMMUNITY_POPUP__=true;
  var TEMPLATE="/telegram-popup.html",STYLE="/telegram-popup.css",LINK="https://t.me/+pN15_8gc54s2NDU1";
  var messages=[
    {title:"Never Miss a Match Update! 🏏",copy:"Join CRICZONE on Telegram for live cricket alerts, match updates and breaking sports news."},
    {title:"Your Cricket Community Awaits! 💙",copy:"Be part of the CRICZONE family. Get important updates and cricket news right on Telegram."},
    {title:"Stay One Step Ahead! 🚀",copy:"Join now and stay connected with the latest match updates. Don't miss the action!"}
  ];
  var current=0,markup="";
  function show(){
    if(current>=messages.length||!markup)return;
    var wrap=document.createElement("div");wrap.innerHTML=markup;
    var backdrop=wrap.firstElementChild;if(!backdrop)return;
    document.body.appendChild(backdrop);
    var title=backdrop.querySelector("#cz-community-title"),copy=backdrop.querySelector("#cz-community-copy");
    var step=backdrop.querySelector("#cz-community-step"),close=backdrop.querySelector(".cz-community-close"),join=backdrop.querySelector(".cz-community-join");
    var item=messages[current];title.textContent=item.title;copy.textContent=item.copy;step.textContent=(current+1)+" / 3";join.href=LINK;
    current++;
    var closed=false;
    function dismiss(next){
      if(closed)return;closed=true;backdrop.classList.remove("cz-visible");
      window.setTimeout(function(){backdrop.remove();if(next&&current<messages.length)window.setTimeout(show,900);},220);
    }
    close.addEventListener("click",function(){dismiss(true);});
    backdrop.addEventListener("click",function(e){if(e.target===backdrop)dismiss(true);});
    join.addEventListener("click",function(){dismiss(false);});
    function onKey(e){if(e.key==="Escape"&&!closed){dismiss(true);document.removeEventListener("keydown",onKey);}}
    document.addEventListener("keydown",onKey);
    backdrop.hidden=false;window.requestAnimationFrame(function(){backdrop.classList.add("cz-visible");});
  }
  function init(){
    var css=document.createElement("link");css.rel="stylesheet";css.href=STYLE+"?v=3";document.head.appendChild(css);
    fetch(TEMPLATE+"?v=3",{credentials:"same-origin"}).then(function(r){if(!r.ok)throw new Error("Popup template unavailable");return r.text();}).then(function(html){markup=html;window.setTimeout(show,5000);}).catch(function(e){console.warn("CRICZONE Telegram popup:",e);window.__CZ_COMMUNITY_POPUP__=false;});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();