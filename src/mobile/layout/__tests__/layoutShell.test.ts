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

describe('mobile layout nesting', () => {
  it('聊天页子路由不再嵌套 MobileLayout', () => {
    const page = read('src/mobile/views/chat-room/ManageGroupMember.vue')
    expect(page).not.toContain('<MobileLayout')
    expect(page).not.toContain("from '#/components/MobileLayout.vue'")
  })
})

describe('friends list', () => {
  it('friends list does not ship a placeholder context menu', () => {
    const source = read('src/mobile/views/friends/index.vue')
    expect(source).not.toContain('<ContextMenu')
    expect(source).not.toContain('@contextmenu.stop')
    expect(source).not.toContain('const showMenu')
  })
})

describe('chat main float button', () => {
  it('new-message float button is available on mobile and styled for it', () => {
    const source = read('src/components/rightBox/chatBox/ChatMain.vue')
    const footer = source.match(/<footer[\s\S]*?>/)?.[0] ?? ''
    expect(footer).toMatch(/\bshouldShowFloatButton\b/)
    expect(footer).toMatch(/\bcurrentNewMsgCount\b/)
    expect(footer).not.toContain('isMobileRef')
    expect(source).toContain('floatButtonStyle')
  })

  it('message row hover state is gated by hover capability', () => {
    const source = read('src/components/rightBox/chatBox/ChatMessageList.vue')
    expect(source).toContain("matchMedia('(hover: hover) and (pointer: fine)')")
    expect(source).toMatch(/@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.message-row--hoverable:hover/)
    expect(source).not.toContain('@mouseenter="hoverId = item.message.id"')
  })
})

describe('chat header layout', () => {
  it('聊天头部用 flex 且不保留桌面残留图标', () => {
    const header = read('src/mobile/components/chat-room/HeaderBar.vue')
    expect(header).toContain('class="header-bar')
    expect(header).not.toContain('grid-cols-[100px_1fr_100px]')
    expect(header).not.toContain('#diannao')
  })

  it('头部三段式 flex 结构锁定：左右 shrink-0，中段 flex-1 且 min-w-0', () => {
    const header = read('src/mobile/components/chat-room/HeaderBar.vue')
    expect(header).toMatch(/class="[^"]*\bshrink-0\b[^"]*"/)
    expect(header).toMatch(/class="[^"]*\bflex-1\b[^"]*\bmin-w-0\b[^"]*"/)
    expect(header).toMatch(/class="[^"]*\bjustify-end\b[^"]*\bshrink-0\b[^"]*"/)
    expect(header).toMatch(/class="[^"]*\bjustify-end\b[^"]*\bpe-16px\b[^"]*"/)
  })
})
