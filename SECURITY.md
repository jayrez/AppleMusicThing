# Security policy

## Supported versions

Only the latest release gets security fixes. Check the [latest release](https://github.com/jayrez/AppleMusicThing/releases/latest) before reporting.

| Component | Supported |
|---|---|
| Apple Music app for DeskThing, latest release | ✅ |
| Now Playing Bridge for DeskThing (browser extension), latest release or store version | ✅ |
| Older versions | ❌ |

## Reporting a vulnerability

**Please don't open a public issue for security problems.**

Report privately through GitHub: open the repository's **Security** tab and choose **[Report a vulnerability](https://github.com/jayrez/AppleMusicThing/security/advisories/new)**. Only the maintainer can see the report.

Please include:

- what the problem is and what an attacker could do with it
- steps to reproduce, or a proof of concept
- the app and extension versions, your OS and browser

You can expect an acknowledgement within a week. This is a one-person hobby project, so fixes take as long as they take, but security reports come first. Once a fix is released, the advisory is published with credit to you, unless you'd rather stay anonymous.

## What's in scope

This project's attack surface is small but real. These areas matter most:

- **The local bridge** ([`app/server/bridge.ts`](app/server/bridge.ts)). A WebSocket server inside DeskThing, bound to `127.0.0.1` and refusing connections whose `Origin` isn't a browser extension. Anything that lets a website, another program, or another machine on your network connect to it or send it commands is in scope.
- **The browser extension** ([`extension/`](extension)). It runs on music.apple.com and holds the `storage` permission plus host access to `lrclib.net`. In scope:
  - any way for a web page to drive it
  - anything that makes it fetch a URL other than `https://lrclib.net/…` on the app's behalf ([`background.js`](extension/background.js))
  - anything that leaks Apple Music session data
- **Data handling** that contradicts the [privacy policy](PRIVACY.md).

## What's out of scope

Please report these to their owners instead:

- **DeskThing itself** (the desktop app, the Car Thing client, the DeskThing SDKs): [ItsRiprod/DeskThing](https://github.com/ItsRiprod/DeskThing)
- **Apple Music, MusicKit or music.apple.com:** [Apple Security Research](https://security.apple.com)
- **LRCLIB:** [lrclib.net](https://lrclib.net)
- **Car Thing firmware and flashing tools:** [Thing Labs](https://github.com/ThingLabsOSS)

Also out of scope:

- anything that needs an attacker who already controls your computer or browser profile
- the Car Thing being reachable from your computer over USB, which is how DeskThing works by design
