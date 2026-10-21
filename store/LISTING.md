# Store listing: Now Playing Bridge for DeskThing

Everything to paste into the Chrome Web Store and Microsoft Edge Add-ons forms. Images are in [`store/images/`](images/); the upload zip is built with [`store/package.sh`](package.sh).

## Basics

| Field | Value |
|---|---|
| Name | Now Playing Bridge for DeskThing |
| Summary / short description (≤132 chars) | Shows what you play on Apple Music on the web on a Car Thing running DeskThing, with synced lyrics and playback controls. |
| Category | Chrome: **Tools** · Edge: **Entertainment** |
| Language | English |
| Homepage / support URL | https://github.com/jayrez/AppleMusicThing |
| Privacy policy URL | https://github.com/jayrez/AppleMusicThing/blob/main/PRIVACY.md |
| Pricing | Free |

## Detailed description

```
Turn a Car Thing running DeskThing into a now playing screen for Apple Music on the web.

This extension connects the Apple Music web player (music.apple.com) in Edge or Chrome to the free Apple Music app for DeskThing, the open-source system that brings Spotify's discontinued Car Thing back to life as a desk display.

WHAT YOU GET ON THE CAR THING
• Album art, title, artist and progress for whatever's playing
• Synced lyrics that fill in word by word as they're sung
• Play, pause, skip and seek from the touchscreen and buttons
• Volume on the dial, play/pause on a press, swipes to skip

WHAT YOU NEED
• A Car Thing running DeskThing (deskthing.app)
• The Apple Music app for DeskThing, installed in DeskThing
• An Apple Music subscription, signed in at music.apple.com

PRIVATE BY DESIGN
Song info only goes to the DeskThing app on your own computer, over a local connection. There are no accounts, servers or analytics. When Apple Music has no lyrics for a song, the song's title and artist are looked up on LRCLIB, a free public lyrics database. Full privacy policy: github.com/jayrez/AppleMusicThing/blob/main/PRIVACY.md

Open source (MIT): github.com/jayrez/AppleMusicThing

Not affiliated with, endorsed by, or sponsored by Apple, Spotify, or the DeskThing project. Apple Music is a trademark of Apple Inc.
```

## Single purpose (Chrome)

```
Sends what's playing in the Apple Music web player to the DeskThing app on the same computer, and carries out playback commands from it, so a Car Thing can show and control the music.
```

## Permission justifications

| Permission | Justification to paste |
|---|---|
| `storage` | Saves one setting: the local port number used to connect to the DeskThing app on the same computer. |
| Host permission `https://lrclib.net/*` | Fetches song lyrics from LRCLIB, a free public lyrics database, when Apple Music has none and the DeskThing app on this computer can't reach lrclib.net itself (for example behind a company proxy). Only lrclib.net URLs are ever fetched. |
| Content scripts on `https://music.apple.com/*` | Reads the current song, playback position and lyrics from the Apple Music web player, and carries out play, pause, skip, seek and volume commands sent from the user's Car Thing. Runs on no other site. |
| Remote code | **No.** All code is included in the package. |

The extension also opens a WebSocket to `ws://127.0.0.1:<port>` to talk to the DeskThing app on the same computer. No permission is required for this, but mention it if asked.

## Data use (Chrome privacy tab / Edge)

- **Data collected:** Website content. The current song's title, artist, album, artwork link, playback state and lyrics, read from music.apple.com.
- **How it's used:** Only to show the song on the user's Car Thing. It's sent to the DeskThing app on the same computer (127.0.0.1). Song title, artist, album and length are sent to lrclib.net for lyrics when needed.
- **Certify all three:**
  - Not sold or transferred to third parties, outside the approved use cases.
  - Not used or transferred for purposes unrelated to the single purpose.
  - Not used or transferred to determine creditworthiness or for lending.

## Notes for reviewers

```
This extension is a companion to a desktop app (DeskThing, deskthing.app) and its Car Thing display. Without DeskThing running, the extension's popup shows "Not reachable — is DeskThing running?" and the extension does nothing else.

To test without hardware: install DeskThing on the computer, install the Apple Music app for DeskThing from github.com/jayrez/AppleMusicThing/releases, then open DeskThing's client page in a browser (DeskThing → Clients → QR Code link). Play a song at music.apple.com; the popup shows "Connected" and the song, and the DeskThing client page shows it.

The extension reads the Apple Music web player through the page's own player object, and requests lyrics through the page's existing signed-in session, the same way the page's lyrics button does. It doesn't read or store sign-in tokens. The local WebSocket only accepts connections from browser extensions, so websites can't use it.
```

## Images

| File | Use | Size |
|---|---|---|
| `images/screenshot-1-now-playing.png` | Screenshot 1 | 1280×800 |
| `images/screenshot-2-lyrics.png` | Screenshot 2 | 1280×800 |
| `images/screenshot-3-controls.png` | Screenshot 3 | 1280×800 |
| `images/screenshot-4-popup.png` | Screenshot 4 | 1280×800 |
| `images/promo-small-440x280.png` | Chrome small promo tile · Edge small promotional tile | 440×280 |
| `images/store-logo-300.png` | Edge store logo | 300×300 |
| `../extension/icons/icon128.png` | Chrome store icon | 128×128 |

The screenshots use the app's demo songs and artwork on purpose: store reviewers reject listings that show real album covers or lyrics they don't hold rights to.

## Publishing checklist

1. Build the zip: `store/package.sh` → `store/dist/now-playing-bridge-v<version>.zip`. `manifest.json` is at the root of the zip, which the stores require.
2. **Edge (free):** at [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview), register as an Edge extension developer, choose **Create new extension**, upload the zip, then fill in **Properties**, **Store listings** and **Submit**.
3. **Chrome (one-time fee):** at the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole), register, choose **New item**, upload the zip, then fill in **Store listing**, **Privacy** and **Distribution** (Public), and submit for review.
4. After approval, add the store links to the README.
5. For every update, bump `version` in `extension/manifest.json`, rebuild the zip, and upload it as a new package in both dashboards.
