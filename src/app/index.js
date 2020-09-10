const Express = require('express')
const replace = require('replace')
const dotenv = require('dotenv')

dotenv.config()

const app = new Express()

const TRACKER = process.env.TRACKER || 'ws://localhost:8000'
const VERIFIER_APP = process.env.VERIFIER_APP || 'http://localhost:8082'

replace({
  regex: 'ENV_TRACKER',
  replacement: TRACKER,
  paths: ['src/app/build/bundle.js']
})

replace({
  regex: 'ENV_VERIFIER_SERVICE',
  replacement: VERIFIER_APP,
  paths: ['src/app/build/bundle.js']
})

app.use(Express.static('src/app/build'))

app.listen(process.env.APP_PORT, () => {
  console.log(`Listening on port ${process.env.APP_PORT}...`)
})
