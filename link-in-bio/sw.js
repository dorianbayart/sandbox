'use strict'

const CACHE_NAME = '0xDBA_Cache_0.0.1'

const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/script.js',
  'https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,100..900&display=swap',
  'https://ipfs.io/ipfs/QmYzbTvmPUgabLHukU7uDGnSvgTJt5gMkrNHctEbrLVM6h/26.webm',
  './assets/26.png',
  './assets/26.avif'
]
const self = this // For scope

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache')
        return cache.addAll(urlsToCache)
      })
  )
})

// Listen for requests
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response
        }

        // Cache miss - fetch & cache new request
        return fetch(event.request).then((response) => {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
          return response
        })
      })
  )
})

// Update cache periodically or on activate
self.addEventListener('activate', (event) => {
  const cacheWhitelist = []
  cacheWhitelist.push(CACHE_NAME)

  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if(!cacheWhitelist.includes(cacheName)) {
          return caches.delete(cacheName)
        }
      })
    )).then(() => self.clients.claim())
  )

  // Periodic cache update (e.g., weekly)
  if ('periodicSync' in self.registration) {
    self.registration.periodicSync.register({
      tag: 'update-cache',
      minPeriod: 7 * 24 * 60 * 60 * 1000, // Weekly
    }).then(registration => console.log('Periodic Sync registered', registration))
  } else {
    console.log('Periodic background sync not supported.')
  }
})

// Handle periodic sync event to update cache
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    event.waitUntil(
      self.registration.showNotification('Updating Cache...'),
      caches.open(CACHE_NAME).then((cache) => {
        // Simulate cache update by re-fetching core resources
        const cacheUpdatePromises = urlsToCache.map((url) => {
          return fetch(url).then((response) => cache.put(url, response.clone()))
        })
        return Promise.all(cacheUpdatePromises)
      }).then(() => self.registration.showNotification('Cache Updated!'))
    )
  }
})
