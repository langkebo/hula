import { shallowRef, triggerRef, shallowReactive, isShallow } from 'vue'

export interface OptimizedListOptions<_T> {
  /** 初始数据大小阈值，超过则使用 shallowRef */
  threshold?: number
  /** 启用调试日志 */
  debug?: boolean
}

/**
 * Optimized List Composable
 * 使用 shallowRef 优化大数据列表的渲染性能
 *
 * @example
 * const { list, addItems, updateItem, removeItem } = useOptimizedList<Message>([])
 *
 * // 添加大量数据时不会触发不必要的重渲染
 * addItems(messages)
 */
export function useOptimizedList<T>(initialValue: T[] = [], options: OptimizedListOptions<T> = {}) {
  const { threshold = 50, debug = false } = options

  // 对于大数据集，使用 shallowRef 避免深度响应式开销
  const data = shallowRef<T[]>(initialValue)

  const log = (msg: string, ...args: unknown[]) => {
    if (debug) {
      console.log(`[OptimizedList] ${msg}`, ...args)
    }
  }

  // 获取列表长度
  const length = () => data.value.length

  // 获取列表
  const getList = () => data.value

  // 获取指定索引的项
  const getItem = (index: number) => data.value[index]

  // 设置整个列表
  const setList = (newList: T[]) => {
    log('setList', newList.length)
    data.value = newList
  }

  // 添加单个或多个项
  const addItems = (...items: T[]) => {
    log('addItems', items.length)
    data.value = [...data.value, ...items]
  }

  // 在指定位置插入项
  const insertItems = (index: number, ...items: T[]) => {
    log('insertItems', index, items.length)
    const list = [...data.value]
    list.splice(index, 0, ...items)
    data.value = list
  }

  // 更新指定索引的项
  const updateItem = (index: number, item: T) => {
    if (index >= 0 && index < data.value.length) {
      log('updateItem', index)
      const list = [...data.value]
      list[index] = item
      data.value = list
    }
  }

  // 移除指定索引的项
  const removeItem = (index: number) => {
    if (index >= 0 && index < data.value.length) {
      log('removeItem', index)
      const list = [...data.value]
      list.splice(index, 1)
      data.value = list
    }
  }

  // 根据条件移除项
  const removeItems = (predicate: (item: T, index: number) => boolean) => {
    log('removeItems by predicate')
    data.value = data.value.filter(predicate)
  }

  // 清空列表
  const clear = () => {
    log('clear')
    data.value = []
  }

  // 手动触发更新（用于修改数组内部项时）
  const refresh = () => {
    log('refresh')
    triggerRef(data)
  }

  // 检查是否使用 shallowRef
  const isUsingShallow = isShallow(data)

  log('initialized', { threshold, isUsingShallow })

  return {
    data,
    length,
    getList,
    getItem,
    setList,
    addItems,
    insertItems,
    updateItem,
    removeItem,
    removeItems,
    clear,
    refresh,
    isUsingShallow
  }
}

/**
 * 使用 shallowReactive 创建响应式对象（用于大对象）
 */
export function useShallowReactive<T extends object>(initialValue: T) {
  return shallowReactive(initialValue)
}
