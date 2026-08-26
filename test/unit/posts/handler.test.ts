import { createPostsHandlers } from '../../../src/posts/handler.js'
import type { ListPostsRequest } from '../../../src/posts/types.js'
import { createMockPrisma, createMockRequest, makePost } from './fixtures.js'

describe('createPostsHandlers', () => {
  it('getPosts delegates to listPosts with request query', async () => {
    const handlers = createPostsHandlers()
    const request = createMockRequest({
      prisma: createMockPrisma({
        findMany: async () => [
          makePost({
            id: '440e8400-e29b-41d4-a716-446655440000',
            platform: 'X',
            externalId: 'tweet-1'
          })
        ]
      }),
      query: {
        offset: 0,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'asc'
      } satisfies ListPostsRequest
    })

    const result = await handlers.getPosts(request)

    expect(result).toEqual({
      data: [
        {
          id: '440e8400-e29b-41d4-a716-446655440000',
          platform: 'X',
          externalId: 'tweet-1',
          isActive: true
        }
      ],
      pagination: { nextOffset: null }
    })
  })
})
