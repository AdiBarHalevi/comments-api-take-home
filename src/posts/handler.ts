import type { FastifyRequest } from 'fastify'
import type { PrismaClient } from '../generated/prisma/client.js'
import * as postsService from './service.js'
import type { ListPostsRequest } from './types.js'

export function createPostsHandlers(prisma: PrismaClient) {
  return {
    async getPosts(
      request: FastifyRequest<{ Querystring: ListPostsRequest }>
    ) {
      return postsService.listPosts(prisma, request.query)
    }
  }
}
