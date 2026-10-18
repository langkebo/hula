import { describe, expect, it } from 'vitest'
import { resolveBurnAfterRead } from '../burnPolicy'

/**
 * P0-7 回归：阅后即焚的判定必须同时看「房间级 state」与「账号级默认开关」。
 *
 * 历史缺陷：发送路径只看房间级，设置页的「默认开启阅后即焚」开关只写不读，
 * 用户打开后发送行为毫无变化（而 UI 明确宣称已开启）。
 */
describe('resolveBurnAfterRead', () => {
  it('房间级开启即启用，与全局开关无关', () => {
    expect(resolveBurnAfterRead(true, false)).toBe(true)
    expect(resolveBurnAfterRead(true, undefined)).toBe(true)
    expect(resolveBurnAfterRead(true, null)).toBe(true)
  })

  it('房间未开启时，全局默认开启仍然生效（核心回归点）', () => {
    expect(resolveBurnAfterRead(false, true)).toBe(true)
  })

  it('两者都未开启才是普通发送', () => {
    expect(resolveBurnAfterRead(false, false)).toBe(false)
    expect(resolveBurnAfterRead(false, undefined)).toBe(false)
    expect(resolveBurnAfterRead(false, null)).toBe(false)
  })
})
