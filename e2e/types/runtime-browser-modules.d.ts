/**
 * page.evaluate 内的动态导入目标：这些 `/src/...` 说明符在浏览器 dev server
 * 运行时才存在（配合 vite-ignore 注释），Node 侧 TypeScript 无法解析。
 * 这里统一声明为运行时模块，调用处的 `as { ... }` 负责给出精确契约。
 */
declare module '/src/*' {
  // biome-ignore lint/suspicious/noExplicitAny: 运行时模块在使用点通过 `as { ... }` 给出精确契约
  const moduleExports: any
  export = moduleExports
}
