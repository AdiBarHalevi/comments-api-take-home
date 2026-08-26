import { buildPaginationResult } from '../../../src/lib/pagination.js'

describe('buildPaginationResult', () => {
  it('returns all items and null nextOffset when page is not full', () => {
    expect(buildPaginationResult(['a', 'b'], 0, 10)).toEqual({
      data: ['a', 'b'],
      pagination: { nextOffset: null }
    })
  })

  it('trims overflow row and sets nextOffset when more exist', () => {
    expect(buildPaginationResult(['a', 'b', 'c'], 5, 2)).toEqual({
      data: ['a', 'b'],
      pagination: { nextOffset: 7 }
    })
  })

  it('handles empty input', () => {
    expect(buildPaginationResult([], 0, 50)).toEqual({
      data: [],
      pagination: { nextOffset: null }
    })
  })
})
