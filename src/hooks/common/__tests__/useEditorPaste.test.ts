import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const { existsMock, mkdirMock, createMock, readFileMock, writeMock, closeMock, getImageCacheMock, isMobileMock } =
  vi.hoisted(() => ({
    existsMock: vi.fn(async () => true),
    mkdirMock: vi.fn(async () => undefined),
    writeMock: vi.fn(async () => undefined),
    closeMock: vi.fn(async () => undefined),
    createMock: vi.fn(),
    readFileMock: vi.fn(async () => new Uint8Array([1, 2, 3])),
    getImageCacheMock: vi.fn((sub: string, _uid: string) => `/cache/${sub}/`),
    isMobileMock: vi.fn(() => false)
  }))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppCache: 'AppCache', AppData: 'AppData' },
  exists: existsMock,
  mkdir: mkdirMock,
  create: createMock,
  readFile: readFileMock
}))

vi.mock('@/utils/PathUtil.ts', () => ({ getImageCache: getImageCacheMock }))
vi.mock('@/utils/PlatformConstants', () => ({ isMobile: isMobileMock }))

import { useEditorPaste } from '../useEditorPaste'

const setup = () => {
  const userUid = ref<string | undefined>('user-1')
  const triggerInputEvent = vi.fn()
  const insertNode = vi.fn()
  const notify = { warning: vi.fn(), error: vi.fn() }
  const hook = useEditorPaste({ userUid, triggerInputEvent, insertNode, notify })
  const dom = document.createElement('div')
  return { hook, triggerInputEvent, insertNode, notify, dom }
}

const makeFile = (name = 'a.png', size = 100, type = 'image/png'): File => {
  const blob = new Blob([new Uint8Array(size)], { type })
  const file = new File([blob], name, { type })
  return file
}

beforeEach(() => {
  existsMock.mockReset().mockResolvedValue(true)
  mkdirMock.mockReset().mockResolvedValue(undefined)
  writeMock.mockReset().mockResolvedValue(undefined)
  closeMock.mockReset().mockResolvedValue(undefined)
  createMock.mockReset().mockResolvedValue({ write: writeMock, close: closeMock })
  readFileMock.mockReset().mockResolvedValue(new Uint8Array([1, 2, 3]))
  getImageCacheMock.mockClear()
  isMobileMock.mockReset().mockReturnValue(false)
})

describe('useEditorPaste — saveCacheFile', () => {
  it('writes the file to AppCache on desktop and returns full path', async () => {
    const { hook } = setup()
    const file = makeFile('hi.png')
    // FileReader in jsdom is synchronous-ish; emulate readAsArrayBuffer
    const promise = hook.saveCacheFile(file, 'img')
    await new Promise((r) => setTimeout(r, 10))
    const fullPath = await promise
    expect(fullPath).toBe('/cache/img/hi.png')
    expect(getImageCacheMock).toHaveBeenCalledWith('img', 'user-1')
    expect(createMock).toHaveBeenCalledWith('/cache/img/hi.png', { baseDir: 'AppCache' })
    expect(writeMock).toHaveBeenCalled()
    expect(closeMock).toHaveBeenCalled()
  })

  it('uses AppData as baseDir on mobile', async () => {
    isMobileMock.mockReturnValue(true)
    const { hook } = setup()
    await hook.saveCacheFile(makeFile(), 'img')
    expect(existsMock).toHaveBeenCalledWith('/cache/img/', { baseDir: 'AppData' })
  })

  it('mkdir is invoked when target directory does not exist', async () => {
    existsMock.mockResolvedValueOnce(false)
    const { hook } = setup()
    await hook.saveCacheFile(makeFile(), 'img')
    expect(mkdirMock).toHaveBeenCalledWith('/cache/img/', { baseDir: 'AppCache', recursive: true })
  })
})

describe('useEditorPaste — FileOrVideoPaste', () => {
  it('rejects files larger than 50MB with a warning', async () => {
    const { hook, notify } = setup()
    const big = makeFile('big.mp4', 51 * 1024 * 1024, 'video/mp4')
    await hook.FileOrVideoPaste(big)
    expect(notify.warning).toHaveBeenCalledWith('文件大小不能超过50M，请重新选择')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('saves smaller files to the video cache subfolder', async () => {
    const { hook } = setup()
    await hook.FileOrVideoPaste(makeFile('clip.mp4', 1024, 'video/mp4'))
    expect(getImageCacheMock).toHaveBeenCalledWith('video', 'user-1')
  })
})

describe('useEditorPaste — handleConfirmFiles', () => {
  it('runs FileOrVideoPaste sequentially for each file', async () => {
    const { hook } = setup()
    await hook.handleConfirmFiles([makeFile('a.mp4', 100), makeFile('b.mp4', 100)])
    expect(getImageCacheMock).toHaveBeenCalledTimes(2)
  })
})

describe('useEditorPaste — processFiles', () => {
  it('warns and aborts when file count exceeds COM_COUNT', async () => {
    const { hook, notify } = setup()
    const files = Array.from({ length: 20 }, (_, i) => makeFile(`f${i}.png`, 100))
    await hook.processFiles(files as any, document.createElement('div'))
    expect(notify.warning).toHaveBeenCalledWith(expect.stringContaining('一次性只能上传'))
    expect(getImageCacheMock).not.toHaveBeenCalled()
  })

  it('warns per oversized file (>500MB) and continues with the rest', async () => {
    const { hook, notify } = setup()
    const tooBig = makeFile('big.png', 600 * 1024 * 1024, 'image/png')
    const ok = makeFile('ok.png', 100, 'image/png')
    await hook.processFiles([tooBig, ok] as any, document.createElement('div'))
    expect(notify.warning).toHaveBeenCalledWith('文件 big.png 超过500MB')
  })

  it('routes non-image files to showFileModal', async () => {
    const { hook } = setup()
    const showFileModal = vi.fn()
    const pdf = makeFile('doc.pdf', 100, 'application/pdf')
    await hook.processFiles([pdf] as any, document.createElement('div'), showFileModal)
    expect(showFileModal).toHaveBeenCalledWith([pdf])
  })

  it('invokes resetCallback after processing', async () => {
    const { hook } = setup()
    const resetCallback = vi.fn()
    await hook.processFiles(
      [makeFile('x.pdf', 1, 'application/pdf')] as any,
      document.createElement('div'),
      undefined,
      resetCallback
    )
    expect(resetCallback).toHaveBeenCalled()
  })

  it('returns early when files is falsy', async () => {
    const { hook, notify } = setup()
    await hook.processFiles(undefined as any, document.createElement('div'))
    expect(notify.warning).not.toHaveBeenCalled()
  })
})

describe('useEditorPaste — handlePaste', () => {
  it('inserts plaintext via insertNode when clipboard has no files', async () => {
    const { hook, insertNode, triggerInputEvent } = setup()
    const event = {
      preventDefault: vi.fn(),
      clipboardData: {
        files: [],
        getData: vi.fn(() => 'hello')
      }
    } as unknown as ClipboardEvent
    const dom = document.createElement('div')
    await hook.handlePaste(event, dom)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(insertNode).toHaveBeenCalledWith(1 /* MsgEnum.TEXT */, 'hello', dom)
    expect(triggerInputEvent).toHaveBeenCalledWith(dom)
  })

  it('does nothing when clipboardData is null', async () => {
    const { hook, insertNode, triggerInputEvent } = setup()
    const event = { preventDefault: vi.fn(), clipboardData: null } as unknown as ClipboardEvent
    await hook.handlePaste(event, document.createElement('div'))
    expect(insertNode).not.toHaveBeenCalled()
    expect(triggerInputEvent).not.toHaveBeenCalled()
  })
})
