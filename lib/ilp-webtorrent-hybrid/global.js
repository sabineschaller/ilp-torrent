const createTorrent = require('../ilp-create-torrent')
const wrtc = require('wrtc')

global.WEBTORRENT_ANNOUNCE = createTorrent.announceList
  .map(arr => arr[0])
  .filter(url => url.indexOf('wss://') === 0 || url.indexOf('ws://') === 0)

global.WRTC = wrtc
