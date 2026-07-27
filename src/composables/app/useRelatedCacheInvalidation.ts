/**
 * 关联缓存失效 Composable (§9.2)
 *
 * 跨 Manager 的关联数据变更后联动失效缓存。
 * 例如：删除好友 → 失效 DM 房间缓存；离开 DM → 失效好友缓存。
 *
 * 通过注册 source→target 的失效关系，
 * 当 source 数据变更时自动调用 target 的失效回调。
 */

import { createLogger } from '@/utils/Logger'

const logger = createLogger('useRelatedCacheInvalidation')

/** 缓存域标识 */
type CacheDomain = 'friend' | 'dm' | 'widget' | 'burn' | string

/** 失效回调 */
type InvalidateCallback = (key: string) => void

/** 关联失效关系 */
interface CacheRelation {
  source: CacheDomain
  target: CacheDomain
  invalidate: InvalidateCallback
}

/** 好友↔DM 双向关联配置 */
interface FriendDmRelationConfig {
  onFriendRemoved: InvalidateCallback
  onDmLeft: InvalidateCallback
}

export function useRelatedCacheInvalidation() {
  /** 按 source 分组的失效关系映射 */
  const relations = new Map<CacheDomain, Map<CacheDomain, InvalidateCallback>>()

  /**
   * 注册一条 source→target 的关联失效关系
   */
  function registerRelation(relation: CacheRelation): void {
    let targetMap = relations.get(relation.source)
    if (!targetMap) {
      targetMap = new Map()
      relations.set(relation.source, targetMap)
    }
    targetMap.set(relation.target, relation.invalidate)
    logger.debug(`[RelatedCache] 注册关联: ${relation.source} → ${relation.target}`)
  }

  /**
   * 注销指定 source→target 的关联关系
   */
  function unregisterRelation(source: CacheDomain, target: CacheDomain): void {
    const targetMap = relations.get(source)
    if (targetMap) {
      targetMap.delete(target)
      if (targetMap.size === 0) {
        relations.delete(source)
      }
      logger.debug(`[RelatedCache] 注销关联: ${source} → ${target}`)
    }
  }

  /**
   * 通知 source 域的数据已变更，触发所有关联 target 的失效回调
   * @param source 变更的缓存域
   * @param key 变更的数据键（如 userId、roomId）
   */
  function notifySourceChanged(source: CacheDomain, key: string): void {
    const targetMap = relations.get(source)
    if (!targetMap || targetMap.size === 0) return

    for (const [target, invalidate] of targetMap) {
      try {
        invalidate(key)
        logger.debug(`[RelatedCache] 失效触发: ${source}(${key}) → ${target}`)
      } catch (err) {
        logger.error(`[RelatedCache] 失效回调异常: ${source} → ${target}:`, err)
      }
    }
  }

  /**
   * 注册好友↔DM 的双向关联失效（常见场景快捷方法）
   * - 删除好友时调用 onFriendRemoved(userId) 失效 DM 缓存
   * 离开 DM 时调用 onDmLeft(roomId) 失效好友缓存
   */
  function registerFriendDmRelation(config: FriendDmRelationConfig): void {
    registerRelation({
      source: 'friend',
      target: 'dm',
      invalidate: config.onFriendRemoved
    })
    registerRelation({
      source: 'dm',
      target: 'friend',
      invalidate: config.onDmLeft
    })
  }

  /**
   * 清除所有关联关系
   */
  function clear(): void {
    relations.clear()
    logger.info('[RelatedCache] 已清除所有关联关系')
  }

  return {
    registerRelation,
    unregisterRelation,
    notifySourceChanged,
    registerFriendDmRelation,
    clear
  }
}
