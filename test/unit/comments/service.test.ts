import { listCommentsByPostId } from '../../../src/comments/service.js'
import { createMockPrisma, makeComment, makePost } from './fixtures.js'

describe('listCommentsByPostId', () => {
  it('throws 404 when the post does not exist', async () => {
    const prisma = createMockPrisma({
      findUniquePost: async () => null
    })

    await expect(
      listCommentsByPostId(prisma, '11111111-1111-1111-1111-111111111111', {})
    ).rejects.toMatchObject({
      message: 'Post not found',
      statusCode: 404
    })
  })

  it('returns empty page when the post has no comments', async () => {
    const post = makePost()
    let capturedArgs: unknown
    const prisma = createMockPrisma({
      findUniquePost: async () => post,
      findManyComments: async (args) => {
        capturedArgs = args
        return []
      }
    })

    const result = await listCommentsByPostId(prisma, post.id, {})

    expect(result).toEqual({
      data: [],
      pagination: { nextOffset: null }
    })
    expect(capturedArgs).toEqual({
      where: { postId: post.id, parentId: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 51
    })
  })

  it('maps comments and sets nextOffset when more exist', async () => {
    const post = makePost()
    const prisma = createMockPrisma({
      findUniquePost: async () => post,
      findManyComments: async () => [
        makeComment({ id: '1', externalId: 'a', text: 'one' }),
        makeComment({ id: '2', externalId: 'b', text: 'two' }),
        makeComment({ id: '3', externalId: 'c', text: 'three' })
      ]
    })

    const result = await listCommentsByPostId(prisma, post.id, {
      offset: 0,
      limit: 2
    })

    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toEqual({
      id: '1',
      externalId: 'a',
      text: 'one',
      parentId: null,
      authorUsername: 'fan_account',
      status: null,
      lastError: null
    })
    expect(result.pagination).toEqual({ nextOffset: 2 })
  })
})
