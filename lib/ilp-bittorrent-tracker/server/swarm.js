var fetch = require('node-fetch')
var { URL } = require('url')
var debug = require('debug')('bittorrent-tracker:swarm')

const Swarm = require('bittorrent-tracker/lib/server/swarm')

class IlpSwarm extends Swarm {
  constructor (infoHash, license, server) {
    super(infoHash, server)

    this.license = license
  }

  announce (params, cb) {
    var self = this
    var id = params.type === 'ws' ? params.peer_id : params.addr
    // Mark the source peer as recently used in cache
    var peer = self.peers.get(id)

    if (params.event === 'started') {
      self._onAnnounceStarted(params, peer, id)
        .then(
          cb(null, {
            complete: self.complete,
            incomplete: self.incomplete,
            peers: self._getPeers(params.numwant, params.peer_id, !!params.socket)
          })
        )
        .catch(err => cb(err))
    } else if (params.event === 'stopped') {
      self._onAnnounceStopped(params, peer, id)
      cb(null, {
        complete: self.complete,
        incomplete: self.incomplete,
        peers: self._getPeers(params.numwant, params.peer_id, !!params.socket)
      })
    } else if (params.event === 'completed') {
      self._onAnnounceCompleted(params, peer, id)
        .then(
          cb(null, {
            complete: self.complete,
            incomplete: self.incomplete,
            peers: self._getPeers(params.numwant, params.peer_id, !!params.socket)
          })
        )
        .catch(err => cb(err))
    } else if (params.event === 'update') {
      self._onAnnounceUpdate(params, peer, id)
        .then(
          cb(null, {
            complete: self.complete,
            incomplete: self.incomplete,
            peers: self._getPeers(params.numwant, params.peer_id, !!params.socket)
          })
        )
        .catch(err => cb(err))
    } else {
      cb(new Error('invalid event'))
      return
    }
    cb(null, {
      complete: self.complete,
      incomplete: self.incomplete,
      peers: self._getPeers(params.numwant, params.peer_id, !!params.socket)
    })
  }

  async _onAnnounceStarted (params, peer, id) {
    if (peer) {
      debug('unexpected `started` event from peer that is already in swarm')
      return this._onAnnounceUpdate(params, peer, id) // treat as an update
    }

    if (params.downloaded === 0) {
      const endpoint = new URL(this.license.verifier.endsWith('/')
        ? `${this.license.verifier}balances/${params.requestId}:spend`
        : `${this.license.verifier}/balances/${params.requestId}:spend`)
      const verifyParams = { endpoint, amount: this.license.amount }
      try {
        await this._verify(verifyParams)
        if (params.left === 0) this.complete += 1
        else this.incomplete += 1
        this.peers.set(id, {
          type: params.type,
          complete: params.left === 0,
          paid: true,
          peerId: params.peer_id, // as hex
          ip: params.ip,
          port: params.port,
          socket: params.socket // only websocket
        })
      } catch (e) {
        throw new Error(`Verify receipt: ${e.message}. RequestID: ${params.requestId}`)
      }
    } else if (params.downloaded !== 0 & params.left === 0) {
      this.peers.set(id, {
        type: params.type,
        complete: params.left === 0,
        paid: true,
        peerId: params.peer_id, // as hex
        ip: params.ip,
        port: params.port,
        socket: params.socket // only websocket
      })
      this.complete += 1
    }
  }

  async _onAnnounceCompleted (params, peer, id) {
    if (!peer) {
      debug('unexpected `completed` event from peer that is not in swarm')
      await this._onAnnounceStarted(params, peer, id) // treat as a start
      return
    }
    if (peer.complete) {
      debug('unexpected `completed` event from peer that is already completed')
      await this._onAnnounceUpdate(params, peer, id) // treat as an update
      return
    }

    this.complete += 1
    this.incomplete -= 1
    peer.complete = true
    this.peers.set(id, peer)
  }

  async _onAnnounceUpdate (params, peer, id) {
    if (!peer) {
      debug('unexpected `update` event from peer that is not in swarm')
      await this._onAnnounceStarted(params, peer, id) // treat as a start
      return
    }

    if (!peer.complete && params.left === 0) {
      this.complete += 1
      this.incomplete -= 1
      peer.complete = true
    }
    this.peers.set(id, peer)
  }

  async _verify (params) {
    const res = await fetch(params.endpoint.href, { method: 'POST', body: params.amount.toString() })
    if (res.ok) {
      debug('Verify receipts: successfully verified')
      return res
    } else {
      debug(res.statusText)
      throw new Error(res.statusText)
    }
  }
}

module.exports = IlpSwarm
