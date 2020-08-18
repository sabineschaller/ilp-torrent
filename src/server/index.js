const WebTorrent = require('../../lib/ilp-webtorrent-hybrid')
const Express = require('express')
const fileUpload = require('express-fileupload')
const dotenv = require('dotenv')

dotenv.config()

const TRACKER = process.env.TRACKER || 'ws://localhost:8000'

const client = new WebTorrent()
const app = new Express()

app.use(fileUpload())

app.post('/seed', (req, res) => {
  const extension = req.files.file.name.split('.').slice(-1)
  const info = {
    name: req.body.name ? `${req.body.name}.${extension}` : req.files.file.name,
    private: true,
    announce: TRACKER,
    paymentRequired: true,
    license: {
      paymentPointer: req.body.paymentPointer,
      verifier: req.body.verifier,
      amount: req.body.amount,
      asset: req.body.asset
    },
    requestId: ''
  }
  const buf = req.files.file.data
  buf.name = info.name
  client.seed(buf, info)
  client.on('torrent', function (torrent) {
    console.log('Client is seeding ' + torrent.magnetURI)
    return res.send(torrent.magnetURI)
  })
})

app.listen(process.env.SERVER_PORT, () => {
  console.log(`Listening on port ${process.env.SERVER_PORT}...`)
})
