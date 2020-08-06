const Tracker = require('bittorrent-tracker')
const Peer = require('simple-peer')
const IlpWebSocketTracker = require('./client/websocket-tracker')

class ilpClient extends Tracker.Client {
  constructor (opts = {}) {
    super(opts)

    this._license = opts.license
    this._requestId = opts.requestId

    const nextTickWarn = err => {
      process.nextTick(() => {
        this.emit('warning', err)
      })
    }

    let announce = typeof opts.announce === 'string'
      ? [opts.announce]
      : opts.announce == null ? [] : opts.announce

    // Remove trailing slash from trackers to catch duplicates
    announce = announce.map(announceUrl => {
      announceUrl = announceUrl.toString()
      if (announceUrl[announceUrl.length - 1] === '/') {
        announceUrl = announceUrl.substring(0, announceUrl.length - 1)
      }
      return announceUrl
    })
    // remove duplicates by converting to Set and back
    announce = Array.from(new Set(announce))

    const webrtcSupport = this._wrtc !== false && (!!this._wrtc || Peer.WEBRTC_SUPPORT)

    this._trackers = announce
      .map(announceUrl => {
        let parsedUrl
        try {
          parsedUrl = new URL(announceUrl)
        } catch (err) {
          nextTickWarn(new Error(`Invalid tracker URL: ${announceUrl}`))
          return null
        }

        const port = parsedUrl.port
        if (port < 0 || port > 65535) {
          nextTickWarn(new Error(`Invalid tracker port: ${announceUrl}`))
          return null
        }

        const protocol = parsedUrl.protocol
        if ((protocol === 'http:' || protocol === 'https:') &&
            typeof HTTPTracker === 'function') {
          return new Error('HTTP protocol not supported')
        } else if (protocol === 'udp:' && typeof UDPTracker === 'function') {
          return new Error('UDP protocol not supported')
        } else if ((protocol === 'ws:' || protocol === 'wss:') && webrtcSupport) {
          // Skip ws:// trackers on https:// sites because they throw SecurityError
          if (protocol === 'ws:' && typeof window !== 'undefined' &&
              window.location.protocol === 'https:') {
            nextTickWarn(new Error(`Unsupported tracker protocol: ${announceUrl}`))
            return null
          }
          return new IlpWebSocketTracker(this, announceUrl)
        } else {
          nextTickWarn(new Error(`Unsupported tracker protocol: ${announceUrl}`))
          return null
        }
      })
      .filter(Boolean)
  }
}

module.exports = ilpClient
