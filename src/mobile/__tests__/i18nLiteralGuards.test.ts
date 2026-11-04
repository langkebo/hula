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
