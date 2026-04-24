import { describe, expect, it } from 'vitest'
import {
  getDefaultMatrixEndpointConfig,
  isValidHttpUrl,
  MATRIX_HOMESERVER_STORAGE_KEY,
  normalizeHttpUrl,
  resolveMatrixEndpointConfig,
  saveMatrixHomeserverUrl
} from '../config'
import type { StorageLike } from '../types'

function createStorage(initialState: Record<string, string> = {}): StorageLike {
  const state = new Map(Object.entries(initialState))

  return {
    getItem(key) {
      return state.get(key) ?? null
    },
    setItem(key, value) {
      state.set(key, value)
    },
    removeItem(key) {
      state.delete(key)
    }
  }
}

describe('backend config', () => {
  it('normalizes bare hosts into http urls', () => {
    expect(normalizeHttpUrl('matrix.example.com')).toBe('http://matrix.example.com')
    expect(normalizeHttpUrl(' https://matrix.example.com ')).toBe('https://matrix.example.com')
  })

  it('validates only http and https urls', () => {
    expect(isValidHttpUrl('https://matrix.example.com')).toBe(true)
    expect(isValidHttpUrl('http://localhost:8008')).toBe(true)
    expect(isValidHttpUrl('ftp://matrix.example.com')).toBe(false)
    expect(isValidHttpUrl('not-a-url')).toBe(false)
  })

  it('falls back to defaults when storage is empty', () => {
    const storage = createStorage()

    expect(resolveMatrixEndpointConfig(storage)).toEqual(getDefaultMatrixEndpointConfig())
  })

  it('prefers stored homeserver over env defaults', () => {
    const storage = createStorage({
      [MATRIX_HOMESERVER_STORAGE_KEY]: 'https://matrix.internal'
    })

    expect(resolveMatrixEndpointConfig(storage).homeserverUrl).toBe('https://matrix.internal')
  })

  it('persists normalized homeserver urls through the shared helper', () => {
    const storage = createStorage()

    const savedUrl = saveMatrixHomeserverUrl('matrix.internal', storage)

    expect(savedUrl).toBe('http://matrix.internal')
    expect(storage.getItem(MATRIX_HOMESERVER_STORAGE_KEY)).toBe('http://matrix.internal')
  })
})
