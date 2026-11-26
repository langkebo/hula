import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { register, unregister } from '@tauri-apps/plugin-global-shortcut'
import { getCurrentScope, onScopeDispose } from 'vue'
import {
  ensureCaptureWindow,
  handleOpenMainPanel,
  handleScreenshot,
  resetPanelToggleState
} from '@/composables/common/shortcutActions'
import { normalizeShortcut } from '@/composables/common/shortcutNormalizer'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('GlobalShortcut')

// 快捷键配置接口
type ShortcutConfig = {
  /** 配置键名，用于从 store 中读取设置 */
  key: keyof NonNullable<ReturnType<typeof useSettingStore>['shortcuts']>
  /** 默认快捷键值 */
  defaultValue: string
  /** 快捷键处理函数 */
  handler: () => Promise<void>
  /** 监听的更新事件名 */
  updateEventName: string
}

// 全局快捷键状态管理
const globalShortcutStates = new Map<string, string>()

// P-05：事件监听的 unlisten 句柄。此前 listen() 返回值被直接丢弃，
// 页面重载/窗口复用时会累积重复监听，必须在作用域销毁时逐个释放。
let shortcutListeners: UnlistenFn[] = []
let shortcutListenersAttached = false
// 重复初始化守卫：并发/重复调用 initializeGlobalShortcut 时复用同一任务。
let shortcutInitTask: Promise<void> | null = null

/**
 * 全局快捷键管理 Hook
 * 负责注册、取消注册和管理全局快捷键
 * 使用配置驱动的方式，方便扩展新快捷键
 */
export const useGlobalShortcut = () => {
  const settingStore = useSettingStore()

  // 组件/作用域销毁时释放事件监听，避免窗口复用后重复监听叠加。
  if (getCurrentScope()) {
    onScopeDispose(() => {
      cleanupShortcutListeners()
    })
  }

  // 快捷键配置数组 - 新增快捷键只需在此处添加配置即可
  const shortcutConfigs: ShortcutConfig[] = [
    {
      key: 'screenshot',
      defaultValue: settingStore.screenshotShortcut,
      handler: () => handleScreenshot({ concealHome: settingStore.screenshotConcealEnabled }),
      updateEventName: 'shortcut-updated'
    },
    {
      key: 'openMainPanel',
      defaultValue: settingStore.openMainPanelShortcut,
      handler: handleOpenMainPanel,
      updateEventName: 'open-main-panel-shortcut-updated'
    }
  ]

  /**
   * 通用快捷键注册函数
   * @param config 快捷键配置
   * @param shortcut 快捷键字符串
   */
  const registerShortcut = async (config: ShortcutConfig, shortcut: string): Promise<boolean> => {
    // 插件只接受固定修饰键名，注册前统一归一化（C-10）
    const normalized = normalizeShortcut(shortcut)
    if (!normalized) {
      logger.warn(`快捷键组合非法，跳过注册 [${config.key}]: ${shortcut}`)
      return false
    }

    try {
      const currentShortcut = globalShortcutStates.get(config.key)

      // 清理当前快捷键
      if (currentShortcut) {
        await unregister(currentShortcut)
        logger.debug(`清理快捷键 [${config.key}]: ${currentShortcut}`)
      }

      // 预防性清理目标快捷键
      if (!currentShortcut) {
        try {
          await unregister(normalized)
          logger.debug(`预清理快捷键 [${config.key}]: ${normalized}`)
        } catch {
          logger.debug(`快捷键 [${config.key}] 未注册: ${normalized}`)
        }
      }

      // 注册新快捷键
      await register(normalized, config.handler)
      globalShortcutStates.set(config.key, normalized)
      logger.debug(`快捷键已注册 [${config.key}]: ${normalized}`)
      return true
    } catch (error) {
      logger.error(`注册快捷键失败 [${config.key}]:`, error)
      return false
    }
  }

  /**
   * 取消注册快捷键
   * @param shortcut 要取消注册的快捷键字符串
   */
  const unregisterShortcut = async (shortcut: string) => {
    try {
      await unregister(shortcut)
      logger.debug(`成功取消注册快捷键: ${shortcut}`)
    } catch (error) {
      logger.error(`取消注册快捷键失败: ${shortcut}`, error)
    }
  }

  /**
   * 强制清理快捷键残留
   */
  const forceCleanupShortcuts = async (shortcuts: string[]) => {
    for (const shortcut of shortcuts) {
      try {
        await unregister(shortcut)
      } catch {
        logger.debug(`强制清理 ${shortcut} (可能未注册)`)
      }
    }
  }

  /**
   * 通用快捷键更新处理函数
   * @param config 快捷键配置
   * @param newShortcut 新快捷键
   */
  const handleShortcutUpdate = async (config: ShortcutConfig, newShortcut: string) => {
    const oldShortcut = globalShortcutStates.get(config.key)
    // 非法组合直接拒绝，保留旧注册并回报失败（C-10）
    const normalized = normalizeShortcut(newShortcut)
    if (!normalized) {
      logger.warn(`快捷键组合非法，忽略更新 [${config.key}]: ${newShortcut}`)
      return
    }

    // 强制清理旧快捷键
    const shortcutsToClean = [oldShortcut, normalized].filter(Boolean) as string[]
    await forceCleanupShortcuts(shortcutsToClean)

    // 清除状态，准备重新注册
    globalShortcutStates.delete(config.key)

    // 尝试注册新快捷键
    logger.debug(`[Home] 开始注册新快捷键 [${config.key}]: ${normalized}`)
    const success = await registerShortcut(config, normalized)

    // 如果注册失败且有旧快捷键，尝试回滚
    if (!success && oldShortcut) {
      globalShortcutStates.delete(config.key)
      const rollbackSuccess = await registerShortcut(config, oldShortcut)
      logger.debug(`[Home] 快捷键回滚结果 [${config.key}]: ${rollbackSuccess ? '成功' : '失败'}`)
    }

    logger.debug(`[Home] 快捷键注册状态 [${config.key}]: ${success ? '已注册' : '未注册'}`)
  }

  /**
   * 处理全局快捷键开关状态变化
   * @param enabled 是否启用全局快捷键
   */
  const handleGlobalShortcutToggle = async (enabled: boolean) => {
    if (enabled) {
      // 开启时重新注册所有快捷键
      for (const config of shortcutConfigs) {
        const savedShortcut =
          config.key === 'screenshot' ? settingStore.screenshotShortcut : settingStore.openMainPanelShortcut
        await registerShortcut(config, savedShortcut as string)
      }
    } else {
      // 关闭时取消注册所有快捷键
      await cleanupGlobalShortcut()
    }
  }

  /**
   * 监听设置页发来的快捷键开关/更新事件。
   * 幂等：重复调用不会重复注册，句柄统一登记以便作用域销毁时释放。
   */
  const attachShortcutListeners = async () => {
    if (shortcutListenersAttached) return
    shortcutListenersAttached = true
    try {
      // 监听全局快捷键开关变化
      shortcutListeners.push(
        await listen('global-shortcut-enabled-changed', (event) => {
          const enabled = (event.payload as Record<string, unknown>)?.enabled
          if (typeof enabled === 'boolean') {
            handleGlobalShortcutToggle(enabled)
          } else {
            logger.warn(`[Home] 收到无效的全局快捷键开关事件:`, event.payload)
          }
        })
      )

      // 监听每个快捷键的更新事件
      for (const config of shortcutConfigs) {
        shortcutListeners.push(
          await listen(config.updateEventName, (event) => {
            const newShortcut = (event.payload as Record<string, unknown>)?.shortcut as string | undefined
            if (newShortcut) {
              // 只有全局快捷键开启时才处理更新
              const globalEnabled = settingStore.globalShortcutEnabled
              if (globalEnabled) {
                handleShortcutUpdate(config, newShortcut)
              } else {
                logger.debug(`[Home] 全局快捷键已关闭，跳过快捷键更新 [${config.key}]`)
              }
            } else {
              logger.warn(`[Home] 收到无效的快捷键更新事件 [${config.key}]:`, event.payload)
            }
          })
        )
      }
    } catch (err) {
      // 注册中途失败时回收已登记的句柄，避免半挂载状态导致后续无法重试。
      cleanupShortcutListeners()
      throw err
    }
  }

  /**
   * 释放所有事件监听句柄。
   */
  const cleanupShortcutListeners = () => {
    for (const unlisten of shortcutListeners) {
      try {
        unlisten()
      } catch (err) {
        logger.warn('[Home] 释放全局快捷键监听失败:', err)
      }
    }
    shortcutListeners = []
    shortcutListenersAttached = false
  }

  /**
   * 初始化全局快捷键
   * 根据配置自动注册所有快捷键并监听更新事件
   */
  const initializeGlobalShortcut = (): Promise<void> => {
    if (shortcutInitTask) return shortcutInitTask

    shortcutInitTask = (async () => {
      // 确保capture窗口存在
      await ensureCaptureWindow()

      // 检查全局快捷键是否开启，默认为关闭
      const globalEnabled = settingStore.globalShortcutEnabled

      // 只有开启时才注册快捷键
      if (globalEnabled) {
        // 批量注册所有配置的快捷键
        for (const config of shortcutConfigs) {
          const savedShortcut =
            config.key === 'screenshot' ? settingStore.screenshotShortcut : settingStore.openMainPanelShortcut
          await registerShortcut(config, savedShortcut as string)
        }
      }

      await attachShortcutListeners()
    })()
    // 失败时清空任务，允许调用方在下次进入首页时重试。
    shortcutInitTask.catch(() => {
      shortcutInitTask = null
    })

    return shortcutInitTask
  }

  /**
   * 清理全局快捷键
   * 取消注册所有快捷键并清理状态
   */
  const cleanupGlobalShortcut = async () => {
    // 清理防抖定时器
    resetPanelToggleState()

    // 取消注册所有已注册的快捷键
    for (const shortcut of globalShortcutStates.values()) {
      await unregisterShortcut(shortcut)
    }
    // 清理状态
    globalShortcutStates.clear()
    // 释放事件监听并允许下次重新初始化
    cleanupShortcutListeners()
    shortcutInitTask = null
  }

  return {
    // 处理函数
    handleScreenshot: () => handleScreenshot({ concealHome: settingStore.screenshotConcealEnabled }),
    handleOpenMainPanel,

    // 核心功能
    initializeGlobalShortcut,
    cleanupGlobalShortcut,
    ensureCaptureWindow,

    // 工具函数
    registerShortcut: (config: ShortcutConfig, shortcut: string) => registerShortcut(config, shortcut),
    unregisterShortcut,

    // 配置信息（用于外部访问）
    shortcutConfigs
  }
}
