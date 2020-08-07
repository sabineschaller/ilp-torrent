const Torrent = require('webtorrent/lib/torrent')
const IlpDiscovery = require('../ilp-torrent-discovery')

const VERSION = require('webtorrent/package.json').version
const USER_AGENT = `WebTorrent/${VERSION} (https://webtorrent.io)`

class IlpTorrent extends Torrent {
  constructor (torrentId, client, opts) {
    super(torrentId, client, opts)

    this.requestId = opts.requestId
  }

  _startDiscovery () {
    if (this.discovery || this.destroyed) return

    let trackerOpts = this.client.tracker
    if (trackerOpts) {
      trackerOpts = Object.assign({}, this.client.tracker, {
        getAnnounceOpts: () => {
          const opts = {
            uploaded: this.uploaded,
            downloaded: this.downloaded,
            left: Math.max(this.length - this.downloaded, 0)
          }
          if (this.client.tracker.getAnnounceOpts) {
            Object.assign(opts, this.client.tracker.getAnnounceOpts())
          }
          if (this._getAnnounceOpts) {
            // TODO: consider deprecating this, as it's redundant with the former case
            Object.assign(opts, this._getAnnounceOpts())
          }
          return opts
        }
      })
    }

    // begin discovering peers via DHT and trackers
    this.discovery = new IlpDiscovery({
      infoHash: this.infoHash,
      announce: this.announce,
      peerId: this.client.peerId,
      dht: !this.private && this.client.dht,
      tracker: trackerOpts,
      port: this.client.torrentPort,
      userAgent: USER_AGENT,
      license: this.license,
      requestId: this.requestId
    })

    this.discovery.on('error', (err) => {
      this._destroy(err)
    })

    this.discovery.on('peer', (peer) => {
      // Don't create new outgoing TCP connections when torrent is done
      if (typeof peer === 'string' && this.done) return
      this.addPeer(peer)
    })

    this.discovery.on('trackerAnnounce', () => {
      this.emit('trackerAnnounce')
      if (this.numPeers === 0) this.emit('noPeers', 'tracker')
    })

    this.discovery.on('dhtAnnounce', () => {
      this.emit('dhtAnnounce')
      if (this.numPeers === 0) this.emit('noPeers', 'dht')
    })

    this.discovery.on('warning', (err) => {
      this.emit('warning', err)
    })
  }
}

module.exports = IlpTorrent
