import { onRequest as channels } from "./api/channels.js";

const COUNTER_MARKER = "__CRICZONE_TOTAL_COUNTER__";
const COUNTER_SCRIPT = '<script src="/assets/js/cz-global-counter.js?v=20261114" defer></script>';

const apiError=(error,path,method)=>new Response(JSON.stringify({ok:false,source:"criczone-pages-middleware",path,method,error:String(error?.message||error||"Unknown runtime error")}),{status:500,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

function injectGlobalCounter(response) {
  return response.text().then(html => {
    // The two pages that already contain the full counter keep their existing
    // implementation. This prevents duplicate heartbeats and duplicate badges.
    if (html.includes(COUNTER_MARKER) || html.includes("cz-global-counter.js")) {
      return new Response(html, {status:response.status,statusText:response.statusText,headers:response.headers});
    }
    const injected = html.includes("</body>")
      ? html.replace(/</body>/i, COUNTER_SCRIPT + "</body>")
      : html + COUNTER_SCRIPT;
    const headers = new Headers(response.headers);
    // The body has been decoded and rebuilt; stale encoded-body metadata is invalid.
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("content-md5");
    headers.delete("etag");
    headers.set("x-criczone-counter-injected", "global-v1");
    return new Response(injected, {status:response.status,statusText:response.statusText,headers});
  });
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
