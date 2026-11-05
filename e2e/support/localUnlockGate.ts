/// <reference types="node" />
import type { Page } from '@playwright/test'

/**
 * 关闭「设置本地解锁密码」门禁弹窗（`LocalUnlockDialog`）。
 *
 * ## 为什么所有浏览器态用例都需要它
 *
 * `App.vue` 在启动时调用 `useLocalUnlockGate().ensureReady()`：先探测安全存储后端，
 * 纯浏览器（Playwright / 真机 Chrome，没有 Tauri 密钥库）必然不可用 ⇒ 弹窗并**阻断启动**，
 * 直到用户点「稍后」或设置密码。表现是 splash 停在 0%、路由永不就绪、
 * 任何工作区选择器（`.message-list-page` 等）都等不到。
 *
 * 点「稍后」的代价是本次会话 crypto fail-closed（E2EE 不可用），但明文房间照常收发 ——
 * 这正是浏览器态用例的既定前提（需要 E2EE 的用例得走真实 Tauri 或设置解锁密码）。
 *
 * ## 为什么用 `dispatchEvent` 而不是 `click()`
 *
 * naive-ui 把弹窗 teleport 到 `n-modal-container`（实测尺寸 0×0，但仍留在 hit-test 链上），
 * Playwright 的 actionability 检查会一直超时。直接派发 click 可绕开命中判定，
 * 且该按钮没有依赖真实指针事件（不是拖拽/长按类交互）。
 *
 * @param page 目标页面
 * @param timeoutMs 等待弹窗出现的上限；弹窗不出现时静默返回 false（不拖慢正常用例）
 * @returns 是否真的点到了「稍后」
 */
export const dismissLocalUnlockDialog = async (page: Page, timeoutMs = 5_000): Promise<boolean> => {
  const skip = page.locator('[data-test="local-unlock-skip"]')
  const appeared = await skip
    .first()
    .waitFor({ state: 'attached', timeout: timeoutMs })
    .then(() => true)
    .catch(() => false)
  if (!appeared) return false
  await skip
    .first()
    .dispatchEvent('click')
    .catch(() => {})
  return true
}

/**
 * 在页面生命周期内**自动**点掉解锁门禁（init script + 轮询）。
 *
 * 与 {@link dismissLocalUnlockDialog} 的分工：
 * - 后者是「导航完成后等一次」，适用于 spec 自己控制 `goto` 之后要断言登录页/工作区的场景；
 * - 本函数装一次就永久生效，适用于 `bootstrapDesktopHarness` 这类**每个用例都必然遇到**
 *   同一个弹窗的 mock 会话（纯浏览器没有密钥库，弹窗 100% 出现）。
 *
 * 为什么要轮询而不是 MutationObserver 一次：App 启动与 crypto 初始化**两个阶段**都可能
 * 触发 `ensureReady()`，弹窗会二次出现（实测残留时 `input[type=password]` 会命中 2 个，
 * 把登录页用例判成 strict mode violation）。这里按「出现即点、消失后重新武装」处理。
 *
 * 每 400ms 检查一次，连续 30 次（约 12s）没再出现就停止，避免长期占着定时器。
 */
export const autoDismissLocalUnlockGate = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const SKIP_SELECTOR = '[data-test="local-unlock-skip"]'
    let armed = true
    let idleTicks = 0

    const timer = setInterval(() => {
      const target = document.querySelector(SKIP_SELECTOR)
      if (!target) {
        armed = true
        idleTicks += 1
        if (idleTicks >= 30) clearInterval(timer)
        return
      }
      idleTicks = 0
      if (!armed || !(target instanceof HTMLElement)) return
      armed = false
      // 与 dismissLocalUnlockDialog 同理：naive-ui 的 teleport 容器命中判定不过，
      // 直接派发事件绕开 actionability 检查。
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    }, 400)
  })
}
