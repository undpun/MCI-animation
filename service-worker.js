const CACHE_VERSION='mci-2d-v6.8.0-walk-1';
const APP_SHELL=[
  './',
  './index.html',
  './mci-client.js',
  './mci-phone.css',
  './mci-phone.js',
  './mci-walk.js',
  './mci-walk.css',
  './asset-manifest.json',
  './offline.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_VERSION).then(cache=>cache.addAll(APP_SHELL)));
  // Activate after older tabs close; never interrupt an active game session.
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith('mci-2d-')&&key!==CACHE_VERSION).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);

  // Firebase and every cross-origin request must always use the live network.
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith(
      fetch(request)
        .then(response=>{
          const copy=response.clone();
          if(response.ok)caches.open(CACHE_VERSION).then(cache=>cache.put('./index.html',copy)).catch(()=>{});
          return response;
        })
        .catch(()=>caches.match('./index.html').then(hit=>hit||caches.match('./offline.html')))
    );
    return;
  }

  if(url.pathname.includes('/assets-v66/')||url.pathname.includes('/assets-walk-v68/')||url.pathname.includes('/icons/')||url.pathname.endsWith('/mci-client.js')||url.pathname.endsWith('/mci-phone.css')||url.pathname.endsWith('/mci-phone.js')||url.pathname.endsWith('/mci-walk.js')||url.pathname.endsWith('/mci-walk.css')||url.pathname.endsWith('/asset-manifest.json')){
    event.respondWith(
      caches.match(request).then(hit=>hit||fetch(request).then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE_VERSION).then(cache=>cache.put(request,copy)).catch(()=>{});
        }
        return response;
      }))
    );
  }
});
