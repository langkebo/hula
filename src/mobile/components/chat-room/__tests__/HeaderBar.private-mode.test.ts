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

  it('MobileChatMain.vue syncs private mode via mitt with confirmed payload', () => {
    const src = readFileSync(resolve(__dirname, '../../../views/chat-room/MobileChatMain.vue'), 'utf-8')
    expect(src).toContain('PRIVATE_MODE_CHANGED')
    expect(src).toContain('PRIVATE_MODE_TOGGLE_REQUEST')
    // 移动端拦截 S 按钮：未激活时显示本地 van-dialog，已激活时直接 emit 退出
    expect(src).toContain('showPrivateConfirm')
    expect(src).toContain('onConfirmPrivateMode')
    expect(src).toContain('onCancelPrivateMode')
    // payload 携带 confirmed 字段，由 ChatMain 决定 confirmPrivateMode / togglePrivateMode
    expect(src).toContain('{ confirmed: true }')
    expect(src).toContain('{ confirmed: false }')
    // 引入并使用 PrivateModeConfirmDialog（van-dialog）
    expect(src).toContain('PrivateModeConfirmDialog')
  })

  it('ChatMain.vue routes PRIVATE_MODE_TOGGLE_REQUEST by confirmed payload', () => {
    const src = readFileSync(resolve(__dirname, '../../../../components/rightBox/chatBox/ChatMain.vue'), 'utf-8')
    expect(src).toContain('onPrivateModeToggleRequest')
    expect(src).toContain('payload?.confirmed')
    expect(src).toContain('confirmPrivateMode')
    expect(src).toContain('togglePrivateMode')
  })

  it('PrivateModeConfirmDialog.vue is a pure UI component that only emits events', () => {
    const src = readFileSync(resolve(__dirname, '../PrivateModeConfirmDialog.vue'), 'utf-8')
    expect(src).toContain('van-dialog')
    expect(src).toContain('emit(')
    // 不应直接调用 confirmPrivateMode / cancelPrivateMode（状态由父组件通过 mitt 协调）
    expect(src).not.toContain('confirmPrivateMode()')
    expect(src).not.toContain('cancelPrivateMode()')
  })
})
