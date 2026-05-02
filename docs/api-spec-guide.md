# hula API 规范指南 (OpenAPI)

> 版本: v1.0.0  
> 维护人: 后端负责人 / 前端负责人  
> 最后更新: 2026-04-30

## 1. 概述

`hula` 项目的 API 交互主要分为三部分：
1. **Matrix Client-Server API**: 遵循 [Matrix Spec](https://spec.matrix.org/latest/client-server-api/)。
2. **Internal Microservices API**: 由 `hula` 后端提供的业务接口。
3. **Tauri IPC Command API**: 前端与 Rust 壳层的交互接口。

## 2. OpenAPI 接入规范

为了确保前后端契约的一致性，本项目要求：
- 所有 **Internal Microservices** 必须提供标准的 `openapi.json` 或 `swagger.json`。
- 前端使用 `openapi-typescript` 或类似工具自动生成类型定义。

### 2.1 推荐工具链

- **文档生成**: 后端集成 Swagger/Knife4j。
- **类型同步**: `npx openapi-typescript <url_to_openapi_json> --output src/services/api/types.ts`。

## 3. Tauri IPC 接口规范

Tauri 侧的接口（Command）目前通过 Rust 宏 `#[tauri::command]` 定义。

### 3.1 核心指令清单 (示例)

| 指令 | 描述 | 输入参数 | 返回值 |
|---|---|---|---|
| `get_user_tokens` | 获取本地存储的 Token | 无 | `StoredMatrixTokens` |
| `update_token` | 更新本地 Token | `uid, token, refresh_token` | `Result<(), Error>` |
| `discover_service` | 服务发现指令 | `service_name` | `ServiceInstance[]` |

## 4. 维护计划

- [ ] 建立自动化任务：每周同步一次后端 OpenAPI 类型。
- [ ] 针对 Tauri 指令，探索使用 `ts-rs` 自动从 Rust 结构体生成 TypeScript 类型定义。
