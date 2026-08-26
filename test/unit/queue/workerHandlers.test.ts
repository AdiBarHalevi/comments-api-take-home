import { createWorkerHandlers } from '../../../src/queue/workerHandlers.js'

describe('createWorkerHandlers', () => {
  it('process calls processJob with commentId from the durable job payload', async () => {
    const processed: string[] = []
    const handlers = createWorkerHandlers({
      processJob: async (commentId) => {
        processed.push(commentId)
      },
      onJobFailed: async () => undefined
    })

    await handlers.process({
      data: { commentId: 'comment-123' }
    })

    expect(processed).toEqual(['comment-123'])
  })

  it('handleFailed ignores intermediate retry attempts', async () => {
    const failed: Array<{ commentId: string; message: string }> = []
    const handlers = createWorkerHandlers({
      processJob: async () => undefined,
      onJobFailed: async ({ commentId, error }) => {
        failed.push({ commentId, message: error.message })
      }
    })

    handlers.handleFailed(
      {
        data: { commentId: 'comment-123' },
        attemptsMade: 2,
        opts: { attempts: 5 }
      },
      new Error('transient')
    )

    // Give the void promise a tick in case it ran
    await Promise.resolve()
    expect(failed).toEqual([])
  })

  it('handleFailed calls onJobFailed with commentId after the final attempt', async () => {
    const failed: Array<{ commentId: string; message: string }> = []
    const handlers = createWorkerHandlers({
      processJob: async () => undefined,
      onJobFailed: async ({ commentId, error }) => {
        failed.push({ commentId, message: error.message })
      }
    })

    handlers.handleFailed(
      {
        data: { commentId: 'comment-123' },
        attemptsMade: 5,
        opts: { attempts: 5 }
      },
      new Error('platform down')
    )

    await new Promise((resolve) => setImmediate(resolve))

    expect(failed).toEqual([
      { commentId: 'comment-123', message: 'platform down' }
    ])
  })

  it('handleFailed no-ops when job is undefined', async () => {
    let called = false
    const handlers = createWorkerHandlers({
      processJob: async () => undefined,
      onJobFailed: async () => {
        called = true
      }
    })

    handlers.handleFailed(undefined, new Error('boom'))
    await Promise.resolve()
    expect(called).toBe(false)
  })

  it('reports onJobFailed errors via onWorkerError', async () => {
    const workerErrors: string[] = []
    const handlers = createWorkerHandlers({
      processJob: async () => undefined,
      onJobFailed: async () => {
        throw new Error('db unavailable')
      },
      onWorkerError: (error) => {
        workerErrors.push(error.message)
      }
    })

    handlers.handleFailed(
      {
        data: { commentId: 'comment-123' },
        attemptsMade: 5,
        opts: { attempts: 5 }
      },
      new Error('platform down')
    )

    await new Promise((resolve) => setImmediate(resolve))

    expect(workerErrors).toEqual(['db unavailable'])
  })
})
