/**
 * Service worker: lets the game open without internet.
 *
 * It keeps a complete copy of the game: the page, the files it links to and the app icons.
 *  - Online, the page comes from the network first, so a new deploy shows up right away.
 *    The new version is then downloaded in the background and saved.
 *  - Offline (or when the network takes too long), the saved copy is used.
 *  - A new copy is saved only after ALL of its files have downloaded, so a dropped connection
 *    can't leave a half-updated game behind.
 *
 * There is no build step: the list of files is read from index.html and the manifest,
 * so the hashed file names created by the build need no upkeep here.
 */
const PREFIX = 'stupid-territorialism-';
/** Bump the number only if the way things are stored changes; new deploys don't need it. */
const CACHE = `${PREFIX}v1`;
const PAGE = './index.html';
const SLOW_NETWORK_MS = 4000;

const absolute = (url) => new URL(url, self.registration.scope).href;

/** Downloads a file, asking the server whether it changed instead of trusting the HTTP cache. */
async function download(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

/** Local files a page needs: what its HTML links to, plus the icons listed in the manifest. */
async function filesOf(html, readManifest) {
  const files = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((match) => match[1]);
  const manifest = files.find((file) => file.endsWith('.webmanifest'));
  const response = manifest ? await readManifest(manifest) : undefined;
  if (response) {
    const { icons = [] } = await response.json();
    files.push(...icons.map((icon) => `./${icon.src}`));
  }
  return [...new Set(files)];
}

/** Saves `page` and everything it needs. If any download fails, the previous copy stays as it was. */
async function saveCopy(page) {
  const cache = await caches.open(CACHE);
  const oldPage = await cache.match(PAGE);
  const oldFiles = oldPage ? await filesOf(await oldPage.text(), (url) => cache.match(url)) : [];

  const files = await filesOf(await page.clone().text(), download);
  const downloads = await Promise.all(files.map(download));
  await Promise.all(files.map((file, i) => cache.put(file, downloads[i])));
  await cache.put(PAGE, page); // last: the saved page never points to files that aren't saved yet

  // Keep this version and the one before it: a tab opened from the old copy may still ask for its files.
  const keep = new Set([PAGE, ...files, ...oldFiles].map(absolute));
  for (const request of await cache.keys()) {
    if (!keep.has(request.url)) await cache.delete(request);
  }
}

/** Network first; the saved page if the network fails or is too slow. */
async function pageResponse(network) {
  const saved = await (await caches.open(CACHE)).match(PAGE);
  const live = network.then((response) => response.clone());
  if (!saved) return live;
  const tooSlow = new Promise((resolve) => setTimeout(() => resolve(saved), SLOW_NETWORK_MS));
  return Promise.race([live, tooSlow]).catch(() => saved);
}

/** Other files: the saved one if there is one (build files have a new name on every change). */
async function fileResponse(request) {
  const cache = await caches.open(CACHE);
  return (await cache.match(request, { ignoreSearch: true })) ?? fetch(request);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    download(PAGE)
      .then(saveCopy)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Every project under user.github.io shares one origin: only ever delete our own caches.
      for (const name of await caches.keys()) {
        if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;

  if (request.mode !== 'navigate') {
    event.respondWith(fileResponse(request));
    return;
  }
  // Only the game page itself (with or without ?seed=...).
  const path = request.url.split(/[?#]/)[0];
  if (path !== self.registration.scope && path !== absolute(PAGE)) return;

  const network = download(PAGE);
  // Save the new version in the background. It clones the response before anyone reads it.
  event.waitUntil(network.then((response) => saveCopy(response.clone())).catch(() => {}));
  event.respondWith(pageResponse(network));
});
