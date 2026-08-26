import { join } from 'node:path'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import fp from 'fastify-plugin'

const DOCS_ROUTE_PREFIX = '/openapi'
const OPENAPI_SPEC_PATH = join(process.cwd(), 'docs', 'openapi.json')

export default fp(async (fastify) => {
  await fastify.register(swagger, {
    mode: 'static',
    specification: {
      path: OPENAPI_SPEC_PATH,
      baseDir: join(process.cwd(), 'docs')
    }
  })

  await fastify.register(swaggerUi, {
    routePrefix: DOCS_ROUTE_PREFIX,
    staticCSP: true
  })
})
