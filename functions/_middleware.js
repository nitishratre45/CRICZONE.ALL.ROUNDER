import { onRequest as channels } from "./api/channels.js";

const COUNTER_MARKER = "__CRICZONE_TOTAL_COUNTER__";
const COUNTER_SCRIPT = '<script src="/assets/js/cz-global-counter.js?v=20261114" defer></script>';
const NAVBAR_SCRIPT = '<script src="/assets/js/cz-counter-navbar.js?v=1" defer></script>';

const apiError=(error,path,method)=>new Response(JSON.stringify({ok:false,source:"criczone-pages-middleware",path,method,error:String(error?.message||error||"Unknown runtime error")}),{status:500,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

async function injectGlobalCounter(response) {
  const html = await response.clone().text();
  const hasLegacyCounter = html.includes(COUNTER_MARKER);
  const hasGlobalCounter = html.includes("cz-global-counter.js");
  const hasNavbarScript = html.includes("cz-counter-navbar.js");
  const scripts = [];
  if (!hasLegacyCounter && !hasGlobalCounter) scripts.push(COUNTER_SCRIPT);
  if (!hasNavbarScript) scripts.push(NAVBAR_SCRIPT);
  if (!scripts.length) return response;

  const injection = scripts.join("");
  const injected = html.includes("</body>")
    ? html.replace(/<\/body>/i, injection + "</body>")
    : html + injection;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("content-md5");
  headers.delete("etag");
  headers.set("x-criczone-counter-injected", "global-navbar-v1");
  return new Response(injected, {status:response.status,statusText:response.statusText,headers});
}

export async function onRequest(context){
  const {request}=context;
  const path=new URL(request.url).pathname;
  const method=request.method;
  try {
    if(path==="/api/channels") return await channels(context);
    const response=await context.next();
    const contentType=response.headers.get("content-type")||"";
    if(method!=="GET" || !contentType.toLowerCase().includes("text/html") || response.status!==200) return response;
    return await injectGlobalCounter(response);
  } catch(error) {
    console.error("CRICZONE Pages middleware error",path,method,error);
    return apiError(error,path,method);
  }
}
