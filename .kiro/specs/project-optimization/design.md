# Design Document: HuLa-Server 项目优化

## Overview

本设计文档详细描述 HuLa-Server 即时通讯系统的全面优化方案。优化涵盖安全加固、代码质量提升、功能完善和架构改进四个主要方面。

### 优化目标
- 将生产就绪度从 9.0/10 提升至 9.5/10
- 消除所有 P0 级安全风险
- 完成所有核心功能的实现
- 建立可持续的代码质量保障机制

### 技术栈
- Java 21 + Spring Boot 3.4.4 + Spring Cloud 2024
- MyBatis-Plus + MySQL 8.0
- Redis 7 + RocketMQ
- Elasticsearch 8.11
- jqwik 1.8.2 (属性测试)

## Architecture

### 整体架构优化

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway Layer                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  luohuo-gateway (路由 + 鉴权 + 限流 + 审计日志)              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      Business Service Layer                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │luohuo-im │ │luohuo-ws │ │luohuo-   │ │luohuo-   │           │
│  │(消息业务)│ │(WebSocket)│ │oauth     │ │presence  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      Infrastructure Layer                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ MySQL    │ │ Redis    │ │ RocketMQ │ │Elastic-  │           │
│  │          │ │          │ │          │ │search    │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      Observability Layer                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Prometheus│ │ Grafana  │ │ Zipkin   │ │ ELK Stack│           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. 敏感配置管理组件 (SecretsManager)

```java
/**
 * 敏感配置管理接口
 */
public interface SecretsManager {
    /**
     * 获取敏感配置值
     * @param key 配置键
     * @return 配置值
     * @throws SecretNotFoundException 配置不存在时抛出
     */
    String getSecret(String key);
    
    /**
     * 获取敏感配置值，带默认值
     */
    String getSecret(String key, String defaultValue);
    
    /**
     * 检查配置是否存在
     */
    boolean hasSecret(String key);
    
    /**
     * 刷新配置缓存
     */
    void refresh();
}

/**
 * 环境变量实现
 */
@Component
@Primary
public class EnvironmentSecretsManager implements SecretsManager {
    // 从环境变量加载敏感配置
}

/**
 * Vault 实现 (可选)
 */
@Component
@ConditionalOnProperty(name = "secrets.provider", havingValue = "vault")
public class VaultSecretsManager implements SecretsManager {
    // 从 HashiCorp Vault 加载敏感配置
}
```

### 2. 统一异常处理组件

```java
/**
 * 业务异常基类
 */
public abstract class BusinessException extends RuntimeException {
    private final String errorCode;
    private final Object[] args;
    
    public BusinessException(String errorCode, String message, Object... args) {
        super(message);
        this.errorCode = errorCode;
        this.args = args;
    }
}

/**
 * 具体业务异常
 */
public class MessageNotFoundException extends BusinessException {
    public MessageNotFoundException(Long messageId) {
        super("MSG_NOT_FOUND", "消息不存在: " + messageId, messageId);
    }
}

public class UserNotFoundException extends BusinessException {
    public UserNotFoundException(Long userId) {
        super("USER_NOT_FOUND", "用户不存在: " + userId, userId);
    }
}

public class UnauthorizedException extends BusinessException {
    public UnauthorizedException(String resource) {
        super("UNAUTHORIZED", "无权访问资源: " + resource, resource);
    }
}

/**
 * 全局异常处理器
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    
    @ExceptionHandler(BusinessException.class)
    public R<Void> handleBusinessException(BusinessException e, HttpServletRequest request) {
        log.warn("业务异常: code={}, message={}, uri={}", 
            e.getErrorCode(), e.getMessage(), request.getRequestURI());
        return R.fail(e.getErrorCode(), e.getMessage());
    }
    
    @ExceptionHandler(Exception.class)
    public R<Void> handleException(Exception e, HttpServletRequest request) {
        String traceId = MDC.get("traceId");
        log.error("系统异常: traceId={}, uri={}", traceId, request.getRequestURI(), e);
        return R.fail("SYSTEM_ERROR", "系统繁忙，请稍后重试 [" + traceId + "]");
    }
}
```

### 3. 推送服务组件

```java
/**
 * 推送提供者接口
 */
public interface PushProvider {
    /**
     * 发送推送通知
     */
    PushResult push(PushRequest request);
    
    /**
     * 批量发送推送通知
     */
    List<PushResult> batchPush(List<PushRequest> requests);
    
    /**
     * 获取支持的平台
     */
    PushPlatform getPlatform();
    
    /**
     * 检查令牌有效性
     */
    boolean validateToken(String token);
    
    /**
     * 处理无效令牌
     */
    void handleInvalidToken(String token);
}

/**
 * 小米推送实现
 */
@Component
@ConditionalOnProperty(name = "push.xiaomi.enabled", havingValue = "true")
public class XiaomiPushProvider implements PushProvider {
    
    @Value("${push.xiaomi.app-secret}")
    private String appSecret;
    
    @Value("${push.xiaomi.package-name}")
    private String packageName;
    
    @Override
    public PushResult push(PushRequest request) {
        // 完整实现小米推送逻辑
        Message message = buildMessage(request);
        Result result = sender.send(message);
        
        if (result.getErrorCode() != ErrorCode.Success) {
            handlePushError(result, request.getDeviceToken());
        }
        
        return convertResult(result);
    }
    
    @Override
    public void handleInvalidToken(String token) {
        // 从数据库删除无效令牌
        deviceTokenService.removeToken(token, PushPlatform.XIAOMI);
        log.info("已删除无效的小米推送令牌: {}", maskToken(token));
    }
}

/**
 * OPPO 推送实现
 */
@Component
@ConditionalOnProperty(name = "push.oppo.enabled", havingValue = "true")
public class OppoPushProvider implements PushProvider {
    // 完整实现 OPPO 推送逻辑
}

/**
 * Vivo 推送实现
 */
@Component
@ConditionalOnProperty(name = "push.vivo.enabled", havingValue = "true")
public class VivoPushProvider implements PushProvider {
    // 完整实现 Vivo 推送逻辑
}
```

### 4. 搜索服务组件

```java
/**
 * 搜索服务接口
 */
public interface SearchService {
    SearchResponse<UserDocument> searchUsers(SearchRequest request);
    SearchResponse<ConversationDocument> searchConversations(SearchRequest request);
    SearchResponse<FileDocument> searchFiles(SearchRequest request);
    SearchResponse<ImageDocument> searchImages(SearchRequest request);
    void reindex(String type, Long id);
    void reindexAll();
}

/**
 * 搜索服务实现
 */
@Service
@Slf4j
public class SearchServiceImpl implements SearchService {
    
    private final ElasticsearchClient esClient;
    private final UserService userService;
    private final ConversationService conversationService;
    
    @Override
    public SearchResponse<UserDocument> searchUsers(SearchRequest request) {
        SearchRequest.Builder builder = new SearchRequest.Builder()
            .index("users")
            .query(q -> q.multiMatch(m -> m
                .query(request.getKeyword())
                .fields("nickname", "username", "email")
                .fuzziness("AUTO")
            ))
            .from(request.getPage() * request.getSize())
            .size(request.getSize());
        
        co.elastic.clients.elasticsearch.core.SearchResponse<UserDocument> response = 
            esClient.search(builder.build(), UserDocument.class);
        
        return convertResponse(response, request);
    }
    
    @Override
    public SearchResponse<ConversationDocument> searchConversations(SearchRequest request) {
        // 实现会话搜索
        Long userId = SecurityUtils.getCurrentUserId();
        
        SearchRequest.Builder builder = new SearchRequest.Builder()
            .index("conversations")
            .query(q -> q.bool(b -> b
                .must(m -> m.term(t -> t.field("participants").value(userId)))
                .must(m -> m.multiMatch(mm -> mm
                    .query(request.getKeyword())
                    .fields("name", "lastMessage")
                ))
            ))
            .from(request.getPage() * request.getSize())
            .size(request.getSize());
        
        return executeSearch(builder.build(), ConversationDocument.class, request);
    }
    
    @Override
    public SearchResponse<FileDocument> searchFiles(SearchRequest request) {
        // 实现文件搜索
        Long userId = SecurityUtils.getCurrentUserId();
        
        SearchRequest.Builder builder = new SearchRequest.Builder()
            .index("files")
            .query(q -> q.bool(b -> b
                .must(m -> m.term(t -> t.field("ownerId").value(userId)))
                .must(m -> m.multiMatch(mm -> mm
                    .query(request.getKeyword())
                    .fields("fileName", "content")
                ))
            ))
            .from(request.getPage() * request.getSize())
            .size(request.getSize());
        
        return executeSearch(builder.build(), FileDocument.class, request);
    }
    
    @Override
    public SearchResponse<ImageDocument> searchImages(SearchRequest request) {
        // 实现图片搜索 (基于标签和描述)
        Long userId = SecurityUtils.getCurrentUserId();
        
        SearchRequest.Builder builder = new SearchRequest.Builder()
            .index("images")
            .query(q -> q.bool(b -> b
                .must(m -> m.term(t -> t.field("ownerId").value(userId)))
                .should(s -> s.match(mm -> mm.field("tags").query(request.getKeyword())))
                .should(s -> s.match(mm -> mm.field("description").query(request.getKeyword())))
                .minimumShouldMatch("1")
            ))
            .from(request.getPage() * request.getSize())
            .size(request.getSize());
        
        return executeSearch(builder.build(), ImageDocument.class, request);
    }
    
    @Override
    @Async
    public void reindex(String type, Long id) {
        log.info("开始重建索引: type={}, id={}", type, id);
        switch (type) {
            case "user" -> reindexUser(id);
            case "conversation" -> reindexConversation(id);
            case "file" -> reindexFile(id);
            case "image" -> reindexImage(id);
            default -> log.warn("未知的索引类型: {}", type);
        }
    }
    
    @Override
    @Async
    public void reindexAll() {
        log.info("开始全量重建索引...");
        reindexAllUsers();
        reindexAllConversations();
        reindexAllFiles();
        reindexAllImages();
        log.info("全量重建索引完成");
    }
}
```

### 5. 审计日志组件

```java
/**
 * 审计日志注解
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AuditLog {
    String action();
    String resource() default "";
    String description() default "";
}

/**
 * 审计日志实体
 */
@Data
@TableName("sys_audit_log")
public class AuditLogEntity {
    private Long id;
    private Long userId;
    private String username;
    private String action;
    private String resource;
    private String resourceId;
    private String description;
    private String requestMethod;
    private String requestUri;
    private String requestParams;
    private String responseStatus;
    private String clientIp;
    private String userAgent;
    private String traceId;
    private LocalDateTime createTime;
    private Long duration;
}

/**
 * 审计日志切面
 */
@Aspect
@Component
@Slf4j
public class AuditLogAspect {
    
    private final AuditLogService auditLogService;
    
    @Around("@annotation(auditLog)")
    public Object around(ProceedingJoinPoint point, AuditLog auditLog) throws Throwable {
        long startTime = System.currentTimeMillis();
        HttpServletRequest request = getRequest();
        
        AuditLogEntity logEntity = new AuditLogEntity();
        logEntity.setUserId(SecurityUtils.getCurrentUserId());
        logEntity.setUsername(SecurityUtils.getCurrentUsername());
        logEntity.setAction(auditLog.action());
        logEntity.setResource(auditLog.resource());
        logEntity.setDescription(auditLog.description());
        logEntity.setRequestMethod(request.getMethod());
        logEntity.setRequestUri(request.getRequestURI());
        logEntity.setRequestParams(getRequestParams(point));
        logEntity.setClientIp(IpUtils.getClientIp(request));
        logEntity.setUserAgent(request.getHeader("User-Agent"));
        logEntity.setTraceId(MDC.get("traceId"));
        logEntity.setCreateTime(LocalDateTime.now());
        
        try {
            Object result = point.proceed();
            logEntity.setResponseStatus("SUCCESS");
            return result;
        } catch (Exception e) {
            logEntity.setResponseStatus("FAILED: " + e.getMessage());
            throw e;
        } finally {
            logEntity.setDuration(System.currentTimeMillis() - startTime);
            auditLogService.saveAsync(logEntity);
        }
    }
}
```

## Data Models

### 审计日志表结构

```sql
CREATE TABLE sys_audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT COMMENT '用户ID',
    username VARCHAR(64) COMMENT '用户名',
    action VARCHAR(64) NOT NULL COMMENT '操作类型',
    resource VARCHAR(64) COMMENT '资源类型',
    resource_id VARCHAR(64) COMMENT '资源ID',
    description VARCHAR(255) COMMENT '操作描述',
    request_method VARCHAR(10) COMMENT '请求方法',
    request_uri VARCHAR(255) COMMENT '请求URI',
    request_params TEXT COMMENT '请求参数',
    response_status VARCHAR(255) COMMENT '响应状态',
    client_ip VARCHAR(64) COMMENT '客户端IP',
    user_agent VARCHAR(512) COMMENT 'User-Agent',
    trace_id VARCHAR(64) COMMENT '追踪ID',
    create_time DATETIME NOT NULL COMMENT '创建时间',
    duration BIGINT COMMENT '执行时长(ms)',
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_create_time (create_time),
    INDEX idx_trace_id (trace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志表';
```

### 设备令牌表结构优化

```sql
-- 添加令牌状态和最后验证时间
ALTER TABLE im_device_token 
ADD COLUMN status TINYINT DEFAULT 1 COMMENT '状态: 1-有效, 0-无效',
ADD COLUMN last_validated_at DATETIME COMMENT '最后验证时间',
ADD COLUMN invalid_reason VARCHAR(255) COMMENT '无效原因',
ADD INDEX idx_status (status),
ADD INDEX idx_platform_status (platform, status);
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 敏感配置加载正确性

*For any* 配置键值对集合，当这些键值对被设置为环境变量时，SecretsManager 应该能够正确加载并返回对应的值。

**Validates: Requirements 1.1**

### Property 2: 配置文件无敏感信息

*For any* 配置文件（.yml, .properties, .xml），文件内容不应匹配任何敏感信息模式（密码、密钥、令牌等）。

**Validates: Requirements 1.2**

### Property 3: 缺失配置启动失败

*For any* 必需的敏感配置键，当该键在环境变量中缺失时，应用启动应该抛出 SecretNotFoundException 并包含明确的错误信息。

**Validates: Requirements 1.4**

### Property 4: 无泛型异常捕获

*For any* Java 源文件中的 catch 块，不应使用 `catch(Exception e)` 或 `catch(Throwable t)` 的泛型捕获模式（除非在全局异常处理器中）。

**Validates: Requirements 3.1**

### Property 5: 异常日志完整性

*For any* 抛出的异常，日志记录应包含完整的异常堆栈信息、请求上下文（URI、方法、参数）和追踪 ID。

**Validates: Requirements 3.2**

### Property 6: 错误响应标准化

*For any* API 请求产生的异常，返回的响应应符合标准格式：包含 code、message 字段，且不暴露内部实现细节（如类名、行号、SQL 语句）。

**Validates: Requirements 3.4, 3.5**

### Property 7: 无效推送令牌清理

*For any* 推送请求返回令牌无效错误时，该令牌应在 5 秒内从数据库中被标记为无效或删除。

**Validates: Requirements 4.4**

### Property 8: 搜索结果相关性

*For any* 搜索请求和索引数据集，搜索结果应只包含与关键词匹配的文档，且结果数量不超过请求的 size 参数。

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 9: 搜索错误处理

*For any* 搜索请求失败（如 Elasticsearch 不可用），应返回友好的错误信息而非抛出未处理异常，且错误应被记录到日志。

**Validates: Requirements 5.6**

### Property 10: 审计日志完整性

*For any* 标记了 @AuditLog 注解的方法调用，审计日志记录应包含：userId、action、resource、clientIp、createTime、duration 字段，且所有字段非空。

**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 11: Controller 授权注解覆盖

*For any* Controller 类中的公开 HTTP 方法（@GetMapping, @PostMapping 等），应存在 @PreAuthorize、@SaCheckPermission 或 @SaIgnore 注解。

**Validates: Requirements 8.1**

### Property 12: 未授权访问拒绝

*For any* 受保护的 API 端点，当请求不包含有效的认证令牌或权限不足时，应返回 401 或 403 状态码。

**Validates: Requirements 8.2**

## Error Handling

### 异常类层次结构

```
RuntimeException
└── BusinessException (业务异常基类)
    ├── ResourceNotFoundException (资源不存在)
    │   ├── UserNotFoundException
    │   ├── MessageNotFoundException
    │   └── ConversationNotFoundException
    ├── ValidationException (验证失败)
    │   ├── InvalidParameterException
    │   └── DuplicateResourceException
    ├── AuthorizationException (授权失败)
    │   ├── UnauthorizedException
    │   └── ForbiddenException
    ├── ExternalServiceException (外部服务异常)
    │   ├── PushServiceException
    │   └── SearchServiceException
    └── ConfigurationException (配置异常)
        └── SecretNotFoundException
```

### 错误响应格式

```json
{
    "code": "USER_NOT_FOUND",
    "message": "用户不存在",
    "traceId": "abc123def456",
    "timestamp": "2025-12-21T10:30:00Z",
    "path": "/api/users/123"
}
```

### 错误码规范

| 错误码前缀 | 含义 | 示例 |
|-----------|------|------|
| AUTH_ | 认证授权错误 | AUTH_TOKEN_EXPIRED |
| USER_ | 用户相关错误 | USER_NOT_FOUND |
| MSG_ | 消息相关错误 | MSG_SEND_FAILED |
| PUSH_ | 推送相关错误 | PUSH_TOKEN_INVALID |
| SEARCH_ | 搜索相关错误 | SEARCH_INDEX_ERROR |
| CONFIG_ | 配置相关错误 | CONFIG_SECRET_MISSING |
| SYS_ | 系统错误 | SYS_INTERNAL_ERROR |

## Testing Strategy

### 测试框架

- **单元测试**: JUnit 5 + Mockito
- **属性测试**: jqwik 1.8.2
- **集成测试**: Spring Boot Test + Testcontainers
- **API 测试**: MockMvc + RestAssured

### 属性测试配置

```java
@PropertyDefaults(tries = 100)
public class PropertyTestConfig {
    // 每个属性测试运行 100 次迭代
}
```

### 测试覆盖目标

| 模块 | 目标覆盖率 | 当前覆盖率 |
|------|-----------|-----------|
| luohuo-im-biz | 70% | ~40% |
| luohuo-ws-biz | 70% | ~35% |
| luohuo-oauth | 70% | ~50% |
| luohuo-base | 70% | ~45% |

### 属性测试示例

```java
/**
 * Feature: project-optimization, Property 1: 敏感配置加载正确性
 * Validates: Requirements 1.1
 */
@Property(tries = 100)
void secretsManagerLoadsConfigCorrectly(
    @ForAll @AlphaNumeric @StringLength(min = 1, max = 50) String key,
    @ForAll @AlphaNumeric @StringLength(min = 1, max = 100) String value
) {
    // Arrange
    System.setProperty(key, value);
    
    // Act
    String result = secretsManager.getSecret(key);
    
    // Assert
    assertThat(result).isEqualTo(value);
    
    // Cleanup
    System.clearProperty(key);
}

/**
 * Feature: project-optimization, Property 6: 错误响应标准化
 * Validates: Requirements 3.4, 3.5
 */
@Property(tries = 100)
void errorResponseIsStandardized(
    @ForAll("businessExceptions") BusinessException exception
) {
    // Act
    R<Void> response = globalExceptionHandler.handleBusinessException(exception, mockRequest);
    
    // Assert
    assertThat(response.getCode()).isNotNull();
    assertThat(response.getMessage()).isNotNull();
    assertThat(response.getMessage()).doesNotContain("Exception");
    assertThat(response.getMessage()).doesNotContain(".java:");
    assertThat(response.getMessage()).doesNotContainIgnoringCase("sql");
}

/**
 * Feature: project-optimization, Property 10: 审计日志完整性
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 */
@Property(tries = 100)
void auditLogContainsRequiredFields(
    @ForAll("auditLogEntities") AuditLogEntity logEntity
) {
    // Assert
    assertThat(logEntity.getUserId()).isNotNull();
    assertThat(logEntity.getAction()).isNotBlank();
    assertThat(logEntity.getClientIp()).isNotBlank();
    assertThat(logEntity.getCreateTime()).isNotNull();
    assertThat(logEntity.getDuration()).isNotNull();
    assertThat(logEntity.getDuration()).isGreaterThanOrEqualTo(0);
}
```

### 单元测试与属性测试的平衡

- **单元测试**: 用于验证具体的边界条件和特定场景
- **属性测试**: 用于验证通用规则和不变量
- 两者互补，共同确保代码质量


## Deployment Architecture

### 部署流程优化

```
┌─────────────────────────────────────────────────────────────────┐
│                     部署流程 (deploy.sh)                         │
├─────────────────────────────────────────────────────────────────┤
│  1. 环境检查                                                     │
│     ├── 检查 Docker 安装                                         │
│     ├── 检查 JDK 21 安装                                         │
│     ├── 检查 Maven 安装                                          │
│     └── 检查网络连接                                             │
├─────────────────────────────────────────────────────────────────┤
│  2. 配置初始化                                                   │
│     ├── 运行 init-passwords.sh 生成密码                          │
│     ├── 检测服务器 IP 并更新 broker.conf                         │
│     ├── 创建必需的目录结构                                       │
│     └── 验证配置文件完整性                                       │
├─────────────────────────────────────────────────────────────────┤
│  3. 基础设施部署                                                 │
│     ├── 启动 MySQL (等待健康检查通过)                            │
│     ├── 启动 Redis (等待健康检查通过)                            │
│     ├── 启动 Nacos (等待健康检查通过)                            │
│     ├── 启动 RocketMQ (NameServer + Broker)                     │
│     └── 启动 MinIO                                              │
├─────────────────────────────────────────────────────────────────┤
│  4. 数据库初始化                                                 │
│     ├── 导入 Nacos 数据库 Schema                                 │
│     ├── 导入业务数据库 (luohuo_dev, luohuo_im_01)               │
│     └── 执行数据库迁移脚本                                       │
├─────────────────────────────────────────────────────────────────┤
│  5. Nacos 配置导入                                               │
│     ├── 检查配置文件存在                                         │
│     ├── 生成动态配置 (mysql.yml, redis.yml, rocketmq.yml)       │
│     ├── 导入配置到 Nacos                                         │
│     └── 验证配置导入成功                                         │
├─────────────────────────────────────────────────────────────────┤
│  6. 应用服务部署                                                 │
│     ├── 编译项目 (mvn clean package -DskipTests)                │
│     ├── 构建 Docker 镜像                                         │
│     ├── 启动 Gateway → OAuth → Base → IM → WS                   │
│     └── 等待所有服务健康检查通过                                 │
├─────────────────────────────────────────────────────────────────┤
│  7. 部署验证                                                     │
│     ├── 运行 health-check.sh                                     │
│     ├── 验证 API 端点可访问                                      │
│     └── 输出部署结果和访问地址                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 部署问题修复设计

#### 1. RocketMQ Broker IP 自动配置

```bash
# 在 init-passwords.sh 中自动检测并设置 IP
detect_server_ip() {
    # 优先使用命令行参数
    if [ -n "$SERVER_IP_OVERRIDE" ]; then
        echo "$SERVER_IP_OVERRIDE"
        return
    fi
    
    # 尝试获取公网 IP
    PUBLIC_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || \
                curl -s --connect-timeout 5 icanhazip.com 2>/dev/null || \
                echo "")
    
    if [ -n "$PUBLIC_IP" ]; then
        echo "$PUBLIC_IP"
        return
    fi
    
    # 获取内网 IP
    hostname -I | awk '{print $1}'
}

# 更新 broker.conf
update_broker_config() {
    local ip=$(detect_server_ip)
    if [ -n "$ip" ] && [ "$ip" != "YOUR_SERVER_IP" ]; then
        sed -i "s/^brokerIP1=.*/brokerIP1=${ip}/" rocketmq/broker/conf/broker.conf
        echo "✓ 已设置 brokerIP1=${ip}"
    fi
}
```

#### 2. Nacos 配置导入重试机制

```bash
# 带重试的配置导入
import_nacos_config_with_retry() {
    local max_retries=3
    local retry_delay=10
    
    for i in $(seq 1 $max_retries); do
        echo "尝试导入 Nacos 配置 (第 $i 次)..."
        
        if import_nacos_config; then
            echo "✓ Nacos 配置导入成功"
            return 0
        fi
        
        if [ $i -lt $max_retries ]; then
            echo "导入失败，${retry_delay}秒后重试..."
            sleep $retry_delay
        fi
    done
    
    echo "⚠ Nacos 配置导入失败，请手动导入"
    return 1
}
```

#### 3. Linux 环境 host.docker.internal 支持

```yaml
# docker-compose.services.yml 中添加
services:
  gateway:
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - SERVICE_HOST=${SERVICE_HOST:-host.docker.internal}
```

#### 4. 健康检查增强

```bash
# 增强的健康检查脚本
wait_for_service() {
    local service_name=$1
    local check_cmd=$2
    local max_wait=${3:-120}
    local interval=${4:-5}
    
    echo -n "等待 ${service_name}..."
    local elapsed=0
    
    while [ $elapsed -lt $max_wait ]; do
        if eval "$check_cmd" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC} (${elapsed}s)"
            return 0
        fi
        echo -n "."
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    echo -e " ${RED}✗${NC} (超时)"
    return 1
}
```

### 缺失配置文件补全

需要创建以下缺失的配置文件：

1. **docs/install/docker/docker/prometheus/prometheus.yml**
2. **docs/install/docker/docker/grafana/provisioning/**
3. **docs/install/docker/docker/nginx/nginx.conf**
4. **docs/install/docker/docker/redis/redis.conf** (如果不存在)
5. **docs/install/docker/scripts/db-init.sql**
6. **docs/install/docker/scripts/db-integrity-fix.sql**

### 部署脚本改进

```bash
#!/bin/bash
# 改进的部署脚本结构

# 错误处理
set -euo pipefail
trap 'echo "错误发生在第 $LINENO 行"; exit 1' ERR

# 日志函数
log_info() { echo -e "\033[0;32m[INFO]\033[0m $1"; }
log_warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

# 前置检查
pre_check() {
    log_info "执行前置检查..."
    
    # 检查必需的命令
    for cmd in docker curl unzip; do
        if ! command -v $cmd &> /dev/null; then
            log_error "$cmd 未安装"
            exit 1
        fi
    done
    
    # 检查必需的配置文件
    local required_files=(
        "rocketmq/broker/conf/broker.conf"
        "redis/redis.conf"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "缺少配置文件: $file"
            exit 1
        fi
    done
    
    log_info "前置检查通过"
}

# 主函数
main() {
    pre_check
    init_passwords
    start_infrastructure
    wait_for_infrastructure
    import_database
    import_nacos_config_with_retry
    start_applications
    run_health_check
    show_summary
}
```
