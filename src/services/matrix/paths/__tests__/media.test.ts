import { describe, expect, it } from 'vitest'
import { MEDIA } from '../media'

describe('MEDIA', () => {
  it('MatrixUrlPreviewService 移除后不再包含路径常量', () => {
    expect(Object.keys(MEDIA)).toEqual([])
  })
})
