const CACHE='savenest-shell-v9';
const FILES=['./','./index.html','./manifest.webmanifest','./icon.svg'];
const FIREBASE_PREFIX='https://www.gstatic.com/firebasejs/';
const INDEX_URL=()=>new URL('./index.html',self.registration.scope).href;

// Install: fetch the shell straight from the network (bypass the HTTP cache) so a
// new version can never be built from a stale copy. Activate immediately.
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>c.add(new Request(f,{cache:'reload'}))))));
});

// Activate: drop old caches, take control of open pages, and if this is an upgrade
// reload any already-open (possibly stale) windows once so they run the new code.
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const keys=await caches.keys();
  const upgraded=keys.some(k=>k!==CACHE);
  await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
  if(upgraded){
    const wins=await self.clients.matchAll({type:'window'});
    wins.forEach(c=>{try{c.navigate(c.url).catch(()=>{})}catch(err){}});
  }
})()));

// Same-origin files: network first (revalidated), cache only as the offline fallback.
async function networkFirst(req){
  const cache=await caches.open(CACHE);
  const isNav=req.mode==='navigate';
  const key=isNav?INDEX_URL():req.url;
  try{
    const res=await fetch(req.url,{cache:'no-cache'});
    if(res&&res.ok&&res.type==='basic')await cache.put(key,res.clone());
    return res;
  }catch(err){
    const hit=await cache.match(key,{ignoreSearch:true});
    if(hit)return hit;
    if(isNav){const idx=await cache.match(INDEX_URL());if(idx)return idx}
    return Response.error();
