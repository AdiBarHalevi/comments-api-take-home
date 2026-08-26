import type { FastifyInstance } from 'fastify'
import type { Comment, Post, PrismaClient } from '../../../src/generated/prisma/client.js'
import type { EnqueueJob } from '../../../src/queue/types.js'
import type { AppRequest } from '../../../src/types/request.js'

export function createMockPrisma(overrides: {
  findUniquePost?: (args: unknown) => Promise<Post | null>
  findUniqueComment?: (args: unknown) => Promise<
    | (Comment & { post?: Post })
    | null
  >
  findManyComments?: (args: unknown) => Promise<Comment[]>
  createComment?: (args: unknown) => Promise<Comment>
  updateComment?: (args: unknown) => Promise<Comment>
} = {}): PrismaClient {
  return {
    post: {
      findUnique: overrides.findUniquePost ?? (async () => null)
    },
    comment: {
      findMany: overrides.findManyComments ?? (async () => []),
      findUnique: overrides.findUniqueComment ?? (async () => null),
      create: overrides.createComment ?? (async () => makeComment()),
      update: overrides.updateComment ?? (async () => makeComment())
    }
  } as unknown as PrismaClient
}

export function createMockEnqueue(
  impl: EnqueueJob = async () => undefined
): EnqueueJob {
  return impl
}

export function createMockRequest<T extends object = object>({
  prisma,
  enqueue = createMockEnqueue(),
  ...rest
}: {
  prisma: PrismaClient
  enqueue?: EnqueueJob
} & T): AppRequest & T {
  return {
    ...rest,
    server: {
      prisma,
      enqueue
    } as unknown as FastifyInstance
  } as AppRequest & T
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
    externalId: 'externalId' in overrides ? overrides.externalId! : 'comment-1',
    text: overrides.text ?? 'Nice post!',
    authorUsername: overrides.authorUsername ?? 'fan_account',
    authorExternalId: overrides.authorExternalId ?? 'author-1',
    isActive: overrides.isActive ?? true,
    status: 'status' in overrides ? overrides.status! : null,
    lastError: 'lastError' in overrides ? overrides.lastError! : null,
    postId: overrides.postId ?? '11111111-1111-1111-1111-111111111111',
    parentId: 'parentId' in overrides ? overrides.parentId! : null
  }
}
