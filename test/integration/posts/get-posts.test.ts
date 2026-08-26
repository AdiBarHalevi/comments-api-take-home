import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { env } from '../../../src/config/env.js'
import type { PrismaClient } from '../../../src/generated/prisma/client.js'
import { createPrismaClient } from '../../../src/lib/prisma.js'
import { build } from '../../helper.js'

describe('GET /posts', () => {
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

  async function createPost(data: {
    platform: 'INSTAGRAM' | 'X'
    externalId: string
  }) {
    const post = await prisma.post.create({
      data: {
        id: randomUUID(),
        platform: data.platform,
        externalId: data.externalId
      }
    })
    createdPostIds.push(post.id)
    return post
  }

  describe('200', () => {
    it('includes a created post in the list', async () => {
      const post = await createPost({
        platform: 'INSTAGRAM',
        externalId: `ig-${randomUUID()}`
      })

      const res = await app.inject({ method: 'GET', url: '/posts?limit=100' })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: post.id,
            platform: 'INSTAGRAM',
            externalId: post.externalId
          })
        ])
      )
    })

    it('returns created posts ordered by id when requested', async () => {
      const first = await createPost({
        platform: 'INSTAGRAM',
        externalId: `ig-${randomUUID()}`
      })
      const second = await createPost({
        platform: 'X',
        externalId: `x-${randomUUID()}`
      })
      const ids = [first.id, second.id].sort()

      const res = await app.inject({
        method: 'GET',
        url: '/posts?limit=100&sortBy=id&sortOrder=asc'
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      const ours = body.data.filter((p: { id: string }) =>
        ids.includes(p.id)
      )
      expect(ours.map((p: { id: string }) => p.id)).toEqual(ids)
    })

    it('returns created posts ordered by platform desc when requested', async () => {
      const ig = await createPost({
        platform: 'INSTAGRAM',
        externalId: `ig-${randomUUID()}`
      })
      const x = await createPost({
        platform: 'X',
        externalId: `x-${randomUUID()}`
      })

      const res = await app.inject({
        method: 'GET',
        url: '/posts?limit=100&sortBy=platform&sortOrder=desc'
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      const ours = body.data.filter((p: { id: string }) =>
        [ig.id, x.id].includes(p.id)
      )
      expect(ours.map((p: { platform: string }) => p.platform)).toEqual([
        'X',
        'INSTAGRAM'
      ])
    })
  })

  describe('400', () => {
    it('rejects limit below minimum', async () => {
      const res = await app.inject({ method: 'GET', url: '/posts?limit=0' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.payload).message).toMatch(/limit/i)
    })

    it('rejects limit above maximum', async () => {
      const res = await app.inject({ method: 'GET', url: '/posts?limit=101' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.payload).message).toMatch(/limit/i)
    })

    it('rejects non-integer limit', async () => {
      const res = await app.inject({ method: 'GET', url: '/posts?limit=abc' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.payload).message).toMatch(/limit/i)
    })

    it('rejects offset below minimum', async () => {
      const res = await app.inject({ method: 'GET', url: '/posts?offset=-1' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.payload).message).toMatch(/offset/i)
    })

    it('rejects invalid sortBy', async () => {
      const res = await app.inject({ method: 'GET', url: '/posts?sortBy=foo' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.payload).message).toMatch(/sortBy/i)
    })

    it('rejects invalid sortOrder', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/posts?sortOrder=sideways'
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.payload).message).toMatch(/sortOrder/i)
    })
  })
})
