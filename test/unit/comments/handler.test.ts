import type { FastifyReply } from 'fastify'
import { jest } from '@jest/globals'
import { createCommentsHandlers } from '../../../src/comments/handler.js'
import type {
  CreateReplyByCommentIdRequest,
  ListCommentsByPostIdRequest
} from '../../../src/comments/types.js'
import {
  createMockEnqueue,
  createMockPrisma,
  createMockRequest,
  makeComment,
  makePost
} from './fixtures.js'

describe('createCommentsHandlers', () => {
  const handlers = createCommentsHandlers()

  it('getCommentsByPostId throws 404 when the post does not exist', async () => {
    const request = createMockRequest({
      prisma: createMockPrisma({ findUniquePost: async () => null }),
      params: { postId: '11111111-1111-1111-1111-111111111111' },
      query: {}
    })

    await expect(handlers.getCommentsByPostId(request)).rejects.toMatchObject({
      message: 'Post not found',
      statusCode: 404
    })
  })

  it('getCommentsByPostId delegates to the service after validating the post', async () => {
    const post = makePost()
    const request = createMockRequest({
      prisma: createMockPrisma({
        findUniquePost: async () => post,
        findManyComments: async () => [
          makeComment({
            id: '22222222-2222-2222-2222-222222222222',
            postId: post.id,
            text: 'Nice post!'
          })
        ]
      }),
      params: { postId: post.id },
      query: { offset: 0, limit: 10 } satisfies ListCommentsByPostIdRequest
    })

    const result = await handlers.getCommentsByPostId(request)

    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.text).toBe('Nice post!')
    expect(result.pagination.nextOffset).toBeNull()
  })

  it('getCommentById throws 404 when the comment does not exist', async () => {
    const request = createMockRequest({
      prisma: createMockPrisma({ findUniqueComment: async () => null }),
      params: { commentId: '22222222-2222-2222-2222-222222222222' }
    })

    await expect(handlers.getCommentById(request)).rejects.toMatchObject({
      message: 'Comment not found',
      statusCode: 404
    })
  })

  it('getCommentById delegates to the service after validating the comment', async () => {
    const comment = makeComment({ status: 'PENDING', externalId: null })
    const request = createMockRequest({
      prisma: createMockPrisma({ findUniqueComment: async () => comment }),
      params: { commentId: comment.id }
    })

    const result = await handlers.getCommentById(request)

    expect(result).toMatchObject({ id: comment.id, status: 'PENDING' })
  })

  it('createReplyByCommentId throws 404 when the parent does not exist', async () => {
    const request = createMockRequest({
      prisma: createMockPrisma({ findUniqueComment: async () => null }),
      params: { commentId: '22222222-2222-2222-2222-222222222222' },
      body: { text: 'Thanks!' } satisfies CreateReplyByCommentIdRequest
    })
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    } as unknown as FastifyReply

    await expect(
      handlers.createReplyByCommentId(request, reply)
    ).rejects.toMatchObject({
      message: 'Comment not found',
      statusCode: 404
    })
  })

  it('createReplyByCommentId throws 400 when the parent has no externalId', async () => {
    const post = makePost()
    const parent = makeComment({ externalId: null, postId: post.id })
    const request = createMockRequest({
      prisma: createMockPrisma({
        findUniqueComment: async () => ({ ...parent, post })
      }),
      params: { commentId: parent.id },
      body: { text: 'Thanks!' } satisfies CreateReplyByCommentIdRequest
    })
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    } as unknown as FastifyReply

    await expect(
      handlers.createReplyByCommentId(request, reply)
    ).rejects.toMatchObject({
      statusCode: 400
    })
  })

  it('createReplyByCommentId returns 202 after validating the parent', async () => {
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
    const request = createMockRequest({
      prisma: createMockPrisma({
        findUniqueComment: async () => ({ ...parent, post }),
        createComment: async () => created
      }),
      enqueue: createMockEnqueue(),
      params: { commentId: parent.id },
      body: { text: 'Thanks!' } satisfies CreateReplyByCommentIdRequest
    })
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockImplementation((payload) => payload)
    } as unknown as FastifyReply

    const result = await handlers.createReplyByCommentId(request, reply)

    expect(reply.code).toHaveBeenCalledWith(202)
    expect(result).toEqual({
      id: created.id,
      status: 'PENDING',
      text: 'Thanks!',
      parentId: parent.id
    })
  })
})
