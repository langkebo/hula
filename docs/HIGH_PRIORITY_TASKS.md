# 高优先级任务清单

> 生成日期：2026-03-25
> 依据：frontend-compliance-report.md

---

## 状态总结

| 任务 | 原问题 | 当前状态 | 结论 |
|------|--------|----------|------|
| TD-01 Matrix SDK 初始化 | TODO 登录后初始化连接 | ✅ 已实现 | 已在 loginProcess 中通过 setLoginState 处理 |
| TD-04 输入框草稿 | TODO 切换时记录内容 | ✅ 已实现 | globalStore.setDraftMessage/getDraftMessage |
| TD-05 隐藏会话接口 | TODO 使用隐藏会话接口 | ✅ 已实现 | invokeWithErrorHandler('hide_contact_command') |
| OPT-01 举报消息功能 | 功能不完整 | ✅ 已完成 | 完整实现举报流程 + 服务端对接 |

---

## OPT-01 举报消息功能 - 已完成

### 实现内容

| 文件 | 说明 |
|------|------|
| `src/hooks/useChatMain.ts` | 举报菜单点击事件 + 弹窗调用 |
| `src/composables/useReportDialog.ts` | **新增** 举报对话框 + 服务调用 |
| `src/services/matrix/MatrixReportService.ts` | 举报服务（已存在） |
| `src/i18n/locales/zh-CN.ts` | 中文翻译 |
| `src/i18n/locales/en-US.ts` | 英文翻译 |

### 举报流程

```
用户右键消息 → 点击"举报" → 弹出举报原因选择框 → 选择原因 → 提交 → 
→ MatrixReportService.reportEvent() → 显示成功/失败提示
```

### 举报原因（7种）

1. 色情内容 (Sexual)
2. 暴力内容 (Violence)
3. 仇恨言论 (HateSpeech)
4. 自杀自残 (SelfHarm)
5. 恐怖主义 (Terrorism)
6. 垃圾信息 (Spam)
7. 违规内容 (Violation)
8. 其他 (Other)