import { build } from '../helper.js'

describe('default root route', () => {
  it('returns { root: true }', async () => {
    const app = await build()

    const res = await app.inject({ url: '/' })

    expect(JSON.parse(res.payload)).toEqual({ root: true })
    await app.close()
  })
})
