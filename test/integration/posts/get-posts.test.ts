import type { FastifyInstance } from 'fastify'
import { env } from '../../../src/config/env.js'
import { createPrismaClient } from '../../../src/lib/prisma.js'
import type { PrismaClient } from '../../../src/generated/prisma/client.js'
import { build } from '../../helper.js'

describe('GET /posts', () => {
  let app: FastifyInstance
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = createPrismaClient(env.DATABASE_URL)
    app = await build()
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await prisma.comment.deleteMany()
    await prisma.post.deleteMany()
  })

  describe('200', () => {
    it('returns an empty list when no posts exist', async () => {
      const res = await app.inject({ method: 'GET', url: '/posts' })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.payload)).toEqual({
        data: [],
        pagination: { nextOffset: null }
      })
    })

    it('returns seeded posts', async () => {
      await prisma.post.createMany({
        data: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            platform: 'INSTAGRAM',
            externalId: 'ig-1',
            isActive: true
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            platform: 'X',
            externalId: 'x-1',
            isActive: false
          }
        ]
      })

      const res = await app.inject({
        method: 'GET',
        url: '/posts?sortBy=id&sortOrder=asc'
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.payload)).toEqual({
        data: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            platform: 'INSTAGRAM',
            externalId: 'ig-1',
            isActive: true
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            platform: 'X',
            externalId: 'x-1',
            isActive: false
          }
        ],
        pagination: { nextOffset: null }
      })
    })

    it('paginates with nextOffset', async () => {
      await prisma.post.createMany({
        data: [
          {
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            platform: 'INSTAGRAM',
            externalId: 'ig-a'
          },
          {
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            platform: 'INSTAGRAM',
            externalId: 'ig-b'
          },
          {
            id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            platform: 'X',
            externalId: 'x-c'
          }
        ]
      })

      const first = await app.inject({
        method: 'GET',
        url: '/posts?limit=2&sortBy=id&sortOrder=asc'
      })
      expect(first.statusCode).toBe(200)
      const firstBody = JSON.parse(first.payload)
      expect(firstBody.data).toHaveLength(2)
      expect(firstBody.pagination.nextOffset).toBe(2)

      const second = await app.inject({
        method: 'GET',
        url: '/posts?offset=2&limit=2&sortBy=id&sortOrder=asc'
      })
      expect(second.statusCode).toBe(200)
      const secondBody = JSON.parse(second.payload)
      expect(secondBody.data).toHaveLength(1)
      expect(secondBody.pagination.nextOffset).toBeNull()
    })

    it('sorts by platform desc', async () => {
      await prisma.post.createMany({
        data: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            platform: 'INSTAGRAM',
            externalId: 'ig-1'
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            platform: 'X',
            externalId: 'x-1'
          }
        ]
      })

      const res = await app.inject({
        method: 'GET',
        url: '/posts?sortBy=platform&sortOrder=desc'
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.data.map((p: { platform: string }) => p.platform)).toEqual([
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
