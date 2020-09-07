import { Injector } from "reduct"
import { Server } from "http"
import * as Koa from "koa"
import * as bodyParser from "koa-bodyparser"
import * as cors from "@koa/cors"
import * as Router from "koa-router"
import { Redis } from "./Redis"
import { Config } from "./Config"

export class Proxy {
  private config: Config
  private redis: Redis
  private server: Server

  constructor(deps: Injector) {
    this.config = deps(Config)
    this.redis = deps(Redis)
  }

  start(): void {
    const koa = new Koa()
    const router = new Router()

    router.post("/proxy", async (ctx: Koa.Context) => {
      const body = ctx.request.body

      try {
        const proxy = await this.redis.createProxy(body.paymentPointer)
        ctx.response.body = { proxy }
        return (ctx.status = 200)
      } catch (error) {
        ctx.throw(409, error.message)
      }
    })

    router.delete("/proxy/:proxy", async (ctx: Koa.Context) => {
      try {
        await this.redis.deleteProxy(ctx.params.proxy)
        return (ctx.status = 200)
      } catch (error) {
        if (error.message === "proxy does not exist") {
          ctx.throw(404, error.message)
        }
        ctx.throw(409, error.message)
      }
    })

    koa.use(bodyParser())
    koa.use(cors())
    koa.use(router.routes())
    koa.use(router.allowedMethods())
    this.server = koa.listen(this.config.proxyApiPort, () => {
      if (process.env.NODE_ENV !== "test") {
        console.log("Proxy API listening on port: " + this.config.proxyApiPort)
      }
    })
  }

  stop(): void {
    this.server.close()
  }
}
