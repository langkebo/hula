import { onActivated, onMounted } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useRefreshOnReactivate')

/**
 * 首次挂载加载 + 每次「重新激活」时刷新。
 *
 * ## 为什么需要它
 *
 * 移动端二级页挂在 `MyLayout` 的 RouterView 下，而该 RouterView **没有** keep-alive
 * ⇒ 「进别的二级页再返回」会重新挂载，`onMounted` 自己会重跑，不需要额外处理。
 *
 * 但 `MyLayout` 自身被 `src/mobile/layout/index.vue` 的 `<keep-alive :max="10">`
 * （key 为 `route.name`）缓存 ⇒ 「切到别的 Tab 再切回来」是 deactivate/activate，
 * **`onMounted` 不再触发**。只写 `onMounted` 的页面于是永远显示切走前的旧数据：
 * 设备数、已忽略用户、邀请黑名单、绑定邮箱都会停留在旧值。
 *
 * ## 为什么必须区分 `load` 与 `refresh`
 *
 * 首次挂载时 `onMounted` 与 `onActivated` **都会触发**（mounted 先，activated 后），
 * 所以这里用一次性开关跳过首次激活，把「初次加载」与「再次激活」严格分开。
 *
 * 更关键的是两者**不是同一个调用**：初次加载要开整页 loading 骨架，
 * 再次激活必须是**静默刷新**——否则每次切 Tab 回来页面都会白闪一下；
 * 刷新失败也不该把用户正在看的列表清空或换成错误页。
 *
 * 曾经踩过的坑：只给一个回调、并在里面写 `{ silent: true }`，
 * 结果首次加载也静默了。`loading` 初值为 `true` 的页面（如邀请权限）
 * 会**永久卡在加载态**。所以这里强制把两个回调分开表达。
 *
 * @param load 首次挂载时的加载（可显示 loading、失败可提示）
 * @param refresh 重新激活时的刷新，缺省复用 `load`。应尽量写成静默刷新
 */
export function useRefreshOnReactivate(load: () => void | Promise<void>, refresh?: () => void | Promise<void>): void {
  const wrap = (fn: () => void | Promise<void>): (() => void) => {
    return () => {
      try {
        void Promise.resolve(fn()).catch((error: unknown) => {
          logger.debug('reactivate refresh rejected', error)
        })
      } catch (error) {
        logger.debug('reactivate refresh threw synchronously', error)
      }
    }
  }

  const runLoad = wrap(load)
  const runRefresh = wrap(refresh ?? load)
  let isFirstActivation = true

  onMounted(runLoad)

  onActivated(() => {
    // 首次进入紧跟 mounted，已加载过，跳过
    if (isFirstActivation) {
      isFirstActivation = false
      return
    }
    runRefresh()
  })
}
