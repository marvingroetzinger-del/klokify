const VERSION="v37.0";
const CACHE=`arbeitszeit-${VERSION}`;
const APP_SHELL=[
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "icon.svg"
];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(
      keys
        .filter(key=>key.startsWith("arbeitszeit-") && key!==CACHE)
        .map(key=>caches.delete(key))
    );
    await self.clients.claim();
  })());
});

async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:"no-store"});
    if(response && response.ok && request.method==="GET"){
      await cache.put(request,response.clone());
    }
    return response;
  }catch(error){
    const cached=await cache.match(request,{ignoreSearch:true});
    if(cached) return cached;

    if(request.mode==="navigate"){
      const fallback=await cache.match("index.html");
      if(fallback) return fallback;
    }
    throw error;
  }
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET") return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  // Online immer die aktuelle Netlify-Datei bevorzugen.
  // Der Cache ist ausschließlich Offline-Fallback.
  event.respondWith(networkFirst(request));
});
