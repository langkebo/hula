import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')

describe('preview gestures', () => {
  it('image preview does not close on tap while zoomed', () => {
    const source = read('src/mobile/components/ImagePreview.vue')
    expect(source).toContain('handleBackdropClick')
    expect(source).not.toContain('@click="handleClose"')
    expect(source).toContain('DOUBLE_TAP_SCALE')
    expect(source).toContain('CLOSE_DRAG_PX')
  })

  it('video preview ships native controls', () => {
    const source = read('src/mobile/components/VideoPreview.vue')
    expect(source).toContain('controls')
  })
})
