import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),

  IG_EXTERNAL_ACCOUNT_ID: z.string().min(1),
  IG_USERNAME: z.string().min(1),
  IG_ACCESS_TOKEN: z.string().min(1),
  IG_API_BASE_URL: z.string().url(),

  X_EXTERNAL_ACCOUNT_ID: z.string().min(1),
  X_USERNAME: z.string().min(1),
  X_ACCESS_TOKEN: z.string().min(1),
  X_API_BASE_URL: z.string().url()
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment variables:\n${details}`)
  }
  return parsed.data
}

/** Validated env — fails fast at import if env is missing/invalid. */
export const env = loadEnv()
