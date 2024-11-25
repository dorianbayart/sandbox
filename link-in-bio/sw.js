'use strict'

const CACHE_NAME = '0xDBA_Cache_0.0.1'

const CACHED_URLS = [
  '',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/script.js',
  'assets/26.png',
  'assets/26.avif',
  'https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,100..900&display=swap',
  'https://ipfs.io/ipfs/QmYzbTvmPUgabLHukU7uDGnSvgTJt5gMkrNHctEbrLVM6h/26.webm',
]
const self = this // For scope

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(CACHED_URLS)
  })
})

// Listen for requests - Stale-while-revalidate
self.addEventListener('fetch', (event) => {
  const { request } = event
  event.respondWith(async () => {
    const cache = await caches.open(CACHE_NAME)
    const cachedResponsePromise = await cache.match(request)
    const fetchedResponsePromise = fetch(request)

    event.waitUntil(async () => {
      const fetchedResponse = await fetchedResponsePromise
      await cache.put(request, fetchedResponse.clone())
    })

    return cachedResponsePromise || fetchedResponsePromise
  })
})

// Update cache periodically or on activate
self.addEventListener('activate', (event) => {
  const cacheWhitelist = []
  cacheWhitelist.push(CACHE_NAME)

  event.waitUntil(async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter((cacheName) => cacheName !== CACHE_NAME)
      .map(cacheName => caches.delete(cacheName))
    )
  })

  // Periodic cache update
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
        const cacheUpdatePromises = CACHED_URLS.map(async (url) => {
          return fetch(url).then((response) => cache.put(url, response.clone()))
        })
        return Promise.all(cacheUpdatePromises)
      }).then(() => self.registration.showNotification('Cache Updated!'))
    )
  }
})
