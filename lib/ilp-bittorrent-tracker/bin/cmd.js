#!/usr/bin/env node

var minimist = require('minimist')
var Server = require('../').Server

var argv = minimist(process.argv.slice(2), {
  alias: {
    p: 'port',
    q: 'quiet',
    s: 'silent'
  },
  boolean: [
    'http',
    'quiet',
    'silent',
    'trust-proxy',
    'ws',
    'stats'
  ],
  string: [
    'http-hostname'
  ],
  default: {
    port: 8000,
    stats: true
  }
})

if (argv.version) {
  console.log(require('../package.json').version)
  process.exit(0)
}

if (argv.silent) argv.quiet = true

var allFalsy = !argv.http && !argv.ws

argv.http = allFalsy || argv.http
argv.ws = allFalsy || argv.ws

var server = new Server({
  http: argv.http,
  interval: argv.interval,
  stats: argv.stats,
  trustProxy: argv['trust-proxy'],
  ws: argv.ws
})

server.on('error', function (err) {
  if (!argv.silent) console.error('ERROR: ' + err.message)
})
server.on('warning', function (err) {
  if (!argv.quiet) console.log('WARNING: ' + err.message)
})
server.on('update', function (addr) {
  if (!argv.quiet) console.log('update: ' + addr)
})
server.on('complete', function (addr) {
  if (!argv.quiet) console.log('complete: ' + addr)
})
server.on('start', function (addr) {
  if (!argv.quiet) console.log('start: ' + addr)
})
server.on('stop', function (addr) {
  if (!argv.quiet) console.log('stop: ' + addr)
})

var hostname = {
  http: argv['http-hostname']
}

server.listen(argv.port, hostname, function () {
  if (server.ws && !argv.quiet) {
    var wsAddr = server.http.address()
    var wsHost = wsAddr.address !== '::' ? wsAddr.address : 'localhost'
    var wsPort = wsAddr.port
    console.log('WebSocket tracker: ws://' + wsHost + ':' + wsPort)
  }
  if (server.http && argv.stats && !argv.quiet) {
    var statsAddr = server.http.address()
    var statsHost = statsAddr.address !== '::' ? statsAddr.address : 'localhost'
    var statsPort = statsAddr.port
    console.log('Tracker stats: http://' + statsHost + ':' + statsPort + '/stats')
  }
})
