const json=(data,status=404)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

// Keep this catch-all as a fallback only, so API handlers are not duplicated.
export async function onRequest({request}) {
  const path = new URL(request.url).pathname;
  return json({ok:false,error:"Unknown API route",path},404);
}
