import type { PaginatedResponse } from '../types/pagination.js'

export function buildPaginationResult<T>({
  items,
  offset,
  limit
}: {
  items: T[]
  offset: number
  limit: number
}): PaginatedResponse<T> {
  const hasMore = items.length > limit
  const data = hasMore ? items.slice(0, limit) : items

  return {
    data,
    pagination: {
      nextOffset: hasMore ? offset + limit : null
    }
  }
}
