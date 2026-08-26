import { randomUUID } from 'node:crypto'
import { Queue, Worker } from 'bullmq'
import type { EnqueueJob, JobData } from './types.js'

const ENQUEUE_ATTEMPTS = 3
const ENQUEUE_RETRY_DELAY_MS = 100

type JobCallbacks = {
  run: () => Promise<void>
  onFailed?: (error: Error) => Promise<void>
}

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
 * Generic BullMQ wrapper. Callers pass `run` / `onFailed` callbacks at enqueue
 * time; the in-process worker invokes them when the job is processed.
 *
 * Each instance uses an isolated queue name so parallel app instances (e.g.
 * Jest workers) cannot steal each other's jobs — callbacks live in-process.
 */
export function createJobQueue({
  connection,
  onWorkerError
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ioredis client from @fastify/redis
  connection: any
  onWorkerError?: (error: Error) => void
}): JobQueue {
  const callbacks = new Map<string, JobCallbacks>()
  const queueName = `jobs-${randomUUID()}`

  const queue = new Queue<JobData>(queueName, { connection })

  const worker = new Worker<JobData>(
    queueName,
    async (job) => {
      const registered = callbacks.get(job.data.jobId)
      if (!registered) {
        throw new Error(`No callback registered for job ${job.data.jobId}`)
      }
      await registered.run()
      callbacks.delete(job.data.jobId)
    },
    { connection }
  )

  worker.on('failed', (job, error) => {
    if (!job) return
    const maxAttempts = job.opts.attempts ?? 1
    if (job.attemptsMade < maxAttempts) return

    const registered = callbacks.get(job.data.jobId)
    callbacks.delete(job.data.jobId)
    if (!registered?.onFailed) return

    void registered.onFailed(error).catch((markError: unknown) => {
      onWorkerError?.(
        markError instanceof Error
          ? markError
          : new Error('Job onFailed handler failed')
      )
    })
  })

  worker.on('error', (error) => {
    onWorkerError?.(error)
  })

  const enqueue: EnqueueJob = async ({ jobId, run, onFailed }) => {
    let lastError: unknown

    for (let attempt = 1; attempt <= ENQUEUE_ATTEMPTS; attempt++) {
      try {
        callbacks.set(jobId, { run, onFailed })
        await queue.add(
          'job',
          { jobId },
          {
            jobId,
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
        callbacks.delete(jobId)
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
