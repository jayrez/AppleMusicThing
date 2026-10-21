# Contributing

Thanks for wanting to help. Bug reports, lyric-timing reports from real songs, fixes and ideas are all welcome. This is a small hobby project, so keep changes focused and expect friendly but sometimes slow reviews.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). For security problems, see [SECURITY.md](SECURITY.md) instead of opening an issue.

## Ways to help

- **Report a bug** with the [bug report form](https://github.com/jayrez/AppleMusicThing/issues/new?template=bug_report.yml). Your app and extension versions and what the extension popup says help most.
- **Report lyrics that are off** with the [lyrics form](https://github.com/jayrez/AppleMusicThing/issues/new?template=lyrics.yml): wrong song, early or late, not found. Real songs are the only way to tune the timing.
- **Suggest a feature** with the [feature request form](https://github.com/jayrez/AppleMusicThing/issues/new?template=feature_request.yml).
- **Send a pull request.** For anything bigger than a small fix, open an issue first so we can agree on the approach.

Questions about flashing the Car Thing or running DeskThing itself belong in the [DeskThing Discord](https://discord.gg/uNS3dhj46D), not here.

## How the project is laid out

```
app/          the DeskThing app
  server/     runs inside DeskThing on the computer: extension bridge, lyrics, actions, settings
  src/        the Car Thing screen (React)
  shared/     message and type definitions used by both
  deskthing/  app manifest and icons
extension/    the browser extension (Manifest V3, plain JavaScript, no build step)
store/        browser store listing text, images, and package.sh
docs/         screenshots and the technical tour
```

Read [How it works](docs/HOW-IT-WORKS.md) first. It explains how data flows between the pieces and why things are done the way they are.

## Development setup

You need Node.js 20 or newer. A Car Thing running DeskThing is needed for final testing, but most work can happen in a browser.

```sh
git clone https://github.com/jayrez/AppleMusicThing.git
cd AppleMusicThing/app
npm install
```

**Preview the Car Thing screen** with built-in demo songs. No DeskThing, Apple Music or Car Thing needed:

```sh
npx vite
```

Open the printed URL with your browser's device toolbar set to **800 × 480**. These URL options show specific states:

| URL | Shows |
|---|---|
| `?view=lyrics` | lyrics view |
| `?controls=1` | tap controls showing |
| `?track=2` | long title and artist |
| `?state=empty` | nothing playing |
| `?state=offline` | waiting for the browser |

Keyboard and mouse stand in for the hardware: **Enter** is a dial press, **Esc** the back button, the mouse wheel the dial, and click-and-drag a swipe.

**Run it in DeskThing.** Build the app and install the zip in DeskThing (**Apps** → add an app from a file):

```sh
npm run build        # → app/dist/applemusic-v<version>.zip
npm run typecheck    # must pass before a PR
```

**Work on the extension.** Load the `extension/` folder unpacked (`chrome://extensions` or `edge://extensions`, Developer mode, **Load unpacked**). After a change, click reload on the extension's card, then reload the music.apple.com tab.

## Rules that matter on the Car Thing

The Car Thing runs a 2018-era Chromium on a slow processor. Code that works in a modern desktop browser can break or stutter there.

- **Avoid newer CSS:** no `gap` on flex layouts (use margins), no `inset`, no `min()`/`max()`/`clamp()`, no `backdrop-filter`, no `:focus-visible`, and no `aspect-ratio`. The top of [`styles.css`](app/src/styles.css) lists these.
- **Nothing per-frame goes through React.** Anything that moves every frame, like the lyric fill or progress bar, writes straight to the DOM from a `requestAnimationFrame` loop and only touches what changed. See [`Progress.tsx`](app/src/Progress.tsx) and [`Lyrics.tsx`](app/src/Lyrics.tsx).
- **Continuous motion uses only `transform` and `opacity`.** Anything else triggers layout or repaint on every frame. Short one-off transitions on a state change, like the progress bar growing when controls appear, are fine.
- **Expensive work happens once per song,** not continuously. The glass effect in [`glass.ts`](app/src/glass.ts) is the example.
- **Layout is fixed at 800 × 480.** The album art must not move between states.

## Other rules

- **No real album art or lyrics in the repo,** test data or screenshots for the stores. They belong to their owners. Use the demo data in [`app/src/mock.ts`](app/src/mock.ts). README screenshots of real music are the one exception.
- **Keep the extension's permissions minimal.** Any new permission or host needs a strong reason and an update to [PRIVACY.md](PRIVACY.md) and [store/LISTING.md](store/LISTING.md).
- **Don't break the privacy promise:** song data goes only to `127.0.0.1` and lrclib.net.
- **Credit what you borrow.** New third-party code needs a compatible license and an entry in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Pull requests

- Keep one change per pull request, and say what you tested and where (preview, Car Thing, which OS and browser).
- Include before/after screenshots or a short clip for anything visual.
- Don't bump version numbers. The maintainer does that when releasing.
- Write commit messages that say what changed and why, in plain sentences.
- AI-assisted contributions are welcome (this project was built that way, see the README), as long as you've run and tested what you submit and can explain it.

## Releases

The maintainer releases by pushing a version tag. GitHub Actions builds both zips and publishes the release. See [Releasing](README.md#releasing) in the README.

## License

By contributing, you agree that your contributions are licensed under the project's [MIT License](LICENSE).
