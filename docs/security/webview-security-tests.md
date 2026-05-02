# 外链与嵌入 Webview 安全回归测试方案 (P2-SEC-02)

> 关联 Hook: [useLinkSegments.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/hooks/useLinkSegments.ts)  
> 状态: **测试用例产出 / 待实施**

## 1. 现状分析

`hula` 通过 `openExternalUrl` 函数处理外链。目前已具备基础的协议校验（仅允许 `http`, `https`, `mailto`），但仍需验证在 Tauri 容器环境下的拦截效果，防止协议注入攻击。

## 2. 测试用例集

### 2.1 协议白名单校验 (Protocol Whitelist)
| 输入 URL | 预期结果 | 风险点 |
|---|---|---|
| `https://matrix.org` | ✅ 正常打开 | 基础功能 |
| `mailto:support@hula.com` | ✅ 正常唤起邮件 | 基础功能 |
| `javascript:alert(1)` | ❌ 拦截并记录警告 | XSS / 脚本执行 |
| `file:///etc/passwd` | ❌ 拦截并记录警告 | 本地文件读取 |
| `tauri://localhost` | ❌ 拦截并记录警告 | 容器内部协议逃逸 |
| `shell:powershell.exe` | ❌ 拦截并记录警告 | 命令注入 |

### 2.2 嵌入 Webview 隔离校验 (Webview Isolation)
若未来引入内嵌 Webview 预览功能，必须验证以下项：
- **Context Isolation**: 验证 Webview 内脚本无法访问 `window.__TAURI__`。
- **IPC Bridge**: 验证 Webview 无法通过 `invoke` 调用敏感 Command。
- **Sandbox**: 验证是否开启了原生沙箱标志。

## 3. 自动化回归脚本建议

在 `src/hooks/__tests__/useLinkSegments.test.ts` 中补齐安全边界用例：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { normalizeExternalUrl } from '../useLinkSegments';

describe('useLinkSegments Security Boundaries', () => {
  it('should allow valid protocols', () => {
    expect(normalizeExternalUrl('https://google.com')).toBe('https://google.com');
    expect(normalizeExternalUrl('mailto:test@test.com')).toBe('mailto:test@test.com');
  });

  it('should block dangerous protocols', () => {
    expect(normalizeExternalUrl('javascript:alert(1)')).toBe('');
    expect(normalizeExternalUrl('file:///C:/Windows/System32')).toBe('');
    expect(normalizeExternalUrl('data:text/html,<html>')).toBe('');
    expect(normalizeExternalUrl('php://filter/read=convert.base64-encode')).toBe('');
  });
});
```

## 4. 后续动作
- [ ] 运行 `pnpm test:run` 验证新增的安全边界用例。
- [ ] 审计 `tauri.conf.json` 中的 `allowlist.shell.open` 配置，确保没有过大的正则匹配。
