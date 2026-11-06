import type { Preview } from '@storybook/vue3-vite'
import { setup } from '@storybook/vue3-vite'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
// 设计令牌是组件真实配色来源；不引入时 stories 内所有 --tjg-* 均为空值，
// 组件退化为浏览器默认色（黑字透明底），axe 的 color-contrast 结论与视觉基线都会失真。
import '../src/styles/css/design-tokens.css'

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
    'common.confirm': 'Confirm',
    'friend.federated_user': 'Federated user',
    'friend.local_user': 'Local user'
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
    'common.confirm': '确认',
    'friend.federated_user': '联邦用户',
    'friend.local_user': '本地用户'
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages
})

// 多数业务组件会调用 useRouter/useRoute；story 中没有 router 实例时这些 hook 返回
// undefined，组件在 setup 阶段就抛错，导致 axe 只能扫到 Storybook 的错误浮层。
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }]
})

setup((app) => {
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  setActivePinia(pinia)
  app.use(router)
})

const preview: Preview = {
  /**
   * 为每个 story 补齐页面级 landmark 骨架。
   *
   * 背景：story 在 iframe 中隔离渲染，组件本身没有 `main` / `h1`，会让 axe 的
   * `landmark-one-main`、`page-has-heading-one`、`region` 三条 best-practice 规则
   * 对每个 story 各报一次（此前 108 个 story 累计 249 条 moderate 噪声），
   * 真实缺陷被淹没。生产页面由布局层提供 landmark，这里用等价的隐藏骨架对齐语义。
   *
   * 标题用视觉隐藏（clip）而非 `display:none`，确保读屏与 axe 都能识别，且不改变像素基线。
   */
  decorators: [
    (story) => ({
      // 必须用小写 `story` 作为组件名（Storybook Vue renderer 的约定），
      // 用 PascalCase 别名或 render 函数包裹都会被当成普通函数，渲染成函数源码文本。
      components: { story },
      template: `
        <main class="sb-story-main">
          <h1 class="sb-story-heading" style="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0">Story preview</h1>
          <story />
        </main>
      `
    })
  ],
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
