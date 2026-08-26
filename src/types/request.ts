import type { FastifyRequest } from 'fastify'

/**
 * Request with access to app decorations on `request.server`
 * (`prisma`, `enqueue`, …).
 */
export type AppRequest<
  T extends {
    Params?: unknown
    Querystring?: unknown
    Body?: unknown
  } = object
> = FastifyRequest<T>
