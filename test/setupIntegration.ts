/**
 * Jest setupFiles for integration tests — runs before test files load
 * (so before `env.ts` reads process.env). First caller starts containers;
 * others reuse the state file. Ryuk reaps containers when Jest exits.
 */
import { execFileSync } from 'node:child_process'
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { config as loadDotenv } from 'dotenv'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer } from '@testcontainers/redis'

loadDotenv({ path: '.env.test' })

type State = { databaseUrl: string; redisUrl: string }

const statePath = resolve('test/.testcontainers-state.json')
const lockPath = resolve('test/.testcontainers-lock')

function readState(): State | undefined {
  if (!existsSync(statePath)) return undefined
  return JSON.parse(readFileSync(statePath, 'utf8')) as State
}

function applyEnv({ databaseUrl, redisUrl }: State): void {
  process.env.DATABASE_URL = databaseUrl
  process.env.REDIS_URL = redisUrl
}

function tryLock(): number | undefined {
  try {
    return openSync(lockPath, 'wx')
  } catch {
    return undefined
  }
}

async function waitForState(): Promise<State> {
  console.log(
    '[testcontainers] waiting for another worker to finish starting containers'
  )
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const state = readState()
    if (state) {
      console.log(
        '[testcontainers] reusing containers started by another worker'
      )
      return state
    }
    await sleep(100)
  }
  throw new Error('Timed out waiting for Testcontainers')
}

async function startAndMigrate(): Promise<State> {
  console.log('[testcontainers] starting Postgres and Redis')
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('comments_test')
      .withUsername('comments')
      .withPassword('comments')
      .start(),
    new RedisContainer('redis:7-alpine').start()
  ])

  const state: State = {
    databaseUrl: postgres.getConnectionUri(),
    redisUrl: redis.getConnectionUrl()
  }
  console.log(`[testcontainers] Postgres ready at ${state.databaseUrl}`)
  console.log(`[testcontainers] Redis ready at ${state.redisUrl}`)

  applyEnv(state)
  console.log('[testcontainers] running prisma migrate deploy')
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: process.env
  })
  writeFileSync(statePath, JSON.stringify(state))
  console.log('[testcontainers] containers ready')
  return state
}

async function ensureContainers(): Promise<State> {
  const existing = readState()
  if (existing) {
    console.log('[testcontainers] reusing containers from state file')
    return existing
  }

  const lockFd = tryLock()
  if (lockFd === undefined) return waitForState()

  try {
    return await startAndMigrate()
  } finally {
    closeSync(lockFd)
    try {
      unlinkSync(lockPath)
    } catch {
      // lock may already be gone
    }
  }
}

applyEnv(await ensureContainers())
