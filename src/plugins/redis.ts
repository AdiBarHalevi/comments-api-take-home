import redis from '@fastify/redis'
import fp from 'fastify-plugin'
import { env } from '../config/env.js'

/**
 * Shared Redis client via @fastify/redis (ioredis under the hood).
 * `maxRetriesPerRequest: null` is required so BullMQ can use duplicated
 * connections for blocking commands.
 */
export default fp(
  async (fastify) => {
    await fastify.register(redis, {
      url: env.REDIS_URL,
      maxRetriesPerRequest: null
    })
  },
  { name: 'redis' }
)
