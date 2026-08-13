import { defineStore } from 'pinia'
import { useI18n } from 'vue-i18n'
import { PluginEnum, StoresEnum } from '@/enums'

export const useMenuTopStore = defineStore(
  StoresEnum.MENUTOP,
  () => {
    const { t } = useI18n()
    // 初始配置，文案由 i18n 动态注入，确保语言切换实时更新
    const baseMenuTop: Array<Omit<STO.Plugins<PluginEnum>, 'title' | 'shortTitle'>> = [
      {
        url: 'message',
        icon: 'message',
        iconAction: 'message-action',
        state: PluginEnum.BUILTIN,
        isAdd: true,
        dot: false,
        progress: 0,
        miniShow: false
      },
      {
        url: 'friendsList',
        icon: 'peoples-two',
        iconAction: 'peoples-two',
        state: PluginEnum.BUILTIN,
        isAdd: true,
        dot: false,
        progress: 0,
        miniShow: false
      }
    ]

    const menuTop = computed<STO.Plugins<PluginEnum>[]>(() => [
      {
        ...baseMenuTop[0],
        title: t('home.action.message'),
        shortTitle: t('home.action.message_short_title')
      },
      {
        ...baseMenuTop[1],
        title: t('home.action.contact'),
        shortTitle: t('home.action.contact_short_title')
      }
    ])

    return {
      menuTop
    }
  },
  {
    persist: true
  }
)
