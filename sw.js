/* what the realm keeps between visits.
   the page itself is asked for afresh every time, so a new one is never missed;
   everything else is served from the store the moment it has been seen once.

   the store is named after the asset version the page registered this with
   (sw.js?v=N), so bumping ASSET_VERSION brings in a fresh store and the old
   one - every file of it - is thrown away rather than kept forever. */

const VERSION = new URL(self.location.href).searchParams.get("v") || "0";
const STORE = "ash-queen-v" + VERSION;

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== STORE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function isPage(req){
  return req.mode === "navigate" ||
         (req.headers.get("accept") || "").indexOf("text/html") !== -1;
}

/* only a whole, good answer from this site is worth keeping */
function keepable(res){
  return res && res.ok && res.status === 200 && res.type === "basic";
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  /* a player asking for part of a sound (seeking, or just starting to play) is
     answered by the network: a part can't be stored, and a stored whole sent in
     answer to a part request is refused by Safari */
  if (req.headers.has("range")) return;

  /* the page: always ask, and only fall back to what is kept if there is no answer */
  if (isPage(req)){
    e.respondWith(
      fetch(req)
        .then(res => {
          if (keepable(res)){
            const copy = res.clone();
            caches.open(STORE).then(store => store.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  /* everything else: once it has been seen, it is never asked for again */
  e.respondWith(
    caches.match(req).then(had => {
      if (had) return had;
      return fetch(req).then(res => {
        if (keepable(res)){
          const copy = res.clone();
          caches.open(STORE).then(store => store.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
