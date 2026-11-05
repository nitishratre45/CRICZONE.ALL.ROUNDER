import { onRequest as channels } from "./api/channels.js";

const apiError=(error,path,method)=>new Response(JSON.stringify({ok:false,source:"criczone-pages-middleware",path,method,error:String(error?.message||error||"Unknown runtime error")}),{status:500,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

export async function onRequest(context){
  const {request}=context;
  const path=new URL(request.url).pathname;
  const method=request.method;
  try {
    if(path==="/api/channels") return await channels(context);
    return await context.next();
  } catch(error) {
    console.error("CRICZONE Pages middleware error",path,method,error);
    return apiError(error,path,method);
  }
}
