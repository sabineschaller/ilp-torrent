/* global FileList */

const concat = require('simple-concat')
const parallel = require('run-parallel')
const path = require('path')

const WebTorrent = require('webtorrent')
const IlpTorrent = require('./torrent')
const createTorrent = require('../ilp-create-torrent')
const parseTorrent = require('../ilp-parse-torrent')

const VERSION = require('webtorrent/package.json').version
const VERSION_STR = VERSION
  .replace(/\d*./g, v => `0${v % 100}`.slice(-2))
  .slice(0, 4)

class IlpWebTorrent extends WebTorrent {
  constructor (opts = {}) {
    super(opts)
  }

  get (torrentId) {
    if (torrentId instanceof IlpTorrent) {
      if (this.torrents.includes(torrentId)) return torrentId
    } else {
      let parsed
      try { parsed = parseTorrent(torrentId) } catch (err) {}

      if (!parsed) return null
      if (!parsed.infoHash) throw new Error('Invalid torrent identifier')

      for (const torrent of this.torrents) {
        if (torrent.infoHash === parsed.infoHash) return torrent
      }
    }
    return null
  }

  add (torrentId, opts = {}, ontorrent) {
    if (this.destroyed) throw new Error('client is destroyed')
    if (typeof opts === 'function') [opts, ontorrent] = [{}, opts]
    if (opts.requestId === undefined) throw new Error('No STREAM receipts id provided')

    const onInfoHash = () => {
      if (this.destroyed) return
      for (const t of this.torrents) {
        if (t.infoHash === torrent.infoHash && t !== torrent) {
          torrent._destroy(new Error(`Cannot add duplicate torrent ${torrent.infoHash}`))
          return
        }
      }
    }

    const onReady = () => {
      if (this.destroyed) return
      if (typeof ontorrent === 'function') ontorrent(torrent)
      this.emit('torrent', torrent)
    }

    function onClose () {
      torrent.removeListener('_infoHash', onInfoHash)
      torrent.removeListener('ready', onReady)
      torrent.removeListener('close', onClose)
    }

    this._debug('add')
    opts = opts ? Object.assign({}, opts) : {}

    const torrent = new IlpTorrent(torrentId, this, opts)
    this.torrents.push(torrent)

    torrent.once('_infoHash', onInfoHash)
    torrent.once('ready', onReady)
    torrent.once('close', onClose)

    return torrent
  }

  seed (input, opts, onseed) {
    if (this.destroyed) throw new Error('client is destroyed')
    if (typeof opts === 'function') [opts, onseed] = [{}, opts]
    if (opts.license === undefined) throw new Error('no license included in opts')

    this._debug('seed')
    opts = opts ? Object.assign({}, opts) : {}

    // no need to verify the hashes we create
    opts.skipVerify = true

    const isFilePath = typeof input === 'string'

    // When seeding from fs path, initialize store from that path to avoid a copy
    if (isFilePath) opts.path = path.dirname(input)
    if (!opts.createdBy) opts.createdBy = `WebTorrent/${VERSION_STR}`

    const onTorrent = torrent => {
      const tasks = [
        cb => {
          // when a filesystem path is specified, files are already in the FS store
          if (isFilePath) return cb()
          torrent.load(streams, cb)
        }
      ]
      if (this.dht) {
        tasks.push(cb => {
          torrent.once('dhtAnnounce', cb)
        })
      }
      parallel(tasks, err => {
        if (this.destroyed) return
        if (err) return torrent._destroy(err)
        _onseed(torrent)
      })
    }

    const _onseed = torrent => {
      this._debug('on seed')
      if (typeof onseed === 'function') onseed(torrent)
      torrent.emit('seed')
      this.emit('seed', torrent)
    }

    const torrent = this.add(null, opts, onTorrent)
    let streams

    if (isFileList(input)) input = Array.from(input)
    else if (!Array.isArray(input)) input = [input]

    parallel(input.map(item => cb => {
      if (isReadable(item)) concat(item, cb)
      else cb(null, item)
    }), (err, input) => {
      if (this.destroyed) return
      if (err) return torrent._destroy(err)

      createTorrent.parseInput(input, opts, (err, files) => {
        if (this.destroyed) return
        if (err) return torrent._destroy(err)

        streams = files.map(file => file.getStream)

        createTorrent(input, opts, (err, torrentBuf) => {
          if (this.destroyed) return
          if (err) return torrent._destroy(err)

          const existingTorrent = this.get(torrentBuf)
          if (existingTorrent) {
            torrent._destroy(new Error(`Cannot add duplicate torrent ${existingTorrent.infoHash}`))
          } else {
            torrent._onTorrentId(torrentBuf)
          }
        })
      })
    })

    return torrent
  }
}

function isReadable (obj) {
  return typeof obj === 'object' && obj != null && typeof obj.pipe === 'function'
}

function isFileList (obj) {
  return typeof FileList !== 'undefined' && obj instanceof FileList
}

module.exports = IlpWebTorrent
