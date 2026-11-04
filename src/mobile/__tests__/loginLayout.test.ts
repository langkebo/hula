import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf-8')

const loginSource = read('../login.vue')
const formSource = read('../components/login/MobileLoginForm.vue')

describe('登录页布局', () => {
  it('不再用视口百分比绝对定位', () => {
    expect(loginSource).not.toContain('top-13vh')
    expect(loginSource).not.toContain('top-20vh')
  })

  it('指示条用 transform 位移且基准位置固定', () => {
    expect(loginSource).toContain('left-[33px]')
    expect(loginSource).toContain('translate-x-0')
    expect(loginSource).toContain('translate-x-[100px]')
    expect(loginSource).not.toContain('left-[133px]')
  })
})

describe('登录表单语义', () => {
  it('使用 form 提交', () => {
    expect(formSource).toContain('@submit.prevent')
    expect(formSource).toContain('native-type="submit"')
  })

  it('提供正确的自动填充提示', () => {
    expect(formSource).toContain('name="username"')
    expect(formSource).toContain('autocomplete="username"')
    expect(formSource).toContain('name="password"')
    expect(formSource).toContain('autocomplete="current-password"')
    expect(formSource.match(/autocomplete="off"/g) ?? []).toHaveLength(1)
  })

  it('协议区不再绝对定位遮挡表单', () => {
    expect(formSource).not.toContain('absolute bottom-0 w-[80%]')
  })
})
