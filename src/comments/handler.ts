import type { FastifyReply } from 'fastify'
import { httpError } from '../lib/httpError.js'
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
      const post = await request.server.prisma.post.findUnique({
        where: { id: request.params.postId }
      })
      if (!post) {
        throw httpError(404, 'Post not found')
      }

      return commentsService.listCommentsByPostId({
        request,
        postId: post.id,
        query: request.query
      })
    },

    async getCommentById(
      request: AppRequest<{
        Params: { commentId: string }
      }>
    ) {
      const comment = await request.server.prisma.comment.findUnique({
        where: { id: request.params.commentId }
      })
      if (!comment) {
        throw httpError(404, 'Comment not found')
      }

      return commentsService.getCommentById({ comment })
    },

    async createReplyByCommentId(
      request: AppRequest<{
        Params: { commentId: string }
        Body: CreateReplyByCommentIdRequest
      }>,
      reply: FastifyReply
    ) {
      const parent = await request.server.prisma.comment.findUnique({
        where: { id: request.params.commentId },
        include: { post: true }
      })
      if (!parent) {
        throw httpError(404, 'Comment not found')
      }
      if (!parent.externalId) {
        throw httpError(
          400,
          'Parent comment is not synced to a platform and cannot be replied to'
        )
      }

      const result = await commentsService.createReplyByCommentId({
        request,
        parent: { ...parent, externalId: parent.externalId },
        text: request.body.text
      })
      return reply.code(202).send(result)
    }
  }
}
