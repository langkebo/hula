# Design Document: 推送服务优化

## Overview

本设计文档描述了 HuLa-Server 推送服务的优化方案。主要包括：
1. 实现推送记录持久化，支持真实统计数据
2. 完善小米、OPPO、Vivo 推送提供商的核心逻辑
3. 优化推送统计接口，使用真实数据替代估算值

## Architecture

推送服务采用策略模式，通过 `PushProvider` 接口统一各厂商推送实现：

```
luohuo-im/
├── push/
│   ├── PushProvider.java          # 推送提供者接口
│   ├── PushType.java              # 推送类型枚举
│   ├── ApnsPushProvider.java      # iOS APNs 推送 ✅
│   ├── FcmPushProvider.java       # Android FCM 推送 ✅
│   ├── HuaweiPushProvider.java    # 华为推送 ✅
│   ├── XiaomiPushProvider.java    # 小米推送 ⚠️ 待完善
│   ├── OppoPushProvider.java      # OPPO推送 ⚠️ 待完善
│   └── VivoPushProvider.java      # Vivo推送 ⚠️ 待完善
├── service/
│   ├── PushService.java           # 推送服务接口
│   ├── PushRecordService.java     # 推送记录服务 🆕
│   └── impl/
│       ├── PushServiceImpl.java   # 推送服务实现
│       └── PushRecordServiceImpl.java  # 推送记录服务实现 🆕
├── entity/
│   ├── PushDevice.java            # 推送设备实体 ✅
│   └── PushRecord.java            # 推送记录实体 🆕
└── mapper/
    ├── PushDeviceMapper.java      # 设备Mapper ✅
    └── PushRecordMapper.java      # 记录Mapper 🆕
```

## Components and Interfaces

### 1. PushRecord 实体类

```java
@Data
@TableName("im_push_record")
public class PushRecord {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String deviceToken;
    private String pushType;      // apns/fcm/huawei/xiaomi/oppo/vivo
    private String title;
    private String content;
    private String extra;         // JSON格式
    private String status;        // pending/success/failed
    private String errorMessage;
    private LocalDateTime createTime;
    private Long tenantId;
}
```

### 2. PushRecordService 接口

```java
public interface PushRecordService {
    /**
     * 创建推送记录
     */
    PushRecord createRecord(Long userId, String deviceToken, String pushType, 
                           String title, String content, Map<String, Object> extra);
    
    /**
     * 更新推送状态
     */
    void updateStatus(Long recordId, String status, String errorMessage);
    
    /**
     * 获取统计数据
     */
    PushStatistics getStatistics(Long startTime, Long endTime);
    
    /**
     * 按类型统计
     */
    Map<String, Long> countByType(Long startTime, Long endTime);
}
```

### 3. 小米推送核心逻辑

小米推送使用 HTTP API，需要：
1. 使用 AppSecret 进行认证
2. 调用 `https://api.xmpush.xiaomi.com/v3/message/regid` 发送消息

```java
// 认证头
Authorization: key={appSecret}

// 请求体
{
    "registration_id": "deviceToken",
    "payload": "{\"title\":\"xxx\",\"description\":\"xxx\"}",
    "restricted_package_name": "com.xxx.app",
    "pass_through": 0,
    "notify_type": 1
}
```

### 4. OPPO 推送核心逻辑

OPPO 推送需要：
1. 先获取 auth_token（使用 appKey + masterSecret）
2. 使用 auth_token 调用推送 API

```java
// 获取Token: POST https://api.push.oppomobile.com/server/v1/auth
// 推送消息: POST https://api.push.oppomobile.com/server/v1/message/notification/unicast
```

### 5. Vivo 推送核心逻辑

Vivo 推送需要：
1. 先获取 auth_token（使用 appId + appKey + appSecret）
2. 使用 auth_token 调用推送 API

```java
// 获取Token: POST https://api-push.vivo.com.cn/message/auth
// 推送消息: POST https://api-push.vivo.com.cn/message/send
```

## Data Models

### 数据库表结构

推送记录表 `im_push_record` 已在 `push.sql` 中定义：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| user_id | bigint | 用户ID |
| device_token | varchar(255) | 设备Token |
| push_type | varchar(20) | 推送类型 |
| title | varchar(255) | 标题 |
| content | text | 内容 |
| extra | json | 扩展信息 |
| status | varchar(20) | 状态 |
| error_message | text | 错误信息 |
| create_time | datetime | 创建时间 |
| tenant_id | bigint | 租户ID |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 推送统计数据一致性
*For any* set of push records in the database, the statistics returned by `getStatistics()` SHALL have `total_count` equal to the count of all records, `success_count` equal to records with status='success', and `failure_count` equal to records with status='failed'.
**Validates: Requirements 1.1, 1.2, 5.3**

### Property 2: 推送记录完整性
*For any* push operation executed through `PushProvider.push()`, a corresponding `PushRecord` entry SHALL be created containing user_id, device_token, push_type, status, and create_time.
**Validates: Requirements 5.1, 5.2**

### Property 3: 推送提供商接口一致性
*For any* implementation of `PushProvider` interface (Xiaomi, OPPO, Vivo), calling `push()` with valid parameters SHALL return a boolean result and not throw uncaught exceptions.
**Validates: Requirements 2.4, 3.4, 4.4**

## Error Handling

### 推送失败处理

1. **网络错误**: 记录错误信息，状态设为 `failed`，可加入重试队列
2. **认证失败**: 记录错误，检查配置是否正确
3. **设备Token无效**: 记录错误，标记设备为非活跃
4. **限流错误**: 记录错误，延迟重试

### 错误码映射

| 厂商 | 错误码 | 含义 | 处理方式 |
|------|--------|------|----------|
| 小米 | 20301 | Token无效 | 标记设备非活跃 |
| OPPO | 10000 | 成功 | 记录成功 |
| OPPO | 10001 | 参数错误 | 记录失败 |
| Vivo | 0 | 成功 | 记录成功 |
| Vivo | 10070 | Token无效 | 标记设备非活跃 |

## Testing Strategy

### 单元测试

1. **PushRecordService 测试**
   - 测试记录创建
   - 测试状态更新
   - 测试统计查询

2. **PushProvider 测试**
   - 使用 Mock HTTP Client 测试 API 调用
   - 测试错误处理逻辑

### 属性测试

使用 jqwik 进行属性测试：

```java
// Property 1: 统计数据一致性
@Property(tries = 100)
void statisticsMatchRecordCounts(@ForAll List<PushRecord> records) {
    // 插入记录
    // 查询统计
    // 验证 total = records.size()
    // 验证 success = records.filter(status=success).size()
}

// Property 2: 记录完整性
@Property(tries = 100)
void pushCreatesRecord(@ForAll @StringLength(min=1, max=100) String title,
                       @ForAll @StringLength(min=1, max=500) String content) {
    // 执行推送
    // 验证记录已创建
    // 验证字段完整
}
```

### 集成测试

- 使用 TestContainers 启动 MySQL
- 测试完整的推送流程
- 验证统计数据准确性
