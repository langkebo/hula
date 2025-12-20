# Requirements Document

## Introduction

本文档定义了 HuLa-Server 项目代码质量优化的需求规范。经过代码审查，发现以下问题需要进一步优化：推送统计接口使用估算数据而非真实统计、小米/OPPO/Vivo 推送核心逻辑待实现、代码耦合度优化等。

## Glossary

- **Push_Service**: 推送服务模块，负责消息推送功能
- **Push_Statistics**: 推送统计数据，包括成功率、失败率、各渠道推送量等
- **Push_Provider**: 推送提供商，如 APNs、FCM、华为、小米、OPPO、Vivo 等
- **Push_Record**: 推送记录，记录每次推送的结果和状态
- **Batch_Query**: 批量查询，一次查询多条数据以提高性能

## Requirements

### Requirement 1: 实现推送统计真实数据

**User Story:** As a product manager, I want push statistics to return real data based on actual push records, so that I can make informed decisions based on accurate metrics.

#### Acceptance Criteria

1. WHEN calling push statistics API THEN the System SHALL return data aggregated from actual push records
2. WHEN calculating success rate THEN the System SHALL use real success/failure counts from push_record table
3. WHEN no push records exist THEN the System SHALL return zero values with accurate counts
4. THE Push_Statistics SHALL include total_count, success_count, failure_count calculated from real data

### Requirement 2: 实现小米推送核心逻辑

**User Story:** As a developer, I want Xiaomi push provider to have complete implementation, so that Android users with Xiaomi devices can receive push notifications.

#### Acceptance Criteria

1. WHEN pushing to Xiaomi device THEN the System SHALL call Xiaomi Push API with proper authentication
2. WHEN batch pushing to multiple Xiaomi devices THEN the System SHALL use Xiaomi batch API
3. IF Xiaomi push fails THEN the System SHALL log the error and return failure status
4. THE XiaomiPushProvider SHALL implement all methods defined in PushProvider interface

### Requirement 3: 实现 OPPO 推送核心逻辑

**User Story:** As a developer, I want OPPO push provider to have complete implementation, so that Android users with OPPO devices can receive push notifications.

#### Acceptance Criteria

1. WHEN pushing to OPPO device THEN the System SHALL call OPPO Push API with proper authentication
2. WHEN batch pushing to multiple OPPO devices THEN the System SHALL use OPPO batch API
3. IF OPPO push fails THEN the System SHALL log the error and return failure status
4. THE OppoPushProvider SHALL implement all methods defined in PushProvider interface

### Requirement 4: 实现 Vivo 推送核心逻辑

**User Story:** As a developer, I want Vivo push provider to have complete implementation, so that Android users with Vivo devices can receive push notifications.

#### Acceptance Criteria

1. WHEN pushing to Vivo device THEN the System SHALL call Vivo Push API with proper authentication
2. WHEN batch pushing to multiple Vivo devices THEN the System SHALL use Vivo batch API
3. IF Vivo push fails THEN the System SHALL log the error and return failure status
4. THE VivoPushProvider SHALL implement all methods defined in PushProvider interface

### Requirement 5: 创建推送记录表和服务

**User Story:** As a developer, I want push operations to be recorded in database, so that statistics can be calculated from real data.

#### Acceptance Criteria

1. WHEN a push operation is executed THEN the System SHALL create a push_record entry
2. THE Push_Record SHALL include push_id, user_id, device_type, status, create_time, response_code
3. WHEN querying statistics THEN the System SHALL aggregate data from push_record table
4. THE Push_Record_Service SHALL provide methods for creating and querying push records

