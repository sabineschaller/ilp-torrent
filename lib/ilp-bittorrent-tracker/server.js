const Tracker = require('bittorrent-tracker')
const IlpSwarm = require('./server/swarm')

class IlpServer extends Tracker.Server {
  constructor (opts = {}) {
    opts.udp = false
    super(opts)
  }

  createSwarm (infoHash, license, cb) {
    if (license === undefined) {
      return cb(new Error('license not provided'), null)
    }
    if (Buffer.isBuffer(infoHash)) infoHash = infoHash.toString('hex')

    process.nextTick(() => {
      const swarm = this.torrents[infoHash] = new IlpServer.Swarm(infoHash, license, this)
      cb(null, swarm)
    })
  }

  _onAnnounce (params, cb) {
    const self = this

    if (this._filter) {
      this._filter(params.info_hash, params, err => {
        // Presence of `err` means that this announce request is disallowed
        if (err) return cb(err)

        getOrCreateSwarm((err, swarm) => {
          if (err) return cb(err)
          announce(swarm)
        })
      })
    } else {
      getOrCreateSwarm((err, swarm) => {
        if (err) return cb(err)
        announce(swarm)
      })
    }

    // Get existing swarm, or create one if one does not exist
    function getOrCreateSwarm (cb) {
      self.getSwarm(params.info_hash, (err, swarm) => {
        if (err) return cb(err)
        if (swarm) return cb(null, swarm)
        self.createSwarm(params.info_hash, params.license, (err, swarm) => {
          if (err) return cb(err)
          cb(null, swarm)
        })
      })
    }

    const announce = super._onAnnounce.announce
  }
}

IlpServer.Swarm = IlpSwarm

module.exports = IlpServer
