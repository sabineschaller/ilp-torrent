const Discovery = require('torrent-discovery')
const Tracker = require('../ilp-bittorrent-tracker/client')

class IlpDiscovery extends Discovery {
  constructor (opts) {
    opts.trackerOpts = opts.tracker
    opts.tracker = false
    super(opts)

    this._license = opts.license
    this._requestId = opts.requestId
    this._trackerOpts = Object.assign({}, opts.trackerOpts)
    this.tracker = this._createTracker()
  }

  _createTracker () {
    const opts = Object.assign({}, this._trackerOpts, {
      infoHash: this.infoHash,
      announce: this._announce,
      peerId: this.peerId,
      port: this._port,
      userAgent: this._userAgent,
      license: this._license,
      requestId: this._requestId
    })

    const tracker = new Tracker(opts)
    tracker.on('warning', this._onWarning)
    tracker.on('error', this._onError)
    tracker.on('peer', this._onTrackerPeer)
    tracker.on('update', this._onTrackerAnnounce)
    tracker.setInterval(this._intervalMs)
    tracker.start()
    return tracker
  }
}

module.exports = IlpDiscovery
