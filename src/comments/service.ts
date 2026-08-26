import type { Comment, Platform } from '../generated/prisma/client.js'
import { getStaticPlatformUser } from '../config/staticPlatformUser.js'
import { maxReplyLengthForPlatform } from '../lib/clients/limits.js'
import { httpError } from '../lib/httpError.js'
import { buildPaginationResult } from '../lib/pagination.js'
import { createQueuedResponse } from '../queue/queuedResponse.js'
import type { PaginatedResponse } from '../types/pagination.js'
import type { AppRequest } from '../types/request.js'
import { markOutboundReplyFailed } from './syncOutboundReply.js'
import type {
  CommentResponse,
  CreateReplyByCommentIdResponse,
  ListCommentsByPostIdRequest
} from './types.js'
export async function listCommentsByPostId({
  request,
  postId,
  query
}: {
  request: AppRequest
  postId: string
  query: ListCommentsByPostIdRequest
}): Promise<PaginatedResponse<CommentResponse>> {
  const { prisma } = request.server

  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post) {
    throw httpError(404, 'Post not found')
  }

  const offset = query.offset ?? 0
  const limit = query.limit ?? 50

  const comments = await prisma.comment.findMany({
    where: {
      postId,
      parentId: null
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    skip: offset,
    take: limit + 1
  })

  const { data, pagination } = buildPaginationResult({
    items: comments,
    offset,
    limit
  })

  return {
    data: data.map(toCommentResponse),
    pagination
  }
}

export async function createReplyByCommentId({
  request,
  commentId,
  text
}: {
  request: AppRequest
  commentId: string
  text: string
}): Promise<CreateReplyByCommentIdResponse> {
  const { prisma, enqueue } = request.server

  const parent = await prisma.comment.findUnique({
    where: { id: commentId },
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

  const maxLength = maxReplyLengthForPlatform(parent.post.platform)
  if (text.length > maxLength) {
    throw httpError(
      400,
      `Reply text exceeds the ${maxLength}-character limit for ${parent.post.platform}`
    )
  }

  const authorUsername = authorUsernameForPlatform(parent.post.platform)

  const pending = await createQueuedResponse({
    enqueue,
    createPending: () =>
      prisma.comment.create({
        data: {
          postId: parent.postId,
          parentId: parent.id,
          text,
          status: 'PENDING',
          authorUsername
        }
      }),
    onEnqueueFailed: (comment) =>
      markOutboundReplyFailed({
        prisma,
        commentId: comment.id,
        lastError: 'Queue unavailable'
      })
  })

  return {
    id: pending.id,
    status: 'PENDING',
    text: pending.text!,
    parentId: parent.id
  }
}

export const commentsService = {
  listCommentsByPostId,
  createReplyByCommentId
}

function authorUsernameForPlatform(platform: Platform): string {
  return platform === 'INSTAGRAM'
    ? getStaticPlatformUser('instagram').username
    : getStaticPlatformUser('x').username
}

function toCommentResponse(comment: Comment): CommentResponse {
  return {
    id: comment.id,
    externalId: comment.externalId,
    text: comment.text,
    parentId: comment.parentId,
    authorUsername: comment.authorUsername,
    status: comment.status,
    lastError: comment.lastError
  }
}
