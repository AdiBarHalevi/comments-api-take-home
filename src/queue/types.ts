export type JobData = {
  commentId: string
}

/** Enqueue a durable outbound-reply job. Work is recovered from the DB by id. */
export type EnqueueJob = (args: { commentId: string }) => Promise<void>
