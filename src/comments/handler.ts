import type { FastifyRequest } from 'fastify'
import type { PrismaClient } from '../generated/prisma/client.js'
import { commentsService } from './service.js'
import type { ListCommentsByPostIdRequest } from './types.js'

export function createCommentsHandlers(prisma: PrismaClient) {
  return {
    async getCommentsByPostId(
      request: FastifyRequest<{
        Params: { postId: string }
        Querystring: ListCommentsByPostIdRequest
      }>
    ) {
      return commentsService.listCommentsByPostId(
        prisma,
        request.params.postId,
        request.query
      )
    }
  }
}
