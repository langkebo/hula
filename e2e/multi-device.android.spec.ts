import { chromium, expect, test } from '@playwright/test'

/**
 * 跨设备冒烟：**Android 模拟器里的真 Chrome** ↔ **本机 dev server** ↔ **同一后端**。
 *
 * 与 `matrix-live.spec.ts` 的区别：那边是「两个浏览器上下文」模拟两端，
 * 这边是**一台真实 Android 设备**加载同一份前端产物 —— 能抓到只在移动 WebView/Chrome
 * 上冒头的问题（UA 分流、视口、代理、证书、CSP）。
 *
 * ## 前置（本机一次性准备，缺任一步该用例自动 skip）
 *
 * ```bash
 * # 1) 起移动 UI 的 dev server（5210 端口，手机版路由）
 * TAURI_ENV_PLATFORM=android pnpm dev
 * # 2) 起模拟器（本机已有 AVD：Medium_Phone）
 * ~/Library/Android/sdk/emulator/emulator -avd Medium_Phone -no-snapshot-save -no-boot-anim -no-audio &
 * # 3) 让设备能访问本机的 5210（反向隧道）
 * adb reverse tcp:5210 tcp:5210
 * # 4) 在设备上打开页面（首次会停在 Chrome 首启页，点「Stay signed out」即可）
 * adb shell am start -a android.intent.action.VIEW -d "http://127.0.0.1:5210/"
 * # 5) 把设备的 DevTools 暴露到本机 9222
 * adb forward tcp:9222 localabstract:chrome_devtools_remote
 * # 6) 跑本用例
 * TJG_ANDROID_CDP=http://127.0.0.1:9222 pnpm exec playwright test e2e/multi-device.android.spec.ts \
 *   --project=desktop-chromium
 * ```
 *
 * 为什么不做「设备上登录并发消息」：移动 UI 的登录表单在真机 Chrome 里需要稳定的选择器与
 * 账号凭据，且 Tauri 壳（真实 APK）才能覆盖原生能力；这层留给 `pnpm adev` + APK 安装后
 * 用 UiAutomator/Appium 做。本用例只断言「设备端能加载同一前端并打到同一后端」——
 * 这是跨设备测试里最先坏、也最容易漏的一环。
 */

/** 设备端 Chrome 的 CDP 地址（由 `adb forward` 暴露）；未设置则整组 skip。 */
const cdpUrl = process.env.TJG_ANDROID_CDP?.trim() ?? ''

/** 设备端加载的地址：走 `adb reverse` 的 127.0.0.1（不是本机 host IP）。 */
const DEVICE_APP_URL = process.env.TJG_ANDROID_APP_URL?.trim() || 'http://127.0.0.1:5210/'

test.describe('跨设备冒烟：Android 模拟器 ↔ 本机 dev server', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(120_000)

  test('设备端加载同一前端，并打到同一后端（客户端发现一致）', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', '跨设备用例只在 desktop-chromium 项目下跑一次')
    test.skip(!cdpUrl, '未设置 TJG_ANDROID_CDP（需先 adb forward tcp:9222 localabstract:chrome_devtools_remote）')

    // 连真实设备上的 Chrome（connectOverCDP 不会启动新浏览器）
    const deviceBrowser = await chromium.connectOverCDP(cdpUrl)
    const deviceContext = deviceBrowser.contexts()[0]
    expect(deviceContext, '设备端没有可用的浏览器上下文（Chrome 是否已启动？）').toBeTruthy()
    // 设备上可能开了多个标签（含历史错误页），优先复用已经停在目标地址的那个，
    // 否则重新打开一个 —— 直接取 pages()[0] 会随机命中旧标签，造成假失败/假通过。
    const appOrigin = new URL(DEVICE_APP_URL).origin
    const existing = deviceContext.pages().find((p) => p.url().startsWith(appOrigin))
    const devicePage = existing ?? deviceContext.pages()[0] ?? (await deviceContext.newPage())

    // 1) 确实是移动端设备，而不是本机伪装
    const userAgent = await devicePage.evaluate(() => navigator.userAgent)
    expect(userAgent).toContain('Android')

    // 2) 设备端能加载同一份前端产物（标题来自 index.html）
    await devicePage.goto(DEVICE_APP_URL, { waitUntil: 'domcontentloaded' })
    await expect(devicePage).toHaveTitle(/HuLa/i)

    // 3) 设备端经 vite 代理打到后端：客户端发现可用
    const deviceVersions = await devicePage.evaluate(async () => {
      const resp = await fetch('/_matrix/client/versions')
      return { status: resp.status, body: (await resp.json()) as { versions?: string[] } }
    })
    expect(deviceVersions.status, '设备端经 /_matrix 代理访问后端失败（检查 adb reverse 与 VITE_HOMESERVER_URL）').toBe(
      200
    )
    expect(Array.isArray(deviceVersions.body.versions)).toBe(true)

    // 4) 本机同一路径的响应必须与设备端一致（证明两端打的是同一个后端）
    // 本机 page 起始是 about:blank，必须先载入同源页面，否则相对路径 fetch 无法解析
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const localVersions = await page.evaluate(async () => {
      const resp = await fetch('/_matrix/client/versions')
      return { status: resp.status, body: (await resp.json()) as { versions?: string[] } }
    })
    expect(localVersions.status).toBe(200)
    expect(deviceVersions.body.versions).toEqual(localVersions.body.versions)

    // 5) 渲染层不得出现裸 mxc://（SDK-1 在移动端的可见后果）
    expect(await devicePage.locator('img[src^="mxc://"]').count()).toBe(0)

    // 不调用 deviceBrowser.close()：CDP 连接的是真机 Chrome，关掉会连带关闭设备浏览器
    // （Playwright 在 worker 结束时会释放这条连接）
  })
})
