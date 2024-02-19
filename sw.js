const CACHE_STATIC_NAME = "static-v1";
const CACHE_DYNAMIC_NAME = "dynamic-v1";
const CACHE_INMUTABLE_NAME = "inmutable-v1";

const CACHE_DYNAMIC_LIMIT = 50;

const cleanCache = (cacheName, sizeItems) => {
  caches.open(cacheName).then((cache) => {
    return cache.keys().then((keys) => {
      if (keys.length > sizeItems) {
        cache.delete(keys[0]).then(cleanCache(cacheName, sizeItems));
      }
    });
  });
};

const APP_SHELL_STATIC = [
  "index.html",
  "css/style.css",
  "img/favicon.ico",
  "img/avatars/hulk.jpg",
  "img/avatars/ironman.jpg",
  "img/avatars/spiderman.jpg",
  "img/avatars/thor.jpg",
  "img/avatars/wolverine.jpg",
  "img/no-img.jpg",
  "js/app.js",
  "pages/offline.html",
];

const APP_SHELL_INMUTABLE = [
  "https://fonts.googleapis.com/css?family=Quicksand:300,400",
  "https://fonts.googleapis.com/css?family=Lato:400,300",
  "https://use.fontawesome.com/releases/v5.3.1/css/all.css",
  "css/animate.css",
  "js/libs/jquery.js",
];

self.addEventListener("install", (event) => {
  const cacheProm = caches.open(CACHE_STATIC_NAME).then((cache) => {
    return cache.addAll(APP_SHELL_STATIC);
  });

  const cacheInmutable = caches.open(CACHE_INMUTABLE_NAME).then((cache) => {
    return cache.addAll(APP_SHELL_INMUTABLE);
  });

  event.waitUntil(Promise.all([cacheProm, cacheInmutable]));
});

self.addEventListener("activate", (event) => {
  const response = caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (
        key !== CACHE_STATIC_NAME &&
        key !== CACHE_DYNAMIC_NAME &&
        key !== CACHE_INMUTABLE_NAME
      ) {
        return caches.delete(key);
      }
    });
  });

  event.waitUntil(response);
});

self.addEventListener("fetch", (event) => {
  const response = new Promise((resolve, reject) => {
    let fetchFirstRejected = false;
    let cacheFirstRejected = false;

    const requestFails = () => {
      if (cacheFirstRejected && fetchFirstRejected) {
        if (event.request.headers.get("accept").includes("text/html")) {
          resolve(caches.match("/pages/offline.html"));
          return;
        }

        if (/\.(png|jpg)$/i.test(event.request.url)) {
          resolve(caches.match("/img/no-img.jpg"));
        } else {
          reject("No se encontro respuesta");
        }
        return;
      }
    };

    const existStatic = APP_SHELL_STATIC.some((element) => {
      return event.request.url.includes(element);
    });

    const existInmutable = APP_SHELL_INMUTABLE.some((element) => {
      return event.request.url.includes(element);
    });

    const addToCache = (res) => {
      if (existStatic) {
        caches.open(CACHE_STATIC_NAME).then((cache) => {
          cache.put(event.request, res);
        });
      }

      if (existInmutable) {
        caches.open(CACHE_INMUTABLE_NAME).then((cache) => {
          cache.put(event.request, res);
        });
      }

      if (!existStatic && !existInmutable) {
        caches.open(CACHE_DYNAMIC_NAME).then((cache) => {
          cache.put(event.request, res);
          cleanCache(CACHE_DYNAMIC_NAME, CACHE_DYNAMIC_LIMIT);
        });
      }
    };

    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          addToCache(res);
          resolve(res.clone());
          return;
        }
      })
      .catch((err) => {
        caches.match(event.request).then((res) => {
          if (res) {
            resolve(res);
            return;
          }

          fetchFirstRejected = true;
          requestFails();
        });
      });

    caches.match(event.request).then((res) => {
      if (res) {
        resolve(res);
        return;
      }

      fetch(event.request)
        .then((newResponse) => {
          addToCache(newResponse);
          resolve(newResponse.clone());
          return;
        })
        .catch((err) => {
          cacheFirstRejected = true;
          requestFails();
        });
    });
  });

  event.respondWith(response);
});