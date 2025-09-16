'use strict'

const CACHE_NAME = '0xDBA_Cache_0.0.1'

const CACHED_URLS = [
  '',
  'index.html',
  'manifest.json',
  'sw.js',
  'css/style.css',
  'js/script.js',
  'assets/26.png',
  'assets/26.avif',
  'assets/unsplash_photo-1731569348001-e49c36947289_fm-jpg_blur-96_q-25_auto-true.jpg',
  'assets/unsplash_photo-1731569348001-e49c36947289_fm-avif_blur-96_q-33_auto-true.avif',
  'assets/unsplash_photo-1663077401478-59d3f4aa0c3d_fm-jpg_blur-255_q-25.jpg',
  'assets/unsplash_photo-1663077401478-59d3f4aa0c3d_fm-avif_blur-255_q-40.avif',
  'https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,100..900&display=swap',
  'https://ipfs.io/ipfs/QmYzbTvmPUgabLHukU7uDGnSvgTJt5gMkrNHctEbrLVM6h/26.webm',
]
const self = this // For scope

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(CACHED_URLS)
    console.log('Service Worker installed')
  })
})

// Listen for requests - Stale-while-revalidate
self.addEventListener('fetch', event => {
  const { request } = event
  console.log('Fetch event | stale-while-revalidate', request.url)
  const cachedResponsePromise = caches.match(request)
  const fetchedResponsePromise = fetch(request)
  const fetchedClone = fetchedResponsePromise.then(resp => resp.clone())

  event.respondWith(
    Promise.race([fetchedResponsePromise.catch(() => cachedResponsePromise), cachedResponsePromise])
      .then(resp => resp || fetchedResponsePromise)
      .catch(() => new Response(null, {status: 404}))
  )

  if(request.method === "GET" && request.url.startsWith('http'))
    event.waitUntil(
      Promise.all([fetchedClone, caches.open(CACHE_NAME)])
        .then(([response, cache]) => cache.put(request, response))
        .catch(error => console.error('Caching error', event.request.url, error))
    )
})

// Clean up caches other than current
self.addEventListener('activate', event => {
  event.waitUntil(async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter((cacheName) => cacheName !== CACHE_NAME)
      .map(cacheName => caches.delete(cacheName))
    )
  })
})
