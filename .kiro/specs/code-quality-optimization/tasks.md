# Implementation Plan: 推送服务优化

## Overview

本实现计划将推送服务从估算数据升级为真实统计数据，并完善小米、OPPO、Vivo 推送提供商的核心逻辑。

## Tasks

- [x] 1. 创建推送记录实体和服务
  - [x] 1.1 创建 PushRecord 实体类
    - 在 `luohuo-im-entity` 模块创建 `PushRecord.java`
    - 包含 id, userId, deviceToken, pushType, title, content, extra, status, errorMessage, createTime, tenantId 字段
    - _Requirements: 5.1, 5.2_
  - [x] 1.2 创建 PushRecordMapper 接口
    - 在 `luohuo-im-biz` 模块创建 `PushRecordMapper.java`
    - 添加统计查询方法 `countByStatus`, `countByType`
    - _Requirements: 5.3_
  - [x] 1.3 创建 PushRecordService 接口和实现
    - 创建 `PushRecordService.java` 接口
    - 创建 `PushRecordServiceImpl.java` 实现
    - 实现 createRecord, updateStatus, getStatistics 方法
    - _Requirements: 5.4_

- [x] 2. 优化推送统计接口
  - [x] 2.1 修改 PushServiceImpl.getStatistics 方法
    - 注入 PushRecordService
    - 使用真实记录数据替代估算值
    - 从 push_record 表聚合统计数据
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ]* 2.2 编写推送统计属性测试
    - **Property 1: 推送统计数据一致性**
    - **Validates: Requirements 1.1, 1.2, 5.3**

- [x] 3. Checkpoint - 验证推送记录功能
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 实现小米推送核心逻辑
  - [x] 4.1 实现小米推送 HTTP 客户端
    - 添加 OkHttp 依赖（如未添加）
    - 实现 `sendToXiaomi` 方法调用小米 API
    - 处理认证头 `Authorization: key={appSecret}`
    - _Requirements: 2.1, 2.2_
  - [x] 4.2 完善 XiaomiPushProvider.push 方法
    - 替换 TODO 注释为实际 API 调用
    - 添加推送记录创建
    - 处理响应和错误
    - _Requirements: 2.1, 2.3, 2.4_
  - [x] 4.3 完善 XiaomiPushProvider.batchPush 方法
    - 实现批量推送 API 调用
    - 处理分批逻辑（每批最多1000个）
    - _Requirements: 2.2_

- [x] 5. 实现 OPPO 推送核心逻辑
  - [x] 5.1 实现 OPPO 认证获取
    - 实现 `getOppoAuthToken` 方法
    - 使用 appKey + masterSecret 获取 auth_token
    - 添加 token 缓存机制
    - _Requirements: 3.1_
  - [x] 5.2 完善 OppoPushProvider.push 方法
    - 替换 TODO 注释为实际 API 调用
    - 添加推送记录创建
    - 处理响应和错误
    - _Requirements: 3.1, 3.3, 3.4_
  - [x] 5.3 完善 OppoPushProvider.batchPush 方法
    - 实现批量推送 API 调用
    - 处理分批逻辑
    - _Requirements: 3.2_

- [x] 6. 实现 Vivo 推送核心逻辑
  - [x] 6.1 实现 Vivo 认证获取
    - 实现 `getVivoAuthToken` 方法
    - 使用 appId + appKey + appSecret 获取 auth_token
    - 添加 token 缓存机制
    - _Requirements: 4.1_
  - [x] 6.2 完善 VivoPushProvider.push 方法
    - 替换 TODO 注释为实际 API 调用
    - 添加推送记录创建
    - 处理响应和错误
    - _Requirements: 4.1, 4.3, 4.4_
  - [x] 6.3 完善 VivoPushProvider.batchPush 方法
    - 实现批量推送 API 调用
    - 处理分批逻辑
    - _Requirements: 4.2_

- [x] 7. Checkpoint - 验证推送提供商实现
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. 集成推送记录到现有推送流程
  - [x] 8.1 修改 PushServiceImpl 集成推送记录
    - 在 pushToUser 方法中创建推送记录
    - 在推送完成后更新记录状态
    - _Requirements: 5.1_
  - [ ]* 8.2 编写推送记录完整性属性测试
    - **Property 2: 推送记录完整性**
    - **Validates: Requirements 5.1, 5.2**

- [x] 9. Final Checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 小米/OPPO/Vivo 推送需要在 Nacos 配置中添加对应的 appKey/appSecret
- 推送记录表 `im_push_record` 已在 `push.sql` 中定义
- 属性测试使用 jqwik 框架，已在项目中配置
