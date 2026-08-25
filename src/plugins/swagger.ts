import { join } from 'node:path'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import fp from 'fastify-plugin'

const DOCS_ROUTE_PREFIX = '/openapi'

function resolveOpenApiSpecPath(): string {
  return join(process.cwd(), 'docs', 'openapi.yaml')
}

export default fp(async (fastify) => {
  const openApiDir = join(process.cwd(), 'docs')

  await fastify.register(swagger, {
    mode: 'static',
    specification: {
      path: resolveOpenApiSpecPath(),
      baseDir: openApiDir
    }
  })

  await fastify.register(swaggerUi, {
    routePrefix: DOCS_ROUTE_PREFIX,
    staticCSP: true
  })
})
