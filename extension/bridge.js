// Isolated-world content script: relays between the page (page.js) and the
// extension's service worker (background.js).
(() => {
  const TAG = '__amDeskThing';
  let port = null;
  let lastState = null;

  const connect = () => {
    try {
      port = chrome.runtime.connect({ name: 'am-tab' });
    } catch (_) {
      // Extension was reloaded/removed; this content script is orphaned.
      return;
    }
    port.onMessage.addListener((msg) => {
      if (msg && msg.type === 'cmd') {
        window.postMessage({ [TAG]: 'cmd', cmd: msg.cmd, value: msg.value }, window.location.origin);
      }
    });
    port.onDisconnect.addListener(() => {
      port = null;
      // The service worker restarts from time to time; reconnect shortly.
      setTimeout(connect, 1000);
    });
    if (lastState) port.postMessage({ type: 'state', state: lastState });
    window.postMessage({ [TAG]: 'cmd', cmd: 'refresh' }, window.location.origin);
  };

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data[TAG] !== 'state') return;
    lastState = e.data.state;
    if (port) {
      try { port.postMessage({ type: 'state', state: lastState }); } catch (_) { /* reconnecting */ }
    }
  });

  connect();
})();
