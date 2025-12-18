package com.luohuo.flex.im.core.e2ee.monitor;

import com.luohuo.flex.im.metrics.E2EEMetrics;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * E2EE性能监控服务
 * 实时监控系统性能指标
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EEPerformanceMonitor implements HealthIndicator {

    private final E2EEMetrics e2eeMetrics;
    private final RedisTemplate<String, Object> redisTemplate;
    private final DataSource dataSource;
    private final MeterRegistry meterRegistry;

    // 性能指标缓存
    private final Map<String, Object> performanceCache = new ConcurrentHashMap<>();
    private final AtomicLong lastUpdateTime = new AtomicLong(System.currentTimeMillis());

    // 性能阈值
    private static final double CPU_USAGE_THRESHOLD = 80.0;
    private static final double MEMORY_USAGE_THRESHOLD = 85.0;
    private static final double DISK_USAGE_THRESHOLD = 90.0;
    private static final long SLOW_QUERY_THRESHOLD_MS = 1000;

    /**
     * 获取综合性能指标
     */
    public Map<String, Object> getPerformanceMetrics() {
        Map<String, Object> metrics = new HashMap<>();

        // 1. 系统资源指标
        metrics.put("system", getSystemMetrics());

        // 2. JVM指标
        metrics.put("jvm", getJVMMetrics());

        // 3. 数据库指标
        metrics.put("database", getDatabaseMetrics());

        // 4. Redis指标
        metrics.put("redis", getRedisMetrics());

        // 5. E2EE业务指标
        metrics.put("e2ee", getE2EEMetrics());

        // 6. 缓存性能
        metrics.put("cache", getCacheMetrics());

        // 更新缓存时间
        lastUpdateTime.set(System.currentTimeMillis());

        return metrics;
    }

    /**
     * 获取实时性能告警
     */
    public List<PerformanceAlert> getPerformanceAlerts() {
        List<PerformanceAlert> alerts = new ArrayList<>();

        // 1. 检查CPU使用率
        double cpuUsage = getCPUUsage();
        if (cpuUsage > CPU_USAGE_THRESHOLD) {
            alerts.add(new PerformanceAlert(
                "HIGH_CPU_USAGE",
                "CPU使用率过高",
                AlertLevel.CRITICAL,
                Map.of("usage", cpuUsage, "threshold", CPU_USAGE_THRESHOLD)
            ));
        }

        // 2. 检查内存使用率
        MemoryUsage heapUsage = getHeapMemoryUsage();
        double memoryUsagePercent = (double) heapUsage.getUsed() / heapUsage.getMax() * 100;
        if (memoryUsagePercent > MEMORY_USAGE_THRESHOLD) {
            alerts.add(new PerformanceAlert(
                "HIGH_MEMORY_USAGE",
                "内存使用率过高",
                AlertLevel.WARNING,
                Map.of("usage", String.format("%.2f%%", memoryUsagePercent), "threshold", MEMORY_USAGE_THRESHOLD)
            ));
        }

        // 3. 检查慢查询
        long slowQueryCount = getSlowQueryCount();
        if (slowQueryCount > 0) {
            alerts.add(new PerformanceAlert(
                "SLOW_QUERIES",
                "检测到慢查询",
                AlertLevel.WARNING,
                Map.of("count", slowQueryCount)
            ));
        }

        // 4. 检查Redis连接
        checkRedisConnection(alerts);

        // 5. 检查E2EE操作延迟
        checkE2EELatency(alerts);

        return alerts;
    }

    /**
     * 获取性能趋势分析
     */
    public Map<String, Object> getPerformanceTrends(String timeRange) {
        Map<String, Object> trends = new HashMap<>();

        // 计算时间范围
        LocalDateTime endTime = LocalDateTime.now();
        LocalDateTime startTime;
        switch (timeRange) {
            case "1h":
                startTime = endTime.minus(1, ChronoUnit.HOURS);
                break;
            case "24h":
                startTime = endTime.minus(1, ChronoUnit.DAYS);
                break;
            case "7d":
                startTime = endTime.minus(7, ChronoUnit.DAYS);
                break;
            default:
                startTime = endTime.minus(1, ChronoUnit.HOURS);
        }

        // 收集趋势数据
        trends.put("encryptionLatency", getEncryptionLatencyTrend(startTime, endTime));
        trends.put("decryptionLatency", getDecryptionLatencyTrend(startTime, endTime));
        trends.put("throughput", getThroughputTrend(startTime, endTime));
        trends.put("errorRate", getErrorRateTrend(startTime, endTime));
        trends.put("cacheHitRate", getCacheHitRateTrend(startTime, endTime));

        return trends;
    }

    /**
     * 定时收集性能指标
     */
    @Scheduled(fixedRate = 30000) // 每30秒执行
    public void collectPerformanceMetrics() {
        try {
            Map<String, Object> metrics = getPerformanceMetrics();

            // 存储到Redis用于历史分析
            String key = "e2ee:performance:" + System.currentTimeMillis();
            redisTemplate.opsForValue().set(key, metrics, 24, java.util.concurrent.TimeUnit.HOURS);

            // 检查并触发告警
            List<PerformanceAlert> alerts = getPerformanceAlerts();
            if (!alerts.isEmpty()) {
                processAlerts(alerts);
            }

            // 记录关键指标到监控系统
            recordKeyMetrics(metrics);

        } catch (Exception e) {
            log.error("收集性能指标失败", e);
        }
    }

    /**
     * 定时清理历史数据
     */
    @Scheduled(cron = "0 0 3 * * ?") // 每天凌晨3点执行
    public void cleanupHistoricalData() {
        try {
            // 清理7天前的性能数据
            long cutoffTime = System.currentTimeMillis() - (7 * 24 * 60 * 60 * 1000);
            Set<String> keys = redisTemplate.keys("e2ee:performance:*");

            List<String> keysToDelete = new ArrayList<>();
            for (String key : keys) {
                long timestamp = Long.parseLong(key.split(":")[2]);
                if (timestamp < cutoffTime) {
                    keysToDelete.add(key);
                }
            }

            if (!keysToDelete.isEmpty()) {
                redisTemplate.delete(keysToDelete);
                log.info("清理历史性能数据 {} 条", keysToDelete.size());
            }

        } catch (Exception e) {
            log.error("清理历史数据失败", e);
        }
    }

    // Health Indicator 实现

    @Override
    public Health health() {
        try {
            Map<String, Object> details = new HashMap<>();

            // 检查各个组件健康状态
            details.put("e2ee_service", checkE2EEHealth());
            details.put("database", checkDatabaseHealth());
            details.put("redis", checkRedisHealth());
            details.put("performance", checkPerformanceHealth());

            // 判断整体健康状态
            List<PerformanceAlert> alerts = getPerformanceAlerts();
            boolean hasCriticalAlerts = alerts.stream()
                .anyMatch(alert -> alert.getLevel() == AlertLevel.CRITICAL);

            if (hasCriticalAlerts) {
                return Health.down()
                    .withDetail("alerts", alerts)
                    .withDetails(details)
                    .build();
            } else if (!alerts.isEmpty()) {
                return Health.unknown()
                    .withDetail("warnings", alerts)
                    .withDetails(details)
                    .build();
            } else {
                return Health.up()
                    .withDetails(details)
                    .build();
            }

        } catch (Exception e) {
            return Health.down()
                .withDetail("error", e.getMessage())
                .build();
        }
    }

    // 私有方法

    private Map<String, Object> getSystemMetrics() {
        Map<String, Object> metrics = new HashMap<>();

        // CPU使用率
        metrics.put("cpuUsage", getCPUUsage());

        // 内存信息
        MemoryUsage heapUsage = getHeapMemoryUsage();
        metrics.put("heapUsed", heapUsage.getUsed());
        metrics.put("heapMax", heapUsage.getMax());
        metrics.put("heapUsagePercent", (double) heapUsage.getUsed() / heapUsage.getMax() * 100);

        // 系统负载
        double loadAverage = ManagementFactory.getOperatingSystemMXBean().getSystemLoadAverage();
        metrics.put("loadAverage", loadAverage);

        // 可用处理器数
        metrics.put("availableProcessors", ManagementFactory.getOperatingSystemMXBean().getAvailableProcessors());

        return metrics;
    }

    private Map<String, Object> getJVMMetrics() {
        Map<String, Object> metrics = new HashMap<>();

        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();

        // 堆内存
        MemoryUsage heapUsage = memoryBean.getHeapMemoryUsage();
        metrics.put("heapInit", heapUsage.getInit());
        metrics.put("heapUsed", heapUsage.getUsed());
        metrics.put("heapCommitted", heapUsage.getCommitted());
        metrics.put("heapMax", heapUsage.getMax());

        // 非堆内存
        MemoryUsage nonHeapUsage = memoryBean.getNonHeapMemoryUsage();
        metrics.put("nonHeapUsed", nonHeapUsage.getUsed());
        metrics.put("nonHeapMax", nonHeapUsage.getMax());

        // GC信息
        metrics.put("gcCount", getGCCount());
        metrics.put("gcTime", getGCTime());

        return metrics;
    }

    private Map<String, Object> getDatabaseMetrics() {
        Map<String, Object> metrics = new HashMap<>();

        try (Connection conn = dataSource.getConnection()) {
            metrics.put("isValid", conn.isValid(5));

            // 慢查询统计
            metrics.put("slowQueryCount", getSlowQueryCount());

        } catch (Exception e) {
            log.error("获取数据库指标失败", e);
            metrics.put("error", e.getMessage());
        }

        return metrics;
    }

    private Map<String, Object> getRedisMetrics() {
        Map<String, Object> metrics = new HashMap<>();

        try {
            Properties info = redisTemplate.getConnectionFactory()
                .getConnection().info();

            metrics.put("connectedClients", info.getProperty("connected_clients"));
            metrics.put("usedMemory", info.getProperty("used_memory_human"));
            metrics.put("usedMemoryRss", info.getProperty("used_memory_rss_human"));
            metrics.put("usedMemoryPeak", info.getProperty("used_memory_peak_human"));
            metrics.put("keyspaceHits", info.getProperty("keyspace_hits"));
            metrics.put("keyspaceMisses", info.getProperty("keyspace_misses"));

            // 计算命中率
            long hits = Long.parseLong(info.getProperty("keyspace_hits", "0"));
            long misses = Long.parseLong(info.getProperty("keyspace_misses", "0"));
            double hitRate = hits + misses > 0 ? (double) hits / (hits + misses) * 100 : 0;
            metrics.put("hitRatePercent", String.format("%.2f%%", hitRate));

        } catch (Exception e) {
            log.error("获取Redis指标失败", e);
            metrics.put("error", e.getMessage());
        }

        return metrics;
    }

    private Map<String, Object> getE2EEMetrics() {
        Map<String, Object> metrics = new HashMap<>();

        // 从E2EEMetrics获取业务指标
        metrics.put("activeUsers", e2eeMetrics.getActiveUsers());
        metrics.put("activeSessions", e2eeMetrics.getActiveSessions());

        // 这里可以添加更多E2EE特定的指标
        metrics.put("totalEncryptedMessages", getTotalEncryptedMessages());
        metrics.put("totalSignatureVerifications", getTotalSignatureVerifications());
        metrics.put("avgEncryptionLatency", getAvgEncryptionLatency());
        metrics.put("avgDecryptionLatency", getAvgDecryptionLatency());

        return metrics;
    }

    private Map<String, Object> getCacheMetrics() {
        Map<String, Object> metrics = new HashMap<>();

        // 本地缓存指标
        metrics.put("localCacheSize", getLocalCacheSize());
        metrics.put("localCacheHitRate", getLocalCacheHitRate());

        // 分布式缓存指标
        metrics.put("distributedCacheSize", getDistributedCacheSize());
        metrics.put("distributedCacheHitRate", getDistributedCacheHitRate());

        return metrics;
    }

    private double getCPUUsage() {
        return ManagementFactory.getOperatingSystemMXBean().getSystemLoadAverage() /
               ManagementFactory.getOperatingSystemMXBean().getAvailableProcessors() * 100;
    }

    private MemoryUsage getHeapMemoryUsage() {
        return ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
    }

    private long getGCCount() {
        return ManagementFactory.getGarbageCollectorMXBeans().stream()
            .mapToLong(gc -> gc.getCollectionCount())
            .sum();
    }

    private long getGCTime() {
        return ManagementFactory.getGarbageCollectorMXBeans().stream()
            .mapToLong(gc -> gc.getCollectionTime())
            .sum();
    }

    private long getSlowQueryCount() {
        // 从日志或监控系统获取慢查询数量
        return 0;
    }

    private void checkRedisConnection(List<PerformanceAlert> alerts) {
        try {
            redisTemplate.opsForValue().get("health:check");
        } catch (Exception e) {
            alerts.add(new PerformanceAlert(
                "REDIS_CONNECTION_FAILED",
                "Redis连接失败",
                AlertLevel.CRITICAL,
                Map.of("error", e.getMessage())
            ));
        }
    }

    private void checkE2EELatency(List<PerformanceAlert> alerts) {
        // 检查E2EE操作延迟
        if (getAvgEncryptionLatency() > 100) {
            alerts.add(new PerformanceAlert(
                "HIGH_ENCRYPTION_LATENCY",
                "加密延迟过高",
                AlertLevel.WARNING,
                Map.of("latency", getAvgEncryptionLatency())
            ));
        }
    }

    private void processAlerts(List<PerformanceAlert> alerts) {
        for (PerformanceAlert alert : alerts) {
            log.warn("性能告警: {} - {}", alert.getType(), alert.getMessage());

            // 发送告警通知
            if (alert.getLevel() == AlertLevel.CRITICAL) {
                // 发送紧急通知
                sendCriticalAlert(alert);
            }
        }
    }

    private void recordKeyMetrics(Map<String, Object> metrics) {
        // 记录关键指标到监控系统
    }

    private boolean checkE2EEHealth() {
        return true;
    }

    private boolean checkDatabaseHealth() {
        try (Connection conn = dataSource.getConnection()) {
            return conn.isValid(5);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean checkRedisHealth() {
        try {
            redisTemplate.opsForValue().get("health:check");
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean checkPerformanceHealth() {
        return getPerformanceAlerts().stream()
            .noneMatch(alert -> alert.getLevel() == AlertLevel.CRITICAL);
    }

    // 获取趋势数据的方法
    private List<Map<String, Object>> getEncryptionLatencyTrend(LocalDateTime start, LocalDateTime end) {
        return new ArrayList<>();
    }

    private List<Map<String, Object>> getDecryptionLatencyTrend(LocalDateTime start, LocalDateTime end) {
        return new ArrayList<>();
    }

    private List<Map<String, Object>> getThroughputTrend(LocalDateTime start, LocalDateTime end) {
        return new ArrayList<>();
    }

    private List<Map<String, Object>> getErrorRateTrend(LocalDateTime start, LocalDateTime end) {
        return new ArrayList<>();
    }

    private List<Map<String, Object>> getCacheHitRateTrend(LocalDateTime start, LocalDateTime end) {
        return new ArrayList<>();
    }

    // 其他辅助方法
    private long getTotalEncryptedMessages() { return 0; }
    private long getTotalSignatureVerifications() { return 0; }
    private long getAvgEncryptionLatency() { return 0; }
    private long getAvgDecryptionLatency() { return 0; }
    private int getLocalCacheSize() { return 0; }
    private double getLocalCacheHitRate() { return 0; }
    private int getDistributedCacheSize() { return 0; }
    private double getDistributedCacheHitRate() { return 0; }
    private void sendCriticalAlert(PerformanceAlert alert) {}

    // 内部类
    public static class PerformanceAlert {
        private final String type;
        private final String message;
        private final AlertLevel level;
        private final Map<String, Object> details;
        private final long timestamp = System.currentTimeMillis();

        public PerformanceAlert(String type, String message, AlertLevel level, Map<String, Object> details) {
            this.type = type;
            this.message = message;
            this.level = level;
            this.details = details;
        }

        public String getType() { return type; }
        public String getMessage() { return message; }
        public AlertLevel getLevel() { return level; }
        public Map<String, Object> getDetails() { return details; }
        public long getTimestamp() { return timestamp; }
    }

    public enum AlertLevel {
        INFO, WARNING, CRITICAL
    }
}
