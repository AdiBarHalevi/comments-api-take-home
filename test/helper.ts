import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import App from '../src/app.js'

/** Same app as production — only env (`.env.test`) differs. */
async function build(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(App)
  await app.ready()
  return app
}

export { build }
