import type { FastifyRequest } from 'fastify'
import { createCommentsHandlers } from '../../../src/comments/handler.js'
import type { ListCommentsByPostIdRequest } from '../../../src/comments/types.js'
import { createMockPrisma, makeComment, makePost } from './fixtures.js'

describe('createCommentsHandlers', () => {
  it('getCommentsByPostId delegates to the service', async () => {
    const post = makePost()
    const prisma = createMockPrisma({
      findUniquePost: async () => post,
      findManyComments: async () => [
        makeComment({
          id: '22222222-2222-2222-2222-222222222222',
          postId: post.id,
          text: 'Nice post!'
        })
      ]
    })
    const handlers = createCommentsHandlers(prisma)
    const request = {
      params: { postId: post.id },
      query: { offset: 0, limit: 10 }
    } as FastifyRequest<{
      Params: { postId: string }
      Querystring: ListCommentsByPostIdRequest
    }>

    const result = await handlers.getCommentsByPostId(request)

    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.text).toBe('Nice post!')
    expect(result.pagination.nextOffset).toBeNull()
  })
})
