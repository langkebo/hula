/**
 * 徽章目录纯函数。
 *
 * 从 `stores/domains/chat/badge` 抽出：`BadgeService` 需要同一份构建逻辑，
 * 但 service 不应 import store（S7 消除 service → store 反向依赖）。
 * 该模块无 Pinia / 无副作用，store 与 service 都可以直接引用。
 */
export interface BadgeCatalogItem {
  id: string
  img: string
  describe: string
}

const KNOWN_BADGES: Record<string, BadgeCatalogItem> = {
  '6': {
    id: '6',
    img: '/tjg.png',
    describe: '频道徽章'
  }
}

/**
 * 按徽章 ID 构建展示目录：命中已知目录时复用其图片与描述，
 * 未知 ID 生成占位条目，空 ID 与重复 ID 会被剔除。
 */
export function buildBadgeCatalog(ids: string[]): BadgeCatalogItem[] {
  return [...new Set(ids)]
    .filter((id): id is string => Boolean(id))
    .map((id) => {
      const knownBadge = KNOWN_BADGES[id]
      if (knownBadge) return knownBadge
      return {
        id,
        img: '/img/dispersion-bg.png',
        describe: `徽章 ${id}`
      }
    })
}

/** 已知徽章 ID 列表（store 初始化默认目录用）。 */
export const KNOWN_BADGE_IDS = Object.keys(KNOWN_BADGES)
