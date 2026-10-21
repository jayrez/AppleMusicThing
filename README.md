# Apple Music for DeskThing

An album-art-first now playing screen for the Car Thing, driven by Apple Music on the web (Edge or Chrome), with synced lyrics. Works on Windows and macOS.

Two pieces:

- **Apple Music DeskThing Bridge** (`extension/`) — a small browser extension for Edge or Chrome. It reads what's playing in your music.apple.com tab and carries out play/pause, skip, seek and volume.
- **Apple Music DeskThing app** (`app/`) — runs inside DeskThing. It talks to the extension on `127.0.0.1:8899`, gets lyrics, and draws the screen on the Car Thing.

**Lyrics** come from Apple Music itself when available (fetched by the extension, the same way Apple's lyrics button does). Many newer songs have word-by-word timing there, so the fill matches Apple Music exactly; older songs have line timing. When Apple has no lyrics, the app falls back to [LRCLIB](https://lrclib.net) and estimates word timing from syllables.

## Install

### 1. The browser extension
1. Download this repo (or the release's `applemusic-bridge-extension.zip`) and keep the `extension` folder somewhere permanent; the browser loads it from that folder.
2. Open the extensions page — `edge://extensions` in Edge or `chrome://extensions` in Chrome — turn on **Developer mode**, click **Load unpacked**, and pick the `extension` folder.
3. Reload any open music.apple.com tab.

### 2. The DeskThing app
1. Get `applemusic-v1.4.2.zip` from the Releases page (or build it, see below). In DeskThing, open **Apps**, choose to add/upload an app from a file, and pick that zip.
2. Open the app on the Car Thing.
3. Click the extension's toolbar icon (in Chrome, pin it from the puzzle-piece menu first). It should say **Connected** and show the current song.

## Using it

| Input | Does |
|---|---|
| Tap the screen | Show play / pause, previous, next and a bigger scrub bar; they fade after a few seconds |
| Drag the bar (while controls show) | Seek |
| Swipe left / right | Next / previous song |
| Swipe up / down | Volume up / down |
| Turn the dial | Volume |
| Press the dial | Play / pause |
| Hold the dial | Next song |
| Press the back button (below the dial) | Show / hide lyrics |
| Hold the back button | DeskThing app list, as before |

Previous restarts the song if you're more than 3 seconds in, like a car stereo.

Volume here is Apple Music's own volume slider, not Windows volume.

## Settings (DeskThing → Apps → Apple Music)

- **Lyrics button** — which hardware button toggles lyrics, or *None* to set it in button mappings instead.
- **Volume step** — 2, 5 or 10% per dial click or swipe.
- **Bridge port** — default 8899. If you change it, set the same port in the extension popup.

The app also registers mappable actions (**Apple Music: Play / Pause, Next, Previous, Volume Up, Volume Down, Toggle Lyrics**) so you can put them on any button in a mapping profile.

## Platforms

- **Windows 11** and **macOS**: both tested. Install DeskThing for your OS from [deskthing.app](https://deskthing.app/releases); the app zip and the extension are the same on both.
- **Browsers**: Microsoft Edge or Google Chrome. Other Chromium browsers that allow unpacked extensions should work but aren't tested.
- Use one browser at a time for Apple Music. If both have the extension and an Apple Music tab open, the most recent connection wins.

## Troubleshooting

- **"Waiting for the browser" on the Car Thing**: the extension isn't connected. Check the popup. If it says not reachable, make sure DeskThing is running and the ports match. Another program using port 8899 shows up in DeskThing's logs; pick another port.
- **Popup connected but nothing playing**: reload the Apple Music tab once after installing the extension.
- **"No lyrics found"**: LRCLIB doesn't have that song.
- **"Couldn't reach the lyrics service"**: lyrics come from lrclib.net. The app tries directly first; if the computer's network blocks that (common behind a company proxy, which DeskThing doesn't use), it asks the extension to fetch through the browser instead. If it still fails, check that `https://lrclib.net/api/search?q=hello` opens in your browser; if it's blocked there, a web filter is blocking the site.
- Only one Apple Music tab is followed at a time: the one that's playing.

## Security notes

- The bridge listens on `127.0.0.1` only and refuses connections that don't come from a browser extension, so websites can't control playback through it.
- The extension only runs on music.apple.com. Besides local storage for the port number, it can reach lrclib.net, and it only fetches lrclib.net URLs on the app's behalf, so the app can't use it as a general proxy.

## Building from source

```
cd app
npm install
npm run build        # → app/dist/applemusic-v1.4.2.zip
npx vite             # preview the screen in a browser with demo data
```

Preview URLs: `?view=lyrics`, `?controls=1`, `?track=2` (long title), `?state=empty`, `?state=offline`.

## Repo layout

```
app/
  server/      runs inside DeskThing on the computer: extension bridge, lyrics, actions, settings
  src/         the Car Thing screen (React)
  shared/      message and type definitions used by both
  deskthing/   app manifest and action icons
extension/     the browser extension for Edge or Chrome (Manifest V3, no build step)
```
