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
 *
 * PRECACHE 必须覆盖 manifest 里的每个图标与 index.html 引用的入口资源：
 * 少一项就是「在线能用、离线缺件」。这条由 tests/unit/sw-precache.test.ts 卡住。
 *
 * BUILD_ID 不在这里写死：构建时由 vite.config.ts 的 stampSwBuildId 在下面的 CACHE
 * 声明之前插入一行「BUILD_ID = 应用代码哈希」的常量定义（它靠字符串替换定位，
 * 所以本文件里别出现那两处被匹配的原文）。该常量在本文件里没有任何引用，作用是让
 * sw.js 的字节随代码变化 -> 浏览器才会走 updatefound 提示新版本
 * （静态资源文件名固定 + cache-first，否则改了代码 SW 也不会更新）。
 * 别把它当死代码删掉，也别改动 vite 里匹配它的那段替换逻辑。
 */
const CACHE = 'hotpot-v1';
const PRECACHE = [
  './',
  './index.html',
  './assets/index.js',
  './assets/index.css',
  './manifest.webmanifest',
  './timer-worker.js',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
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
