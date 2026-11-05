import { defineStore } from 'pinia'
import { PluginEnum, StoresEnum } from '@/enums'
import { usePluginsList } from '@/layout/left/config.tsx'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('PluginsStore')

export const usePluginsStore = defineStore(
  StoresEnum.PLUGINS,
  () => {
    const LEGACY_PLUGIN_URL_MAP: Record<string, string> = {
      dynamic: 'roomList'
    }
    const pluginsList = usePluginsList()
    /** 插件内容 */
    const plugins = ref(pluginsList.value.filter((p) => p.state === PluginEnum.BUILTIN) as STO.Plugins<PluginEnum>[])
    /** 插件查看模式 */
    const viewMode = ref<string>('card')

    /**
     * 设置插件
     * @param newPlugin 插件数据
     * @param newPlugin 插件数据
     */
    const addPlugin = (newPlugin: STO.Plugins<PluginEnum>) => {
      const index = plugins.value.findIndex((i) => i.url === newPlugin.url)
      index === -1 && plugins.value.push(newPlugin)
    }

    /**
     * 删除插件
     * @param p 插件数据
     * @param p 插件数据
     */
    const removePlugin = (p: STO.Plugins<PluginEnum>) => {
      const index = plugins.value.findIndex((i: STO.Plugins<PluginEnum>) => i.url === p.url)
      plugins.value.splice(index, 1)
    }

    /**
     * 更新插件状态
     * @param p 插件
     */
    const updatePlugin = (p: STO.Plugins<PluginEnum>) => {
      const index = plugins.value.findIndex((i) => i.url === p.url)
      index !== -1 && (plugins.value[index] = p)
    }

    const syncPluginsWithLocale = (latest: STO.Plugins<PluginEnum>[]) => {
      const existingMap = new Map(plugins.value.map((plugin) => [plugin.url, plugin]))
      const syncedBuiltins = latest.map((builtin) => {
        const existing = existingMap.get(builtin.url)

        if (!existing) return builtin

        const size = builtin.size ? { ...existing.size, ...builtin.size } : existing.size
        const window = builtin.window ? { ...existing.window, ...builtin.window } : existing.window

        return {
          ...existing,
          icon: builtin.icon,
          state: builtin.state,
          ...(builtin.iconAction !== undefined ? { iconAction: builtin.iconAction } : {}),
          ...(builtin.title !== undefined ? { title: builtin.title } : {}),
          ...(builtin.shortTitle !== undefined ? { shortTitle: builtin.shortTitle } : {}),
          ...(builtin.tip !== undefined ? { tip: builtin.tip } : {}),
          ...(size !== undefined ? { size } : {}),
          ...(window !== undefined ? { window } : {})
        }
      })

      const customPlugins = plugins.value.filter((plugin) => !latest.some((builtin) => builtin.url === plugin.url))
      plugins.value = [...syncedBuiltins, ...customPlugins]
    }

    const migrateLegacyPlugins = (storedPlugins: STO.Plugins<PluginEnum>[]) => {
      const migratedMap = new Map<string, STO.Plugins<PluginEnum>>()

      storedPlugins.forEach((plugin) => {
        const nextUrl = LEGACY_PLUGIN_URL_MAP[plugin.url] || plugin.url
        migratedMap.set(nextUrl, { ...plugin, url: nextUrl })
      })

      return [...migratedMap.values()]
    }

    watch(pluginsList, (latest) => syncPluginsWithLocale(latest), { immediate: true })

    onBeforeMount(() => {
      // 读取本地存储的插件数据。持久化内容可能被手工改坏或来自旧版本，
      // 解析失败时回退到内置插件列表，避免设置页初始化直接抛错。
      const raw = localStorage.getItem(StoresEnum.PLUGINS)
      if (!raw) return

      let storedPlugins: STO.Plugins<PluginEnum>[] = []
      try {
        const parsed = JSON.parse(raw) as { plugins?: STO.Plugins<PluginEnum>[] } | null
        if (Array.isArray(parsed?.plugins)) {
          storedPlugins = parsed.plugins
        }
      } catch (error) {
        logger.warn('Failed to parse stored plugins, fallback to builtin list:', error)
      }

      plugins.value = []
      migrateLegacyPlugins(storedPlugins).forEach((item: STO.Plugins<PluginEnum>) => plugins.value.push(item))
      syncPluginsWithLocale(pluginsList.value)
    })

    return {
      plugins,
      viewMode,
      addPlugin,
      removePlugin,
      updatePlugin
    }
  },
  {
    persist: true
  }
)
