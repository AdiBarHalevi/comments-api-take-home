import type { JobData } from './types.js'

/**
 * Pure worker handlers — job payload is only `{ commentId }`; processors load
 * everything else from the DB so work survives process restarts.
 */
export function createWorkerHandlers({
  processJob,
  onJobFailed,
  onWorkerError
}: {
  processJob: (commentId: string) => Promise<void>
  onJobFailed: (args: { commentId: string; error: Error }) => Promise<void>
  onWorkerError?: (error: Error) => void
}) {
  return {
    async process(job: { data: JobData }): Promise<void> {
      await processJob(job.data.commentId)
    },

    handleFailed(
      job: { data: JobData; attemptsMade: number; opts: { attempts?: number } } | undefined,
      error: Error
    ): void {
      if (!job) return
      const maxAttempts = job.opts.attempts ?? 1
      if (job.attemptsMade < maxAttempts) return

      void onJobFailed({ commentId: job.data.commentId, error }).catch(
        (markError: unknown) => {
          onWorkerError?.(
            markError instanceof Error
              ? markError
              : new Error('Job onFailed handler failed')
          )
        }
      )
    }
  }
}
