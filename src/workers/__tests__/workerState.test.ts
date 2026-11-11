import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendResponse } from '../workerState'

/**
 * worker ↔ 主线程的响应信封契约：主线程按 `{ type, id }` 匹配 pending Promise，
 * 缺字段或改形状会让请求永久悬挂。
 */
describe('sendResponse', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const stubSelf = () => {
    const postMessage = vi.fn()
    vi.stubGlobal('self', { postMessage })
    return postMessage
  }

  it('posts a success envelope preserving type/id/data', async () => {
    const postMessage = stubSelf()

    await sendResponse('getServerVersions', 'req-1', true, { unstable_features: {} })

    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage).toHaveBeenCalledWith({
      type: 'getServerVersions',
      id: 'req-1',
      success: true,
      data: { unstable_features: {} },
      error: undefined
    })
  })

  it('posts a failure envelope carrying the error message', async () => {
    const postMessage = stubSelf()

    await sendResponse('probeCors', 'req-2', false, undefined, 'network error')

    expect(postMessage).toHaveBeenCalledWith({
      type: 'probeCors',
      id: 'req-2',
      success: false,
      data: undefined,
      error: 'network error'
    })
  })

  it('keeps the envelope shape even without data or error', async () => {
    const postMessage = stubSelf()

    await sendResponse('ping', 'req-3', true)

    expect(postMessage).toHaveBeenCalledWith({
      type: 'ping',
      id: 'req-3',
      success: true,
      data: undefined,
      error: undefined
    })
  })
})
