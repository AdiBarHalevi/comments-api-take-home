import fp from 'fastify-plugin'
import { platformClients } from '../lib/clients/registry.js'
import {
  markOutboundReplyFailed,
  syncOutboundReply
} from '../comments/syncOutboundReply.js'
import { createJobQueue } from '../queue/jobQueue.js'
import type { EnqueueJob } from '../queue/types.js'

export default fp(
  async (fastify) => {
    const jobQueue = createJobQueue({
      connection: fastify.redis,
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
