/*!
 *
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const NAME = 'TextAdventure';
const VERSION = '{{ version }}';
const URL = 'https://notification-adventure.appspot.com/';

importScripts('/static/third_party/idb-keyval.js');

/* eslint-env es6 */

self.oninstall = evt => {
  const urls = ['/',
      '/static/third_party/idb-keyval.js',
      '/static/scripts/app.js',
      '/static/images/icon@512.png',
      '/static/images/icon@192.png',
      '/static/images/sword.png',
      '/static/images/title.png'];

  evt.waitUntil(
    caches
      .open(NAME + '-v' + VERSION)
      .then(cache => {
        return cache.addAll(urls);
      }));

  self.skipWaiting();
};

self.onactivate = _ => {
  const currentCacheName = NAME + '-v' + VERSION;
  caches.keys().then(cacheNames => {
    return Promise.all(
      cacheNames.map(cacheName => {
        if (cacheName.indexOf(NAME) === -1) {
          return null;
        }

        if (cacheName !== currentCacheName) {
          return caches.delete(cacheName);
        }

        return null;
      })
    );
  });

  self.clients.claim();
};

self.onnotificationclose = evt => {
  evt.waitUntil(idbKeyval.delete('story'));

  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        story: false
      });
    });
  });
}

self.bringClientToFrontIfNeeded = evt => {
  return self.clients.matchAll().then(windowClients => {
    const client = windowClients.find(client => {
      return (
          (client.url === URL || client.url.indexOf('localhost') >= 0) &&
          'focus' in client
      );
    });

    if (client) {
      client.focus();
    } else if (clients.openWindow) {
      return clients.openWindow(URL);
    }
  });
}

self.onnotificationclick = evt => {
  const action = evt.action;
  if (!action) {
    evt.waitUntil(self.bringClientToFrontIfNeeded());
    return;
  }

  idbKeyval.get('story').then(story => {
    self._showNode(story, action);
  });
};

self._getIcon = _ => {
  return caches.match('/static/images/icon@512.png')
    .then(r => r.blob())
    .then(imgBlob => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', _ => {
          resolve(reader.result);
        });
        reader.addEventListener('error', reject);
        reader.readAsDataURL(imgBlob);
      });
    });
}

self._showNode = (storyName, nodeName) => {
  const vibrate = [200, 100, 200, 100];
  const tag = 'adventure';
  const requireInteraction = true;
  let icon;

  return Promise.all([
    self._getIcon(),
    caches.match(`/static/stories/${storyName}.json`)
  ]).then(arr => {
    icon = arr[0];
    return arr[1];
  })
    .then(r => r.json())
    .then(story => {

      const node = story[nodeName];
      if (!node) {
        throw new Error('Unable to locate node!');
      }

      if (typeof node === 'string') {
        return self._showNode(storyName, node);
      }

      return self.registration.showNotification(nodeName, {
        body: node.text,
        actions: node.actions,
        requireInteraction,
        tag,
        icon,
        vibrate
      });
    });
}

self.onmessage = evt => {
  switch (evt.data) {
    case 'version':
      evt.source.postMessage({
        version: VERSION,
        message: 'A wild story appears!'
      });
      break;

    default:
      idbKeyval.set('story', evt.data).then(_ => {
        self._showNode(evt.data, '__start').then(_ => {
          evt.source.postMessage({
            story: true
          });
        });
      });
      break;
  }
};

self.onfetch = evt => {
  const url = evt.request.url.replace(/[a-f0-9]{64}/, '');

  evt.respondWith(
    caches.match(url)
        .then(response => {
          if (response) {
            return response;
          }

          const request = evt.request;
          return fetch(request).then(fetchResponse => {
            // Never cache Analytics, Conversion or Push requests.
            if (/google/.test(request.url)) {
              return fetchResponse;
            }

            // Cache for next time.
            return caches.open(NAME + '-v' + VERSION).then(cache => {
              return cache.put(request.clone(), fetchResponse.clone());
            }).then(_ => {
              return fetchResponse;
            });
          }, err => {
            console.warn(`Unable to fetch ${evt.request.url}.`);
            console.warn(err.stack);
            return new Response('Unable to fetch.');
          });
        })
  );
}
