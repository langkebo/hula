import { createPersistedState } from 'pinia-plugin-persistedstate'

export const pinia = createPinia()
pinia.use(
  createPersistedState({
    auto: false // P1: 关闭全局自动持久化，按需在 store 中开启
  })
)
