import { describe, expect, it, vi } from 'vitest'
import { useAction } from '../useAction'

describe('useAction', () => {
  it('sets loading=true during execution and false after', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const { loading, execute } = useAction(fn)

    const promise = execute()
    expect(loading.value).toBe(true)
    await promise
    expect(loading.value).toBe(false)
  })

  it('returns the result on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const { execute } = useAction(fn)

    const result = await execute()
    expect(result).toBe('ok')
  })

  it('sets error on failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'))
    const { error, execute } = useAction(fn)

    const result = await execute()
    expect(result).toBeUndefined()
    expect(error.value).toBe('boom')
  })

  it('calls onSuccess callback', async () => {
    const onSuccess = vi.fn()
    const fn = vi.fn().mockResolvedValue('ok')
    const { execute } = useAction(fn, { onSuccess })

    await execute()
    expect(onSuccess).toHaveBeenCalledWith('ok')
  })

  it('calls onError callback', async () => {
    const onError = vi.fn()
    const err = new Error('boom')
    const fn = vi.fn().mockRejectedValue(err)
    const { execute } = useAction(fn, { onError })

    await execute()
    expect(onError).toHaveBeenCalledWith(err)
  })

  it('uses custom errorMessage', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('raw'))
    const { error, execute } = useAction(fn, { errorMessage: 'custom' })

    await execute()
    expect(error.value).toBe('custom')
  })

  it('clears error on retry', async () => {
    let call = 0
    const fn = vi.fn().mockImplementation(() => {
      call++
      return call === 1 ? Promise.reject(new Error('fail')) : Promise.resolve('ok')
    })
    const { error, execute } = useAction(fn)

    await execute()
    expect(error.value).toBe('fail')

    const result = await execute()
    expect(result).toBe('ok')
    expect(error.value).toBeNull()
  })

  it('passes arguments through to the wrapped function', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const { execute } = useAction(fn)

    await execute('a', 1, { x: true })
    expect(fn).toHaveBeenCalledWith('a', 1, { x: true })
  })
})
