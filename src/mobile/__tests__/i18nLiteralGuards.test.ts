import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

/** 与 check-ratchet 的 zh_literal_vue 同口径：注释里的中文不计入 */
function readWithoutComments(path: string) {
  return readFileSync(resolve(root, path), 'utf-8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

function chineseSegments(source: string) {
  return source.match(/[\u4e00-\u9fff]+/g) ?? []
}

describe('移动端用户可见页面中文字面量收口', () => {
  it.each(['src/mobile/views/ConfirmQRLogin.vue', 'src/mobile/layout/my/MyLayout.vue'])(
    '%s 的中文文案全部走 i18n',
    (path) => {
      expect(chineseSegments(readWithoutComments(path))).toEqual([])
    }
  )
})

describe('移动端其余用户可见页面中文字面量收口', () => {
  it.each([
    'src/mobile/views/MobileForgetPassword.vue',
    'src/mobile/views/my/Files.vue',
    'src/mobile/views/MyQRCode.vue',
    'src/mobile/views/my/MobileSettings.vue',
    'src/mobile/views/space/SpaceView.vue',
    'src/mobile/views/my/EditProfile.vue',
    'src/mobile/views/my/MobileSecurityKeySetup.vue',
    'src/mobile/views/my/SimpleBio.vue'
  ])('%s 的中文文案全部走 i18n', (path) => {
    expect(chineseSegments(readWithoutComments(path))).toEqual([])
  })
})

describe('桌面端存量页面中文字面量收口', () => {
  it.each([
    'src/views/forgetPasswordWindow/index.vue',
    'src/views/Notify.vue',
    'src/views/videoViewerWindow/index.vue',
    'src/views/trendradar/TrendRadarView.vue',
    'src/App.vue',
    'src/views/previewFileWindow/index.vue'
  ])('%s 的中文文案全部走 i18n', (path) => {
    expect(chineseSegments(readWithoutComments(path))).toEqual([])
  })
})

describe('桌面端剩余页面与窗口骨架中文字面量收口', () => {
  it.each([
    'src/views/callWindow/index.vue',
    'src/plugins/dynamic/detail.vue',
    'src/plugins/dynamic/index.vue',
    'src/views/CheckUpdate.vue',
    'src/views/homeWindow/message/index.vue',
    'src/views/Tray.vue',
    'src/views/chatHistory/index.vue',
    'src/views/fileManagerWindow/index.vue',
    'src/views/LockScreen.vue',
    'src/views/homeWindow/SecretChatPage.vue',
    'src/views/loginWindow/Login.vue',
    'src/views/loginWindow/QRCode.vue',
    'src/views/loginWindow/SecretChatModal.vue',
    'src/views/onlineStatusWindow/index.vue',
    'src/views/registerWindow/index.vue',
    'src/views/settingsWindow/SettingsPage.vue'
  ])('%s 的中文文案全部走 i18n', (path) => {
    expect(chineseSegments(readWithoutComments(path))).toEqual([])
  })
})
