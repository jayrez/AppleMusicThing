# Privacy policy

**Now Playing Bridge for DeskThing** (the browser extension) and the **Apple Music app for DeskThing**

Last updated: October 21, 2026

This project has no servers, no accounts and no analytics. The developer never receives any of your data.

## What the extension reads

On music.apple.com only, the extension reads what the Apple Music web player is doing:

- the current song's title, artist, album, artwork link and length
- the playback position, whether it's playing, and the player volume
- the next song in your queue
- the current and next song's lyrics, which the extension asks for through the Apple Music page you're already signed in to, the same way the page's own lyrics button does

It does not run on any other website, and it does not read your browsing history, your Apple account details or your sign-in tokens.

## Where that information goes

- **To the DeskThing app on your own computer.** The extension sends the information above over a local connection to `127.0.0.1` (your computer only, port 8899 by default). DeskThing shows it on your Car Thing. It never leaves your computer this way.
- **To lrclib.net, only when needed for lyrics.** If Apple Music has no lyrics for a song, the DeskThing app looks them up on [LRCLIB](https://lrclib.net), a free public lyrics database, using the song's title, artist, album and length. If your computer's network blocks the app from reaching lrclib.net, the extension makes that same request through your browser instead. No other information is sent, and LRCLIB's own privacy terms apply to those requests.

The DeskThing app also downloads album artwork from Apple's image servers so it can display it.

## What is stored

- The extension stores one setting in your browser: the local port number.
- The DeskThing app keeps the current and recent songs' lyrics in memory to avoid fetching them twice. Nothing is written to disk, and it's gone when DeskThing closes.

## What is not done

- No data is sold, shared with third parties, or used for advertising.
- No personal information is collected.
- No analytics, tracking or crash reporting.

## Contact

Questions or concerns: open an issue at [github.com/jayrez/AppleMusicThing](https://github.com/jayrez/AppleMusicThing/issues).

If this policy changes, the update will be published here, with a new date above.
