import { build } from '../helper.js'

describe('health check route', () => {
  it('returns { status: "ok" }', async () => {
    const app = await build()

    const res = await app.inject({ url: '/' })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload)).toEqual({ status: 'ok' })
    await app.close()
  })
})
