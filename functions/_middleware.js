import { onRequest as channels } from "./api/channels.js";

const COUNTER_MARKER = "__CRICZONE_TOTAL_COUNTER__";
const COUNTER_SCRIPT = '<script src="/assets/js/cz-global-counter.js?v=20261116f" defer></script>';

const apiError=(error,path,method)=>new Response(JSON.stringify({ok:false,source:"criczone-pages-middleware",path,method,error:String(error?.message||error||"Unknown runtime error")}),{status:500,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

async function injectGlobalCounter(response) {
  const html = await response.clone().text();
  // Existing counter-enabled pages retain their original response and script.
  if (html.includes(COUNTER_MARKER) || html.includes("cz-global-counter.js")) return response;

  const injected = html.includes("</body>")
    ? html.replace(/<\/body>/i, COUNTER_SCRIPT + "</body>")
    : html + COUNTER_SCRIPT;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("content-md5");
  headers.delete("etag");
  headers.set("x-criczone-counter-injected", "global-v1");
  return new Response(injected, {status:response.status,statusText:response.statusText,headers});
}

export async function onRequest(context){
  const {request}=context;
  const path=new URL(request.url).pathname;
  const method=request.method;
  try {
    if(path==="/api/channels") return await channels(context);
    const response=await context.next();
    // Keep the visitor badge/counter disabled inside /criczone6 and /sonychannels.
    if(path==="/criczone6" || path.startsWith("/criczone6/") || path==="/sonychannels" || path.startsWith("/sonychannels/")) return response;
    const contentType=response.headers.get("content-type")||"";
    if(method!=="GET" || !contentType.toLowerCase().includes("text/html") || response.status!==200) return response;
    return await injectGlobalCounter(response);
  } catch(error) {
    console.error("CRICZONE Pages middleware error",path,method,error);
    return apiError(error,path,method);
  }
}
