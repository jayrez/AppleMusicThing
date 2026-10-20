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

  const fromMusicKit = () => {
    const item = mk.nowPlayingItem;
    if (!item) return { hasTrack: false };
    const a = item.attributes || {};
    const artworkTemplate = (a.artwork && a.artwork.url) || item.artworkURL || '';
    let durationMs = a.durationInMillis || item.playbackDuration || 0;
    if (!durationMs && mk.currentPlaybackDuration) durationMs = mk.currentPlaybackDuration * 1000;
    let isPlaying = !!mk.isPlaying;
    if (!isPlaying && window.MusicKit && window.MusicKit.PlaybackStates) {
      isPlaying = mk.playbackState === window.MusicKit.PlaybackStates.playing;
    }
    return {
      hasTrack: true,
      id: String(item.id || a.playParams?.id || `${a.name}|${a.artistName}`),
      title: item.title || a.name || '',
      artist: item.artistName || a.artistName || '',
      album: item.albumName || a.albumName || '',
      artwork: artworkFromTemplate(artworkTemplate),
      durationMs: Math.round(durationMs),
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
  };

  const changed = (a, b) => {
    if (!a || !b) return true;
    if (a.hasTrack !== b.hasTrack || a.id !== b.id || a.isPlaying !== b.isPlaying) return true;
    if (a.title !== b.title || a.artist !== b.artist || a.artwork !== b.artwork) return true;
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
        case 'refresh': break;
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
