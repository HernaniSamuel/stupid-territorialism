/**
 * Runs the real service worker (public/sw.js) against a fake server, fake Cache Storage and fake
 * worker globals, to check offline behaviour and updates without a browser.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import source from '../public/sw.js?raw';

const SCOPE = 'https://user.github.io/game/';
const CACHE = 'stupid-territorialism-v1';

type Input = string | { url: string };
const absolute = (input: Input) => new URL(typeof input === 'string' ? input : input.url, SCOPE).href;

function createWorker() {
  const server = new Map<string, string>();
  const net = { online: true, hang: false };
  const stores = new Map<string, Map<string, string>>();

  const fetch = async (input: Input) => {
    if (net.hang) return new Promise<Response>(() => {});
    if (!net.online) throw new TypeError('offline');
    const body = server.get(absolute(input).split('?')[0].slice(SCOPE.length) || 'index.html');
    return body === undefined ? new Response('not found', { status: 404 }) : new Response(body);
  };

  const openStore = (store: Map<string, string>) => ({
    match: async (input: Input, options?: { ignoreSearch?: boolean }) => {
      const key = options?.ignoreSearch ? absolute(input).split('?')[0] : absolute(input);
      const body = store.get(key);
      return body === undefined ? undefined : new Response(body);
    },
    // Like the real Cache: storing consumes the body, so storing an already-read response throws.
    put: async (input: Input, response: Response) => void store.set(absolute(input), await response.text()),
    keys: async () => [...store.keys()].map((url) => ({ url })),
    delete: async (input: Input) => store.delete(absolute(input)),
  });

  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      return openStore(stores.get(name)!);
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };

  const handlers: Record<string, (event: unknown) => void> = {};
  const self = {
    registration: { scope: SCOPE },
    addEventListener: (type: string, handler: (event: unknown) => void) => (handlers[type] = handler),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  new Function('self', 'caches', 'fetch', source)(self, caches, fetch);

  /** Fires an event. `response` is what was passed to respondWith; `done` is all the waitUntil work. */
  function fire(type: string, extra: object = {}) {
    const waits: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    handlers[type]({
      ...extra,
      waitUntil: (p: Promise<unknown>) => waits.push(p),
      respondWith: (p: Promise<Response>) => (response = p),
    });
    return { response, done: Promise.all(waits) };
  }

  const request = (path: string, mode = 'no-cors', method = 'GET') => ({ url: absolute(path), mode, method });

  async function get(path: string, mode?: string) {
    const { response, done } = fire('fetch', { request: request(path, mode) });
    const result = await response!;
    const text = await result.text();
    await done;
    return text;
  }

  /** Publishes version `v`, removing the previous build files, as GitHub Pages does. */
  function deploy(v: number) {
    server.clear();
    server.set(
      'index.html',
      `<link rel="icon" href="data:image/svg+xml,x"><link rel="apple-touch-icon" href="./apple-touch-icon.png">` +
        `<link rel="manifest" href="./manifest.webmanifest"><script src="./assets/app-${v}.js"></script>` +
        `<a href="https://example.com/elsewhere">v${v}</a>`,
    );
    server.set(`assets/app-${v}.js`, `app ${v}`);
    server.set('apple-touch-icon.png', 'touch icon');
    server.set('manifest.webmanifest', JSON.stringify({ icons: [{ src: 'icon-192.png' }] }));
    server.set('icon-192.png', 'icon');
  }

  const saved = () => [...(stores.get(CACHE)?.keys() ?? [])].map((url) => url.slice(SCOPE.length)).sort();

  return { server, net, stores, fire, get, request, deploy, saved, install: () => fire('install').done };
}

let worker: ReturnType<typeof createWorker>;
beforeEach(async () => {
  worker = createWorker();
  worker.deploy(1);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('service worker', () => {
  it('saves the page, everything it links to and the manifest icons on install', async () => {
    await worker.install();
    expect(worker.saved()).toEqual([
      'apple-touch-icon.png',
      'assets/app-1.js',
      'icon-192.png',
      'index.html',
      'manifest.webmanifest',
    ]);
  });

  it('works offline, including a link with a map seed', async () => {
    await worker.install();
    worker.net.online = false;
    expect(await worker.get('./?seed=123', 'navigate')).toContain('v1');
    expect(await worker.get('./index.html', 'navigate')).toContain('v1');
    expect(await worker.get('./assets/app-1.js')).toBe('app 1');
    expect(await worker.get('./icon-192.png')).toBe('icon');
  });

  it('shows a new deploy right away when online, and keeps it for offline use', async () => {
    await worker.install();
    worker.deploy(2);
    expect(await worker.get('./', 'navigate')).toContain('v2');
    worker.net.online = false;
    expect(await worker.get('./', 'navigate')).toContain('v2');
    expect(await worker.get('./assets/app-2.js')).toBe('app 2');
  });

  it('keeps the complete old copy if an update cannot download every file', async () => {
    await worker.install();
    worker.deploy(2);
    worker.server.delete('assets/app-2.js'); // the connection fails for this file
    await worker.get('./', 'navigate');
    worker.net.online = false;
    expect(await worker.get('./', 'navigate')).toContain('v1');
    expect(await worker.get('./assets/app-1.js')).toBe('app 1');
  });

  it('keeps the current and the previous version, and prunes older ones', async () => {
    await worker.install();
    for (const v of [2, 3]) {
      worker.deploy(v);
      await worker.get('./', 'navigate');
    }
    const assets = worker.saved().filter((file) => file.startsWith('assets/'));
    expect(assets).toEqual(['assets/app-2.js', 'assets/app-3.js']);
  });

  it('uses the saved page when the network takes too long', async () => {
    await worker.install();
    vi.useFakeTimers();
    worker.net.hang = true;
    const { response } = worker.fire('fetch', { request: worker.request('./', 'navigate') });
    await vi.advanceTimersByTimeAsync(4000);
    expect(await (await response!).text()).toContain('v1');
  });

  it('serves the saved page if the server answers with an error', async () => {
    await worker.install();
    worker.server.delete('index.html');
    expect(await worker.get('./', 'navigate')).toContain('v1');
  });

  it('installs nothing if it cannot download the game', async () => {
    worker.net.online = false;
    await expect(worker.install()).rejects.toThrow();
    expect(worker.saved()).toEqual([]);
  });

  it('only deletes its own old caches (all user.github.io projects share them)', async () => {
    worker.stores.set('stupid-territorialism-v0', new Map());
    worker.stores.set('another-project-cache', new Map());
    await worker.install();
    await worker.fire('activate').done;
    expect([...worker.stores.keys()].sort()).toEqual(['another-project-cache', CACHE]);
  });

  it('leaves alone requests that are not its business', () => {
    const ignored = [
      { url: 'https://user.github.io/other-project/', mode: 'navigate', method: 'GET' },
      { url: 'https://example.com/file.js', mode: 'no-cors', method: 'GET' },
      worker.request('./index.html', 'navigate', 'POST'),
      worker.request('./some/other/page', 'navigate'),
    ];
    for (const request of ignored) expect(worker.fire('fetch', { request }).response).toBeUndefined();
  });
});
