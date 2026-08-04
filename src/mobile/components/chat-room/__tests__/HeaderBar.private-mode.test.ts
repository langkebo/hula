import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('HeaderBar private-mode', () => {
  it('HeaderBar.vue has privateModeActive prop and togglePrivateMode emit', () => {
    const src = readFileSync(resolve(__dirname, '../HeaderBar.vue'), 'utf-8')
    expect(src).toContain('privateModeActive')
    expect(src).toContain('togglePrivateMode')
    expect(src).toContain('private-toggle-btn-mobile')
  })

  it('MobileChatMain.vue syncs private mode via mitt', () => {
    const src = readFileSync(resolve(__dirname, '../../../views/chat-room/MobileChatMain.vue'), 'utf-8')
    expect(src).toContain('PRIVATE_MODE_CHANGED')
    expect(src).toContain('PRIVATE_MODE_TOGGLE_REQUEST')
  })
})
