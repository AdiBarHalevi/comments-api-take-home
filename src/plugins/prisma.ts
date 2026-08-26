import fp from 'fastify-plugin'
import { env } from '../config/env.js'
import { createPrismaClient } from '../lib/prisma.js'
import type { PrismaClient } from '../generated/prisma/client.js'

export interface PrismaPluginOptions {
  // Reserved for test overrides (e.g. inject a mock client).
}

export default fp<PrismaPluginOptions>(
  async (fastify) => {
    const prisma = createPrismaClient(env.DATABASE_URL)

    fastify.decorate('prisma', prisma)

    fastify.addHook('onClose', async (instance) => {
      await instance.prisma.$disconnect()
    })
  },
  { name: 'prisma' }
)

declare module 'fastify' {
  export interface FastifyInstance {
    prisma: PrismaClient
  }
}
