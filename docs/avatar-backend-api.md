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

## 头像变更历史后端存储设计

本章节为 synapse-rust 扩展的设计规范（documentary 性质）。完整实现需要 synapse-rust 仓库的 Rust 开发与数据库迁移工作，不在本前端代码库范围内。本文档记录契约，为未来后端工作提供明确规范。

### 新表结构：avatar_history

在 synapse-rust 数据库中新增 `avatar_history` 表，记录用户每次头像变更的旧值、新值与时间戳，用于审计追踪与历史头像画廊展示：

```sql
CREATE TABLE avatar_history (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  old_avatar_url TEXT,
  new_avatar_url TEXT NOT NULL,
  changed_at BIGINT NOT NULL,  -- epoch millis
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(name)
);
CREATE INDEX idx_avatar_history_user ON avatar_history(user_id, changed_at DESC);
```

### 新 synapse-rust 扩展 API

新增以下 unstable 端点供前端查询头像变更历史：

- `GET /_matrix/client/unstable/io.tjg.avatar/history?limit=20` — 当前用户的头像历史
- `GET /_matrix/client/unstable/io.tjg.avatar/history/{userId}` — 管理员/其他用户的历史（需权限）

### 前端集成计划（未来，不在当前计划范围内）

待后端端点就绪后，前端按以下步骤集成：

- 在 `src/services/matrix/user/` 添加 `MatrixAvatarHistoryService`
- 调用 `setAvatarUrl` 的 hook 同时 POST 到 history 端点
- 在 Settings > Account > Avatar History 画廊展示历史

### 为何仅作为文档

synapse-rust 是独立仓库（langkebo/synapse-rust）。后端变更需要在该仓库进行 Rust 开发 + 数据库迁移。本文档记录契约，为未来后端工作提供明确规范。
