# Tauri Security Audit

最后更新: `2026-04-30`

## assetProtocol.scope

当前 `src-tauri/tauri.conf.json` 中 `assetProtocol.scope` 已收敛为以下白名单:

```json
[
  "$APPDATA/**",
  "$RESOURCE/**",
  "$CACHE/**",
  "$TEMP/**"
]
```

这意味着资源协议不再开放到全盘 `**`，仅允许应用数据、资源目录、缓存目录和临时目录。

## 实际访问路径清单

当前前端通过 `convertFileSrc()` 或 `asset://` 访问本地资源的主要来源如下:

- `$RESOURCE/**`
  - `src/components/rightBox/chatBox/HuLaAssistant.vue`
  - 读取 `resourceDir()/draco` 下的 Draco 解码器
- `$APPDATA/**`
  - `src/stores/domains/widget/file.ts`
  - `src/stores/domains/chat/emoji.ts`
  - `src/components/rightBox/emoticon/useEmojiLocalCache.ts`
  - `src/plugins/robot/composables/useAiMediaCache.ts`
  - 读取持久化后的图片、表情、文件和 AI 媒体缓存
- `$CACHE/**`
  - `src/hooks/useAudioFileManager.ts`
  - `src/hooks/useImageViewer.ts`
  - `src/components/rightBox/renderMessage/Image.vue`
  - `src/components/rightBox/renderMessage/Video.vue`
  - 读取音频、图片、视频缩略图等本地缓存
- `$TEMP/**`
  - `src/hooks/msgInput/useMsgInputSend.ts`
  - `src/strategy/strategies/voice.ts`
  - 读取语音录制等临时文件

## 动态授权路径

桌面端仍保留 `allow_asset_path` 命令:

- 文件: `src-tauri/src/command/asset_command.rs`
- 用途: 为用户手动选择的本地文件按需调用 `fs_scope.allow_file()`
- 当前调用点:
  - `src/components/rightBox/chatBox/HuLaAssistant.vue`

这意味着 `assetProtocol.scope` 只覆盖默认白名单，用户从任意目录导入单个本地文件时仍通过显式授权放行，而不是恢复全局通配。

## Capability 现状

- `assetProtocol.scope` 已完成白名单收敛。
- `src-tauri/capabilities/default.json`、`desktop.json`、`mobile.json` 仍存在 `windows: ["*"]` 等较宽配置。
- `src-tauri/capabilities/mobile.json` 的 FS 与 HTTP 范围仍为 `**` 级别，后续仍需继续最小化。

## 最小回归清单

本轮针对 `assetProtocol.scope` 的最小回归关注点如下:

- 启动应用
- 登录
- 房间切换
- 附件预览
- 本地图片/视频/音频缓存回显
- 自定义 3D 模型加载
- 更新与托盘
- 设置页打开

## 本轮执行记录

- 配置核对: 已确认 `assetProtocol.scope` 不再为 `**`
- 路径核对: 已核查 `$APPDATA`、`$RESOURCE`、`$CACHE`、`$TEMP` 对应调用点
- 构建验证: 已执行 `pnpm build`
- 风险结论:
  - 桌面端默认资源访问面已收窄
  - 动态导入文件仍依赖 `allow_asset_path`
  - capability 的窗口范围和移动端 FS/HTTP 仍需后续继续收口
