import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf-8')

const manageSource = read('../ManageGroupMember.vue')
const inviteSource = read('../MobileInviteGroupMember.vue')

describe('ManageGroupMember 移动端结构', () => {
  it('不再依赖桌面组件与运行时平台判断', () => {
    expect(manageSource).not.toMatch(/<n-[a-z-]+/)
    expect(manageSource).not.toContain('@tauri-apps/plugin-os')
    expect(manageSource).not.toContain('useDialog')
    expect(manageSource).not.toContain('isMobileView')
  })

  it('使用纯 Vant 交互', () => {
    expect(manageSource).toContain('van-search')
    expect(manageSource).toContain('van-checkbox-group')
    expect(manageSource).toContain('showConfirmDialog')
  })
})

describe('群成员相关页面单层滚动', () => {
  it.each([
    ['ManageGroupMember.vue', manageSource],
    ['MobileInviteGroupMember.vue', inviteSource]
  ])('%s 不使用 JS 高度与内层滚动', (_name, source) => {
    expect(source).not.toContain('window.innerHeight')
    expect(source).not.toContain('scrollHeight')
    expect(source.match(/overflow-y-auto/g) ?? []).toHaveLength(1)
  })
})

describe('群成员页布局链路', () => {
  it('ManageGroupMember 不嵌套布局容器', () => {
    expect(manageSource).not.toContain('MobileLayout')
    expect(manageSource).not.toContain('AutoFixHeightPage')
  })

  it('MobileInviteGroupMember 建立 flex 高度链并保留页脚', () => {
    expect(inviteSource).not.toContain('addEventListener')
    expect(inviteSource).not.toContain(':show-footer="false"')
    expect(inviteSource).toContain('h-full flex flex-col')
  })
})
