import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FileUploadProgress from '../FileUploadProgress.vue'

// 工厂中创建真实 reactive/ref 实例后挂回此容器，测试直接改 .value，
// 避免 primitive 重赋值无法触发响应式更新的陷阱。
const uploadRefs = vi.hoisted(() => ({
  queue: null as unknown as { [k: string]: unknown },
  progress: null as unknown as { value: number },
  isUploading: null as unknown as { value: boolean }
}))

vi.mock('@/composables/common/useFileUploadQueue', async () => {
  const { reactive, computed, ref } = await import('vue')
  const queue = reactive({
    isActive: false,
    endTime: undefined as number | undefined,
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    items: [] as Array<{ name: string; status: string }>,
    progress: 0,
    isUploading: false
  })
  const progress = ref(0)
  const isUploading = ref(false)
  uploadRefs.queue = queue
  uploadRefs.progress = progress
  uploadRefs.isUploading = isUploading
  return {
    globalFileUploadQueue: {
      queue,
      progress: computed(() => progress.value),
      isUploading: computed(() => isUploading.value)
    }
  }
})

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    NProgress: defineComponent({
      name: 'NProgress',
      props: ['percentage', 'showIndicator', 'height', 'borderRadius', 'color', 'railColor'],
      setup(props) {
        return () => h('div', { 'data-test': 'NProgress', 'data-percentage': String(props.percentage) })
      }
    })
  }
})

describe('rightBox/FileUploadProgress', () => {
  beforeEach(() => {
    Object.assign(uploadRefs.queue, {
      isActive: false,
      endTime: undefined,
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      items: [],
      progress: 0,
      isUploading: false
    })
    uploadRefs.progress.value = 0
    uploadRefs.isUploading.value = false
  })

  const mountComponent = () => mount(FileUploadProgress)

  it('文件数 ≤ 1 时不渲染进度条', () => {
    uploadRefs.queue.totalFiles = 1
    uploadRefs.queue.isActive = true
    const wrapper = mountComponent()
    expect(wrapper.find('.file-upload-progress').exists()).toBe(false)
  })

  it('多文件上传排队/准备阶段渲染 preparing 状态', () => {
    uploadRefs.queue.totalFiles = 3
    uploadRefs.queue.completedFiles = 1
    uploadRefs.queue.isActive = true
    uploadRefs.isUploading.value = false
    uploadRefs.progress.value = 33

    const wrapper = mountComponent()
    expect(wrapper.find('.file-upload-progress').exists()).toBe(true)
    expect(wrapper.text()).toContain('1/3')
    expect(wrapper.find('[data-test="NProgress"]').attributes('data-percentage')).toBe('33')
    expect(wrapper.text()).toContain('message.file_upload_progress.preparing')
  })

  it('上传进行中渲染 uploading 状态并携带文件名', () => {
    uploadRefs.queue.totalFiles = 3
    uploadRefs.queue.completedFiles = 1
    uploadRefs.queue.isActive = true
    uploadRefs.isUploading.value = true
    uploadRefs.queue.items = [{ name: 'photo.png', status: 'uploading' }]
    uploadRefs.progress.value = 33

    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('message.file_upload_progress.uploading_with_name')
  })

  it('上传结束且存在失败文件时显示完成（含失败数）', () => {
    uploadRefs.queue.totalFiles = 3
    uploadRefs.queue.completedFiles = 3
    uploadRefs.queue.failedFiles = 1
    uploadRefs.queue.endTime = Date.now()
    uploadRefs.isUploading.value = false

    const wrapper = mountComponent()
    expect(wrapper.find('.file-upload-progress.is-completed').exists()).toBe(true)
    expect(wrapper.text()).toContain('message.file_upload_progress.completed_failed')
  })

  it('上传结束且无失败文件时显示普通完成状态', () => {
    uploadRefs.queue.totalFiles = 2
    uploadRefs.queue.completedFiles = 2
    uploadRefs.queue.failedFiles = 0
    uploadRefs.queue.endTime = Date.now()
    uploadRefs.isUploading.value = false

    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('message.file_upload_progress.completed')
  })
})
