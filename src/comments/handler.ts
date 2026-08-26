import type { FastifyReply } from 'fastify'
import type { AppRequest } from '../types/request.js'
import { commentsService } from './service.js'
import type {
  CreateReplyByCommentIdRequest,
  ListCommentsByPostIdRequest
} from './types.js'

export function createCommentsHandlers() {
  return {
    async getCommentsByPostId(
      request: AppRequest<{
        Params: { postId: string }
        Querystring: ListCommentsByPostIdRequest
      }>
    ) {
      return commentsService.listCommentsByPostId({
        request,
        postId: request.params.postId,
        query: request.query
      })
    },

    async createReplyByCommentId(
      request: AppRequest<{
        Params: { commentId: string }
        Body: CreateReplyByCommentIdRequest
      }>,
      reply: FastifyReply
    ) {
      const result = await commentsService.createReplyByCommentId({
        request,
        commentId: request.params.commentId,
        text: request.body.text
      })
      return reply.code(202).send(result)
    }
  }
}
