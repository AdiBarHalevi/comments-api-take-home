import type { Comment, Post, PrismaClient } from '../../../src/generated/prisma/client.js'

export function createMockPrisma(overrides: {
  findUniquePost?: (args: unknown) => Promise<Post | null>
  findManyComments?: (args: unknown) => Promise<Comment[]>
} = {}): PrismaClient {
  return {
    post: {
      findUnique: overrides.findUniquePost ?? (async () => null)
    },
    comment: {
      findMany: overrides.findManyComments ?? (async () => [])
    }
  } as unknown as PrismaClient
}

export function makePost(overrides: Partial<Post> = {}): Post {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id: overrides.id ?? '11111111-1111-1111-1111-111111111111',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    externalId: overrides.externalId ?? 'ig-1',
    platform: overrides.platform ?? 'INSTAGRAM',
    isActive: overrides.isActive ?? true
  }
}

export function makeComment(overrides: Partial<Comment> = {}): Comment {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id: overrides.id ?? '22222222-2222-2222-2222-222222222222',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    externalId: overrides.externalId ?? 'comment-1',
    text: overrides.text ?? 'Nice post!',
    authorUsername: overrides.authorUsername ?? 'fan_account',
    authorExternalId: overrides.authorExternalId ?? 'author-1',
    isActive: overrides.isActive ?? true,
    status: overrides.status ?? null,
    lastError: overrides.lastError ?? null,
    postId: overrides.postId ?? '11111111-1111-1111-1111-111111111111',
    parentId: overrides.parentId ?? null
  }
}
