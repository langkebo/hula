package com.luohuo.flex.im.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * E2EE性能监控指标
 *
 * 使用Micrometer进行指标收集，支持：
 * - Prometheus
 * - Grafana
 * - Spring Boot Actuator
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnClass(MeterRegistry.class)
public class E2EEMetrics {

    private final MeterRegistry meterRegistry;

    private static final String METRIC_PREFIX = "e2ee.";

    /**
     * 记录加密操作耗时
     */
    public void recordEncryptionTime(long milliseconds) {
        Timer.builder(METRIC_PREFIX + "encryption.time")
                .description("Time taken to encrypt a message")
                .tag("operation", "encrypt")
                .register(meterRegistry)
                .record(milliseconds, TimeUnit.MILLISECONDS);
    }

    /**
     * 记录解密操作耗时
     */
    public void recordDecryptionTime(long milliseconds) {
        Timer.builder(METRIC_PREFIX + "decryption.time")
                .description("Time taken to decrypt a message")
                .tag("operation", "decrypt")
                .register(meterRegistry)
                .record(milliseconds, TimeUnit.MILLISECONDS);
    }

    /**
     * 记录密钥生成耗时
     */
    public void recordKeyGenerationTime(String keyType, long milliseconds) {
        Timer.builder(METRIC_PREFIX + "key.generation.time")
                .description("Time taken to generate a key")
                .tag("key_type", keyType)
                .register(meterRegistry)
                .record(milliseconds, TimeUnit.MILLISECONDS);
    }

    /**
     * 记录加密消息数量
     */
    public void incrementEncryptedMessages() {
        Counter.builder(METRIC_PREFIX + "messages.encrypted")
                .description("Total number of encrypted messages")
                .tag("type", "encrypted")
                .register(meterRegistry)
                .increment();
    }

    /**
     * 记录清理操作
     */
    public void recordCleanupOperation(String resourceType, int count) {
        Counter.builder(METRIC_PREFIX + "cleanup.operations")
                .description("Number of cleanup operations performed")
                .tag("resource_type", resourceType)
                .register(meterRegistry)
                .increment(count);
    }

    /**
     * 记录数据库查询耗时
     */
    public void recordDatabaseQueryTime(String queryType, long milliseconds) {
        Timer.builder(METRIC_PREFIX + "database.query.time")
                .description("Database query execution time")
                .tag("query_type", queryType)
                .register(meterRegistry)
                .record(milliseconds, TimeUnit.MILLISECONDS);
    }

    /**
     * 记录解密消息数量
     */
    public void incrementDecryptedMessages() {
        Counter.builder(METRIC_PREFIX + "messages.decrypted")
                .description("Total number of decrypted messages")
                .tag("type", "decrypted")
                .register(meterRegistry)
                .increment();
    }

    /**
     * 记录缓存命中
     */
    public void recordCacheHit(String cacheType) {
        Counter.builder(METRIC_PREFIX + "cache.hit")
                .description("Cache hit count")
                .tag("cache_type", cacheType)
                .register(meterRegistry)
                .increment();
    }

    /**
     * 记录缓存命中（批量）
     */
    public void recordCacheHit(String cacheType, int count) {
        Counter.builder(METRIC_PREFIX + "cache.hit")
                .description("Cache hit count")
                .tag("cache_type", cacheType)
                .register(meterRegistry)
                .increment(count);
    }

    /**
     * 记录缓存未命中
     */
    public void recordCacheMiss(String cacheType) {
        Counter.builder(METRIC_PREFIX + "cache.miss")
                .description("Cache miss count")
                .tag("cache_type", cacheType)
                .register(meterRegistry)
                .increment();
    }

    /**
     * 记录缓存未命中（批量）
     */
    public void recordCacheMiss(String cacheType, int count) {
        Counter.builder(METRIC_PREFIX + "cache.miss")
                .description("Cache miss count")
                .tag("cache_type", cacheType)
                .register(meterRegistry)
                .increment(count);
    }

    /**
     * 获取活跃用户数
     */
    public long getActiveUsers() {
        // 通过Gauge获取当前值，如果不存在返回0
        try {
            return (long) meterRegistry.get(METRIC_PREFIX + "active.users")
                    .gauge()
                    .value();
        } catch (Exception e) {
            return 0L;
        }
    }

    /**
     * 获取活跃会话数
     */
    public long getActiveSessions() {
        // 通过Gauge获取当前值，如果不存在返回0
        try {
            return (long) meterRegistry.get(METRIC_PREFIX + "active.sessions")
                    .gauge()
                    .value();
        } catch (Exception e) {
            return 0L;
        }
    }

    /**
     * 记录密钥轮换操作
     */
    public void recordKeyRotation(String keyType) {
        Counter.builder(METRIC_PREFIX + "key.rotation")
                .description("Key rotation operations")
                .tag("key_type", keyType)
                .register(meterRegistry)
                .increment();
    }

    /**
     * 记录签名验证操作
     */
    public void recordSignatureVerification(boolean success) {
        Counter.builder(METRIC_PREFIX + "signature.verification")
                .description("Signature verification operations")
                .tag("success", String.valueOf(success))
                .register(meterRegistry)
                .increment();
    }

    /**
     * 记录错误
     */
    public void recordError(String errorType) {
        Counter.builder(METRIC_PREFIX + "errors")
                .description("E2EE operation errors")
                .tag("error_type", errorType)
                .register(meterRegistry)
                .increment();
    }

    /**
     * 记录错误（带操作类型）
     */
    public void recordError(String errorType, String operation) {
        Counter.builder(METRIC_PREFIX + "errors")
                .description("E2EE operation errors")
                .tag("error_type", errorType)
                .tag("operation", operation)
                .register(meterRegistry)
                .increment();
    }

    /**
     * 记录密钥轮换（带数量）
     *
     * @param count 轮换的密钥数量
     */
    public void recordKeyRotation(int count) {
        Counter.builder(METRIC_PREFIX + "key.rotation.count")
                .description("Number of keys rotated")
                .register(meterRegistry)
                .increment(count);
    }

    /**
     * 记录强制密钥轮换
     *
     * @param userId 用户ID
     * @param count  轮换的密钥数量
     */
    public void recordForceKeyRotation(Long userId, int count) {
        Counter.builder(METRIC_PREFIX + "key.force_rotation")
                .description("Forced key rotation operations")
                .tag("user_id", String.valueOf(userId))
                .register(meterRegistry)
                .increment(count);
    }

    /**
     * 记录通用事件
     *
     * @param category 事件类别
     * @param type     事件类型
     */
    public void recordEvent(String category, String type) {
        Counter.builder(METRIC_PREFIX + "events")
                .description("E2EE events")
                .tag("category", category)
                .tag("type", type)
                .register(meterRegistry)
                .increment();
    }

    /**
     * 记录维护操作
     *
     * @param operation 操作名称
     * @param duration  操作耗时（毫秒）
     */
    public void recordMaintenanceOperation(String operation, long duration) {
        Timer.builder(METRIC_PREFIX + "maintenance")
                .description("Maintenance operations")
                .tag("operation", operation)
                .register(meterRegistry)
                .record(duration, java.util.concurrent.TimeUnit.MILLISECONDS);
    }

    /**
     * 记录公钥上传操作
     *
     * @param userId 用户ID
     */
    public void recordPublicKeyUpload(String userId) {
        Counter.builder(METRIC_PREFIX + "publickey.upload")
                .description("Public key upload operations")
                .tag("user_id", userId)
                .register(meterRegistry)
                .increment();
    }

    /**
     * 记录加密消息
     *
     * @param conversationId 会话ID
     * @param algorithm 加密算法
     */
    public void recordEncryptedMessage(String conversationId, String algorithm) {
        Counter.builder(METRIC_PREFIX + "message.encrypted")
                .description("Encrypted message operations")
                .tag("conversation_id", conversationId)
                .tag("algorithm", algorithm)
                .register(meterRegistry)
                .increment();
    }

    /**
     * 记录密钥包分发
     *
     * @param keyId 密钥ID
     * @param success 是否成功
     */
    public void recordKeyPackageDistributed(String keyId, boolean success) {
        Counter.builder(METRIC_PREFIX + "keypackage.distributed")
                .description("Key package distribution operations")
                .tag("key_id", keyId)
                .tag("success", String.valueOf(success))
                .register(meterRegistry)
                .increment();
    }

    /**
     * 记录签名验证时间
     *
     * @param milliseconds 验证耗时（毫秒）
     */
    public void recordSignatureVerificationTime(long milliseconds) {
        Timer.builder(METRIC_PREFIX + "signature.verification.time")
                .description("Signature verification time")
                .register(meterRegistry)
                .record(milliseconds, TimeUnit.MILLISECONDS);
    }

    /**
     * 记录批量操作
     *
     * @param operation 操作类型
     * @param count 操作数量
     */
    public void recordBatchOperation(String operation, int count) {
        Counter.builder(METRIC_PREFIX + "batch.operation")
                .description("Batch operations")
                .tag("operation", operation)
                .register(meterRegistry)
                .increment(count);
    }

    /**
     * 记录表大小
     *
     * @param tableName 表名
     * @param rowCount 行数
     */
    public void recordTableSize(String tableName, long rowCount) {
        io.micrometer.core.instrument.Gauge.builder(METRIC_PREFIX + "table.size", () -> rowCount)
                .description("Table row count")
                .tag("table", tableName)
                .register(meterRegistry);
    }

    /**
     * 记录限流器清理操作
     *
     * @param cleanedCount 清理的限流器数量
     */
    public void recordRateLimiterCleanup(int cleanedCount) {
        Counter.builder(METRIC_PREFIX + "ratelimiter.cleanup")
                .description("Rate limiter cleanup operations")
                .register(meterRegistry)
                .increment(cleanedCount);
    }
}
