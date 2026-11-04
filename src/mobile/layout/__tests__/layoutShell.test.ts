import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8')

describe('mobile tab shell', () => {
  it('底部安全区只由 TabBar 承担', () => {
    expect(read('src/mobile/layout/index.vue')).toContain(':safe-area-bottom="false"')
    const tabBar = read('src/mobile/layout/tabBar/index.vue')
    expect(tabBar).toContain('min-height: 62px')
    expect(tabBar).toMatch(/\.tab-bar\s*\{[^}]*padding-bottom:\s*var\(--safe-area-inset-bottom/)
    expect(tabBar).not.toContain('padding-bottom: var(--safe-area-inset-bottom, 10px)')
  })

  it('横屏侧边栏的 tab-bar 不继承底部安全区 padding', () => {
    const tabBar = read('src/mobile/layout/tabBar/index.vue')
    expect(tabBar).toMatch(/\.tab-bar-wrap--vertical\s*\{[\s\S]*?\.tab-bar\s*\{[^}]*padding-bottom:\s*0/)
  })
})

describe('keep-alive 命名对齐', () => {
  it('keep-alive 白名单命中真实组件名', () => {
    const layout = read('src/mobile/layout/chat-room/ChatRoomLayout.vue')
    const main = read('src/mobile/views/chat-room/MobileChatMain.vue')
    const include = layout.match(/include="\[([^\]]+)\]"/)?.[1] ?? ''
    const names = include.split(',').map((item) => item.trim().replace(/['"]/g, ''))
    const actualName = main.match(/defineOptions\(\{\s*name:\s*'([^']+)'/)?.[1]
    expect(actualName).toBeTruthy()
    expect(names).toContain(actualName)
  })

  it('桌面中栏白名单同样命中', () => {
    const names = (read('src/layout/center/index.vue').match(/include="\[([^\]]+)\]"/)?.[1] ?? '')
      .split(',')
      .map((item) => item.trim().replace(/['"]/g, ''))
    const message = read('src/views/homeWindow/message/index.vue')
    const friends = read('src/views/homeWindow/FriendsList.vue')
    expect(message).toContain("defineOptions({ name: 'message' })")
    expect(friends).toContain("defineOptions({ name: 'friendsList' })")
    expect(names).toEqual(expect.arrayContaining(['message', 'friendsList']))
  })

  it('不再保留无样式的 slide 过渡', () => {
    expect(read('src/mobile/layout/index.vue')).not.toContain('<Transition name="slide"')
  })
})
