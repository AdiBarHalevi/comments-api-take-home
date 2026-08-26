import { buildPaginationResult } from '../../../src/lib/pagination.js'

describe('buildPaginationResult', () => {
  it('returns all items and null nextOffset when page is not full', () => {
    expect(
      buildPaginationResult({ items: ['a', 'b'], offset: 0, limit: 10 })
    ).toEqual({
      data: ['a', 'b'],
      pagination: { nextOffset: null }
    })
  })

  it('trims overflow row and sets nextOffset when more exist', () => {
    expect(
      buildPaginationResult({ items: ['a', 'b', 'c'], offset: 5, limit: 2 })
    ).toEqual({
      data: ['a', 'b'],
      pagination: { nextOffset: 7 }
    })
  })

  it('handles empty input', () => {
    expect(buildPaginationResult({ items: [], offset: 0, limit: 50 })).toEqual({
      data: [],
      pagination: { nextOffset: null }
    })
  })
})
