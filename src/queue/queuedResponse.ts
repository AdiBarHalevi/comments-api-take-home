import { httpError } from '../lib/httpError.js'
import type { EnqueueJob } from './types.js'

/**
 * Async "202 Accepted" helper: persist a pending record, enqueue by id, return
 * the pending payload. Marks failure if enqueue itself fails.
 */
export async function createQueuedResponse<T extends { id: string }>({
  enqueue,
  createPending,
  onEnqueueFailed
}: {
  enqueue: EnqueueJob
  createPending: () => Promise<T>
  onEnqueueFailed: (pending: T) => Promise<void>
}): Promise<T> {
  const pending = await createPending()

  try {
    await enqueue({ commentId: pending.id })
  } catch {
    await onEnqueueFailed(pending)
    throw httpError(503, 'Queue unavailable')
  }

  return pending
}
