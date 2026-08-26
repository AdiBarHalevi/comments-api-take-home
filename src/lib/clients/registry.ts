import type { PlatformClients } from './types.js'
import { getStaticPlatformUser } from '../../config/staticPlatformUser.js'
import { createInstagramClient } from './instagram.js'
import { createXClient } from './x.js'

/** Shared platform client registry — used by HTTP services and queue workers. */
export const platformClients: PlatformClients = {
  INSTAGRAM: createInstagramClient(getStaticPlatformUser('instagram')),
  X: createXClient(getStaticPlatformUser('x'))
}
