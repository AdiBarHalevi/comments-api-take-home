import type { FastifyInstance } from 'fastify'
import type { Platform, Post, PrismaClient } from '../../../src/generated/prisma/client.js'
import type { AppRequest } from '../../../src/types/request.js'

export type PostFixture = {
  id?: string
  platform: Platform
  externalId: string
  isActive?: boolean
  createdAt?: Date
}

export function createMockPrisma(overrides: {
  findMany?: (args: unknown) => Promise<Post[]>
} = {}): PrismaClient {
  return {
    post: {
      findMany: overrides.findMany ?? (async () => [])
    }
  } as unknown as PrismaClient
}

export function createMockRequest<T extends object = object>({
  prisma,
  ...rest
}: {
  prisma: PrismaClient
} & T): AppRequest & T {
  return {
    ...rest,
    server: { prisma } as unknown as FastifyInstance
  } as AppRequest & T
}

export function makePost(overrides: Partial<Post> & Pick<Post, 'platform' | 'externalId'>): Post {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id: overrides.id ?? '440e8400-e29b-41d4-a716-446655440000',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    externalId: overrides.externalId,
    platform: overrides.platform,
    isActive: overrides.isActive ?? true
  }
}
