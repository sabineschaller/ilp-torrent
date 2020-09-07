import { Injector } from 'reduct'
import { randomBytes, generateReceiptSecret } from '../util/crypto'
import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import * as httpProxy from 'http-proxy'
import { Redis } from './Redis'
import { Config } from './Config'

export class SPSP {
  private config: Config
  private redis: Redis
  private server: Server

  constructor(deps: Injector) {
    this.config = deps(Config)
    this.redis = deps(Redis)
    this.server = createServer(
      async function (req: IncomingMessage, res: ServerResponse) {
        let endpoint: string
        let proxyServer: httpProxy
        try {
          endpoint = await this.redis.getPointer(req.url?.substring(1))
        } catch (error) {
          console.log(error.message)
          res.statusCode = 409
          res.end()
          return
        }
        proxyServer = httpProxy.createProxyServer({
          target: endpoint,
          changeOrigin: true,
        })
        if (
          req.method === 'GET' &&
          req.headers.accept &&
          req.headers.accept.indexOf('application/spsp4+json') !== -1
        ) {
          const nonce = randomBytes(16)
          const secret = generateReceiptSecret(this.config.receiptSeed, nonce)
          proxyServer.on(
            'proxyRes',
            function (
              proxyRes: IncomingMessage,
              req: IncomingMessage,
              res: ServerResponse
            ) {
              if (req.method !== 'GET') {
                return
              }
              const chunks: Buffer[] = []
              proxyRes.on('data', (chunk) => {
                chunks.push(chunk)
              })
              proxyRes.on('end', async () => {
                const body = Buffer.concat(chunks)
                try {
                  const spspRes = JSON.parse(body.toString())
                  if (spspRes.receipts_enabled) {
                    // should this strip 'receipts_enabled'?
                    await this.redis.setReceiptTTL(nonce.toString('base64'))
                    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
                    res.end(body)
                  } else {
                    res.statusCode = 409
                    res.end()
                  }
                } catch (err) {
                  console.log(body.toString())
                  console.log(err)
                  res.statusCode = 409
                  res.end()
                }
              })
            }.bind(this)
          )
          proxyServer.web(req, res, {
            headers: {
              'Receipt-Nonce': nonce.toString('base64'),
              'Receipt-Secret': secret.toString('base64'),
            },
            ignorePath: true,
            selfHandleResponse: true,
          })
        } else if (
          req.method === 'OPTIONS' &&
          req.headers['access-control-request-method'] === 'GET'
        ) {
          proxyServer.web(req, res, {
            ignorePath: true,
          })
        } else {
          res.statusCode = 404
          res.end()
        }
      }.bind(this)
    )
  }

  start(): void {
    this.server.listen(this.config.spspProxyPort, () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log(
          'SPSP proxy listening on port: ' + this.config.spspProxyPort
        )
      }
    })
  }

  stop(): void {
    this.server.close()
  }
}
