// 내 음악 - 오프라인 실행용 서비스 워커
// 앱 파일은 "네트워크 우선"(항상 최신 버전, 인터넷이 없을 때만 저장본 사용)
// 글꼴·Firebase 라이브러리는 "저장본 우선"
const CACHE = 'mp3p-v8';
const CORE = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png', './icon-96.png', './icon-144.png', './lame.min.js', './lyrics-worker.js'];

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    // 예전 버전 화면이 열려 있으면 새로 열게 함 (새 버전 화면은 대답하고 스스로 알맞은 때에 업데이트)
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(cs => Promise.all(cs.map(c => new Promise(done => {
      let ok = false;
      try {
        const ch = new MessageChannel();
        ch.port1.onmessage = () => { ok = true; };
        c.postMessage({ type: 'sw-hello' }, [ch.port2]);
      } catch {}
      setTimeout(() => { if (!ok && c.navigate) c.navigate(c.url).catch(() => {}); done(); }, 2500);
    })))));
});
const bust = u => { const x = new URL(u); x.searchParams.set('_', Date.now()); return x.href; };
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  const lib = /(^|\.)gstatic\.com$/.test(url.hostname) || url.hostname === 'fonts.googleapis.com' || url.hostname === 'cdn.jsdelivr.net';
  if (same) {
    e.respondWith(
      // 주소 끝에 매번 다른 값을 붙여 인터넷 중간 저장소(CDN)의 예전 파일을 건너뜀
      fetch(bust(req.url), { cache: 'no-store', credentials: 'same-origin' }).then(res => {
        if (res.ok && !url.pathname.endsWith('version.json')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? './index.html' : req, copy)); }
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
