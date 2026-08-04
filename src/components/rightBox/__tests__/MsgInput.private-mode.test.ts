import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('private-mode styles', () => {
  it('render-message.scss has private-mode-active bubble rules', () => {
    const scss = readFileSync(resolve(__dirname, '../../../styles/scss/render-message.scss'), 'utf-8')
    expect(scss).toContain('.private-mode-active')
    expect(scss).toContain('.bubble-oneself')
    expect(scss).toContain('var(--tjg-color-danger-500)')
  })

  it('MsgInput.vue binds private-mode-input class', () => {
    const src = readFileSync(resolve(__dirname, '../MsgInput.vue'), 'utf-8')
    expect(src).toContain('private-mode-input')
    expect(src).toContain('PRIVATE_MODE_CHANGED')
  })
})
