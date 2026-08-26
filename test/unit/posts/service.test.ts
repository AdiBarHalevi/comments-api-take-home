import { listPosts } from '../../../src/posts/service.js'
import { createMockPrisma, makePost } from './fixtures.js'

describe('listPosts', () => {
  it('returns empty page with defaults when no posts exist', async () => {
    let capturedArgs: unknown
    const prisma = createMockPrisma({
      findMany: async (args) => {
        capturedArgs = args
        return []
      }
    })

    const result = await listPosts(prisma, {})

    expect(result).toEqual({
      data: [],
      pagination: { nextOffset: null }
    })
    expect(capturedArgs).toEqual({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 51
    })
  })

  it('maps posts to response shape and omits nextOffset on last page', async () => {
    const prisma = createMockPrisma({
      findMany: async () => [
        makePost({
          id: '11111111-1111-1111-1111-111111111111',
          platform: 'INSTAGRAM',
          externalId: 'ig-1'
        }),
        makePost({
          id: '22222222-2222-2222-2222-222222222222',
          platform: 'X',
          externalId: 'x-1',
          isActive: false
        })
      ]
    })

    const result = await listPosts(prisma, { limit: 10 })

    expect(result).toEqual({
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

  it('returns nextOffset when more rows exist than limit', async () => {
    const prisma = createMockPrisma({
      findMany: async () => [
        makePost({ id: '1', platform: 'INSTAGRAM', externalId: 'a' }),
        makePost({ id: '2', platform: 'INSTAGRAM', externalId: 'b' }),
        makePost({ id: '3', platform: 'INSTAGRAM', externalId: 'c' })
      ]
    })

    const result = await listPosts(prisma, { offset: 0, limit: 2 })

    expect(result.data).toHaveLength(2)
    expect(result.pagination).toEqual({ nextOffset: 2 })
  })

  it('applies offset and limit to prisma query', async () => {
    let capturedArgs: unknown
    const prisma = createMockPrisma({
      findMany: async (args) => {
        capturedArgs = args
        return []
      }
    })

    await listPosts(prisma, { offset: 10, limit: 5 })

    expect(capturedArgs).toEqual({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: 10,
      take: 6
    })
  })

  it('sorts by id without secondary tie-breaker', async () => {
    let capturedArgs: unknown
    const prisma = createMockPrisma({
      findMany: async (args) => {
        capturedArgs = args
        return []
      }
    })

    await listPosts(prisma, { sortBy: 'id', sortOrder: 'desc' })

    expect(capturedArgs).toEqual({
      orderBy: [{ id: 'desc' }],
      skip: 0,
      take: 51
    })
  })

  it('sorts by platform with id tie-breaker', async () => {
    let capturedArgs: unknown
    const prisma = createMockPrisma({
      findMany: async (args) => {
        capturedArgs = args
        return []
      }
    })

    await listPosts(prisma, { sortBy: 'platform', sortOrder: 'desc' })

    expect(capturedArgs).toEqual({
      orderBy: [{ platform: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 51
    })
  })
})
