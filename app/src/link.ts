// Thin layer over the DeskThing client SDK. When the page is opened on its own
// (not inside the DeskThing client), it runs on demo data so the screen can be
// previewed in a normal browser at 800x480.
import { DeskThing } from '@deskthing/client'
import type { AppSettings } from '@deskthing/types'
import type { Command, LyricsPayload, ToClient, TrackState } from '@shared/types'
import { startMock } from './mock'

export const isMock = typeof window !== 'undefined' && window.self === window.top

type Listener = (msg: ToClient) => void
const listeners = new Set<Listener>()
const emit = (msg: ToClient) => listeners.forEach((l) => l(msg))

let mockCmd: ((cmd: Command, value?: number) => void) | null = null

export const link = {
  start() {
    if (isMock) {
      mockCmd = startMock(emit)
      return
    }
    DeskThing.on('am', (data: unknown) => emit(data as ToClient))
    DeskThing.send({ type: 'am_get' } as never)
  },
  on(l: Listener) {
    listeners.add(l)
    return () => { listeners.delete(l) }
  },
  command(cmd: Command, value?: number) {
    if (isMock) return mockCmd && mockCmd(cmd, value)
    DeskThing.send({ type: 'am_cmd', payload: { cmd, value } } as never)
  },
  image(url?: string) {
    if (!url) return ''
    if (isMock || url.startsWith('data:')) return url
    return DeskThing.useProxy(url)
  },
  overrideKeys(keys: string[]) {
    if (!isMock) DeskThing.overrideKeys(keys)
  },
  restoreKeys(keys: string[]) {
    if (!isMock) DeskThing.restoreKeys(keys)
  },
  openAppList() {
    if (!isMock) DeskThing.triggerAction({ id: 'appslist', value: 'show', source: 'server' } as never)
  },
  async settings(): Promise<AppSettings | undefined> {
    if (isMock) return undefined
    try { return await DeskThing.getSettings() } catch { return undefined }
  },
  onSettings(cb: (s: AppSettings) => void) {
    if (isMock) return () => {}
    return DeskThing.on('settings' as never, (data: { payload?: AppSettings }) => {
      if (data && data.payload) cb(data.payload)
    })
  }
}

export type { TrackState, LyricsPayload }
