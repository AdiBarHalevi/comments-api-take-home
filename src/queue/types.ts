export type JobData = {
  jobId: string
}

export type EnqueueJob = (args: {
  jobId: string
  run: () => Promise<void>
  onFailed?: (error: Error) => Promise<void>
}) => Promise<void>
