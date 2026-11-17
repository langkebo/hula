import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 列表图片懒加载守卫（UI 优化方案 v2.4 §17.1「列表与消息区图片默认懒加载」）。
 *
 * 背景：房间 / 空间 / 成员列表与链接预览会一次性渲染大量远程图片。没有
 * `loading="lazy"` 时浏览器会在首屏同时发起全部请求，弱网下抢占消息列表带宽；
 * `decoding="async"` 则避免解码阻塞主线程（主线程阻塞预算是 50ms）。
 *
 * 口径：只登记「列表 / 网格 / 消息区」容器组件；单实例头像（顶栏、邀请条、
 * 房间详情头图）与二维码、图标不在守卫范围 —— 它们在首屏即需要，懒加载没有收益。
 *
 * 本表同时是漂移守卫：新增列表容器渲染远程图片时，必须同步补属性并登记到此处。
 */
const LIST_IMAGE_COMPONENTS = [
  'src/components/room/RoomCard.vue',
  'src/components/room/RoomCardItem.vue',
  'src/components/room/RoomDetailMembers.vue',
  'src/components/space/PublicSpaceDiscoveryDialog.vue',
  'src/components/space/SpaceRoomGrid.vue',
  'src/components/space/SpaceTree.vue',
  'src/components/workbench/SpaceRoomsPane.vue',
  'src/components/rightBox/linkPreview/LinkPreviewPane.vue',
  'src/mobile/components/space/SpaceCard.vue'
] as const

const ROOT = process.cwd()

interface ImageTag {
  line: number
  text: string
}

/** 抽出模板里的 `<img ...>` 标签（含多行属性），保留起始行号 */
function imageTagsOf(content: string): ImageTag[] {
  return [...content.matchAll(/<img\b[\s\S]*?\/?>/g)].map((match) => ({
    line: content.slice(0, match.index).split('\n').length,
    text: match[0]
  }))
}

describe('image lazy loading', () => {
  it('列表容器里的图片必须 lazy + async 解码', () => {
    const offenders = LIST_IMAGE_COMPONENTS.flatMap((file) => {
      const content = readFileSync(join(ROOT, file), 'utf-8')
      const problems = imageTagsOf(content)
        .filter((tag) => !/loading=["']lazy["']/.test(tag.text) || !/decoding=["']async["']/.test(tag.text))
        .map((tag) => `${file}:${tag.line}`)

      if (problems.length === 0 && imageTagsOf(content).length === 0) {
        problems.push(`${file}: 未找到 <img>，登记项已失效`)
      }
      return problems
    })

    expect(offenders, `以下列表图片缺少 loading="lazy" / decoding="async"：\n${offenders.join('\n')}`).toEqual([])
  })
})
