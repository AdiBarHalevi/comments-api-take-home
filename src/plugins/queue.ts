import fp from 'fastify-plugin'
import {
  markOutboundReplyFailed,
  syncOutboundReply
} from '../comments/syncOutboundReply.js'
import { createJobQueue, DEFAULT_QUEUE_NAME } from '../queue/jobQueue.js'
import type { EnqueueJob } from '../queue/types.js'

export default fp(
  async (fastify) => {
    // Dynamic import: Jest ESM fails to link `env.js` when Autoload loads this
    // plugin in parallel with prisma/redis, which also import env (via the
    // platform client → staticPlatformUser chain).
    const { platformClients } = await import('../lib/clients/registry.js')

    const jobQueue = createJobQueue({
      connection: fastify.redis,
      // Explicit stable name — restarted processes resume the same Redis queue.
      queueName: DEFAULT_QUEUE_NAME,
      processJob: (commentId) =>
        syncOutboundReply({
          prisma: fastify.prisma,
          platformClients,
          commentId
        }),
      onJobFailed: ({ commentId, error }) =>
        markOutboundReplyFailed({
          prisma: fastify.prisma,
          commentId,
          lastError: error.message
        }),
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
    dependencies: ['redis', 'prisma']
  }
)

declare module 'fastify' {
  export interface FastifyInstance {
    enqueue: EnqueueJob
  }
}
