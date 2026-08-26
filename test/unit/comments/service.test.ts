import {
  createReplyByCommentId,
  listCommentsByPostId
} from '../../../src/comments/service.js'
import {
  createMockPrisma,
  createMockRequest,
  makeComment,
  makePost
} from './fixtures.js'

describe('listCommentsByPostId', () => {
  it('throws 404 when the post does not exist', async () => {
    const prisma = createMockPrisma({
      findUniquePost: async () => null
    })

    await expect(
      listCommentsByPostId({
        request: createMockRequest({ prisma }),
        postId: '11111111-1111-1111-1111-111111111111',
        query: {}
      })
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

    const result = await listCommentsByPostId({
      request: createMockRequest({ prisma }),
      postId: post.id,
      query: {}
    })

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

    const result = await listCommentsByPostId({
      request: createMockRequest({ prisma }),
      postId: post.id,
      query: { offset: 0, limit: 2 }
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

describe('createReplyByCommentId', () => {
  it('throws 404 when the parent does not exist', async () => {
    const prisma = createMockPrisma({
      findUniqueComment: async () => null
    })

    await expect(
      createReplyByCommentId({
        request: createMockRequest({ prisma }),
        commentId: '22222222-2222-2222-2222-222222222222',
        text: 'Thanks!'
      })
    ).rejects.toMatchObject({
      message: 'Comment not found',
      statusCode: 404
    })
  })

  it('throws 400 when the parent has no externalId', async () => {
    const post = makePost()
    const parent = makeComment({ externalId: null, postId: post.id })
    const prisma = createMockPrisma({
      findUniqueComment: async () => ({ ...parent, post })
    })

    await expect(
      createReplyByCommentId({
        request: createMockRequest({ prisma }),
        commentId: parent.id,
        text: 'Thanks!'
      })
    ).rejects.toMatchObject({
      statusCode: 400
    })
  })

  it('creates a PENDING comment and enqueues by commentId', async () => {
    const post = makePost()
    const parent = makeComment({ postId: post.id })
    const created = makeComment({
      id: '33333333-3333-3333-3333-333333333333',
      postId: post.id,
      parentId: parent.id,
      text: 'Thanks!',
      status: 'PENDING',
      externalId: null,
      authorUsername: 'brand_account'
    })
    const enqueued: string[] = []
    const prisma = createMockPrisma({
      findUniqueComment: async () => ({ ...parent, post }),
      createComment: async () => created
    })

    const result = await createReplyByCommentId({
      request: createMockRequest({
        prisma,
        enqueue: async ({ commentId }) => {
          enqueued.push(commentId)
        }
      }),
      commentId: parent.id,
      text: 'Thanks!'
    })

    expect(result).toEqual({
      id: created.id,
      status: 'PENDING',
      text: 'Thanks!',
      parentId: parent.id
    })
    expect(enqueued).toEqual([created.id])
  })

  it('marks FAILED and returns 503 when enqueue fails', async () => {
    const post = makePost()
    const parent = makeComment({ postId: post.id })
    const created = makeComment({
      id: '33333333-3333-3333-3333-333333333333',
      postId: post.id,
      parentId: parent.id,
      text: 'Thanks!',
      status: 'PENDING',
      externalId: null
    })
    let updated: unknown
    const prisma = createMockPrisma({
      findUniqueComment: async () => ({ ...parent, post }),
      createComment: async () => created,
      updateComment: async (args) => {
        updated = args
        return { ...created, status: 'FAILED', lastError: 'Queue unavailable' }
      }
    })

    // markOutboundReplyFailed uses updateMany — extend mock
    ;(
      prisma.comment as { updateMany: (args: unknown) => Promise<unknown> }
    ).updateMany = async (args) => {
      updated = args
      return { count: 1 }
    }

    await expect(
      createReplyByCommentId({
        request: createMockRequest({
          prisma,
          enqueue: async () => {
            throw new Error('redis down')
          }
        }),
        commentId: parent.id,
        text: 'Thanks!'
      })
    ).rejects.toMatchObject({
      message: 'Queue unavailable',
      statusCode: 503
    })

    expect(updated).toEqual({
      where: { id: created.id, status: 'PENDING' },
      data: { status: 'FAILED', lastError: 'Queue unavailable' }
    })
  })
})
