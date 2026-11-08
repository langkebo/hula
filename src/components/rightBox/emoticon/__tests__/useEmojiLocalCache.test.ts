import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { useEmojiStore } from '@/stores/domains/chat/emoji'
import { useUserStore } from '@/stores/domains/user/user'
import { useEmojiLocalCache } from '../useEmojiLocalCache'

const {
  convertFileSrcMock,
  joinMock,
  existsMock,
  writeFileMock,
  md5Mock,
  downloadBytesMock,
  loggerErrorMock,
  emojiStoreMock,
  userStoreMock,
  existingPaths,
  WorkerStub
} = vi.hoisted(() => {
  const hashes: Record<string, string> = {
    'https://cdn.test/a.png': 'hash-a',
    'https://cdn.test/b.png': 'hash-b'
  }
  const existingPaths = new Set<string>()

  class WorkerStub {
    static instances: WorkerStub[] = []
    private listeners = new Map<string, Set<(event: Event) => void>>()

    constructor() {
      WorkerStub.instances.push(this)
    }

    addEventListener(type: string, listener: (event: Event) => void) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type)?.add(listener)
    }

    removeEventListener(type: string, listener: (event: Event) => void) {
      this.listeners.get(type)?.delete(listener)
    }

    postMessage(message: { url: string }) {
      const event = new MessageEvent('message', {
        data: { url: message.url, success: true, buffer: new ArrayBuffer(8) }
      })
      this.listeners.get('message')?.forEach((listener) => listener(event))
    }

    terminate() {}
  }

  return {
    convertFileSrcMock: vi.fn((path: string) => `local://${path}`),
    joinMock: vi.fn(async (...parts: string[]) => parts.join('/')),
    existsMock: vi.fn(async (path: string) => existingPaths.has(path)),
    writeFileMock: vi.fn(async () => undefined),
    md5Mock: vi.fn(async (url: string) => hashes[url] ?? 'hash-unknown'),
    downloadBytesMock: vi.fn(async () => new ArrayBuffer(8)),
    loggerErrorMock: vi.fn(),
    emojiStoreMock: { emojiList: [] as Array<{ id: string; expressionUrl: string }>, setLocalUrl: vi.fn() },
    userStoreMock: { userInfo: { uid: 'u1' } as { uid: string } | null },
    existingPaths,
    WorkerStub
  }
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: convertFileSrcMock
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: joinMock
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: existsMock,
  writeFile: writeFileMock
}))

vi.mock('@/utils/HttpClient', () => ({
  HttpClient: { downloadBytes: downloadBytesMock }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: loggerErrorMock, warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}))

vi.mock('@/utils/Md5Util', () => ({
  md5FromString: md5Mock
}))

vi.mock('@/utils/PathUtil', () => ({
  detectRemoteFileType: vi.fn(async () => ({ ext: 'png' })),
  getDownloadBaseDir: () => 1,
  getDownloadBaseDirPath: async () => '/base',
  getUserEmojiDir: async () => 'emoji'
}))

vi.mock('@/stores/domains/chat/emoji', () => ({
  useEmojiStore: () => emojiStoreMock
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => userStoreMock
}))

const setup = (items: Array<{ id: string; expressionUrl: string }>) => {
  emojiStoreMock.emojiList = items
  return useEmojiLocalCache({
    isFavoritesView: computed(() => true),
    emojiStore: useEmojiStore(),
    userStore: useUserStore()
  })
}

describe('useEmojiLocalCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    existingPaths.clear()
    WorkerStub.instances = []
    vi.stubGlobal('Worker', WorkerStub)
  })

  it('本地文件存在时直接写入映射，不触发下载', async () => {
    existingPaths.add('emoji/hash-a.png')
    existingPaths.add('emoji/hash-b.png')
    const cache = setup([
      { id: 'a', expressionUrl: 'https://cdn.test/a.png' },
      { id: 'b', expressionUrl: 'https://cdn.test/b.png' }
    ])

    await cache.hydrateEmojiLocalCache()

    expect(cache.emojiLocalPathMap.value).toEqual({
      a: 'local:///base/emoji/hash-a.png',
      b: 'local:///base/emoji/hash-b.png'
    })
    expect(emojiStoreMock.setLocalUrl).toHaveBeenCalledTimes(2)
    expect(downloadBytesMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('本地文件缺失时下载并落盘后写入映射', async () => {
    existingPaths.add('emoji/hash-a.png')
    const cache = setup([
      { id: 'a', expressionUrl: 'https://cdn.test/a.png' },
      { id: 'b', expressionUrl: 'https://cdn.test/b.png' }
    ])

    await cache.hydrateEmojiLocalCache()

    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock).toHaveBeenCalledWith('emoji/hash-b.png', expect.any(Uint8Array), { baseDir: 1 })
    expect(cache.emojiLocalPathMap.value.b).toBe('local:///base/emoji/hash-b.png')
  })

  it('多条目共用同一地址时只下载一次', async () => {
    const cache = setup([
      { id: 'a1', expressionUrl: 'https://cdn.test/b.png' },
      { id: 'a2', expressionUrl: 'https://cdn.test/b.png' }
    ])

    await cache.hydrateEmojiLocalCache()

    expect(downloadBytesMock).not.toHaveBeenCalled()
    expect(writeFileMock).toHaveBeenCalledTimes(1)
  })
})
