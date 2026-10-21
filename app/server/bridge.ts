import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { AppleLyricsMessage, Command, TrackState } from '../shared/types'

// Local WebSocket server that the "Apple Music DeskThing Bridge" browser
// extension (Edge or Chrome) connects to. Bound to 127.0.0.1 only, and only browser-extension
// origins are accepted, so ordinary web pages can't drive playback.

type Handlers = {
  onState: (s: TrackState) => void
  onStatus: (connected: boolean) => void
  onAppleLyrics: (msg: AppleLyricsMessage) => void
}

const allowedOrigin = (req: IncomingMessage) => {
  const origin = String(req.headers.origin || '')
  return origin.startsWith('chrome-extension://') || origin.startsWith('extension://')
}

export class ExtensionBridge {
  private wss: WebSocketServer | null = null
  private socket: WebSocket | null = null
  private port = 0
  private nextFetchId = 1
  private pendingFetches = new Map<number, { resolve: (r: { status: number; body: string }) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()

  constructor(private handlers: Handlers) {}

  get started() {
    return !!this.wss
  }

  get connected() {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN
  }

  start(port: number) {
    if (this.wss && port === this.port) return
    this.stop()
    this.port = port
    const wss = new WebSocketServer({
      host: '127.0.0.1',
      port,
      verifyClient: (info: { req: IncomingMessage }) => allowedOrigin(info.req)
    })
    this.wss = wss

    wss.on('listening', () => console.log(`[applemusic] bridge listening on 127.0.0.1:${port}`))
    wss.on('error', (err) => console.error(`[applemusic] bridge server error on port ${port}:`, err))

    wss.on('connection', (ws) => {
      // One browser at a time; the newest connection wins.
      if (this.socket && this.socket !== ws) {
        try { this.socket.close(4000, 'replaced') } catch { /* ignore */ }
      }
      this.socket = ws
      this.handlers.onStatus(true)

      ws.on('message', (raw) => {
        let msg: { type?: string; state?: TrackState; lyrics?: AppleLyricsMessage; id?: number; status?: number; body?: string; error?: string }
        try { msg = JSON.parse(String(raw)) } catch { return }
        if (msg.type === 'state' && msg.state) this.handlers.onState(msg.state)
        else if (msg.type === 'fetchResult' && typeof msg.id === 'number') this.settleFetch(msg)
        else if (msg.type === 'appleLyrics' && msg.lyrics) this.handlers.onAppleLyrics(msg.lyrics)
      })

      ws.on('close', () => {
        if (this.socket === ws) {
          this.socket = null
          this.handlers.onStatus(false)
        }
      })
      ws.on('error', () => { /* close follows */ })
    })
  }

  send(cmd: Command, value?: number) {
    if (!this.connected) return false
    this.socket!.send(JSON.stringify({ type: 'cmd', cmd, value }))
    return true
  }

  /** Ask the extension to GET a URL through the browser (and the system proxy). */
  fetchViaBrowser(url: string): Promise<{ status: number; body: string }> {
    if (!this.connected) return Promise.reject(new Error('extension not connected'))
    const id = this.nextFetchId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingFetches.delete(id)
        reject(new Error('browser fetch timed out'))
      }, 10000)
      this.pendingFetches.set(id, { resolve, reject, timer })
      this.socket!.send(JSON.stringify({ type: 'fetch', id, url }))
    })
  }

  private settleFetch(msg: { id?: number; status?: number; body?: string; error?: string }) {
    const p = this.pendingFetches.get(msg.id!)
    if (!p) return
    this.pendingFetches.delete(msg.id!)
    clearTimeout(p.timer)
    if (msg.error) p.reject(new Error(`browser fetch failed: ${msg.error}`))
    else p.resolve({ status: msg.status || 0, body: msg.body || '' })
  }

  requestState() {
    if (this.connected) this.socket!.send(JSON.stringify({ type: 'getState' }))
  }

  stop() {
    if (this.socket) { try { this.socket.close() } catch { /* ignore */ } }
    this.socket = null
    if (this.wss) { try { this.wss.close() } catch { /* ignore */ } }
    this.wss = null
  }
}
