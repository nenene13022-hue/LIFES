const CACHE = 'lifes-v14';

// store pending notification timers so they survive page navigation
const pendingNotifs = new Map();

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// receive notification schedule from main app
self.addEventListener('message', e => {
  if(!e.data || e.data.type !== 'SCHEDULE_NOTIF') return;
  const {delay, taskId, title, body, icon} = e.data;
  // clear any existing timer for this task
  if(pendingNotifs.has(taskId)) clearTimeout(pendingNotifs.get(taskId));
  const tid = setTimeout(() => {
    pendingNotifs.delete(taskId);
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag: taskId,
      vibrate: [200, 100, 200],
      data: {taskId}
    });
  }, delay);
  pendingNotifs.set(taskId, tid);
});

self.addEventListener('fetch', e => {
  // HTML — network first so updates arrive immediately
  if(e.request.mode === 'navigate' || e.request.url.endsWith('.html') || e.request.url.endsWith('/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if(res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Other assets — cache first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if(res.ok && e.request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(list => {
    if(list.length) return list[0].focus();
    return clients.openWindow('/');
  }));
});
