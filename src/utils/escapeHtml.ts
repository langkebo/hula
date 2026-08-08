/**
 * 单一 HTML 转义实现（规范来源）。
 *
 * 转义顺序：先转义 `&`，再转义 `<` `>` `"` `'`，
 * 避免已存在的实体（如 `&lt;`）被二次转义错乱，并消除 XSS 入口。
 * 其它位置曾存在 4 份字符集不一致的副本，已统一到此函数。
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
