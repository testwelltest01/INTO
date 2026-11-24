/* INTO CHURCH 서비스워커
 *  - 앱 화면(HTML/CSS/JS/아이콘)은 미리 저장 → 오프라인에서도 열림
 *  - 사진은 한 번 본 것을 저장(stale-while-revalidate)
 *  - Supabase API 요청은 캐시하지 않음 (항상 최신 데이터)
 *  파일을 수정해 배포할 때는 VERSION 과 V(그리고 index.html 의 ?v= 숫자)를 함께 올려 주세요.
 */
var VERSION = 'into-v10';
var V = '?v=10'; // index.html 의 ?v= 값과 같게 맞춰 주세요
var SHELL = [
  './', './index.html', './config.js' + V, './css/app.css' + V,
  './js/util.js' + V, './js/seed.js' + V, './js/api-demo.js' + V, './js/api-supabase.js' + V,
  './js/app.js' + V, './js/views-public.js' + V, './js/views-member.js' + V, './js/views-admin.js' + V, './js/install.js' + V, './js/scores.js' + V, './js/mix.js' + V,
  './manifest.webmanifest?v=10', './assets/icons/icon-512.png', './assets/vendor/qrcode.js', './assets/logo-dark.png', './assets/logo-light.png',
  './assets/icons/icon-192.png', './assets/icons/favicon-32.png', './assets/photos/home-hero.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    // 앱 화면 캐시만 정리 (찬양팀 악보 보관함 'into-scores-*' 은 유지)
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k.indexOf('into-v') === 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Supabase(API·인증·스토리지 업로드)는 건드리지 않음 — 단, 공개 이미지(storage public)는 캐시
  var isSupabase = /supabase\.co$/.test(url.hostname) || url.pathname.indexOf('/rest/v1/') >= 0 || url.pathname.indexOf('/auth/v1/') >= 0;
  var isPublicImage = url.pathname.indexOf('/storage/v1/object/public/') >= 0;
  if (isSupabase && !isPublicImage) return;

  // 페이지 이동: 네트워크 우선, 실패 시 캐시된 index.html
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put('./index.html', copy); });
      return res;
    }).catch(function () { return caches.match('./index.html'); }));
    return;
  }

  // 같은 출처 정적 파일 · 구글 폰트 · CDN · 공개 이미지: stale-while-revalidate
  var cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === 'cdn.jsdelivr.net' || isPublicImage;
  if (!cacheable) return;
  e.respondWith(caches.open(VERSION).then(function (cache) {
    return cache.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
