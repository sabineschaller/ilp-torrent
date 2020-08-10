const BitField = require('bitfield')
const FSChunkStore = require('fs-chunk-store')
const get = require('simple-get')
const ImmediateChunkStore = require('immediate-chunk-store')
const parallel = require('run-parallel')
const parseRange = require('parse-numeric-range')
const path = require('path')
const Piece = require('torrent-piece')

const File = require('../../node_modules/webtorrent/lib/file')
const RarityMap = require('../../node_modules/webtorrent/lib/rarity-map')

const Torrent = require('webtorrent/lib/torrent')
const IlpDiscovery = require('../ilp-torrent-discovery')
const parseTorrent = require('../ilp-parse-torrent')

const VERSION = require('webtorrent/package.json').version
const USER_AGENT = `WebTorrent/${VERSION} (https://webtorrent.io)`

class IlpTorrent extends Torrent {
  constructor (torrentId, client, opts) {
    super(torrentId, client, opts)

    this.license = opts.license
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

  _onTorrentId (torrentId) {
    if (this.destroyed) return

    let parsedTorrent
    try { parsedTorrent = parseTorrent(torrentId) } catch (err) {}
    if (parsedTorrent) {
      // Attempt to set infoHash property synchronously
      this.infoHash = parsedTorrent.infoHash
      this._debugId = parsedTorrent.infoHash.toString('hex').substring(0, 7)
      process.nextTick(() => {
        if (this.destroyed) return
        this._onParsedTorrent(parsedTorrent)
      })
    } else {
      // If torrentId failed to parse, it could be in a form that requires an async
      // operation, i.e. http/https link, filesystem path, or Blob.
      parseTorrent.remote(torrentId, (err, parsedTorrent) => {
        if (this.destroyed) return
        if (err) return this._destroy(err)
        this._onParsedTorrent(parsedTorrent)
      })
    }
  }

  _processParsedTorrent (parsedTorrent) {
    this._debugId = parsedTorrent.infoHash.toString('hex').substring(0, 7)

    if (typeof this.private !== 'undefined') {
      // `private` option overrides default, only if it's defined
      parsedTorrent.private = this.private
    }

    if (this.announce) {
      // Allow specifying trackers via `opts` parameter
      parsedTorrent.announce = parsedTorrent.announce.concat(this.announce)
    }

    if (this.client.tracker && global.WEBTORRENT_ANNOUNCE && !parsedTorrent.private) {
      // So `webtorrent-hybrid` can force specific trackers to be used
      parsedTorrent.announce = parsedTorrent.announce.concat(global.WEBTORRENT_ANNOUNCE)
    }

    if (this.urlList) {
      // Allow specifying web seeds via `opts` parameter
      parsedTorrent.urlList = parsedTorrent.urlList.concat(this.urlList)
    }

    // remove duplicates by converting to Set and back
    parsedTorrent.announce = Array.from(new Set(parsedTorrent.announce))
    parsedTorrent.urlList = Array.from(new Set(parsedTorrent.urlList))

    Object.assign(this, parsedTorrent)

    this.magnetURI = parseTorrent.toMagnetURI(parsedTorrent)
    this.torrentFile = parseTorrent.toTorrentFile(parsedTorrent)
  }

  _getMetadataFromServer () {
    // to allow function hoisting
    const self = this

    const urls = Array.isArray(this.xs) ? this.xs : [this.xs]

    const tasks = urls.map(url => cb => {
      getMetadataFromURL(url, cb)
    })
    parallel(tasks)

    function getMetadataFromURL (url, cb) {
      if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
        self.emit('warning', new Error(`skipping non-http xs param: ${url}`))
        return cb(null)
      }

      const opts = {
        url,
        method: 'GET',
        headers: {
          'user-agent': USER_AGENT
        }
      }
      let req
      try {
        req = get.concat(opts, onResponse)
      } catch (err) {
        self.emit('warning', new Error(`skipping invalid url xs param: ${url}`))
        return cb(null)
      }

      self._xsRequests.push(req)

      function onResponse (err, res, torrent) {
        if (self.destroyed) return cb(null)
        if (self.metadata) return cb(null)

        if (err) {
          self.emit('warning', new Error(`http error from xs param: ${url}`))
          return cb(null)
        }
        if (res.statusCode !== 200) {
          self.emit('warning', new Error(`non-200 status code ${res.statusCode} from xs param: ${url}`))
          return cb(null)
        }

        let parsedTorrent
        try {
          parsedTorrent = parseTorrent(torrent)
        } catch (err) {}

        if (!parsedTorrent) {
          self.emit('warning', new Error(`got invalid torrent file from xs param: ${url}`))
          return cb(null)
        }

        if (parsedTorrent.infoHash !== self.infoHash) {
          self.emit('warning', new Error(`got torrent file with incorrect info hash from xs param: ${url}`))
          return cb(null)
        }

        self._onMetadata(parsedTorrent)
        cb(null)
      }
    }
  }

  /**
   * Called when the full torrent metadata is received.
   */
  _onMetadata (metadata) {
    if (this.metadata || this.destroyed) return
    this._debug('got metadata')

    this._xsRequests.forEach(req => {
      req.abort()
    })
    this._xsRequests = []

    let parsedTorrent
    if (metadata && metadata.infoHash) {
      // `metadata` is a parsed torrent (from parse-torrent module)
      parsedTorrent = metadata
    } else {
      try {
        parsedTorrent = parseTorrent(metadata)
      } catch (err) {
        return this._destroy(err)
      }
    }

    this._processParsedTorrent(parsedTorrent)
    this.metadata = this.torrentFile

    // add web seed urls (BEP19)
    if (this.client.enableWebSeeds) {
      this.urlList.forEach(url => {
        this.addWebSeed(url)
      })
    }

    this._rarityMap = new RarityMap(this)

    this.store = new ImmediateChunkStore(
      new this._store(this.pieceLength, {
        torrent: {
          infoHash: this.infoHash
        },
        files: this.files.map(file => ({
          path: path.join(this.path, file.path),
          length: file.length,
          offset: file.offset
        })),
        length: this.length,
        name: this.infoHash
      })
    )

    this.files = this.files.map(file => new File(this, file))

    // Select only specified files (BEP53) http://www.bittorrent.org/beps/bep_0053.html
    if (this.so) {
      const selectOnlyFiles = parseRange.parse(this.so)

      this.files.forEach((v, i) => {
        if (selectOnlyFiles.includes(i)) this.files[i].select(true)
      })
    } else {
      // start off selecting the entire torrent with low priority
      if (this.pieces.length !== 0) {
        this.select(0, this.pieces.length - 1, false)
      }
    }

    this._hashes = this.pieces

    this.pieces = this.pieces.map((hash, i) => {
      const pieceLength = (i === this.pieces.length - 1)
        ? this.lastPieceLength
        : this.pieceLength
      return new Piece(pieceLength)
    })

    this._reservations = this.pieces.map(() => [])

    this.bitfield = new BitField(this.pieces.length)

    this.wires.forEach(wire => {
      // If we didn't have the metadata at the time ut_metadata was initialized for this
      // wire, we still want to make it available to the peer in case they request it.
      if (wire.ut_metadata) wire.ut_metadata.setMetadata(this.metadata)

      this._onWireWithMetadata(wire)
    })

    // Emit 'metadata' before 'ready' and 'done'
    this.emit('metadata')

    // User might destroy torrent in response to 'metadata' event
    if (this.destroyed) return

    if (this.skipVerify) {
      // Skip verifying exisitng data and just assume it's correct
      this._markAllVerified()
      this._onStore()
    } else {
      const onPiecesVerified = (err) => {
        if (err) return this._destroy(err)
        this._debug('done verifying')
        this._onStore()
      }

      this._debug('verifying existing torrent data')
      if (this._fileModtimes && this._store === FSChunkStore) {
        // don't verify if the files haven't been modified since we last checked
        this.getFileModtimes((err, fileModtimes) => {
          if (err) return this._destroy(err)

          const unchanged = this.files.map((_, index) => fileModtimes[index] === this._fileModtimes[index]).every(x => x)

          if (unchanged) {
            this._markAllVerified()
            this._onStore()
          } else {
            this._verifyPieces(onPiecesVerified)
          }
        })
      } else {
        this._verifyPieces(onPiecesVerified)
      }
    }
  }
}

module.exports = IlpTorrent
