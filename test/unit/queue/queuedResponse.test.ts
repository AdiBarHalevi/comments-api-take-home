import { createQueuedResponse } from '../../../src/queue/queuedResponse.js'

describe('createQueuedResponse', () => {
  it('returns the pending record after a successful enqueue', async () => {
    const pending = { id: 'job-1', status: 'PENDING' as const }
    const runs: string[] = []

    const result = await createQueuedResponse({
      enqueue: async ({ jobId, run }) => {
        expect(jobId).toBe(pending.id)
        runs.push('enqueued')
        void run
      },
      createPending: async () => pending,
      run: async () => {
        runs.push('run')
      },
      onFailed: async () => {
        runs.push('failed')
      },
      onEnqueueFailed: async () => {
        runs.push('enqueue-failed')
      }
    })

    expect(result).toEqual(pending)
    expect(runs).toEqual(['enqueued'])
  })

  it('calls onEnqueueFailed and throws 503 when enqueue fails', async () => {
    const pending = { id: 'job-1' }
    let enqueueFailed = false

    await expect(
      createQueuedResponse({
        enqueue: async () => {
          throw new Error('redis down')
        },
        createPending: async () => pending,
        run: async () => undefined,
        onFailed: async () => undefined,
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
