import {
  type ComputedRef,
  computed,
  type InjectionKey,
  inject,
  type MaybeRefOrGetter,
  onScopeDispose,
  provide,
  ref,
  toValue,
  watch
} from 'vue'
import type { SettingsTabType } from '@/stores/domains/settings/settingsSchema'

export interface SettingsDirtyConfirmOptions {
  scope: 'close' | 'switch'
  tabId?: SettingsTabType
  currentTabLabel?: string
  dirtyTabs: SettingsTabType[]
}

export type SettingsDirtyConfirmHandler = (options: SettingsDirtyConfirmOptions) => Promise<boolean>

export interface SettingsDirtyRegistry {
  dirtyTabs: ComputedRef<SettingsTabType[]>
  hasDirtyTabs: ComputedRef<boolean>
  isTabDirty: (tabId: SettingsTabType) => boolean
  setTabDirty: (tabId: SettingsTabType, isDirty: boolean) => void
  clearDirtyTabs: () => void
  confirmIfNeeded: (options: {
    scope: 'close' | 'switch'
    tabId?: SettingsTabType
    currentTabLabel?: string
  }) => Promise<boolean>
}

const SETTINGS_DIRTY_REGISTRY_KEY: InjectionKey<SettingsDirtyRegistry> = Symbol('settings-dirty-registry')

function createNoopSettingsDirtyRegistry(): SettingsDirtyRegistry {
  const dirtyTabs = computed<SettingsTabType[]>(() => [])

  return {
    dirtyTabs,
    hasDirtyTabs: computed(() => false),
    isTabDirty: () => false,
    setTabDirty: () => undefined,
    clearDirtyTabs: () => undefined,
    confirmIfNeeded: async () => true
  }
}

const NOOP_SETTINGS_DIRTY_REGISTRY = createNoopSettingsDirtyRegistry()

export function createSettingsDirtyRegistry(confirmHandler?: SettingsDirtyConfirmHandler): SettingsDirtyRegistry {
  const dirtyState = ref<Partial<Record<SettingsTabType, boolean>>>({})

  const dirtyTabs = computed(() => {
    return Object.entries(dirtyState.value)
      .filter(([, isDirty]) => Boolean(isDirty))
      .map(([tabId]) => tabId as SettingsTabType)
  })

  const hasDirtyTabs = computed(() => dirtyTabs.value.length > 0)

  function isTabDirty(tabId: SettingsTabType): boolean {
    return Boolean(dirtyState.value[tabId])
  }

  function setTabDirty(tabId: SettingsTabType, isDirty: boolean) {
    dirtyState.value = {
      ...dirtyState.value,
      [tabId]: isDirty
    }
  }

  function clearDirtyTabs() {
    dirtyState.value = {}
  }

  async function confirmIfNeeded(options: {
    scope: 'close' | 'switch'
    tabId?: SettingsTabType
    currentTabLabel?: string
  }): Promise<boolean> {
    const shouldConfirm =
      options.scope === 'close' ? hasDirtyTabs.value : options.tabId ? isTabDirty(options.tabId) : false

    if (!shouldConfirm) return true
    if (!confirmHandler) return false

    return confirmHandler({
      scope: options.scope,
      tabId: options.tabId,
      currentTabLabel: options.currentTabLabel,
      dirtyTabs: dirtyTabs.value
    })
  }

  return {
    dirtyTabs,
    hasDirtyTabs,
    isTabDirty,
    setTabDirty,
    clearDirtyTabs,
    confirmIfNeeded
  }
}

export function provideSettingsDirtyRegistry(registry: SettingsDirtyRegistry) {
  provide(SETTINGS_DIRTY_REGISTRY_KEY, registry)
}

export function useSettingsDirtyRegistry(): SettingsDirtyRegistry {
  return inject(SETTINGS_DIRTY_REGISTRY_KEY, NOOP_SETTINGS_DIRTY_REGISTRY)
}

export function useSettingsTabDirty(tabId: SettingsTabType, isDirty: MaybeRefOrGetter<boolean>) {
  const registry = useSettingsDirtyRegistry()

  watch(
    () => Boolean(toValue(isDirty)),
    (value) => {
      registry.setTabDirty(tabId, value)
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    registry.setTabDirty(tabId, false)
  })
}
