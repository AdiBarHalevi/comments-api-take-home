import type { PaginatedRequest } from '../types/pagination.js'

export type PostResponse = {
  id: string
  platform: 'INSTAGRAM' | 'X'
  externalId: string
  isActive: boolean
}

export type ListPostsRequest = PaginatedRequest & {
  sortBy?: 'createdAt' | 'id' | 'platform'
  sortOrder?: 'asc' | 'desc'
}
