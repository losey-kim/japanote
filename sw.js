// Service Worker - Japanote PWA
// 설치 가능 조건 충족을 위한 최소 Service Worker (오프라인 캐싱 없음)
'use strict';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
