import { describe, expect, it } from 'vitest'
import { FOOTER_HEIGHT } from '@/common/constants'
import { useChatLayout, useChatLayoutGlobal } from '@/composables/chat/useChatLayout'

describe('useChatLayout', () => {
  it('initializes footerHeight to FOOTER_HEIGHT constant', () => {
    const { footerHeight } = useChatLayout()
    expect(footerHeight.value).toBe(FOOTER_HEIGHT)
  })

  it('setFooterHeight updates the readonly height', () => {
    const { footerHeight, setFooterHeight } = useChatLayout()
    setFooterHeight(320)
    expect(footerHeight.value).toBe(320)
  })

  it('different useChatLayout calls produce isolated state', () => {
    const a = useChatLayout()
    const b = useChatLayout()
    a.setFooterHeight(100)
    b.setFooterHeight(200)
    expect(a.footerHeight.value).toBe(100)
    expect(b.footerHeight.value).toBe(200)
  })

  it('useChatLayoutGlobal returns a shared singleton', () => {
    const a = useChatLayoutGlobal()
    const b = useChatLayoutGlobal()
    a.setFooterHeight(250)
    expect(b.footerHeight.value).toBe(250)
  })
})
