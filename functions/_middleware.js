import { onRequest as channels } from "./api/channels.js";

const apiError=(error,path,method)=>new Response(JSON.stringify({ok:false,source:"criczone-pages-middleware",path,method,error:String(error?.message||error||"Unknown runtime error")}),{status:500,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

export async function onRequest(context){
  const {request}=context;
  const path=new URL(request.url).pathname;
  const method=request.method;
  try {
    if(path==="/api/channels") return await channels(context);
    const response=await context.next();
    const contentType=response.headers.get("content-type")||"";
    if(method!=="GET" || !contentType.toLowerCase().includes("text/html") || response.status!==200) return response;
    return new HTMLRewriter()
      .on("body", { element(element){ element.append('<script src="/telegram-popup.js?v=1" defer></script>',{html:true}); } })
      .transform(response);
  } catch(error) {
    console.error("CRICZONE Pages middleware error",path,method,error);
    return apiError(error,path,method);
  }
}
