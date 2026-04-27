/**
 * Editor paste / file processing helpers split out of `useCommon`.
 *
 * Owns the chain `handlePaste` → `processFiles` → (`imgPaste` | showFileModal),
 * plus `FileOrVideoPaste` / `handleConfirmFiles` and the underlying
 * `saveCacheFile` cache writer. DOM-mutation primitives (`triggerInputEvent`,
 * `insertNode`) and the current `userUid` are injected so this hook stays
 * decoupled from the wider `useCommon` returns.
 */
import { BaseDirectory, create, exists, mkdir, readFile } from '@tauri-apps/plugin-fs'
import type { Ref } from 'vue'
import { LimitEnum, MsgEnum } from '@/enums'
import { isPathUploadFile, type UploadFile } from '@/utils/FileType'
import { SUPPORTED_IMAGE_EXTENSIONS, getFileExtension } from '@/utils/FileType'
import { isMobile } from '@/utils/PlatformConstants'
import { getImageCache } from '@/utils/PathUtil.ts'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Common:EditorPaste')

type AitMentionData = { name?: string; text?: string; label?: string; uid?: string }
type ReplyData = { accountName: string; content: string; avatar: string; name?: string }
type InsertNodeData = AitMentionData | ReplyData | string

export type UseEditorPasteOptions = {
  userUid: Ref<string | undefined>
  triggerInputEvent: (element: HTMLElement) => void
  insertNode: (type: MsgEnum, dom: InsertNodeData, target: HTMLElement) => void
  /** Optional toast surface; defaults to `window.$message`. */
  notify?: {
    warning: (msg: string) => void
    error?: (msg: string) => void
  }
}

const defaultNotify = () => (window as any).$message

const insertImgAtRange = (img: HTMLImageElement, dom: HTMLElement) => {
  const lastEditRange = (dom as { getLastEditRange?: () => Range | null }).getLastEditRange?.()
  dom.focus()

  let range: Range
  if (!lastEditRange) {
    range = document.createRange()
    range.selectNodeContents(dom)
    range.collapse(false)
  } else {
    range = lastEditRange
  }

  const selection = window.getSelection()
  if (!selection) return
  range.deleteContents()
  range.insertNode(img)
  range.setStartAfter(img)
  range.setEndAfter(img)
  selection.removeAllRanges()
  selection.addRange(range)
}

const buildPreviewImg = () => {
  const img = document.createElement('img')
  img.style.maxHeight = '88px'
  img.style.maxWidth = '140px'
  img.style.marginRight = '6px'
  return img
}

export const useEditorPaste = (options: UseEditorPasteOptions) => {
  const { userUid, triggerInputEvent, insertNode } = options

  const saveCacheFile = async (file: File, subFolder: string): Promise<string> => {
    const fileName = file.name ?? 'test.png'
    const tempPath = getImageCache(subFolder, userUid.value!)
    const fullPath = `${tempPath}${fileName}`
    logger.debug(`cache file start: ${fullPath}, size: ${file.size} bytes`)

    return new Promise((resolve, reject) => {
      const cacheReader = new FileReader()
      cacheReader.onload = async (e: Event) => {
        try {
          const target = e.target as FileReader | null
          if (!target) {
            reject(new Error('FileReader failed'))
            return
          }
          const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
          const isExists = await exists(tempPath, { baseDir })
          if (!isExists) {
            await mkdir(tempPath, { baseDir, recursive: true })
          }
          const tempFile = await create(fullPath, { baseDir })
          await tempFile.write(new Uint8Array(target.result as ArrayBuffer))
          await tempFile.close()
          logger.debug(`cache file saved: ${fullPath}, written: ${(target.result as ArrayBuffer).byteLength} bytes`)
          resolve(fullPath)
        } catch (error) {
          reject(error)
        }
      }
      cacheReader.onerror = (error) => reject(error)
      cacheReader.readAsArrayBuffer(file)
    })
  }

  const imgPaste = async (file: File | string, dom: HTMLElement) => {
    const fileStr = file as string
    if (typeof file === 'string' && fileStr.startsWith('blob:')) {
      const url = fileStr.replace('blob:', '')
      logger.debug('blob URL:', url)
      const img = buildPreviewImg()
      img.src = url
      insertImgAtRange(img, dom)
      triggerInputEvent(dom)
      return
    }

    const cachePath = await saveCacheFile(file as File, 'img')
    const reader = new FileReader()
    reader.onload = (e: Event) => {
      const target = e.target as FileReader | null
      if (!target) return
      const img = buildPreviewImg()
      img.src = target.result as string
      img.id = 'temp-image'
      img.setAttribute('data-path', cachePath)
      insertImgAtRange(img, dom)
      triggerInputEvent(dom)
    }
    reader.readAsDataURL(file as File)
  }

  const FileOrVideoPaste = async (file: File) => {
    const notify = options.notify ?? defaultNotify()
    if (file.size > 1024 * 1024 * 50) {
      notify?.warning?.('文件大小不能超过50M，请重新选择')
      return
    }
    await saveCacheFile(file, 'video')
    new FileReader().readAsDataURL(file)
  }

  const handleConfirmFiles = async (files: File[]) => {
    for (const file of files) {
      await FileOrVideoPaste(file)
    }
  }

  const processFiles = async (
    files: UploadFile[],
    dom: HTMLElement,
    showFileModal?: (files: UploadFile[]) => void,
    resetCallback?: () => void
  ) => {
    if (!files) return
    const notify = options.notify ?? defaultNotify()

    if (files.length > LimitEnum.COM_COUNT) {
      notify?.warning?.(`一次性只能上传${LimitEnum.COM_COUNT}个文件或图片`)
      return
    }

    const imageFiles: UploadFile[] = []
    const otherFiles: UploadFile[] = []

    for (const file of files) {
      const fileSizeInMB = file.size / 1024 / 1024
      if (fileSizeInMB > 500) {
        notify?.warning?.(`文件 ${file.name} 超过500MB`)
        continue
      }
      const mimeType = file.type || ''
      const extension = getFileExtension(file.name)
      const isImage =
        (mimeType.startsWith('image/') || (SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(extension)) &&
        extension !== 'svg' &&
        !mimeType.includes('svg')

      if (isImage) imageFiles.push(file)
      else otherFiles.push(file)
    }

    for (const file of imageFiles) {
      if (isPathUploadFile(file)) {
        const fileData = await readFile(file.path)
        const fileObj = new File([fileData], file.name, { type: file.type })
        await imgPaste(fileObj, dom)
      } else {
        await imgPaste(file, dom)
      }
    }

    if (otherFiles.length > 0 && showFileModal) {
      showFileModal(otherFiles)
    }
    resetCallback?.()
  }

  const handlePaste = async (e: ClipboardEvent, dom: HTMLElement, showFileModal?: (files: UploadFile[]) => void) => {
    e.preventDefault()
    const clipboardData = e.clipboardData
    if (!clipboardData) return
    if (clipboardData.files.length > 0) {
      await processFiles(Array.from(clipboardData.files), dom, showFileModal)
    } else {
      const plainText = clipboardData.getData('text/plain')
      insertNode(MsgEnum.TEXT, plainText, dom)
      triggerInputEvent(dom)
    }
  }

  return {
    saveCacheFile,
    imgPaste,
    FileOrVideoPaste,
    handleConfirmFiles,
    processFiles,
    handlePaste
  }
}
