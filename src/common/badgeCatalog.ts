export interface BadgeCatalogItem {
  id: string
  img: string
  describe: string
}

const KNOWN_BADGES: Record<string, BadgeCatalogItem> = {
  '6': {
    id: '6',
    img: '/hula.png',
    describe: '频道徽章'
  }
}

export function buildBadgeCatalog(ids: string[]): BadgeCatalogItem[] {
  return [...new Set(ids)]
    .filter((id): id is string => Boolean(id))
    .map((id) => {
      const knownBadge = KNOWN_BADGES[id]
      if (knownBadge) {
        return knownBadge
      }
      return {
        id,
        img: '/img/dispersion-bg.png',
        describe: `徽章 ${id}`
      }
    })
}

export function getKnownBadgeIds(): string[] {
  return Object.keys(KNOWN_BADGES)
}
