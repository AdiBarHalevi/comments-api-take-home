import { jest } from '@jest/globals'
import {
  createPlatformHttpClient,
  PlatformHttpError
} from '../../../../src/lib/clients/http.js'

describe('createPlatformHttpClient', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('GETs JSON relative to baseUrl', async () => {
    globalThis.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ id: '1' }] }), { status: 200 })
    )

    const http = createPlatformHttpClient({
      platform: 'Instagram',
      baseUrl: 'http://example.test/v21.0'
    })

    const body = await http.get<{ data: Array<{ id: string }> }>(
      '/178414/media',
      { query: { access_token: 'tok' } }
    )

    expect(body.data).toEqual([{ id: '1' }])
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'http://example.test/v21.0/178414/media?access_token=tok'
      }),
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal)
      })
    )
  })

  it('POSTs JSON and merges default headers', async () => {
    globalThis.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ data: { id: 'tweet-1' } }), {
          status: 201
        })
    )

    const http = createPlatformHttpClient({
      platform: 'X',
      baseUrl: 'http://example.test',
      defaultHeaders: { Authorization: 'Bearer tok' }
    })

    const body = await http.post<{ data: { id: string } }>('/2/tweets', {
      json: { text: 'hi' }
    })

    expect(body.data.id).toBe('tweet-1')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://example.test/2/tweets' }),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok',
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({ text: 'hi' })
      })
    )
  })

  it('throws PlatformHttpError with Graph error detail', async () => {
    globalThis.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { message: 'Rate limit exceeded', type: 'OAuthException' }
          }),
          { status: 429, statusText: 'Too Many Requests' }
        )
    )

    const http = createPlatformHttpClient({
      platform: 'Instagram',
      baseUrl: 'http://example.test/v21.0'
    })

    try {
      await http.get('/x')
      throw new Error('expected PlatformHttpError')
    } catch (error) {
      expect(error).toBeInstanceOf(PlatformHttpError)
      expect(error).toMatchObject({
        status: 429,
        detail: 'Rate limit exceeded',
        message:
          'Instagram request failed: 429 Too Many Requests — Rate limit exceeded'
      })
    }
  })

  it('throws PlatformHttpError with X errors[0].message', async () => {
    globalThis.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            errors: [{ message: 'Tweet text is too long', code: 186 }]
          }),
          { status: 400, statusText: 'Bad Request' }
        )
    )

    const http = createPlatformHttpClient({
      platform: 'X',
      baseUrl: 'http://example.test'
    })

    await expect(http.post('/2/tweets', { json: {} })).rejects.toMatchObject({
      detail: 'Tweet text is too long',
      message: 'X request failed: 400 Bad Request — Tweet text is too long'
    })
  })

  it('maps AbortSignal timeout to a clear error', async () => {
    globalThis.fetch = jest.fn(async (_input, init) => {
      const signal = init?.signal
      return await new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted due to timeout')
          err.name = 'TimeoutError'
          reject(err)
        })
      })
    })

    const http = createPlatformHttpClient({
      platform: 'X',
      baseUrl: 'http://example.test',
      timeoutMs: 20
    })

    await expect(http.get('/slow')).rejects.toThrow(/timed out after 20ms/i)
  })
})
