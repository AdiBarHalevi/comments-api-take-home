import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { env } from '../../../src/config/env.js'
import type { PrismaClient } from '../../../src/generated/prisma/client.js'
import { createPrismaClient } from '../../../src/lib/prisma.js'
import { build } from '../../helper.js'

describe('GET /posts/:postId/comments', () => {
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

  afterEach(async () => {
    if (createdPostIds.length === 0) return
    await prisma.comment.deleteMany({
      where: { postId: { in: createdPostIds } }
    })
    await prisma.post.deleteMany({ where: { id: { in: createdPostIds } } })
    createdPostIds.length = 0
  })

  async function createPost(platform: 'INSTAGRAM' | 'X' = 'INSTAGRAM') {
    const post = await prisma.post.create({
      data: {
        id: randomUUID(),
        platform,
        externalId: `${platform.toLowerCase()}-${randomUUID()}`
      }
    })
    createdPostIds.push(post.id)
    return post
  }

  describe('200', () => {
    it('returns an empty list for a post with no comments', async () => {
      const post = await createPost()

      const res = await app.inject({
        method: 'GET',
        url: `/posts/${post.id}/comments`
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.payload)).toEqual({
        data: [],
        pagination: { nextOffset: null }
      })
    })

    it('returns comments created for that post', async () => {
      const post = await createPost()
      const comment = await prisma.comment.create({
        data: {
          id: randomUUID(),
          postId: post.id,
          externalId: `c-${randomUUID()}`,
          text: 'First',
          authorUsername: 'fan_1'
        }
      })

      const res = await app.inject({
        method: 'GET',
        url: `/posts/${post.id}/comments`
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.data).toEqual([
        expect.objectContaining({
          id: comment.id,
          externalId: comment.externalId,
          text: 'First',
          parentId: null,
          authorUsername: 'fan_1',
          status: null,
          lastError: null
        })
      ])
      expect(body.pagination.nextOffset).toBeNull()
    })

    it('paginates comments for that post', async () => {
      const post = await createPost('X')
      const comments = await Promise.all(
        [1, 2, 3].map((n) =>
          prisma.comment.create({
            data: {
              id: randomUUID(),
              postId: post.id,
              externalId: `c-${n}-${randomUUID()}`,
              text: `comment-${n}`
            }
          })
        )
      )

      const first = await app.inject({
        method: 'GET',
        url: `/posts/${post.id}/comments?limit=2`
      })
      expect(first.statusCode).toBe(200)
      const firstBody = JSON.parse(first.payload)
      expect(firstBody.data).toHaveLength(2)
      expect(firstBody.pagination.nextOffset).toBe(2)
      expect(
        firstBody.data.every((c: { id: string }) =>
          comments.some((created) => created.id === c.id)
        )
      ).toBe(true)

      const second = await app.inject({
        method: 'GET',
        url: `/posts/${post.id}/comments?offset=2&limit=2`
      })
      expect(second.statusCode).toBe(200)
      const secondBody = JSON.parse(second.payload)
      expect(secondBody.data).toHaveLength(1)
      expect(secondBody.pagination.nextOffset).toBeNull()
      expect(comments.map((c) => c.id)).toContain(secondBody.data[0].id)
    })
  })

  describe('404', () => {
    it('returns not found when the post does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/posts/${randomUUID()}/comments`
      })

      expect(res.statusCode).toBe(404)
      expect(JSON.parse(res.payload).message).toMatch(/post not found/i)
    })
  })

  describe('400', () => {
    it('rejects limit below minimum', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/posts/${randomUUID()}/comments?limit=0`
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.payload).message).toMatch(/limit/i)
    })

    it('rejects limit above maximum', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/posts/${randomUUID()}/comments?limit=101`
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.payload).message).toMatch(/limit/i)
    })

    it('rejects invalid postId format', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/posts/not-a-uuid/comments'
      })
      expect(res.statusCode).toBe(400)
    })
  })
})
