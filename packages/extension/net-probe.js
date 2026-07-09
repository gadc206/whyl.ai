'use strict';

/**
 * WHYL network probe. Runs in the page's MAIN world.
 * Detects AI "working" state at the network level: open streaming responses
 * (SSE / streaming fetch), long-running requests, and websocket chatter.
 * Emits `__whyl_net` DOM events consumed by the content script.
 */
(() => {
  if (window.__whylNetProbe) return;
  window.__whylNetProbe = true;

  let openStreams = 0;

  function emit(kind) {
    try {
      document.dispatchEvent(new CustomEvent('__whyl_net', { detail: { kind, openStreams } }));
    } catch {
      /* page teardown */
    }
  }

  function streamOpened() {
    openStreams += 1;
    emit('open');
  }

  function streamClosed() {
    openStreams = Math.max(0, openStreams - 1);
    emit('close');
  }

  function chunk() {
    emit('chunk');
  }

  function monitorStream(stream) {
    const reader = stream.getReader();
    const pump = () =>
      reader
        .read()
        .then(({ done }) => {
          if (done) {
            streamClosed();
            return;
          }
          chunk();
          pump();
        })
        .catch(() => streamClosed());
    pump();
  }

  const origFetch = window.fetch;
  window.fetch = function whylFetch(...args) {
    // Long time-to-headers means the server is holding the request open
    // (deep research phases, tool runs, image generation).
    let slowOpened = false;
    const slowTimer = setTimeout(() => {
      slowOpened = true;
      streamOpened();
    }, 1500);

    return origFetch
      .apply(this, args)
      .then((response) => {
        clearTimeout(slowTimer);
        if (slowOpened) streamClosed();

        try {
          const contentType = (response.headers.get('content-type') || '').toLowerCase();
          if (contentType.includes('text/event-stream') && response.body && !response.bodyUsed) {
            const clone = response.clone();
            if (clone.body) {
              streamOpened();
              monitorStream(clone.body);
            }
          }
        } catch {
          /* never break the page's own request */
        }
        return response;
      })
      .catch((err) => {
        clearTimeout(slowTimer);
        if (slowOpened) streamClosed();
        throw err;
      });
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function whylSend(...args) {
    let slowOpened = false;
    const slowTimer = setTimeout(() => {
      slowOpened = true;
      streamOpened();
    }, 1500);

    this.addEventListener('progress', chunk);
    this.addEventListener('loadend', () => {
      clearTimeout(slowTimer);
      if (slowOpened) streamClosed();
    });

    return origSend.apply(this, args);
  };

  const OrigWebSocket = window.WebSocket;
  if (OrigWebSocket) {
    class WhylWebSocket extends OrigWebSocket {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', chunk);
      }
    }
    window.WebSocket = WhylWebSocket;
  }

  const OrigEventSource = window.EventSource;
  if (OrigEventSource) {
    class WhylEventSource extends OrigEventSource {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', chunk);
      }
    }
    window.EventSource = WhylEventSource;
  }
})();
