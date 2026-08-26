import type { CommentStatus } from '../generated/prisma/client.js'
import type { PaginatedRequest } from '../types/pagination.js'

export type CommentResponse = {
  id: string
  externalId: string | null
  text: string | null
  parentId: string | null
  authorUsername: string | null
  status: CommentStatus | null
  lastError: string | null
}

export type ListCommentsByPostIdRequest = PaginatedRequest
