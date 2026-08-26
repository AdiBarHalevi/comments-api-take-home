const DEFAULT_TIMEOUT_MS = 10_000

export class PlatformHttpError extends Error {
  readonly status: number
  readonly statusText: string
  readonly detail?: string

  constructor(
    platform: string,
    status: number,
    statusText: string,
    detail?: string
  ) {
    const statusLabel = `${status} ${statusText}`.trim()
    super(
      detail
        ? `${platform} request failed: ${statusLabel} — ${detail}`
        : `${platform} request failed: ${statusLabel}`
    )
    this.name = 'PlatformHttpError'
    this.status = status
    this.statusText = statusText
    this.detail = detail
  }
}

export type PlatformHttpRequestInit = {
  method?: string
  query?: Record<string, string>
  headers?: Record<string, string>
  json?: unknown
  timeoutMs?: number
}

export type PlatformHttpClient = {
  request<T>(path: string, init?: PlatformHttpRequestInit): Promise<T>
  get<T>(
    path: string,
    init?: Omit<PlatformHttpRequestInit, 'method' | 'json'>
  ): Promise<T>
  post<T>(
    path: string,
    init?: Omit<PlatformHttpRequestInit, 'method'>
  ): Promise<T>
}

/**
 * Tiny HTTP SDK for platform APIs: timeout, JSON encode/decode, and Graph/X
 * error parsing. Point `baseUrl` at Mockoon locally or the real API in prod.
 */
export function createPlatformHttpClient({
  platform,
  baseUrl,
  defaultHeaders = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
}: {
  platform: string
  baseUrl: string
  defaultHeaders?: Record<string, string>
  timeoutMs?: number
}): PlatformHttpClient {
  async function request<T>(
    path: string,
    init: PlatformHttpRequestInit = {}
  ): Promise<T> {
    const url = resolveUrl(baseUrl, path)
    for (const [key, value] of Object.entries(init.query ?? {})) {
      url.searchParams.set(key, value)
    }

    const headers: Record<string, string> = {
      ...defaultHeaders,
      ...init.headers
    }
    let body: string | undefined
    if (init.json !== undefined) {
      headers['Content-Type'] ??= 'application/json'
      body = JSON.stringify(init.json)
    }

    const effectiveTimeout = init.timeoutMs ?? timeoutMs
    const response = await fetchWithTimeout(url, {
      method: init.method ?? 'GET',
      headers,
      body,
      timeoutMs: effectiveTimeout
    })

    const raw = await response.text()
    if (!response.ok) {
      throw new PlatformHttpError(
        platform,
        response.status,
        response.statusText,
        detailFromBody(raw)
      )
    }

    if (!raw.trim()) {
      return undefined as T
    }

    try {
      return JSON.parse(raw) as T
    } catch (error) {
      throw new Error(`${platform} request failed: invalid JSON response`, {
        cause: error
      })
    }
  }

  return {
    request,
    get: (path, init) => request(path, { ...init, method: 'GET' }),
    post: (path, init) => request(path, { ...init, method: 'POST' })
  }
}

function resolveUrl(baseUrl: string, path: string): URL {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return new URL(path.replace(/^\//, ''), base)
}

async function fetchWithTimeout(
  input: URL,
  init: RequestInit & { timeoutMs: number }
): Promise<Response> {
  const { timeoutMs, signal, ...rest } = init
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const combined = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal

  try {
    return await fetch(input, { ...rest, signal: combined })
  } catch (error) {
    if (isAbortOrTimeout(error)) {
      throw new Error(`Platform request timed out after ${timeoutMs}ms`, {
        cause: error
      })
    }
    throw error
  }
}

function detailFromBody(raw: string): string | undefined {
  if (!raw.trim()) return undefined

  try {
    const message = messageFromPlatformErrorBody(JSON.parse(raw) as unknown)
    if (message) return message
  } catch {
    // non-JSON — fall through
  }

  return raw.length > 300 ? `${raw.slice(0, 300)}…` : raw
}

function messageFromPlatformErrorBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined
  const record = body as Record<string, unknown>

  // Instagram Graph: { error: { message, type, code } }
  const error = record.error
  if (error && typeof error === 'object') {
    const ig = error as Record<string, unknown>
    if (typeof ig.message === 'string' && ig.message.trim()) {
      return ig.message.trim()
    }
  }

  // X API v2: { errors: [{ message }] } or { detail } / { title }
  const errors = record.errors
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0]
    if (first && typeof first === 'object') {
      const msg = (first as Record<string, unknown>).message
      if (typeof msg === 'string' && msg.trim()) return msg.trim()
    }
  }
  if (typeof record.detail === 'string' && record.detail.trim()) {
    return record.detail.trim()
  }
  if (typeof record.title === 'string' && record.title.trim()) {
    return record.title.trim()
  }
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim()
  }

  return undefined
}

function isAbortOrTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  )
}
