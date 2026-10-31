import { onRequest as channels } from "./api/channels.js";
import { onRequest as telegramStart } from "./api/telegram/start.js";
import { onRequest as telegramRepairWebhook } from "./api/telegram/repair-webhook.js";
import { onRequest as telegramSetup } from "./api/telegram/setup.js";
import { onRequest as telegramCategories } from "./api/telegram/categories.js";
import { onRequest as telegramSettings } from "./api/telegram/settings.js";
import { onRequestGet as telegramAccess } from "./api/telegram/access.js";
import { onRequestPost as telegramWebhook } from "./api/telegram/webhook.js";
import { onRequestGet as telegramComplete } from "./api/telegram/complete.js";
import { onRequestGet as telegramSession } from "./api/telegram/session.js";
import { onRequestGet as telegramStatus } from "./api/telegram/status.js";
const apiError=(error,path,method)=>new Response(JSON.stringify({ok:false,source:"criczone-pages-middleware",path,method,error:String(error?.message||error||"Unknown runtime error")}),{status:500,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
export async function onRequest(context){const {request}=context,path=new URL(request.url).pathname,method=request.method;try{
if(path==="/api/channels")return await channels(context);
if(path==="/api/telegram/start")return await telegramStart(context);
if(path==="/api/telegram/repair-webhook")return await telegramRepairWebhook(context);
if(path==="/api/telegram/setup")return await telegramSetup(context);
if(path==="/api/telegram/categories")return await telegramCategories(context);
if(path==="/api/telegram/settings")return await telegramSettings(context);
if(path==="/api/telegram/access"&&method==="GET")return await telegramAccess(context);
if(path==="/api/telegram/webhook"&&method==="POST")return await telegramWebhook(context);
if(path==="/api/telegram/complete"&&method==="GET")return await telegramComplete(context);
if(path==="/api/telegram/session"&&method==="GET")return await telegramSession(context);
if(path==="/api/telegram/status"&&method==="GET")return await telegramStatus(context);
// Add the same simple Telegram channel popup to every public HTML page.
const response = await context.next();
const contentType = response.headers.get("Content-Type") || "";
if (method !== "GET" || !contentType.includes("text/html") ||
    /(^|\/)admin(?:\/|[-.]|$)/i.test(path) ||
    /admin/i.test(path.split("/").pop() || "")) return response;
const popupScript = '<script src="/assets/js/telegram-membership-gate.js?v=normal4" defer></script>';
return new HTMLRewriter().on("body", {
  element(element) { element.append(popupScript, { html: true }); }
}).transform(response);
}catch(error){console.error("CRICZONE Pages middleware error",path,method,error);return apiError(error,path,method)}}
