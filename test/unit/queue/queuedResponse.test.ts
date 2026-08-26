import { createQueuedResponse } from '../../../src/queue/queuedResponse.js'

describe('createQueuedResponse', () => {
  it('returns the pending record after enqueuing by commentId', async () => {
    const pending = { id: 'comment-1', status: 'PENDING' as const }
    const enqueued: string[] = []

    const result = await createQueuedResponse({
      enqueue: async ({ commentId }) => {
        enqueued.push(commentId)
      },
      createPending: async () => pending,
      onEnqueueFailed: async () => {
        throw new Error('should not run')
      }
    })

    expect(result).toEqual(pending)
    expect(enqueued).toEqual([pending.id])
  })

  it('calls onEnqueueFailed and throws 503 when enqueue fails', async () => {
    const pending = { id: 'comment-1' }
    let enqueueFailed = false

    await expect(
      createQueuedResponse({
        enqueue: async () => {
          throw new Error('redis down')
        },
        createPending: async () => pending,
        onEnqueueFailed: async () => {
          enqueueFailed = true
        }
      })
    ).rejects.toMatchObject({
      message: 'Queue unavailable',
      statusCode: 503
    })

    expect(enqueueFailed).toBe(true)
  })
})
