import { DeskThing } from '@deskthing/server'
import { Action, AppSettings, DESKTHING_EVENTS, SETTING_TYPES } from '@deskthing/types'
import { ExtensionBridge } from './bridge'
import { fetchLyrics, setFallbackFetch } from './lyrics'
import { ACTION_IDS, Command, LyricsPayload, SETTING_IDS, ToClient, ToServer, TrackState } from '../shared/types'

const DeskThingServer = DeskThing as unknown as typeof DeskThing & {
  send: (data: ToClient) => void
}

const DEFAULT_PORT = 8899

let state: TrackState = { hasTrack: false }
let lyrics: LyricsPayload | null = null
let volumeStep = 0.05

const sendToClient = (data: ToClient) => DeskThingServer.send(data)

// ---------- extension bridge ----------

const bridge = new ExtensionBridge({
  onState: (s) => {
    const trackChanged = s.hasTrack && s.id !== state.id
    state = s
    sendToClient({ type: 'am', request: 'state', payload: state })
    if (trackChanged) loadLyrics(s)
    if (!s.hasTrack) lyrics = null
  },
  onStatus: (connected) => {
    sendToClient({ type: 'am', request: 'bridge', payload: { connected } })
    if (connected) bridge.requestState()
  }
})

setFallbackFetch((url) => bridge.fetchViaBrowser(url))

const loadLyrics = async (track: TrackState) => {
  const trackId = track.id || ''
  lyrics = { trackId, status: 'loading' }
  sendToClient({ type: 'am', request: 'lyrics', payload: lyrics })
  const result = await fetchLyrics(track)
  if (state.id !== trackId) return // song changed while we were fetching
  lyrics = result
  sendToClient({ type: 'am', request: 'lyrics', payload: result })
}

const runCommand = (cmd: Command, value?: number) => {
  // Optimistic volume so rapid dial turns stack correctly.
  if (cmd === 'volumeDelta' && typeof value === 'number') {
    const v = Math.max(0, Math.min(1, (state.volume ?? 1) + value))
    state = { ...state, volume: v }
    return bridge.send('volume', v)
  }
  if (cmd === 'volume' && typeof value === 'number') state = { ...state, volume: value }
  return bridge.send(cmd, value)
}

// ---------- messages from the Car Thing UI ----------

DeskThing.on('am_cmd', (data) => {
  const p = (data as ToServer).payload as { cmd: Command; value?: number } | undefined
  if (p && p.cmd) runCommand(p.cmd, p.value)
})

DeskThing.on('am_get', () => {
  sendToClient({ type: 'am', request: 'bridge', payload: { connected: bridge.connected } })
  sendToClient({ type: 'am', request: 'state', payload: state })
  if (lyrics) sendToClient({ type: 'am', request: 'lyrics', payload: lyrics })
  else if (state.hasTrack) loadLyrics(state)
})

// ---------- actions (for DeskThing button mappings) ----------

const actions: Action[] = [
  { id: ACTION_IDS.PLAY_PAUSE, name: 'Apple Music: Play / Pause', description: 'Toggle playback in Apple Music web', tag: 'media', enabled: true, version: '1.0.0' },
  { id: ACTION_IDS.NEXT, name: 'Apple Music: Next', description: 'Skip to the next song', tag: 'media', enabled: true, version: '1.0.0' },
  { id: ACTION_IDS.PREV, name: 'Apple Music: Previous', description: 'Restart the song, or go back if near the start', tag: 'media', enabled: true, version: '1.0.0' },
  { id: ACTION_IDS.VOL_UP, name: 'Apple Music: Volume Up', description: 'Raise Apple Music volume by the volume step', tag: 'media', enabled: true, version: '1.0.0' },
  { id: ACTION_IDS.VOL_DOWN, name: 'Apple Music: Volume Down', description: 'Lower Apple Music volume by the volume step', tag: 'media', enabled: true, version: '1.0.0' },
  { id: ACTION_IDS.LYRICS, name: 'Apple Music: Toggle Lyrics', description: 'Show or hide lyrics on the Apple Music screen', tag: 'basic', enabled: true, version: '1.0.0' }
]

DeskThing.on(DESKTHING_EVENTS.ACTION, (data) => {
  switch (data.payload?.id) {
    case ACTION_IDS.PLAY_PAUSE: return void runCommand('playPause')
    case ACTION_IDS.NEXT: return void runCommand('next')
    case ACTION_IDS.PREV: return void runCommand('prev')
    case ACTION_IDS.VOL_UP: return void runCommand('volumeDelta', volumeStep)
    case ACTION_IDS.VOL_DOWN: return void runCommand('volumeDelta', -volumeStep)
    case ACTION_IDS.LYRICS: return void sendToClient({ type: 'am', request: 'toggleLyrics' })
  }
})

// ---------- settings ----------

const settings: AppSettings = {
  [SETTING_IDS.LYRICS_BUTTON]: {
    id: SETTING_IDS.LYRICS_BUTTON,
    label: 'Lyrics button',
    description: 'Physical button that shows/hides lyrics while this app is open. Holding the back button still opens the app list.',
    type: SETTING_TYPES.SELECT,
    value: 'Escape',
    options: [
      { value: 'Escape', label: 'Back button (below the dial)' },
      { value: 'KeyM', label: 'Top-right button' },
      { value: 'Digit1', label: 'Preset 1' },
      { value: 'Digit2', label: 'Preset 2' },
      { value: 'Digit3', label: 'Preset 3' },
      { value: 'Digit4', label: 'Preset 4' },
      { value: 'none', label: 'None (use button mappings)' }
    ]
  },
  [SETTING_IDS.VOLUME_STEP]: {
    id: SETTING_IDS.VOLUME_STEP,
    label: 'Volume step',
    description: 'How much one dial click or swipe changes the Apple Music volume',
    type: SETTING_TYPES.SELECT,
    value: '5',
    options: [
      { value: '2', label: '2%' },
      { value: '5', label: '5%' },
      { value: '10', label: '10%' }
    ]
  },
  [SETTING_IDS.BRIDGE_PORT]: {
    id: SETTING_IDS.BRIDGE_PORT,
    label: 'Bridge port',
    description: 'Local port the Edge extension connects to. Must match the port in the extension popup.',
    type: SETTING_TYPES.NUMBER,
    value: DEFAULT_PORT,
    min: 1024,
    max: 65535
  }
}

const applySettings = (s: AppSettings | null | undefined) => {
  if (!s) return
  const step = Number(s[SETTING_IDS.VOLUME_STEP]?.value)
  if (step) volumeStep = step / 100
  const port = Number(s[SETTING_IDS.BRIDGE_PORT]?.value) || DEFAULT_PORT
  bridge.start(port)
}

DeskThing.on(DESKTHING_EVENTS.SETTINGS, (data) => applySettings(data.payload as AppSettings))

// ---------- lifecycle ----------

const start = async () => {
  await DeskThing.initSettings(settings)
  actions.forEach((a) => DeskThing.registerAction(a))
  applySettings((await DeskThing.getSettings()) || settings)
  // If saved settings never arrive, still listen on the default port.
  setTimeout(() => { if (!bridge.started) bridge.start(DEFAULT_PORT) }, 3000)
}

const stop = async () => {
  bridge.stop()
}

DeskThing.on(DESKTHING_EVENTS.START, start)
DeskThing.on(DESKTHING_EVENTS.STOP, stop)
