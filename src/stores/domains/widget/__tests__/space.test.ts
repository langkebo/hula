import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const spaceMock = vi.hoisted(() => ({
  getUserSpaces: vi.fn(),
  createSpace: vi.fn(),
  deleteSpace: vi.fn()
}))

vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: spaceMock
}))

import { useSpaceStore } from '../space'

const sp = (id: string, name = id): any => ({ spaceId: id, name })

describe('useSpaceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(spaceMock).forEach((fn) => fn.mockReset())
  })

  it('initializes empty', () => {
    const store = useSpaceStore()
    expect(store.spaces).toEqual([])
    expect(store.activeSpaceId).toBeNull()
    expect(store.activeSpace).toBeNull()
    expect(store.isLoading).toBe(false)
  })

  it('loadSpaces populates spaces and toggles isLoading', async () => {
    spaceMock.getUserSpaces.mockResolvedValue([sp('s1'), sp('s2')])
    const store = useSpaceStore()
    const promise = store.loadSpaces()
    expect(store.isLoading).toBe(true)
    await promise
    expect(store.isLoading).toBe(false)
    expect(store.spaces.map((s) => s.spaceId)).toEqual(['s1', 's2'])
  })

  it('loadSpaces resets isLoading even on failure', async () => {
    spaceMock.getUserSpaces.mockRejectedValue(new Error('boom'))
    const store = useSpaceStore()
    await expect(store.loadSpaces()).rejects.toThrow('boom')
    expect(store.isLoading).toBe(false)
  })

  it('setActiveSpace updates id and computed activeSpace', async () => {
    spaceMock.getUserSpaces.mockResolvedValue([sp('s1'), sp('s2')])
    const store = useSpaceStore()
    await store.loadSpaces()
    store.setActiveSpace('s2')
    expect(store.activeSpaceId).toBe('s2')
    expect(store.activeSpace?.spaceId).toBe('s2')
    store.setActiveSpace(null)
    expect(store.activeSpace).toBeNull()
  })

  it('replaceSpaces clones the input list', () => {
    const store = useSpaceStore()
    const input = [sp('s1')]
    store.replaceSpaces(input)
    expect(store.spaces).toEqual(input)
    expect(store.spaces).not.toBe(input)
  })

  it('createSpace pushes the created space and returns it', async () => {
    spaceMock.createSpace.mockResolvedValue(sp('s3'))
    const store = useSpaceStore()
    const created = await store.createSpace({ name: 'n' })
    expect(created?.spaceId).toBe('s3')
    expect(store.spaces.map((s) => s.spaceId)).toEqual(['s3'])
  })

  it('createSpace does not push when service returns null', async () => {
    spaceMock.createSpace.mockResolvedValue(null)
    const store = useSpaceStore()
    const created = await store.createSpace({ name: 'n' })
    expect(created).toBeNull()
    expect(store.spaces).toEqual([])
  })

  it('deleteSpace removes by id and clears active when matching', async () => {
    spaceMock.getUserSpaces.mockResolvedValue([sp('s1'), sp('s2')])
    spaceMock.deleteSpace.mockResolvedValue(undefined)
    const store = useSpaceStore()
    await store.loadSpaces()
    store.setActiveSpace('s1')
    await store.deleteSpace('s1')
    expect(store.spaces.map((s) => s.spaceId)).toEqual(['s2'])
    expect(store.activeSpaceId).toBeNull()
  })

  it('deleteSpace keeps active when removing a different space', async () => {
    spaceMock.getUserSpaces.mockResolvedValue([sp('s1'), sp('s2')])
    spaceMock.deleteSpace.mockResolvedValue(undefined)
    const store = useSpaceStore()
    await store.loadSpaces()
    store.setActiveSpace('s2')
    await store.deleteSpace('s1')
    expect(store.activeSpaceId).toBe('s2')
  })
})
