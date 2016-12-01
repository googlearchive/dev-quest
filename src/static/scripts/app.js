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

/* eslint-env es6 */

class Toast {
  static create (msg, options) {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.classList.add('toast-container');
      document.body.appendChild(toastContainer);
    }
    options = options || {};
    const tag = options.tag || (Date.now().toString());
    Array.from(toastContainer.querySelectorAll(`.toast[data-tag="${tag}"]`))
        .forEach(t => {
          t.parentNode.removeChild(t);
        });

    if (options.removeAll) {
      return;
    }

    // Make a toast...
    const toast = document.createElement('div');
    const toastContent = document.createElement('div');
    toast.classList.add('toast');
    toastContent.classList.add('toast__content');
    toastContent.textContent = msg;
    toast.dataset.tag = tag;
    toast.appendChild(toastContent);
    toastContainer.appendChild(toast);

    if (options.modal) {
      return;
    }

    const toastOkay = document.createElement('button');
    toastOkay.textContent = 'Okay';
    toastOkay.classList.add('toast__okay');
    toastContent.appendChild(toastOkay);

    toastOkay.addEventListener('click', _ => {
      toast.parentNode.removeChild(toast);

      if (options.cb) {
        options.cb.call();
      }
    });
  }
}

class IntroScreen {
  static get LINE_COUNT () {
    return 35;
  }

  constructor () {
    this._width = 0;
    this._height = 0;
    this._lines = [];
    this._flash = 0;
    this._globalVelocity = this._targetVelocity = 1;

    this._onResize = this._onResize.bind(this);
    this._update = this._update.bind(this);

    this._canvas = document.createElement('canvas');
    this._canvas.classList.add('intro');
    this._ctx = this._canvas.getContext('2d');
    document.body.insertBefore(this._canvas, document.body.firstElementChild);

    this._createLines();
    this._onResize();
  }

  start () {
    requestAnimationFrame(this._update);
  }

  stop () {
    this._targetVelocity = 0;
    this._flash = 1;
  }

  _createLines () {
    for (let i = 0; i < IntroScreen.LINE_COUNT; i++) {
      this._lines[i] = this._resetLine();
    }
  }

  _resetLine () {
    const vh = 0.5 + Math.random();
    const h = Math.random();
    return {
      x: Math.random(),
      y: -Math.random(),
      vy: vh * 0.015,
      w: 2,
      h: h,
      a: Math.random()
    }
  }

  _onResize () {
    this._width = window.innerWidth;
    this._height = window.innerHeight;

    this._canvas.width = this._width;
    this._canvas.height = this._height;
  }

  _update () {
    this._ctx.clearRect(0, 0, this._width, this._height);

    this._lines.forEach((line, index) => {
      line.y += line.vy;

      this._ctx.globalAlpha = line.a * this._globalVelocity;
      this._ctx.fillStyle = '#FFF';
      this._ctx.fillRect(
            line.x * this._width,
            line.y * this._height,
            line.w,
            line.vy * this._height * 5 * this._globalVelocity);

      if (line.y > 1.4) {
        this._lines[index] = this._resetLine();
      }
    });

    this._ctx.globalAlpha = this._flash;
    this._ctx.fillStyle = '#FFF';
    this._ctx.fillRect(0, 0, this._width, this._height);

    this._flash += (0 - this._flash) * 0.05;

    this._globalVelocity +=
        (this._targetVelocity - this._globalVelocity) * 0.05;

    if (this._globalVelocity < 0.001) {
      return;
    }
    requestAnimationFrame(this._update);
  }
}

class App {
  constructor () {
    if (!('serviceWorker' in navigator) || (!('PushManager' in window))) {
      Toast.create(`Oof! This browser doesn't support notifications. Sorry
          about that :(`, {tag: 'modal', modal: true});
      return;
    }

    if (!('actions' in Notification.prototype)) {
      Toast.create(`Oof! This browser doesn't support notification actions.
          Sorry about that :(`, {tag: 'modal', modal: true});
      return;
    }

    if (Notification.permission === 'denied') {
      this._showNotificationPermissionFailed();
      return;
    }

    this._content = document.body.querySelector('.content');

    this._introScreen = new IntroScreen();
    this._introScreen.start();

    this._swordImage = new Image();
    this._swordImage.classList.add('sword');
    this._swordImage.onload = _ => {
      document.body.insertBefore(this._swordImage,
          document.body.firstElementChild);
      requestAnimationFrame(_ => {
        requestAnimationFrame(_ => {
          this._swordImage.classList.add('active');
          this._swordImage.addEventListener('transitionend', _ => {
            this._introScreen.stop();
            this._content.classList.add('visible');
          });
        });
      });
    }
    this._swordImage.src = '/static/images/sword.png';

    this._onMessage = this._onMessage.bind(this);
    this._onRegistration = this._onRegistration.bind(this);
    this._startAdventure = this._startAdventure.bind(this);

    this._buttons = document.querySelectorAll('.start-adventure');
    this._currentVersion = null;
    this._registerServiceWorker();
    this._key = new Uint8Array([4,84,7,205,103,88,137,201,233,56,199,24,121,204,115,205,197,21,65,143,73,63,244,234,125,143,157,145,197,108,204,147,152,198,150,116,156,154,39,197,93,8,11,142,230,85,190,92,136,119,103,252,24,188,170,59,3,96,13,45,38,244,87,240,200]);
    this._keyString = this._key.toString();

    this._addEventListeners();
  }

  _enableButtonWhenReady () {
    return navigator.serviceWorker.ready.then(registration => {
      if (!registration) {
        return;
      }

      for (let i = 0; i < this._buttons.length; i++) {
        this._buttons[i].disabled = false;
      }
    });
  }

  _addEventListeners () {
    for (let i = 0; i < this._buttons.length; i++) {
      this._buttons[i].addEventListener('click', this._startAdventure);
    }
  }

  _onMessage (evt) {
    if (typeof evt.data.version !== 'undefined') {
      if (this._currentVersion === null) {
        this._currentVersion = evt.data.version;
      } else {
        const newVersion = evt.data.version;
        const cvParts = this._currentVersion.split('.');
        const nvParts = newVersion.split('.');

        if (cvParts[0] === nvParts[0]) {
          console.log('Service Worker moved from ' +
                    this._currentVersion + ' to ' + newVersion);
        } else if (evt.data.message) {
          Toast.create(evt.data.message, {cb: _ => window.location.reload() });
        }
      }
    }

    if (typeof evt.data.story !== 'undefined') {
      if (evt.data.story) {
        this._showStoryInProgress();
      } else {
        this._hideStoryInProgress();
      }
    }
  }

  _showNotificationPermissionFailed () {
    Toast.create(`Oof! Can't play the game if notifications are blocked.
          Sorry about that :(`, {tag: 'modal'});
  }

  _showStoryInProgress () {
    Toast.create(`Your amazing adventure has started! Check out
        your notifications.`, {tag: 'modal'});
  }

  _hideStoryInProgress () {
    Toast.create('', {tag: 'modal', removeAll: true});
  }

  _onRegistration (registration) {
    if (registration.active) {
      registration.active.postMessage('version');
    }

    // We should also start tracking for any updates to the Service Worker.
    registration.onupdatefound = function () {
      console.log('A new version has been found... Installing...');

      // If an update is found the spec says that there is a new Service Worker
      // installing, so we should wait for that to complete then show a
      // notification to the user.
      registration.installing.onstatechange = function () {
        if (this.state === 'installed') {
          return console.log('App updated');
        }

        if (this.state === 'activated') {
          registration.active.postMessage('version');
        }

        console.log('Incoming SW state:', this.state);
      };
    };

    this._enableButtonWhenReady();
  }

  _registerServiceWorker () {
    navigator.serviceWorker.onmessage = this._onMessage;
    navigator.serviceWorker.register('./sw.js').then(this._onRegistration);
  }

  _getSubscription () {
    return navigator.serviceWorker.ready.then(registration => {
      return registration.pushManager.getSubscription().then(subscription => {
        if (subscription && !this._keyHasChanged) {
          return subscription;
        }

        return idbKeyval.set('appkey', this._keyString).then(_ => {
          return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this._key
          }).catch(err => {
            console.error(err);
            this._showNotificationPermissionFailed();
            return;
          });
        });
      });
    });
  }

  _startAdventure (evt) {
    const story = evt.target.dataset.story;
    const validStory = /\d{4}\-\d{2}-\d{2}/;

    if (!validStory.test(story)) {
      console.error('Invalid story.');
      return;
    }

    return fetch(`/static/stories/${story}.json`)
      .then(_ =>this._getSubscription())
      .then(subscription => {
          if (!subscription) {
            console.error('Need a subscription to play!');
            return;
          }

          return navigator.serviceWorker.getRegistration().then(registration => {
            registration.active.postMessage(story);
          });
        });
  }
}

new App();
