import type { Ref } from 'vue'
import type { ContextMenuItem, MenuContent } from './useContextMenuTypes'

/**
 * 右键菜单项辅助函数
 *
 * 负责：
 * - 解析菜单项属性（支持函数式与静态值两种形式）
 * - 判断菜单项是否为危险操作（logout/forbid 图标）
 */
export const useContextMenuItem = (content: Ref<MenuContent>) => {
  /**
   * 获取菜单项的属性值（处理函数式和静态值）
   * @param item 菜单项
   * @param prop 属性名 ('icon' | 'label')
   */
  const getMenuItemProp = (item: ContextMenuItem, prop: 'icon' | 'label') => {
    return typeof item[prop] === 'function' ? item[prop](content.value) : item[prop]
  }

  /**
   * 判断菜单项是否需要危险样式
   * @param item 菜单项
   */
  const isDangerousItem = (item: ContextMenuItem) => {
    const icon = getMenuItemProp(item, 'icon')
    return ['logout', 'forbid'].includes(icon)
  }

  return {
    getMenuItemProp,
    isDangerousItem
  }
}
