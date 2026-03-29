import { createSharedComposable } from '@vueuse/core'
import { ref, readonly } from 'vue'

const useSharedFileSystemPermission = createSharedComposable(() => {
  const isSupported = ref(false)
  const isReadSupported = ref(false)
  const isWriteSupported = ref(false)

  async function checkSupport() {
    if (typeof window === 'undefined') {
      isSupported.value = false
      isReadSupported.value = false
      isWriteSupported.value = false
      return
    }

    const win = window as any

    if ('showOpenFilePicker' in win) {
      isReadSupported.value = true
    }

    if ('showSaveFilePicker' in win) {
      isWriteSupported.value = true
    }

    if ('showDirectoryPicker' in win) {
      isSupported.value = true
    }

    isSupported.value = isReadSupported.value || isWriteSupported.value
  }

  async function openFilePicker(options?: {
    multiple?: boolean
    types?: { description: string; accept: Record<string, string[]> }[]
  }): Promise<File[] | null> {
    if (!isReadSupported.value) {
      console.warn('[FileSystemPermission] 文件读取不支持')
      return null
    }

    try {
      const win = window as any
      const handles = await win.showOpenFilePicker({
        multiple: options?.multiple ?? true,
        types: options?.types ?? [
          {
            description: '所有文件',
            accept: { '*/*': [] }
          }
        ]
      })
      const files: File[] = []
      for (const handle of handles) {
        const file = await handle.getFile()
        files.push(file)
      }
      return files
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[FileSystemPermission] 打开文件失败:', err)
      }
      return null
    }
  }

  async function saveFilePicker(options?: {
    suggestedName?: string
    types?: { description: string; accept: Record<string, string[]> }[]
  }): Promise<FileSystemFileHandle | null> {
    if (!isWriteSupported.value) {
      console.warn('[FileSystemPermission] 文件写入不支持')
      return null
    }

    try {
      const win = window as any
      const handle = await win.showSaveFilePicker({
        suggestedName: options?.suggestedName,
        types: options?.types ?? [
          {
            description: '所有文件',
            accept: { '*/*': [] }
          }
        ]
      })
      return handle
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[FileSystemPermission] 保存文件失败:', err)
      }
      return null
    }
  }

  async function openDirectoryPicker(): Promise<FileSystemDirectoryHandle | null> {
    if (!isSupported.value) {
      console.warn('[FileSystemPermission] 目录选择不支持')
      return null
    }

    try {
      const win = window as any
      const handle = await win.showDirectoryPicker()
      return handle
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[FileSystemPermission] 打开目录失败:', err)
      }
      return null
    }
  }

  async function writeFile(handle: FileSystemFileHandle, content: string | Blob): Promise<boolean> {
    try {
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return true
    } catch (err) {
      console.warn('[FileSystemPermission] 写入文件失败:', err)
      return false
    }
  }

  checkSupport()

  return {
    isSupported: readonly(isSupported),
    isReadSupported: readonly(isReadSupported),
    isWriteSupported: readonly(isWriteSupported),
    checkSupport,
    openFilePicker,
    saveFilePicker,
    openDirectoryPicker,
    writeFile
  }
})

export function useFileSystemPermission() {
  return useSharedFileSystemPermission()
}

export default useFileSystemPermission
