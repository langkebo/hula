import { describe, expect, it } from 'vitest'
import { createManualChunks } from '~/build/config/chunks'

describe('createManualChunks', () => {
  const chunker = createManualChunks([])

  it('link 版 matrix-js-sdk 源码路径归入 matrix-sdk chunk', () => {
    expect(chunker('/Users/ci/work/matrix-js-sdk/src/client.ts')).toBe('matrix-sdk')
    expect(chunker('/Users/ci/work/matrix-js-sdk/src/http-api/index.ts')).toBe('matrix-sdk')
  })

  it('npm 安装形态仍然命中', () => {
    expect(chunker('/repo/node_modules/matrix-js-sdk/lib/index.js')).toBe('matrix-sdk')
  })

  it('本项目 src 路径不受影响', () => {
    expect(chunker('/Users/ci/work/hula/src/services/matrix/MatrixClientService.ts')).toBeUndefined()
  })
})
