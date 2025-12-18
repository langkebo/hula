package com.luohuo.flex.im.core.e2ee.monitor;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * E2EE Prometheus 指标收集器
 * 提供详细的 E2EE 操作指标监控
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
@Component
public class E2EEPromeetheusMetrics {

    @Autowired
    private MeterRegistry meterRegistry;

    // 计数器
    private Counter encryptionTotalCounter;
    private Counter decryptionTotalCounter;
    private Counter keyOperationCounter;
    private Counter messageDestructCounter;
    private Counter batchOperationCounter;
    private Counter cacheOperationCounter;
    private Counter apiRequestCounter;

    // 计时器
    private Timer encryptionTimer;
    private Timer decryptionTimer;
    private Timer keyOperationTimer;
    private Timer apiRequestTimer;
    private Timer batchOperationTimer;

    // 仪表盘
    private AtomicLong activeUsersGauge;
    private AtomicLong activeSessionsGauge;
    private AtomicLong messageQueueSizeGauge;
    private AtomicLong encryptionQueueSizeGauge;
    private AtomicLong keyCacheSizeGauge;

    // 速率计算
    private final ConcurrentHashMap<String, AtomicLong> lastMinuteCounters = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicLong> currentMinuteCounters = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        initCounters();
        initTimers();
        initGauges();
        initRateCalculators();

        log.info("E2EE Prometheus 指标初始化完成");
    }

    /**
     * 记录加密操作
     */
    public void recordEncryption(String algorithm, Duration duration, boolean success) {
        io.micrometer.core.instrument.Counter c = meterRegistry.counter(
                "e2ee_encryption_total",
                "algorithm", algorithm,
                "status", success ? "success" : "failure"
        );
        c.increment();
        io.micrometer.core.instrument.Timer t = meterRegistry.timer(
                "e2ee_encryption_duration",
                "algorithm", algorithm,
                "status", success ? "success" : "failure"
        );
        t.record(duration);
        incrementCounter("encryption_per_minute");
    }

    /**
     * 记录解密操作
     */
    public void recordDecryption(String algorithm, Duration duration, boolean success) {
        meterRegistry.counter(
                "e2ee_decryption_total",
                "algorithm", algorithm,
                "status", success ? "success" : "failure"
        ).increment();
        meterRegistry.timer(
                "e2ee_decryption_duration",
                "algorithm", algorithm,
                "status", success ? "success" : "failure"
        ).record(duration);
        incrementCounter("decryption_per_minute");
    }

    /**
     * 记录密钥操作
     */
    public void recordKeyOperation(String operation, String algorithm, Duration duration) {
        meterRegistry.counter(
                "e2ee_key_operation_total",
                "operation", operation,
                "algorithm", algorithm
        ).increment();
        meterRegistry.timer(
                "e2ee_key_operation_duration",
                "operation", operation,
                "algorithm", algorithm
        ).record(duration);
        incrementCounter("key_operation_per_minute");
    }

    /**
     * 记录消息销毁
     */
    public void recordMessageDestruct(String reason) {
        meterRegistry.counter("e2ee_message_destruct_total", "reason", reason).increment();
        incrementCounter("message_destruct_per_minute");
    }

    /**
     * 记录批量操作
     */
    public void recordBatchOperation(String type, int batchSize, Duration duration) {
        meterRegistry.counter("e2ee_batch_operation_total", "type", type).increment();
        meterRegistry.timer("e2ee_batch_operation_duration",
                "type", type,
                "size_bucket", getSizeBucket(batchSize)
        ).record(duration);
        incrementCounter("batch_operation_per_minute");
    }

    /**
     * 记录缓存操作
     */
    public void recordCacheOperation(String cacheType, boolean hit) {
        meterRegistry.counter("e2ee_cache_operation_total",
                "type", cacheType,
                "result", hit ? "hit" : "miss"
        ).increment();
    }

    /**
     * 记录 API 请求
     */
    public void recordApiRequest(String endpoint, String method, int statusCode, Duration duration) {
        meterRegistry.counter("e2ee_api_requests_total",
                "endpoint", endpoint,
                "method", method,
                "status", String.valueOf(statusCode)
        ).increment();
        meterRegistry.timer("e2ee_api_request_duration",
                "endpoint", endpoint,
                "method", method,
                "status", String.valueOf(statusCode)
        ).record(duration);
    }

    /**
     * 更新活跃用户数
     */
    public void updateActiveUsers(long count) {
        activeUsersGauge.set(count);
    }

    /**
     * 更新活跃会话数
     */
    public void updateActiveSessions(long count) {
        activeSessionsGauge.set(count);
    }

    /**
     * 更新消息队列大小
     */
    public void updateMessageQueueSize(long size) {
        messageQueueSizeGauge.set(size);
    }

    /**
     * 更新加密队列大小
     */
    public void updateEncryptionQueueSize(long size) {
        encryptionQueueSizeGauge.set(size);
    }

    /**
     * 更新密钥缓存大小
     */
    public void updateKeyCacheSize(long size) {
        keyCacheSizeGauge.set(size);
    }

    /**
     * 记录错误
     */
    public void recordError(String errorType, String operation) {
        Counter.builder("e2ee_errors_total")
            .description("Total number of errors")
            .tag("type", errorType)
            .tag("operation", operation)
            .register(meterRegistry)
            .increment();
    }

    /**
     * 记录内存使用
     */
    public void recordMemoryUsage(long used, long max) {
        java.util.concurrent.atomic.AtomicLong usedGaugeVal = new java.util.concurrent.atomic.AtomicLong(used);
        java.util.concurrent.atomic.AtomicLong maxGaugeVal = new java.util.concurrent.atomic.AtomicLong(max);
        Gauge.builder("e2ee_memory_usage_bytes", usedGaugeVal, java.util.concurrent.atomic.AtomicLong::get)
                .description("Memory usage in bytes")
                .tag("type", "used")
                .register(meterRegistry);
        Gauge.builder("e2ee_memory_usage_bytes", maxGaugeVal, java.util.concurrent.atomic.AtomicLong::get)
                .description("Memory usage in bytes")
                .tag("type", "max")
                .register(meterRegistry);
        double usagePercent = max > 0 ? (double) used / max * 100 : 0;
        java.util.concurrent.atomic.AtomicReference<Double> percentRef = new java.util.concurrent.atomic.AtomicReference<>(usagePercent);
        Gauge.builder("e2ee_memory_usage_percent", percentRef, java.util.concurrent.atomic.AtomicReference::get)
                .description("Memory usage percentage")
                .register(meterRegistry);
    }

    /**
     * 记录自定义指标
     */
    public void recordCustomMetric(String name, double value, String... tags) {
        Gauge.builder(name, this, monitor -> value)
            .description("Custom metric")
            .tags(tags)
            .register(meterRegistry);
    }

    /**
     * 初始化计数器
     */
    private void initCounters() {
        encryptionTotalCounter = Counter.builder("e2ee_encryption_total")
            .description("Total number of encryption operations")
            .register(meterRegistry);

        decryptionTotalCounter = Counter.builder("e2ee_decryption_total")
            .description("Total number of decryption operations")
            .register(meterRegistry);

        keyOperationCounter = Counter.builder("e2ee_key_operation_total")
            .description("Total number of key operations")
            .register(meterRegistry);

        messageDestructCounter = Counter.builder("e2ee_message_destruct_total")
            .description("Total number of message destruction operations")
            .register(meterRegistry);

        batchOperationCounter = Counter.builder("e2ee_batch_operation_total")
            .description("Total number of batch operations")
            .register(meterRegistry);

        cacheOperationCounter = Counter.builder("e2ee_cache_operation_total")
            .description("Total number of cache operations")
            .register(meterRegistry);

        apiRequestCounter = Counter.builder("e2ee_api_requests_total")
            .description("Total number of API requests")
            .register(meterRegistry);
    }

    /**
     * 初始化计时器
     */
    private void initTimers() {
        encryptionTimer = Timer.builder("e2ee_encryption_duration")
            .description("Encryption operation duration")
            .register(meterRegistry);

        decryptionTimer = Timer.builder("e2ee_decryption_duration")
            .description("Decryption operation duration")
            .register(meterRegistry);

        keyOperationTimer = Timer.builder("e2ee_key_operation_duration")
            .description("Key operation duration")
            .register(meterRegistry);

        apiRequestTimer = Timer.builder("e2ee_api_request_duration")
            .description("API request duration")
            .register(meterRegistry);

        batchOperationTimer = Timer.builder("e2ee_batch_operation_duration")
            .description("Batch operation duration")
            .register(meterRegistry);
    }

    /**
     * 初始化仪表盘
     */
    private void initGauges() {
        activeUsersGauge = new AtomicLong(0);
        activeSessionsGauge = new AtomicLong(0);
        messageQueueSizeGauge = new AtomicLong(0);
        encryptionQueueSizeGauge = new AtomicLong(0);
        keyCacheSizeGauge = new AtomicLong(0);

        Gauge.builder("e2ee_active_users", activeUsersGauge, AtomicLong::get)
            .description("Number of active users")
            .register(meterRegistry);

        Gauge.builder("e2ee_active_sessions", activeSessionsGauge, AtomicLong::get)
            .description("Number of active sessions")
            .register(meterRegistry);

        Gauge.builder("e2ee_message_queue_size", messageQueueSizeGauge, AtomicLong::get)
            .description("Current message queue size")
            .register(meterRegistry);

        Gauge.builder("e2ee_encryption_queue_size", encryptionQueueSizeGauge, AtomicLong::get)
            .description("Current encryption queue size")
            .register(meterRegistry);

        Gauge.builder("e2ee_key_cache_size", keyCacheSizeGauge, AtomicLong::get)
            .description("Number of cached keys")
            .register(meterRegistry);
    }

    /**
     * 初始化速率计算器
     */
    private void initRateCalculators() {
        // 初始化速率计数器
        currentMinuteCounters.put("encryption_per_minute", new AtomicLong(0));
        currentMinuteCounters.put("decryption_per_minute", new AtomicLong(0));
        currentMinuteCounters.put("key_operation_per_minute", new AtomicLong(0));
        currentMinuteCounters.put("message_destruct_per_minute", new AtomicLong(0));
        currentMinuteCounters.put("batch_operation_per_minute", new AtomicLong(0));

        lastMinuteCounters.put("encryption_per_minute", new AtomicLong(0));
        lastMinuteCounters.put("decryption_per_minute", new AtomicLong(0));
        lastMinuteCounters.put("key_operation_per_minute", new AtomicLong(0));
        lastMinuteCounters.put("message_destruct_per_minute", new AtomicLong(0));
        lastMinuteCounters.put("batch_operation_per_minute", new AtomicLong(0));

        // 注册速率仪表盘
        for (String metric : currentMinuteCounters.keySet()) {
            Gauge.builder("e2ee_rate_per_minute", this, monitor -> {
                    long current = currentMinuteCounters.get(metric).get();
                    long last = lastMinuteCounters.get(metric).get();
                    return current - last;
                })
                .description("Operations per minute")
                .tag("metric", metric)
                .register(meterRegistry);
        }

        // 每分钟更新速率
        Timer rateUpdateTimer = Timer.builder("e2ee_rate_update_timer")
            .description("Rate update timer")
            .register(meterRegistry);

        new Thread(() -> {
            while (true) {
                try {
                    Thread.sleep(60000); // 每分钟执行一次
                    long start = System.nanoTime();

                    // 更新速率计数器
                    for (String metric : currentMinuteCounters.keySet()) {
                        long last = lastMinuteCounters.get(metric).getAndSet(currentMinuteCounters.get(metric).get());
                        currentMinuteCounters.get(metric).set(0);
                    }

                    rateUpdateTimer.record(Duration.ofNanos(System.nanoTime() - start));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    log.error("更新速率失败", e);
                }
            }
        }, "e2ee-rate-updater").start();
    }

    /**
     * 增加计数器
     */
    private void incrementCounter(String counterName) {
        AtomicLong counter = currentMinuteCounters.get(counterName);
        if (counter != null) {
            counter.incrementAndGet();
        }
    }

    /**
     * 获取大小桶标签
     */
    private String getSizeBucket(int size) {
        if (size <= 10) return "small";
        if (size <= 50) return "medium";
        if (size <= 100) return "large";
        return "xlarge";
    }

    /**
     * 获取性能摘要
     */
    public String getMetricsSummary() {
        StringBuilder sb = new StringBuilder();
        sb.append("\n=== E2EE Prometheus Metrics Summary ===\n");
        sb.append(String.format("Total Encryptions: %d\n", encryptionTotalCounter.count()));
        sb.append(String.format("Total Decryptions: %d\n", decryptionTotalCounter.count()));
        sb.append(String.format("Key Operations: %d\n", keyOperationCounter.count()));
        sb.append(String.format("Message Destructs: %d\n", messageDestructCounter.count()));
        sb.append(String.format("Batch Operations: %d\n", batchOperationCounter.count()));
        sb.append(String.format("Active Users: %d\n", activeUsersGauge.get()));
        sb.append(String.format("Active Sessions: %d\n", activeSessionsGauge.get()));
        sb.append("=====================================\n");
        return sb.toString();
    }
}
