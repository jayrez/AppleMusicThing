// Shared between the DeskThing server side and the Car Thing UI.

export type TrackState = {
  hasTrack: boolean
  id?: string
  title?: string
  artist?: string
  album?: string
  artwork?: string
  durationMs?: number
  positionMs?: number
  isPlaying?: boolean
  volume?: number
  source?: 'musickit' | 'mediasession'
}

/** A syllable of a word: times in ms, len = letters, used to fill a word piece by piece. */
export type LyricPart = { t: number; end: number; len: number }
export type LyricWord = { t: number; end?: number; text: string; parts?: LyricPart[] }
/** Times in ms. `end` and `words` are present when the source has them (Apple lyrics, enhanced LRC). */
export type LyricLine = { t: number; end?: number; text: string; words?: LyricWord[] }

export type LyricsPayload = {
  trackId: string
  status: 'loading' | 'synced' | 'plain' | 'instrumental' | 'none' | 'error'
  synced?: LyricLine[]
  plain?: string[]
  source?: 'apple' | 'lrclib'
}

/** Lyrics the extension fetched from Apple Music for the current song. */
export type AppleLyricsMessage = { trackId: string; status: 'ok' | 'none' | 'unavailable'; ttml?: string }

export type Command = 'playPause' | 'next' | 'prev' | 'seek' | 'volume' | 'volumeDelta'

/** Messages the server sends to the UI: { type: 'am', request, payload } */
export type ToClient =
  | { type: 'am'; request: 'state'; payload: TrackState }
  | { type: 'am'; request: 'lyrics'; payload: LyricsPayload }
  | { type: 'am'; request: 'bridge'; payload: { connected: boolean } }
  | { type: 'am'; request: 'toggleLyrics'; payload?: undefined }

/** Messages the UI sends to the server */
export type ToServer =
  | { type: 'am_cmd'; request?: string; payload: { cmd: Command; value?: number } }
  | { type: 'am_get'; request?: string; payload?: undefined }

export const SETTING_IDS = {
  LYRICS_BUTTON: 'lyrics_button',
  VOLUME_STEP: 'volume_step',
  BRIDGE_PORT: 'bridge_port'
} as const

export const ACTION_IDS = {
  PLAY_PAUSE: 'am_playpause',
  NEXT: 'am_next',
  PREV: 'am_prev',
  VOL_UP: 'am_volup',
  VOL_DOWN: 'am_voldown',
  LYRICS: 'am_lyrics'
} as const
