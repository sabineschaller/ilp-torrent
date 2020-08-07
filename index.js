const createTorrent = require('./lib/ilp-create-torrent')
const parseTorrent = require('./lib/ilp-parse-torrent')
const fs = require('fs')

const opts = {
  name: 'example torrent file',
  paymentRequired: true,
  license: {
    paymentPointer: 'https://exmaple.com/sabine',
    amount: '0.00000001',
    asset: 'USD',
    verifier: 'https://example.com/verify'
  }
}

createTorrent('/home/sabine/Pictures/podcast-dark-2.png', opts, (err, torrent) => {
  if (!err) {
    // `torrent` is a Buffer with the contents of the new .torrent file
    fs.writeFile('my.torrent', torrent, (err) => {
      if (err) throw err
      console.log('The file has been saved!')
    })
  }
})

const parsed = parseTorrent(fs.readFileSync('my.torrent'))

console.log(parsed.license)
console.log(parsed.pieces.length)
