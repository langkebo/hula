/**
 * 应用版本号（唯一事实源 = package.json）。
 *
 * 读取途径：`index.html` 里由 `build/config/vite.config.base.ts` 的 `tjg-app-version`
 * 插件注入的 `<meta name="app-version">`。用 meta 而不是 `define` 的原因：实测 Vite 8
 * 在 dev 下不应用项目级 define，会导致开发态拿不到值。
 *
 * 取不到时回退 `'dev'`（vitest 等无 index.html 的场景），不抛错。
 *
 * 背景：移动端设置页曾把 `v1.0.0` 直接写在模板里，与真实版本（3.x）长期不一致，
 * 用户反馈问题时提供的版本号不可信。
 */
export const APP_VERSION: string =
  (typeof document !== 'undefined'
    ? document.querySelector('meta[name="app-version"]')?.getAttribute('content')
    : null) || 'dev'
