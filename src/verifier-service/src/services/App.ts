import { Injector } from 'reduct'
import { Balances } from './Balances'
import { Redis } from './Redis'
import { SPSP } from './SPSP'
import { Proxy } from './Proxy'

export class App {
  private balances: Balances
  private redis: Redis
  private spsp: SPSP
  private proxy: Proxy

  constructor(deps: Injector) {
    this.balances = deps(Balances)
    this.redis = deps(Redis)
    this.spsp = deps(SPSP)
    this.proxy = deps(Proxy)
  }

  start(): void {
    this.redis.start()
    this.balances.start()
    this.spsp.start()
    this.proxy.start()
  }

  async stop(): Promise<void> {
    this.balances.stop()
    this.spsp.stop()
    this.proxy.stop()
    await this.redis.stop()
  }
}
