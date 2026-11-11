// 내 음악 - 오프라인 실행용 서비스 워커
// 앱 파일은 "네트워크 우선"(항상 최신 버전, 인터넷이 없을 때만 저장본 사용)
// 글꼴·Firebase 라이브러리는 "저장본 우선"
const CACHE = 'mp3p-v4';
const CORE = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png', './lame.min.js', './lyrics-worker.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  const lib = /(^|\.)gstatic\.com$/.test(url.hostname) || url.hostname === 'fonts.googleapis.com' || url.hostname === 'cdn.jsdelivr.net';
  if (same) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true })
        .then(m => m || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
    );
  } else if (lib) {
    e.respondWith(
      caches.match(req).then(m => m || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
