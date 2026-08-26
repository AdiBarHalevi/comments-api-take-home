import { jest } from '@jest/globals'
import type {
  PlatformClient,
  PlatformClients
} from '../../../src/lib/clients/types.js'
import {
  markOutboundReplyFailed,
  syncOutboundReply
} from '../../../src/comments/syncOutboundReply.js'
import { makeComment, makePost } from '../comments/fixtures.js'

describe('syncOutboundReply', () => {
  it('calls the platform client and marks the comment SYNCED', async () => {
    const post = makePost({ platform: 'INSTAGRAM' })
    const parent = makeComment({
      id: 'parent-id',
      postId: post.id,
      externalId: 'ext-parent'
    })
    const reply = makeComment({
      id: 'reply-id',
      postId: post.id,
      parentId: parent.id,
      text: 'Thanks!',
      status: 'PENDING',
      externalId: null
    })

    let updated: unknown
    const prisma = {
      comment: {
        findUnique: async () => ({
          ...reply,
          parent,
          post
        }),
        update: async (args: unknown) => {
          updated = args
          return reply
        }
      }
    }

    const createReply = jest.fn<PlatformClient['createReply']>(async () => ({
      externalId: 'ext-reply'
    }))
    const client: PlatformClient = { createReply }
    const platformClients: PlatformClients = {
      INSTAGRAM: client,
      X: client
    }

    await syncOutboundReply({
      prisma: prisma as never,
      platformClients,
      commentId: reply.id
    })

    expect(createReply).toHaveBeenCalledWith({
      externalCommentId: 'ext-parent',
      text: 'Thanks!'
    })
    expect(updated).toEqual({
      where: { id: reply.id },
      data: {
        status: 'SYNCED',
        externalId: 'ext-reply',
        lastError: null
      }
    })
  })

  it('no-ops when the comment is no longer PENDING', async () => {
    const reply = makeComment({ status: 'SYNCED' })
    const createReply = jest.fn<PlatformClient['createReply']>()
    const prisma = {
      comment: {
        findUnique: async () => ({
          ...reply,
          parent: makeComment(),
          post: makePost()
        })
      }
    }
    const client: PlatformClient = { createReply }
    const platformClients: PlatformClients = {
      INSTAGRAM: client,
      X: client
    }

    await syncOutboundReply({
      prisma: prisma as never,
      platformClients,
      commentId: reply.id
    })

    expect(createReply).not.toHaveBeenCalled()
  })
})

describe('markOutboundReplyFailed', () => {
  it('updates PENDING comments only', async () => {
    let args: unknown
    const prisma = {
      comment: {
        updateMany: async (value: unknown) => {
          args = value
          return { count: 1 }
        }
      }
    }

    await markOutboundReplyFailed({
      prisma: prisma as never,
      commentId: 'reply-id',
      lastError: 'boom'
    })

    expect(args).toEqual({
      where: { id: 'reply-id', status: 'PENDING' },
      data: { status: 'FAILED', lastError: 'boom' }
    })
  })
})
