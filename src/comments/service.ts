import type { Comment, Platform, Post } from '../generated/prisma/client.js'
import { getStaticPlatformUser } from '../config/staticPlatformUser.js'
import { createInstagramClient } from '../lib/clients/instagram.js'
import type { PlatformClients } from '../lib/clients/types.js'
import { createXClient } from '../lib/clients/x.js'
import { buildPaginationResult } from '../lib/pagination.js'
import { createQueuedResponse } from '../queue/queuedResponse.js'
import type { PaginatedResponse } from '../types/pagination.js'
import type { AppRequest } from '../types/request.js'
import {
  markOutboundReplyFailed,
  syncOutboundReply
} from './syncOutboundReply.js'
import type {
  CommentResponse,
  CreateReplyByCommentIdResponse,
  ListCommentsByPostIdRequest
} from './types.js'

/** Parent comment already validated by the handler (exists + has platform id). */
export type ValidatedParentComment = Comment & {
  externalId: string
  post: Pick<Post, 'platform'>
}

const platformClients: PlatformClients = {
  INSTAGRAM: createInstagramClient(getStaticPlatformUser('instagram')),
  X: createXClient(getStaticPlatformUser('x'))
}

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

export function getCommentById({
  comment
}: {
  comment: Comment
}): CommentResponse {
  return toCommentResponse(comment)
}

export async function createReplyByCommentId({
  request,
  parent,
  text
}: {
  request: AppRequest
  parent: ValidatedParentComment
  text: string
}): Promise<CreateReplyByCommentIdResponse> {
  const { prisma, enqueue } = request.server
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
    run: (comment) =>
      syncOutboundReply({
        prisma,
        platformClients,
        commentId: comment.id
      }),
    onFailed: ({ pending: comment, error }) =>
      markOutboundReplyFailed({
        prisma,
        commentId: comment.id,
        lastError: error.message
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
  getCommentById,
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
