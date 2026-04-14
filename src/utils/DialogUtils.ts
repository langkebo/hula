import { createDiscreteApi } from 'naive-ui'

const { dialog } = createDiscreteApi(['dialog'])

export async function showConfirmDialog(options: {
  title?: string
  content: string
  confirmText?: string
  cancelText?: string
}): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.warning({
      title: options.title || '确认',
      content: options.content,
      positiveText: options.confirmText || '确认',
      negativeText: options.cancelText || '取消',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false)
    })
  })
}

export async function showAlertDialog(options: {
  title?: string
  content: string
  confirmText?: string
}): Promise<void> {
  return new Promise((resolve) => {
    dialog.info({
      title: options.title || '提示',
      content: options.content,
      positiveText: options.confirmText || '确定',
      onPositiveClick: () => resolve(),
      onClose: () => resolve()
    })
  })
}
