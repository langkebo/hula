# 头像与资料卡后端 API 规划

> 本文档为 documentary 性质，记录头像与资料卡功能当前已依赖的后端能力、尚未实现的功能需求，以及为未来 synapse-rust 后端扩展提供的契约规范。本文档不涉及任何前端代码改动，仅作为后端工作规划的参考依据。

## 当前已工作的后端能力

以下能力已在前端服务层封装完成，可直接被头像与资料卡功能调用：

- `MatrixProfileService.setAvatarUrl(mxcUrl)` — Matrix 协议头像更新，对应 `PUT /_matrix/client/v3/profile/{userId}/avatar_url`
- `MatrixProfileService.getProfile(userId)` — 获取 displayname + avatar_url，对应 `GET /_matrix/client/v3/profile/{userId}`
- `MatrixProfileService.getExtendedProfile(userId)` — synapse-rust 扩展：sex, resume, region, birthday
- `MatrixPresenceService.setPresence(status)` — online/away/busy/offline 在线状态，对应 `PUT /_matrix/client/v3/presence/{userId}/status`
- `MatrixMediaService.uploadImage(file)` — 上传到 homeserver，返回 mxc:// URI，对应 `POST /_matrix/media/v3/upload`

## 尚未实现的功能（需要后端工作，超出当前代码范围）

以下功能需要 synapse-rust 后端扩展支持，不在当前前端代码库实现范围内：

| 功能 | 后端需求 | 优先级 |
|:---|:---|:---|
| 真实"点赞"数 | 新 synapse-rust 扩展：`POST /_matrix/client/unstable/io.tjg.profile/like` + 存储表 | 低（社交功能，非核心 IM） |
| 真实"动态"流 | 新 synapse-rust 扩展：moments 表 + `GET /_matrix/client/unstable/io.tjg.moments` + 媒体上传 | 低（社交功能） |
| 头像变更历史 | 新 synapse-rust 扩展：`avatar_history` 表 (user_id, old_mxc, new_mxc, timestamp) + `GET /_matrix/client/unstable/io.tjg.avatar/history` | 中（审计追踪） |
| 在线状态同步 | 已通过 Matrix presence 工作。前端监听 `m.presence` 事件。无需新后端。 | 已完成 |
| 位置显示 | `locPlace` 字段 — 需验证 synapse-rust 是否存储用户位置。可能未实现。 | 低 |

## 头像上传/保存/更新 API 契约

本章节记录头像相关操作的完整 API 契约，区分已工作能力（无需新后端代码）与未来扩展。

### 已工作的 API（无需新后端代码）

| 操作 | 前端服务 | Matrix API | 状态 |
|:---|:---|:---|:---|
| 上传头像图片 | `MatrixMediaService.uploadImage(file)` | `POST /_matrix/media/v3/upload` | 已工作 |
| 设置用户头像 | `MatrixProfileService.setAvatarUrl(mxc)` | `PUT /_matrix/client/v3/profile/{userId}/avatar_url` | 已工作 |
| 获取用户头像 | `MatrixProfileService.getAvatarUrl(userId)` | `GET /_matrix/client/v3/profile/{userId}` | 已工作 |
| 转换 mxc:// 为 HTTP | `MatrixClientService.mxcResolver` | `client.mxcUrlToHttp()` | 已工作（已修复） |
| 设置在线状态 | `MatrixPresenceService.setPresence(status)` | `PUT /_matrix/client/v3/presence/{userId}/status` | 已工作 |
| 获取在线状态 | `MatrixPresenceService.getPresence(userId)` | `GET /_matrix/client/v3/presence/{userId}/status` | 已工作 |

### 本地图片上传 → 设置头像 流程

用户从本地选择图片后，经过裁剪、上传、设置头像三步完成头像更新：

```
用户选择图片 → useAvatarUpload.handleCrop(blob)
  → MatrixMediaService.uploadImage(file) → 返回 mxc://
  → onSuccess(mxc) → userStore.updateAvatar(mxc)
  → MatrixProfileService.setAvatarUrl(mxc) → PUT /profile/{userId}/avatar_url
  → Matrix presence 事件广播头像变更给所有设备/联系人
```

### 头像库选择 → 设置头像 流程

用户从头像库选择预设头像后，需先将远程 URL 下载为本地文件，再走与本地图片相同的上传流程：

```
用户点击头像库头像 → handleGallerySelect(url)
  → fetch(url) → blob → File
  → MatrixMediaService.uploadImage(file) → mxc://
  → onSuccess(mxc) → 同上
```
