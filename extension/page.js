// Runs inside the Apple Music page itself (MAIN world) so it can read the
// MusicKit player. It talks to bridge.js (the isolated content script) via
// window.postMessage. Nothing here touches the network.
(() => {
  if (window.__amDeskThingBridge) return;
  window.__amDeskThingBridge = true;

  const TAG = '__amDeskThing';
  const ART_SIZE = 600;
  const SYNC_EVERY_MS = 4000; // periodic position resync while playing

  let mk = null;
  let last = null; // last state sent
  let lastSentAt = 0;

  // ---------- reading state ----------

  const getMusicKit = () => {
    try {
      if (window.MusicKit && typeof window.MusicKit.getInstance === 'function') {
        return window.MusicKit.getInstance() || null;
      }
    } catch (_) { /* not ready yet */ }
    return null;
  };

  const getAudio = () => document.querySelector('audio');

  const artworkFromTemplate = (url) => {
    if (!url) return '';
    return url
      .replace('{w}', ART_SIZE)
      .replace('{h}', ART_SIZE)
      .replace('{c}', 'bb')
      .replace('{f}', 'jpg');
  };

  const describe = (item) => {
    const a = item.attributes || {};
    const artworkTemplate = (a.artwork && a.artwork.url) || item.artworkURL || '';
    return {
      id: String(item.id || (a.playParams && a.playParams.id) || `${a.name}|${a.artistName}`),
      title: item.title || a.name || '',
      artist: item.artistName || a.artistName || '',
      album: item.albumName || a.albumName || '',
      artwork: artworkFromTemplate(artworkTemplate),
      durationMs: Math.round(a.durationInMillis || item.playbackDuration || 0)
    };
  };

  // The song queued after the current one, so its lyrics and art can be ready in advance.
  const nextItem = () => {
    try {
      const q = mk.queue;
      if (!q || !q.items || typeof q.position !== 'number') return null;
      for (let i = q.position + 1; i < q.items.length && i < q.position + 4; i++) {
        const it = q.items[i];
        if (it && it.isPlayable !== false) return it;
      }
    } catch (_) { /* queue API differs; skip prefetch */ }
    return null;
  };

  const fromMusicKit = () => {
    const item = mk.nowPlayingItem;
    if (!item) return { hasTrack: false };
    const d = describe(item);
    let durationMs = d.durationMs;
    if (!durationMs && mk.currentPlaybackDuration) durationMs = mk.currentPlaybackDuration * 1000;
    let isPlaying = !!mk.isPlaying;
    if (!isPlaying && window.MusicKit && window.MusicKit.PlaybackStates) {
      isPlaying = mk.playbackState === window.MusicKit.PlaybackStates.playing;
    }
    const n = nextItem();
    return {
      hasTrack: true,
      id: d.id,
      title: d.title,
      artist: d.artist,
      album: d.album,
      artwork: d.artwork,
      durationMs: Math.round(durationMs),
      next: n ? describe(n) : undefined,
      positionMs: Math.round((mk.currentPlaybackTime || 0) * 1000),
      isPlaying,
      volume: typeof mk.volume === 'number' ? mk.volume : 1,
      source: 'musickit'
    };
  };

  // Fallback if MusicKit isn't reachable: Media Session metadata + the <audio> element.
  const fromMediaSession = () => {
    const md = navigator.mediaSession && navigator.mediaSession.metadata;
    const audio = getAudio();
    if (!md) return { hasTrack: false };
    const art = (md.artwork || []).slice().sort((x, y) => {
      const s = (v) => parseInt(String(v.sizes || '0').split('x')[0], 10) || 0;
      return s(y) - s(x);
    })[0];
    return {
      hasTrack: true,
      id: `${md.title}|${md.artist}|${md.album}`,
      title: md.title || '',
      artist: md.artist || '',
      album: md.album || '',
      artwork: art ? art.src : '',
      durationMs: audio && isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0,
      positionMs: audio ? Math.round(audio.currentTime * 1000) : 0,
      isPlaying: audio ? !audio.paused : false,
      volume: audio ? audio.volume : 1,
      source: 'mediasession'
    };
  };

  const readState = () => {
    mk = mk || getMusicKit();
    try {
      if (mk) return fromMusicKit();
    } catch (_) { /* fall through */ }
    return fromMediaSession();
  };

  // ---------- sending ----------

  const post = (state) => {
    last = state;
    lastSentAt = Date.now();
    window.postMessage({ [TAG]: 'state', state }, window.location.origin);
    if (state.hasTrack && state.id !== lyricsFor) fetchAppleLyrics(state);
  };

  // ---------- Apple's own lyrics (TTML with line and often word timing) ----------

  let lyricsFor = null;
  let lastLyrics = null;

  const postLyrics = (msg) => {
    lastLyrics = msg;
    window.postMessage({ [TAG]: 'lyrics', lyrics: msg }, window.location.origin);
  };

  const lyricsCache = new Map(); // trackId -> lyrics message (current and prefetched)

  const loadAppleLyrics = async (item, trackId) => {
    if (lyricsCache.has(trackId)) return lyricsCache.get(trackId);
    if (!mk || !mk.api || typeof mk.api.music !== 'function' || !item) return { trackId, status: 'unavailable' };
    const a = item.attributes || {};
    const catalogId = (a.playParams && a.playParams.catalogId) || (/^\d+$/.test(String(item.id)) ? item.id : null);
    if (!catalogId) return { trackId, status: 'unavailable' };
    const sf = mk.storefrontId || mk.storefrontCountryCode || 'us';
    let result = null;
    for (const kind of ['syllable-lyrics', 'lyrics']) {
      try {
        const res = await mk.api.music(`/v1/catalog/${sf}/songs/${catalogId}/${kind}`);
        const attrs = (res && res.data && res.data.data && res.data.data[0] && res.data.data[0].attributes) || {};
        const ttml = typeof attrs.ttml === 'string' ? attrs.ttml : typeof attrs.ttmlLocalizations === 'string' ? attrs.ttmlLocalizations : '';
        if (ttml) { result = { trackId, status: 'ok', ttml }; break; }
      } catch (_) { /* try the next kind */ }
    }
    result = result || { trackId, status: 'none' };
    lyricsCache.set(trackId, result);
    if (lyricsCache.size > 12) lyricsCache.delete(lyricsCache.keys().next().value);
    return result;
  };

  const fetchAppleLyrics = async (state) => {
    lyricsFor = state.id;
    const trackId = state.id;
    const msg = await loadAppleLyrics(mk && mk.nowPlayingItem, trackId);
    if (lyricsFor !== trackId) return; // song changed meanwhile
    postLyrics(msg);
    // Get the next song's lyrics ready too, so they show the moment it starts.
    const n = mk && nextItem();
    if (n) {
      const nextId = describe(n).id;
      if (nextId !== trackId && !lyricsCache.has(nextId)) {
        const pre = await loadAppleLyrics(n, nextId);
        if (pre.status === 'ok') window.postMessage({ [TAG]: 'lyrics', lyrics: pre, prefetch: true }, window.location.origin);
      }
    }
  };

  const changed = (a, b) => {
    if (!a || !b) return true;
    if (a.hasTrack !== b.hasTrack || a.id !== b.id || a.isPlaying !== b.isPlaying) return true;
    if (a.title !== b.title || a.artist !== b.artist || a.artwork !== b.artwork) return true;
    if ((a.next && a.next.id) !== (b.next && b.next.id)) return true;
    if (Math.abs((a.volume || 0) - (b.volume || 0)) > 0.005) return true;
    if (Math.abs((a.durationMs || 0) - (b.durationMs || 0)) > 1000) return true;
    // detect seeks: where the position should be vs where it is
    const expected = b.positionMs + (b.isPlaying ? Date.now() - lastSentAt : 0);
    return Math.abs(a.positionMs - expected) > 1500;
  };

  const tick = (force) => {
    const s = readState();
    const due = s.isPlaying && Date.now() - lastSentAt > SYNC_EVERY_MS;
    if (force || due || changed(s, last)) post(s);
  };

  const soon = () => setTimeout(() => tick(true), 150);

  // ---------- commands ----------

  const clamp = (v) => Math.max(0, Math.min(1, v));

  const run = async (cmd, value) => {
    mk = mk || getMusicKit();
    const audio = getAudio();
    try {
      switch (cmd) {
        case 'playPause': {
          const playing = mk ? !!mk.isPlaying : audio && !audio.paused;
          if (mk) await (playing ? mk.pause() : mk.play());
          else if (audio) playing ? audio.pause() : audio.play();
          break;
        }
        case 'play': mk ? await mk.play() : audio && audio.play(); break;
        case 'pause': mk ? await mk.pause() : audio && audio.pause(); break;
        case 'next': if (mk) await mk.skipToNextItem(); break;
        case 'prev': {
          // Like a car stereo: restart the song unless we're near its start.
          const pos = mk ? mk.currentPlaybackTime : audio ? audio.currentTime : 0;
          if (pos > 3) {
            if (mk) await mk.seekToTime(0); else if (audio) audio.currentTime = 0;
          } else if (mk) {
            await mk.skipToPreviousItem();
          }
          break;
        }
        case 'seek': {
          const sec = Math.max(0, Number(value) / 1000);
          if (mk) await mk.seekToTime(sec); else if (audio) audio.currentTime = sec;
          break;
        }
        case 'volume': {
          const v = clamp(Number(value));
          if (mk) mk.volume = v; else if (audio) audio.volume = v;
          break;
        }
        case 'volumeDelta': {
          const cur = mk ? mk.volume : audio ? audio.volume : 1;
          const v = clamp(cur + Number(value));
          if (mk) mk.volume = v; else if (audio) audio.volume = v;
          break;
        }
        case 'refresh':
          if (lastLyrics) window.postMessage({ [TAG]: 'lyrics', lyrics: lastLyrics }, window.location.origin);
          break;
        default: return;
      }
    } catch (err) {
      console.warn('[AM DeskThing] command failed', cmd, err);
    }
    soon();
  };

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data[TAG] !== 'cmd') return;
    run(e.data.cmd, e.data.value);
  });

  // ---------- wiring ----------

  const hookMusicKit = () => {
    if (!mk || mk.__amHooked) return;
    mk.__amHooked = true;
    [
      'nowPlayingItemDidChange',
      'playbackStateDidChange',
      'playbackVolumeDidChange',
      'playbackDurationDidChange',
      'mediaItemStateDidChange'
    ].forEach((evt) => {
      try { mk.addEventListener(evt, soon); } catch (_) { /* older MusicKit */ }
    });
  };

  setInterval(() => {
    if (!mk) { mk = getMusicKit(); }
    hookMusicKit();
    tick(false);
  }, 1000);

  tick(true);
})();
