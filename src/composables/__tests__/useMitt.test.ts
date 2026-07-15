import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMitt } from '@/composables/common/useMitt'

describe('useMitt', () => {
  afterEach(() => {
    // Clear handlers between tests by emitting an unrelated event isn't enough;
    // we explicitly remove handlers via off
  })

  it('emits an event to a registered handler', () => {
    const handler = vi.fn()
    useMitt.on('test:event', handler)
    useMitt.emit('test:event', { value: 1 })
    expect(handler).toHaveBeenCalledWith({ value: 1 })
    useMitt.off('test:event', handler)
  })

  it('supports multiple handlers per event', () => {
    const a = vi.fn()
    const b = vi.fn()
    useMitt.on('multi:event', a)
    useMitt.on('multi:event', b)
    useMitt.emit('multi:event', 'payload')
    expect(a).toHaveBeenCalledWith('payload')
    expect(b).toHaveBeenCalledWith('payload')
    useMitt.off('multi:event', a)
    useMitt.off('multi:event', b)
  })

  it('off prevents subsequent emits from invoking the handler', () => {
    const handler = vi.fn()
    useMitt.on('off:event', handler)
    useMitt.off('off:event', handler)
    useMitt.emit('off:event', 'ignored')
    expect(handler).not.toHaveBeenCalled()
  })

  it('emit without payload still triggers handlers', () => {
    const handler = vi.fn()
    useMitt.on('void:event', handler)
    useMitt.emit('void:event')
    expect(handler).toHaveBeenCalledTimes(1)
    useMitt.off('void:event', handler)
  })

  it('different event names are isolated', () => {
    const a = vi.fn()
    const b = vi.fn()
    useMitt.on('a:event', a)
    useMitt.on('b:event', b)
    useMitt.emit('a:event', 1)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
    useMitt.off('a:event', a)
    useMitt.off('b:event', b)
  })
})
