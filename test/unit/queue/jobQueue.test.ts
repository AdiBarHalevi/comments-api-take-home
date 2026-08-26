import { jest } from '@jest/globals'

const addMock = jest.fn(async () => undefined)
const closeMock = jest.fn(async () => undefined)
const workerOnMock = jest.fn()
let workerProcessor:
  ((job: { data: { commentId: string } }) => Promise<void>) | undefined
let failedHandler:
  | ((
      job:
        | {
            data: { commentId: string }
            attemptsMade: number
            opts: { attempts?: number }
          }
        | undefined,
      error: Error
    ) => void)
  | undefined

jest.unstable_mockModule('bullmq', () => ({
  Queue: class {
    add = addMock
    close = closeMock
  },
  Worker: class {
    constructor(
      _name: string,
      processor: (job: { data: { commentId: string } }) => Promise<void>
    ) {
      workerProcessor = processor
    }
    on(event: string, handler: (...args: never[]) => void) {
      if (event === 'failed') {
        failedHandler = handler as typeof failedHandler
      }
      workerOnMock(event, handler)
      return this
    }
    close = closeMock
  }
}))

const { createJobQueue } = await import('../../../src/queue/jobQueue.js')

describe('createJobQueue', () => {
  beforeEach(() => {
    addMock.mockClear()
    closeMock.mockClear()
    workerOnMock.mockClear()
    workerProcessor = undefined
    failedHandler = undefined
  })

  it('enqueues a durable payload with only commentId', async () => {
    const processJob = jest.fn(async () => undefined)
    const onJobFailed = jest.fn(async () => undefined)

    const queue = createJobQueue({
      connection: {},
      processJob,
      onJobFailed,
      queueName: 'test-jobs'
    })

    await queue.enqueue({ commentId: 'comment-abc' })

    expect(addMock).toHaveBeenCalledWith(
      'create-reply',
      { commentId: 'comment-abc' },
      expect.objectContaining({
        jobId: 'comment-abc',
        attempts: 5
      })
    )
    expect(processJob).not.toHaveBeenCalled()

    await queue.close()
  })

  it('worker processor runs processJob from the job payload (no in-memory callbacks)', async () => {
    const processJob = jest.fn(async () => undefined)

    createJobQueue({
      connection: {},
      processJob,
      onJobFailed: async () => undefined,
      queueName: 'test-jobs'
    })

    expect(workerProcessor).toBeDefined()
    await workerProcessor!({ data: { commentId: 'comment-xyz' } })

    expect(processJob).toHaveBeenCalledWith('comment-xyz')
  })

  it('final worker failure marks the comment via onJobFailed(commentId)', async () => {
    const onJobFailed = jest.fn(async () => undefined)

    createJobQueue({
      connection: {},
      processJob: async () => undefined,
      onJobFailed,
      queueName: 'test-jobs'
    })

    failedHandler!(
      {
        data: { commentId: 'comment-fail' },
        attemptsMade: 5,
        opts: { attempts: 5 }
      },
      new Error('exhausted')
    )

    await new Promise((resolve) => setImmediate(resolve))

    expect(onJobFailed).toHaveBeenCalledWith({
      commentId: 'comment-fail',
      error: expect.objectContaining({ message: 'exhausted' })
    })
  })
})
