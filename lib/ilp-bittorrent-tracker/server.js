const string2compact = require('string2compact')
const common = require('../../node_modules/bittorrent-tracker/lib/common')

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

    function announce (swarm) {
      if (!params.event || params.event === 'empty') params.event = 'update'
      swarm.announce(params, (err, response) => {
        if (err) return cb(err)

        if (!response.action) response.action = common.ACTIONS.ANNOUNCE
        if (!response.interval) response.interval = Math.ceil(self.intervalMs / 1000)

        if (params.compact === 1) {
          const peers = response.peers

          // Find IPv4 peers
          response.peers = string2compact(peers.filter(peer => {
            return common.IPV4_RE.test(peer.ip)
          }).map(peer => {
            return `${peer.ip}:${peer.port}`
          }))
          // Find IPv6 peers
          response.peers6 = string2compact(peers.filter(peer => {
            return common.IPV6_RE.test(peer.ip)
          }).map(peer => {
            return `[${peer.ip}]:${peer.port}`
          }))
        } else if (params.compact === 0) {
          // IPv6 peers are not separate for non-compact responses
          response.peers = response.peers.map(peer => {
            return {
              'peer id': common.hexToBinary(peer.peerId),
              ip: peer.ip,
              port: peer.port
            }
          })
        } // else, return full peer objects (used for websocket responses)

        cb(null, response)
      })
    }
  }
}

IlpServer.Swarm = IlpSwarm

module.exports = IlpServer
