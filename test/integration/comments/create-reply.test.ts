import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { jest } from '@jest/globals'
import { env } from '../../../src/config/env.js'
import type { PrismaClient } from '../../../src/generated/prisma/client.js'
import { createPrismaClient } from '../../../src/lib/prisma.js'
import { build } from '../../helper.js'

const originalFetch = globalThis.fetch

type CommentPollBody = {
  id: string
  status: 'PENDING' | 'SYNCED' | 'FAILED' | null
  externalId: string | null
  text: string | null
  parentId: string | null
  lastError: string | null
}

async function waitForCommentStatus({
  app,
  commentId,
  statuses,
  timeoutMs = 8_000
}: {
  app: FastifyInstance
  commentId: string
  statuses: Array<'PENDING' | 'SYNCED' | 'FAILED'>
  timeoutMs?: number
}): Promise<CommentPollBody & { status: 'PENDING' | 'SYNCED' | 'FAILED' }> {
  const deadline = Date.now() + timeoutMs
  let lastBody: CommentPollBody | undefined

  while (Date.now() < deadline) {
    const res = await app.inject({
      method: 'GET',
      url: `/comments/${commentId}`
    })
    expect(res.statusCode).toBe(200)
    lastBody = JSON.parse(res.payload) as CommentPollBody
    if (lastBody.status && statuses.includes(lastBody.status)) {
      return lastBody as CommentPollBody & {
        status: 'PENDING' | 'SYNCED' | 'FAILED'
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  throw new Error(
    `Timed out waiting for status in [${statuses.join(', ')}]; last=${JSON.stringify(lastBody)}`
  )
}

describe('POST /comments/:commentId/replies', () => {
  let app: FastifyInstance
  let prisma: PrismaClient
  const createdPostIds: string[] = []

  beforeAll(async () => {
    prisma = createPrismaClient(env.DATABASE_URL)
    app = await build()
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  beforeEach(() => {
    globalThis.fetch = jest.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        const method = (init?.method ?? 'GET').toUpperCase()

        if (method === 'POST' && url.includes('/replies')) {
          return new Response(
            JSON.stringify({ id: 'ig-ext-reply-123', text: 'Thanks!' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }

        if (method === 'POST' && url.endsWith('/2/tweets')) {
          return new Response(
            JSON.stringify({
              data: { id: 'x-ext-reply-456', text: 'Thanks!' }
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          )
        }

        return new Response(JSON.stringify({ error: 'unmocked fetch' }), {
          status: 500
        })
      }
    ) as typeof fetch
  })

  afterEach(async () => {
    globalThis.fetch = originalFetch

    if (createdPostIds.length === 0) return
    await prisma.comment.deleteMany({
      where: { postId: { in: createdPostIds } }
    })
    await prisma.post.deleteMany({ where: { id: { in: createdPostIds } } })
    createdPostIds.length = 0
  })

  async function createParentComment(platform: 'INSTAGRAM' | 'X' = 'INSTAGRAM') {
    const post = await prisma.post.create({
      data: {
        id: randomUUID(),
        platform,
        externalId: `${platform.toLowerCase()}-${randomUUID()}`
      }
    })
    createdPostIds.push(post.id)

    return prisma.comment.create({
      data: {
        id: randomUUID(),
        postId: post.id,
        externalId: `c-${randomUUID()}`,
        text: 'Nice post!',
        authorUsername: 'fan_1'
      }
    })
  }

  it(
    'returns 202, enqueues work, and the worker marks the reply SYNCED',
    async () => {
      const parent = await createParentComment('INSTAGRAM')

      const res = await app.inject({
        method: 'POST',
        url: `/comments/${parent.id}/replies`,
        payload: { text: 'Thanks!' }
      })

      expect(res.statusCode).toBe(202)
      const body = JSON.parse(res.payload)
      expect(body).toEqual({
        id: expect.any(String),
        status: 'PENDING',
        text: 'Thanks!',
        parentId: parent.id
      })

      const synced = await waitForCommentStatus({
        app,
        commentId: body.id,
        statuses: ['SYNCED']
      })

      expect(synced).toMatchObject({
        id: body.id,
        status: 'SYNCED',
        text: 'Thanks!',
        parentId: parent.id,
        externalId: 'ig-ext-reply-123',
        lastError: null
      })

      expect(globalThis.fetch).toHaveBeenCalled()
      const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>
      const [calledUrl, calledInit] = fetchMock.mock.calls[0]!
      expect(String(calledUrl)).toContain(`/${parent.externalId}/replies`)
      expect(calledInit?.method).toBe('POST')
    },
    15_000
  )

  it(
    'syncs X replies through the queue as well',
    async () => {
      const parent = await createParentComment('X')

      const res = await app.inject({
        method: 'POST',
        url: `/comments/${parent.id}/replies`,
        payload: { text: 'Appreciate it!' }
      })
      expect(res.statusCode).toBe(202)
      const { id } = JSON.parse(res.payload) as { id: string }

      const synced = await waitForCommentStatus({
        app,
        commentId: id,
        statuses: ['SYNCED']
      })

      expect(synced).toMatchObject({
        status: 'SYNCED',
        externalId: 'x-ext-reply-456',
        text: 'Appreciate it!'
      })
    },
    15_000
  )

  it('returns 404 when the parent comment does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/comments/${randomUUID()}/replies`,
      payload: { text: 'Thanks!' }
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.payload).message).toMatch(/comment not found/i)
  })

  it('rejects empty text', async () => {
    const parent = await createParentComment()

    const res = await app.inject({
      method: 'POST',
      url: `/comments/${parent.id}/replies`,
      payload: { text: '' }
    })

    expect(res.statusCode).toBe(400)
  })
})
