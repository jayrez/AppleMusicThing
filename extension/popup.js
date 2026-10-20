const $ = (id) => document.getElementById(id);

const labels = {
  connected: ['ok', 'Connected'],
  connecting: ['warn', 'Connecting…'],
  error: ['bad', 'Not reachable — is DeskThing running?'],
  idle: ['', 'Idle (open Apple Music)']
};

async function refresh() {
  let s;
  try { s = await chrome.runtime.sendMessage({ type: 'status' }); } catch (_) { return; }
  if (!s) return;
  const [cls, text] = labels[s.ws] || labels.idle;
  $('ws').innerHTML = `<span class="dot ${cls}"></span>${text}`;
  $('tabs').textContent = String(s.tabs);
  $('track').textContent = s.track || 'Nothing playing';
  if (document.activeElement !== $('port')) $('port').value = s.port;
}

$('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const port = Number($('port').value);
  if (!port || port < 1024 || port > 65535) return;
  await chrome.storage.local.set({ port });
  setTimeout(refresh, 300);
});

refresh();
setInterval(refresh, 1000);
