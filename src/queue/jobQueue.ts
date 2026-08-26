import { Queue, Worker } from 'bullmq'
import type { EnqueueJob, JobData } from './types.js'
import { createWorkerHandlers } from './workerHandlers.js'

/** Stable name so a restarted process resumes jobs left in Redis. */
export const DEFAULT_QUEUE_NAME = 'create-reply'

const ENQUEUE_ATTEMPTS = 3
const ENQUEUE_RETRY_DELAY_MS = 100

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isDuplicateJobError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /Job .+ already exists|already exists/i.test(error.message)
  )
}

export type JobQueue = {
  enqueue: EnqueueJob
  close: () => Promise<void>
}

/**
 * Durable BullMQ wrapper. Jobs store only `{ commentId }`; `processJob` /
 * `onJobFailed` are wired once at construction and reload work from the DB.
 *
 * Default queue name is stable across process restarts. Pass `queueName` only
 * when isolating parallel consumers that share Redis (e.g. unit tests).
 */
export function createJobQueue({
  connection,
  processJob,
  onJobFailed,
  onWorkerError,
  queueName = DEFAULT_QUEUE_NAME
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ioredis client from @fastify/redis
  connection: any
  processJob: (commentId: string) => Promise<void>
  onJobFailed: (args: { commentId: string; error: Error }) => Promise<void>
  onWorkerError?: (error: Error) => void
  queueName?: string
}): JobQueue {
  const handlers = createWorkerHandlers({
    processJob,
    onJobFailed,
    onWorkerError
  })

  const queue = new Queue<JobData>(queueName, { connection })

  const worker = new Worker<JobData>(
    queueName,
    async (job) => {
      await handlers.process(job)
    },
    { connection }
  )

  worker.on('failed', (job, error) => {
    handlers.handleFailed(job, error)
  })

  worker.on('error', (error) => {
    onWorkerError?.(error)
  })

  const enqueue: EnqueueJob = async ({ commentId }) => {
    let lastError: unknown

    for (let attempt = 1; attempt <= ENQUEUE_ATTEMPTS; attempt++) {
      try {
        await queue.add(
          'create-reply',
          { commentId },
          {
            jobId: commentId,
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: 1000,
            removeOnFail: 5000
          }
        )
        return
      } catch (error) {
        if (isDuplicateJobError(error)) {
          return
        }
        lastError = error
        if (attempt < ENQUEUE_ATTEMPTS) {
          await sleep(ENQUEUE_RETRY_DELAY_MS * attempt)
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to enqueue job')
  }

  return {
    enqueue,
    async close() {
      await worker.close()
      await queue.close()
    }
  }
}
