import type { Prisma, Post } from '../generated/prisma/client.js'
import { buildPaginationResult } from '../lib/pagination.js'
import type { PaginatedResponse } from '../types/pagination.js'
import type { AppRequest } from '../types/request.js'
import type { ListPostsRequest, PostResponse } from './types.js'

export async function listPosts({
  request,
  query
}: {
  request: AppRequest
  query: ListPostsRequest
}): Promise<PaginatedResponse<PostResponse>> {
  const { prisma } = request.server
  const offset = query.offset ?? 0
  const limit = query.limit ?? 50
  const sortBy = query.sortBy ?? 'createdAt'
  const sortOrder = query.sortOrder ?? 'asc'

  const posts = await prisma.post.findMany({
    orderBy: buildPostOrderBy({ sortBy, sortOrder }),
    skip: offset,
    take: limit + 1
  })

  const { data, pagination } = buildPaginationResult({
    items: posts,
    offset,
    limit
  })

  return {
    data: data.map(toPostResponse),
    pagination
  }
}

/** Object form so tests can `jest.spyOn(postsService, 'listPosts')`. */
export const postsService = {
  listPosts
}

function buildPostOrderBy({
  sortBy,
  sortOrder
}: {
  sortBy: NonNullable<ListPostsRequest['sortBy']>
  sortOrder: NonNullable<ListPostsRequest['sortOrder']>
}): Prisma.PostOrderByWithRelationInput[] {
  const primary = { [sortBy]: sortOrder } as Prisma.PostOrderByWithRelationInput

  // Stable tie-breaker so offset pages stay consistent when values collide.
  if (sortBy === 'id') {
    return [primary]
  }

  return [primary, { id: sortOrder }]
}

function toPostResponse(post: Post): PostResponse {
  return {
    id: post.id,
    platform: post.platform,
    externalId: post.externalId
  }
}
