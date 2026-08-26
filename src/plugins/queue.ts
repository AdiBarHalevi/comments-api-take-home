import fp from 'fastify-plugin'
import { createJobQueue } from '../queue/jobQueue.js'
import type { EnqueueJob } from '../queue/types.js'

export default fp(
  async (fastify) => {
    const jobQueue = createJobQueue({
      connection: fastify.redis,
      onWorkerError: (error) => {
        fastify.log.error({ err: error }, 'Job queue worker error')
      }
    })

    fastify.decorate('enqueue', jobQueue.enqueue)

    fastify.addHook('onClose', async () => {
      await jobQueue.close()
    })
  },
  {
    name: 'queue',
    dependencies: ['redis']
  }
)

declare module 'fastify' {
  export interface FastifyInstance {
    enqueue: EnqueueJob
  }
}
