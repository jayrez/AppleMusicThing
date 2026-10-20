// Service worker: keeps one WebSocket open to the DeskThing Apple Music app
// (running on this computer) while an Apple Music tab is open, forwards
// now-playing state to it, and passes its commands back to the right tab.

const DEFAULT_PORT = 8899;
const tabs = new Map(); // tabId -> { port, state, updatedAt }
let activeTabId = null;
let ws = null;
let wsStatus = 'idle'; // idle | connecting | connected | error
let retryMs = 1000;
let retryTimer = null;
let pingTimer = null;
let bridgePort = DEFAULT_PORT;

chrome.storage.local.get({ port: DEFAULT_PORT }).then(({ port }) => {
  bridgePort = Number(port) || DEFAULT_PORT;
  maybeConnect();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.port) {
    bridgePort = Number(changes.port.newValue) || DEFAULT_PORT;
    reconnectNow();
  }
});

// ---------- tabs ----------

const pickActiveTab = () => {
  // Prefer the tab that is playing; otherwise the most recently updated one with a track.
  let best = null;
  for (const [id, t] of tabs) {
    if (!t.state || !t.state.hasTrack) continue;
    const score = (t.state.isPlaying ? 1e13 : 0) + t.updatedAt;
    if (!best || score > best.score) best = { id, score };
  }
  return best ? best.id : tabs.size ? [...tabs.keys()].pop() : null;
};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'am-tab' || !port.sender || !port.sender.tab) return;
  const tabId = port.sender.tab.id;
  tabs.set(tabId, { port, state: null, updatedAt: Date.now() });

  port.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'state') return;
    const entry = tabs.get(tabId);
    if (!entry) return;
    entry.state = msg.state;
    entry.updatedAt = Date.now();
    activeTabId = pickActiveTab();
    if (tabId === activeTabId) sendWs({ type: 'state', state: msg.state });
  });

  port.onDisconnect.addListener(() => {
    tabs.delete(tabId);
    activeTabId = pickActiveTab();
    if (activeTabId == null) {
      sendWs({ type: 'state', state: { hasTrack: false } });
      // Nothing left to bridge; let the connection and worker go idle.
      setTimeout(() => { if (!tabs.size) disconnect(); }, 5000);
    } else {
      const s = tabs.get(activeTabId).state;
      if (s) sendWs({ type: 'state', state: s });
    }
  });

  maybeConnect();
});

// ---------- websocket to DeskThing ----------

function sendWs(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch (_) { /* ignore */ }
  }
}

function maybeConnect() {
  if (!tabs.size || ws || retryTimer) return;
  connect();
}

function connect() {
  clearTimeout(retryTimer);
  retryTimer = null;
  wsStatus = 'connecting';
  let socket;
  try {
    socket = new WebSocket(`ws://127.0.0.1:${bridgePort}/`);
  } catch (_) {
    scheduleRetry();
    return;
  }
  ws = socket;

  socket.onopen = () => {
    wsStatus = 'connected';
    retryMs = 1000;
    sendWs({ type: 'hello', version: chrome.runtime.getManifest().version });
    const t = activeTabId != null && tabs.get(activeTabId);
    sendWs({ type: 'state', state: (t && t.state) || { hasTrack: false } });
    clearInterval(pingTimer);
    // Regular traffic also keeps the MV3 service worker alive.
    pingTimer = setInterval(() => sendWs({ type: 'ping', t: Date.now() }), 20000);
  };

  socket.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch (_) { return; }
    if (msg.type === 'cmd') {
      const t = activeTabId != null && tabs.get(activeTabId);
      if (t) t.port.postMessage({ type: 'cmd', cmd: msg.cmd, value: msg.value });
    } else if (msg.type === 'fetch') {
      browserFetch(msg.id, msg.url);
    } else if (msg.type === 'getState') {
      const t = activeTabId != null && tabs.get(activeTabId);
      sendWs({ type: 'state', state: (t && t.state) || { hasTrack: false } });
    }
  };

  socket.onclose = () => {
    if (ws === socket) ws = null;
    clearInterval(pingTimer);
    wsStatus = tabs.size ? 'error' : 'idle';
    scheduleRetry();
  };

  socket.onerror = () => { /* onclose follows */ };
}

// Lyrics lookups made through Edge, so they use the Windows proxy settings.
// Only LRCLIB is allowed, so the local app can't use this as a general proxy.
async function browserFetch(id, url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== 'lrclib.net') throw new Error('host not allowed');
    const res = await fetch(u.href, { headers: { 'Lrclib-Client': 'DeskThing-AppleMusic/1.1.0' } });
    sendWs({ type: 'fetchResult', id, status: res.status, body: await res.text() });
  } catch (err) {
    sendWs({ type: 'fetchResult', id, error: String((err && err.message) || err) });
  }
}

function scheduleRetry() {
  if (!tabs.size) return;
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { retryTimer = null; connect(); }, retryMs);
  retryMs = Math.min(retryMs * 2, 15000);
}

function disconnect() {
  clearTimeout(retryTimer);
  retryTimer = null;
  clearInterval(pingTimer);
  if (ws) { try { ws.close(); } catch (_) { /* ignore */ } }
  ws = null;
  wsStatus = 'idle';
}

function reconnectNow() {
  disconnect();
  retryMs = 1000;
  maybeConnect();
}

// ---------- popup status ----------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'status') {
    const t = activeTabId != null && tabs.get(activeTabId);
    sendResponse({
      ws: wsStatus,
      port: bridgePort,
      tabs: tabs.size,
      track: t && t.state && t.state.hasTrack ? `${t.state.title} — ${t.state.artist}` : null,
      source: t && t.state ? t.state.source : null
    });
  } else if (msg && msg.type === 'reconnect') {
    reconnectNow();
    sendResponse({ ok: true });
  }
  return false;
});
