/* 火锅计时器 Service Worker
 * - precache 全部应用资源（离线可用）；
 * - 导航请求 network-first、静态资源 cache-first；
 * - 版本更新：新版本装好后等待用户点击"刷新"（页面端提示），
 *   避免正在计时时被强制切换到新代码。
 *
 * 注意：静态资源用 URL 字符串做缓存匹配。
 * 直接传 fetch 事件里的 Request 对象在 Chromium 上可能因缓存键
 * 规范化差异而漏配（预缓存条目由 addAll 写入，与文档子资源请求
 * 的 mode/credentials 不一致），字符串匹配已验证可靠。
 */
const CACHE = 'hotpot-v1';
const PRECACHE = [
  './',
  './index.html',
  './assets/index.js',
  './assets/index.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 导航请求：优先网络（拿新页面），离线回退缓存
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静态资源：缓存优先，未命中走网络并回填
  event.respondWith(
    caches.match(req.url).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.startsWith(self.registration.scope)) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
    )
  );
});
