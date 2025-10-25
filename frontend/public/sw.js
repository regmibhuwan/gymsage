const CACHE_NAME = 'gymsage-v1.0.0';
const STATIC_CACHE_NAME = 'gymsage-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'gymsage-dynamic-v1.0.0';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// API routes that should be cached
const API_CACHE_PATTERNS = [
  /^https:\/\/gymsage-backend-production-4ebe\.up\.railway\.app\/api\/workouts/,
  /^https:\/\/gymsage-backend-production-4ebe\.up\.railway\.app\/api\/auth\/profile/
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static files
  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'image') {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Default: try network first, fallback to cache
  event.respondWith(
    fetch(request)
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Handle API requests with cache-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Check if this API route should be cached
  const shouldCache = API_CACHE_PATTERNS.some(pattern => pattern.test(request.url));
  
  if (!shouldCache) {
    // For non-cacheable API requests, try network first
    try {
      return await fetch(request);
    } catch (error) {
      // Return offline response for failed requests
      return new Response(
        JSON.stringify({ 
          error: 'Offline', 
          message: 'This feature requires an internet connection' 
        }),
        { 
          status: 503, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  }

  // For cacheable API requests, try cache first
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Return cached response and update cache in background
    fetchAndCache(request);
    return cachedResponse;
  }

  // No cache, try network
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, return offline response
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'This feature requires an internet connection' 
      }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Handle static file requests with cache-first strategy
async function handleStaticRequest(request) {
  // Try cache first
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  // No cache, try network
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, return offline page for navigation requests
    if (request.destination === 'document') {
      const offlinePage = await caches.match('/');
      return offlinePage || new Response('Offline', { status: 503 });
    }
    
    throw error;
  }
}

// Background cache update
async function fetchAndCache(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
  } catch (error) {
    console.log('Background cache update failed:', error);
  }
}

// Handle background sync for offline workout data
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-workouts') {
    event.waitUntil(syncWorkouts());
  }
});

// Sync offline workouts when connection is restored
async function syncWorkouts() {
  try {
    // Get offline workouts from IndexedDB
    const offlineWorkouts = await getOfflineWorkouts();
    
    for (const workout of offlineWorkouts) {
      try {
        await fetch('/api/workouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${workout.token}`
          },
          body: JSON.stringify(workout.data)
        });
        
        // Remove from offline storage after successful sync
        await removeOfflineWorkout(workout.id);
      } catch (error) {
        console.log('Failed to sync workout:', error);
      }
    }
  } catch (error) {
    console.log('Background sync failed:', error);
  }
}

// IndexedDB helpers for offline storage
async function getOfflineWorkouts() {
  // This would integrate with your existing IndexedDB setup
  return [];
}

async function removeOfflineWorkout(id) {
  // This would remove the workout from IndexedDB
  console.log('Removing offline workout:', id);
}

// Handle push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey
      },
      actions: [
        {
          action: 'explore',
          title: 'View Workout',
          icon: '/icons/icon-192x192.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/icons/icon-192x192.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});
