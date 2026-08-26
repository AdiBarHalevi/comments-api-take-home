import { join } from 'node:path'
import fp from 'fastify-plugin'
import openapiGlue from 'fastify-openapi-glue'
import { createCommentsHandlers } from '../comments/handler.js'
import { createPostsHandlers } from '../posts/handler.js'

export default fp(
  async (fastify) => {
    await fastify.register(openapiGlue, {
      specification: join(process.cwd(), 'docs', 'openapi.json'),
      serviceHandlers: {
        ...createPostsHandlers(),
        ...createCommentsHandlers()
      }
    })
  },
  {
    name: 'openapi-glue',
    dependencies: ['prisma', 'queue']
  }
)
