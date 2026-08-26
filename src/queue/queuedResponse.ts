import { httpError } from '../lib/httpError.js'
import type { EnqueueJob } from './types.js'

/**
 * Async "202 Accepted" helper: persist a pending record, enqueue work with
 * callbacks, return the pending payload. Marks failure if enqueue itself fails.
 */
export async function createQueuedResponse<T extends { id: string }>({
  enqueue,
  createPending,
  run,
  onFailed,
  onEnqueueFailed
}: {
  enqueue: EnqueueJob
  createPending: () => Promise<T>
  run: (pending: T) => Promise<void>
  onFailed: (args: { pending: T; error: Error }) => Promise<void>
  onEnqueueFailed: (pending: T) => Promise<void>
}): Promise<T> {
  const pending = await createPending()

  try {
    await enqueue({
      jobId: pending.id,
      run: () => run(pending),
      onFailed: (error) => onFailed({ pending, error })
    })
  } catch {
    await onEnqueueFailed(pending)
    throw httpError(503, 'Queue unavailable')
  }

  return pending
}
