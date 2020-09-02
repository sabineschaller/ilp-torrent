const Express = require('express')
const replace = require('replace')
const dotenv = require('dotenv')

dotenv.config()

const app = new Express()

const SPSP_PROXY = process.env.SPSP_PROXY || 'http://localhost:3011'
const PROXY_API = process.env.PROXY_API || 'http://localhost:3012'

replace({
  regex: 'ENV_SPSP_PROXY',
  replacement: SPSP_PROXY,
  paths: ['src/verifier-app/build/bundle.js']
})

replace({
  regex: 'ENV_PROXY_API',
  replacement: PROXY_API,
  paths: ['src/verifier-app/build/bundle.js']
})

app.use(Express.static('src/verifier-app/build'))

app.listen(process.env.VERIFIER_APP_PORT, () => {
  console.log(`Listening on port ${process.env.VERIFIER_APP_PORT}...`)
})
