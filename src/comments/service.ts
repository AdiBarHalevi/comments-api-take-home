import type { Comment, PrismaClient } from '../generated/prisma/client.js'
import { buildPaginationResult } from '../lib/pagination.js'
import type { PaginatedResponse } from '../types/pagination.js'
import type {
  CommentResponse,
  ListCommentsByPostIdRequest
} from './types.js'

export async function listCommentsByPostId(
  prisma: PrismaClient,
  postId: string,
  query: ListCommentsByPostIdRequest
): Promise<PaginatedResponse<CommentResponse>> {
  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post) {
    const error = new Error('Post not found') as Error & { statusCode: number }
    error.statusCode = 404
    throw error
  }

  const offset = query.offset ?? 0
  const limit = query.limit ?? 50

  const comments = await prisma.comment.findMany({
    where: {
      postId: post.id,
      parentId: null
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    skip: offset,
    take: limit + 1
  })

  const { data, pagination } = buildPaginationResult(comments, offset, limit)

  return {
    data: data.map(toCommentResponse),
    pagination
  }
}

export const commentsService = {
  listCommentsByPostId
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
