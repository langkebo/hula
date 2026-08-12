import type { Preview } from '@storybook/vue3-vite'
import { setup } from '@storybook/vue3-vite'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'

const messages = {
  en: {
    'room.tab.all': 'All',
    'room.tab.joined': 'Joined',
    'room.tab.created': 'Created',
    'room.tab.label': 'Room membership tabs',
    'chat.burn.waiting_read': 'Waiting to be read',
    'chat.burn.destroyed': 'Destroyed',
    'common.edit': 'Edit',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.confirm': 'Confirm'
  },
  zh: {
    'room.tab.all': '全部',
    'room.tab.joined': '已加入',
    'room.tab.created': '已创建',
    'room.tab.label': '房间成员标签',
    'chat.burn.waiting_read': '等待对方阅读',
    'chat.burn.destroyed': '已销毁',
    'common.edit': '编辑',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.confirm': '确认'
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages
})

setup((app) => {
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  setActivePinia(pinia)
})

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  }
}

export default preview
