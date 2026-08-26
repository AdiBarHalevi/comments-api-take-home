export type PaginatedRequest = {
  offset?: number
  limit: number
}

export type Pagination = {
  nextOffset: number | null
}

export type PaginatedResponse<T> = {
  data: T[]
  pagination: Pagination
}
