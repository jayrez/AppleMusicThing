import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Command, TrackState } from '../shared/types'

// Local WebSocket server that the "Apple Music DeskThing Bridge" Edge
// extension connects to. Bound to 127.0.0.1 only, and only browser-extension
// origins are accepted, so ordinary web pages can't drive playback.

type Handlers = {
  onState: (s: TrackState) => void
  onStatus: (connected: boolean) => void
}

const allowedOrigin = (req: IncomingMessage) => {
  const origin = String(req.headers.origin || '')
  return origin.startsWith('chrome-extension://') || origin.startsWith('extension://')
}

export class ExtensionBridge {
  private wss: WebSocketServer | null = null
  private socket: WebSocket | null = null
  private port = 0

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
        let msg: { type?: string; state?: TrackState }
        try { msg = JSON.parse(String(raw)) } catch { return }
        if (msg.type === 'state' && msg.state) this.handlers.onState(msg.state)
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
