# Apple Music for DeskThing

An album-art-first now playing screen for the Car Thing, driven by Apple Music in Edge, with synced lyrics.

Two pieces:

- **Apple Music DeskThing Bridge** (`extension/`) — a small Edge extension. It reads what's playing in your music.apple.com tab and carries out play/pause, skip, seek and volume.
- **Apple Music DeskThing app** (`app/`) — runs inside DeskThing. It talks to the extension on `127.0.0.1:8899`, looks up lyrics from LRCLIB, and draws the screen on the Car Thing.

## Install

### 1. The Edge extension
1. Download this repo (or the release's `applemusic-bridge-extension.zip`) and keep the `extension` folder somewhere permanent; Edge loads it from that folder.
2. Go to `edge://extensions`, turn on **Developer mode**, click **Load unpacked**, pick the `extension` folder.
3. Reload any open music.apple.com tab.

### 2. The DeskThing app
1. Get `applemusic-v1.1.0.zip` from the Releases page (or build it, see below). In DeskThing, open **Apps**, choose to add/upload an app from a file, and pick that zip.
2. Open the app on the Car Thing.
3. Click the extension's toolbar icon in Edge. It should say **Connected** and show the current song.

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

## Troubleshooting

- **"Waiting for Edge" on the Car Thing**: the extension isn't connected. Check the popup. If it says not reachable, make sure DeskThing is running and the ports match. Another program using port 8899 shows up in DeskThing's logs; pick another port.
- **Popup connected but nothing playing**: reload the Apple Music tab once after installing the extension.
- **"No lyrics found"**: LRCLIB doesn't have that song.
- **"Couldn't reach the lyrics service"**: lyrics come from lrclib.net. The app tries directly first; if the computer's network blocks that (common behind a company proxy, which DeskThing doesn't use), it asks the extension to fetch through Edge instead. If it still fails, check that `https://lrclib.net/api/search?q=hello` opens in Edge; if it's blocked there, a web filter is blocking the site.
- Only one Apple Music tab is followed at a time: the one that's playing.

## Security notes

- The bridge listens on `127.0.0.1` only and refuses connections that don't come from a browser extension, so websites can't control playback through it.
- The extension only runs on music.apple.com. Besides local storage for the port number, it can reach lrclib.net, and it only fetches lrclib.net URLs on the app's behalf, so the app can't use it as a general proxy.

## Building from source

```
cd app
npm install
npm run build        # → app/dist/applemusic-v1.1.0.zip
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
extension/     the Edge extension (Manifest V3, no build step)
```
