package com.luohuo.flex.im.monitor.service.impl;

import com.luohuo.flex.im.monitor.PerformanceMonitorService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 性能监控服务实现
 *
 * @author HuLa
 */
@Slf4j
@Service
public class PerformanceMonitorServiceImpl implements PerformanceMonitorService {

    @Autowired(required = false)
    private RedisTemplate<String, Object> redisTemplate;

    // 内存中的性能指标缓存（用于实时监控）
    private final Map<String, List<Long>> searchMetricsCache = new ConcurrentHashMap<>();
    private final Map<String, List<Long>> apiMetricsCache = new ConcurrentHashMap<>();
    private final Map<String, List<Long>> dbMetricsCache = new ConcurrentHashMap<>();
    private final Map<String, List<Boolean>> cacheMetricsCache = new ConcurrentHashMap<>();

    // 阈值配置
    private static final Long SEARCH_SLOW_THRESHOLD = 3000L;  // 3秒
    private static final Long API_SLOW_THRESHOLD = 2000L;    // 2秒
    private static final Long DB_SLOW_THRESHOLD = 1000L;     // 1秒
    private static final Long CACHE_SLOW_THRESHOLD = 100L;   // 100毫秒

    // Redis键前缀
    private static final String METRICS_PREFIX = "metrics:";
    private static final String ALERTS_PREFIX = "alerts:";

    @Override
    @Async
    public void recordSearchMetrics(Long userId, String keyword, Long took, Integer resultCount, Boolean success) {
        try {
            // 记录到Redis
            if (redisTemplate != null) {
                String key = METRICS_PREFIX + "search:" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd:HH"));

                Map<String, Object> metrics = new HashMap<>();
                metrics.put("userId", userId);
                metrics.put("keyword", keyword);
                metrics.put("took", took);
                metrics.put("resultCount", resultCount);
                metrics.put("success", success);
                metrics.put("timestamp", System.currentTimeMillis());

                redisTemplate.opsForList().rightPush(key, metrics);
                // 只保留最近1000条记录
                redisTemplate.opsForList().trim(key, -1000, -1);
                redisTemplate.expire(key, 7, TimeUnit.DAYS);
            }

            // 记录到内存缓存
            String cacheKey = "search";
            searchMetricsCache.computeIfAbsent(cacheKey, k -> new ArrayList<>()).add(took);

            // 检查慢查询
            if (took > SEARCH_SLOW_THRESHOLD) {
                createAlert("warning", "slow_search",
                    String.format("Slow search detected: keyword='%s', took=%dms", keyword, took));
            }

            // 检查失败率
            checkFailureRate(cacheKey);

        } catch (Exception e) {
            log.error("Failed to record search metrics", e);
        }
    }

    @Override
    @Async
    public void recordApiMetrics(String apiPath, String method, Long took, Integer statusCode, Long userId) {
        try {
            // 记录到Redis
            if (redisTemplate != null) {
                String key = METRICS_PREFIX + "api:" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd:HH"));

                Map<String, Object> metrics = new HashMap<>();
                metrics.put("apiPath", apiPath);
                metrics.put("method", method);
                metrics.put("took", took);
                metrics.put("statusCode", statusCode);
                metrics.put("userId", userId);
                metrics.put("timestamp", System.currentTimeMillis());

                redisTemplate.opsForList().rightPush(key, metrics);
                redisTemplate.opsForList().trim(key, -1000, -1);
                redisTemplate.expire(key, 7, TimeUnit.DAYS);
            }

            // 记录到内存缓存
            String cacheKey = method + " " + apiPath;
            apiMetricsCache.computeIfAbsent(cacheKey, k -> new ArrayList<>()).add(took);

            // 检查慢API
            if (took > API_SLOW_THRESHOLD) {
                createAlert("warning", "slow_api",
                    String.format("Slow API detected: %s %s took=%dms", method, apiPath, took));
            }

            // 检查错误率
            if (statusCode >= 500) {
                createAlert("critical", "api_error",
                    String.format("API error: %s %s returned %d", method, apiPath, statusCode));
            }

        } catch (Exception e) {
            log.error("Failed to record API metrics", e);
        }
    }

    @Override
    @Async
    public void recordDatabaseMetrics(String operation, String table, Long took, Long rows) {
        try {
            // 记录到Redis
            if (redisTemplate != null) {
                String key = METRICS_PREFIX + "db:" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd:HH"));

                Map<String, Object> metrics = new HashMap<>();
                metrics.put("operation", operation);
                metrics.put("table", table);
                metrics.put("took", took);
                metrics.put("rows", rows);
                metrics.put("timestamp", System.currentTimeMillis());

                redisTemplate.opsForList().rightPush(key, metrics);
                redisTemplate.opsForList().trim(key, -1000, -1);
                redisTemplate.expire(key, 7, TimeUnit.DAYS);
            }

            // 记录到内存缓存
            String cacheKey = operation + ":" + table;
            dbMetricsCache.computeIfAbsent(cacheKey, k -> new ArrayList<>()).add(took);

            // 检查慢查询
            if (took > DB_SLOW_THRESHOLD) {
                createAlert("warning", "slow_db",
                    String.format("Slow database query detected: %s on %s took=%dms, affected %d rows", operation, table, took, rows));
            }

        } catch (Exception e) {
            log.error("Failed to record database metrics", e);
        }
    }

    @Override
    @Async
    public void recordCacheMetrics(String cacheType, String operation, Long took, Boolean hit) {
        try {
            // 记录到Redis
            if (redisTemplate != null) {
                String key = METRICS_PREFIX + "cache:" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd:HH"));

                Map<String, Object> metrics = new HashMap<>();
                metrics.put("cacheType", cacheType);
                metrics.put("operation", operation);
                metrics.put("took", took);
                metrics.put("hit", hit);
                metrics.put("timestamp", System.currentTimeMillis());

                redisTemplate.opsForList().rightPush(key, metrics);
                redisTemplate.opsForList().trim(key, -1000, -1);
                redisTemplate.expire(key, 7, TimeUnit.DAYS);
            }

            // 记录到内存缓存
            cacheMetricsCache.computeIfAbsent(cacheType, k -> new ArrayList<>()).add(hit);

            // 检查慢缓存操作
            if (took > CACHE_SLOW_THRESHOLD) {
                createAlert("warning", "slow_cache",
                    String.format("Slow cache operation detected: %s %s took=%dms", cacheType, operation, took));
            }

        } catch (Exception e) {
            log.error("Failed to record cache metrics", e);
        }
    }

    @Override
    public Map<String, Object> getPerformanceReport(LocalDateTime startTime, LocalDateTime endTime) {
        Map<String, Object> report = new HashMap<>();

        report.put("startTime", startTime.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        report.put("endTime", endTime.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        // 获取各模块的性能指标
        report.put("search", getSearchMetricsByTimeRange(startTime, endTime));
        report.put("api", getApiMetricsByTimeRange(startTime, endTime));
        report.put("database", getDatabaseMetricsByTimeRange(startTime, endTime));
        report.put("cache", getCacheMetricsByTimeRange(startTime, endTime));

        // 获取警报统计
        report.put("alerts", getAlertsByTimeRange(startTime, endTime));

        return report;
    }

    @Override
    public Map<String, Object> getSearchPerformanceStats(String timeRange) {
        LocalDateTime endTime = LocalDateTime.now();
        LocalDateTime startTime = getStartTimeByRange(timeRange, endTime);

        return getSearchMetricsByTimeRange(startTime, endTime);
    }

    @Override
    public Map<String, Object> getApiPerformanceStats(String timeRange) {
        LocalDateTime endTime = LocalDateTime.now();
        LocalDateTime startTime = getStartTimeByRange(timeRange, endTime);

        return getApiMetricsByTimeRange(startTime, endTime);
    }

    @Override
    public Map<String, Object> getDatabasePerformanceStats(String timeRange) {
        LocalDateTime endTime = LocalDateTime.now();
        LocalDateTime startTime = getStartTimeByRange(timeRange, endTime);

        return getDatabaseMetricsByTimeRange(startTime, endTime);
    }

    @Override
    public Map<String, Object> getCachePerformanceStats(String timeRange) {
        LocalDateTime endTime = LocalDateTime.now();
        LocalDateTime startTime = getStartTimeByRange(timeRange, endTime);

        return getCacheMetricsByTimeRange(startTime, endTime);
    }

    @Override
    public Map<String, Object> getSystemHealth() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "healthy");
        health.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        // 系统资源状态
        Runtime runtime = Runtime.getRuntime();
        health.put("jvm", Map.of(
            "usedMemory", runtime.totalMemory() - runtime.freeMemory(),
            "freeMemory", runtime.freeMemory(),
            "totalMemory", runtime.totalMemory(),
            "maxMemory", runtime.maxMemory()
        ));

        // 获取最近的性能指标
        health.put("recentPerformance", getRecentMetrics());

        // 获取最近的警报
        health.put("recentAlerts", getRecentAlerts());

        // 检查系统健康状态
        health.put("checks", performHealthChecks());

        return health;
    }

    @Override
    public List<PerformanceAlert> getPerformanceAlerts(String level) {
        try {
            if (redisTemplate == null) {
                return Collections.emptyList();
            }

            Set<String> keys = redisTemplate.keys(ALERTS_PREFIX + "*");
            List<PerformanceAlert> alerts = new ArrayList<>();

            for (String key : keys) {
                List<Object> alertList = redisTemplate.opsForList().range(key, 0, -1);
                if (alertList != null) {
                    for (Object alertObj : alertList) {
                        PerformanceAlert alert = convertToAlert(alertObj);
                        if (level == null || level.equals(alert.getLevel())) {
                            alerts.add(alert);
                        }
                    }
                }
            }

            // 按时间戳排序
            alerts.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));

            return alerts;
        } catch (Exception e) {
            log.error("Failed to get performance alerts", e);
            return Collections.emptyList();
        }
    }

    // 私有辅助方法

    private LocalDateTime getStartTimeByRange(String timeRange, LocalDateTime endTime) {
        switch (timeRange.toLowerCase()) {
            case "hour":
                return endTime.minusHours(1);
            case "day":
                return endTime.minusDays(1);
            case "week":
                return endTime.minusWeeks(1);
            case "month":
                return endTime.minusMonths(1);
            default:
                return endTime.minusHours(1);
        }
    }

    private Map<String, Object> getSearchMetricsByTimeRange(LocalDateTime startTime, LocalDateTime endTime) {
        Map<String, Object> metrics = new HashMap<>();

        // 从内存缓存获取实时数据
        List<Long> allSearchTimes = searchMetricsCache.values().stream()
                .flatMap(List::stream)
                .collect(Collectors.toList());

        if (!allSearchTimes.isEmpty()) {
            metrics.put("count", allSearchTimes.size());
            metrics.put("avgTook", allSearchTimes.stream().mapToLong(Long::longValue).average().orElse(0.0));
            metrics.put("minTook", Collections.min(allSearchTimes));
            metrics.put("maxTook", Collections.max(allSearchTimes));
            metrics.put("p95Took", calculatePercentile(allSearchTimes, 0.95));
            metrics.put("p99Took", calculatePercentile(allSearchTimes, 0.99));
        } else {
            metrics.put("count", 0);
        }

        return metrics;
    }

    private Map<String, Object> getApiMetricsByTimeRange(LocalDateTime startTime, LocalDateTime endTime) {
        Map<String, Object> metrics = new HashMap<>();

        List<Long> allApiTimes = apiMetricsCache.values().stream()
                .flatMap(List::stream)
                .collect(Collectors.toList());

        if (!allApiTimes.isEmpty()) {
            metrics.put("count", allApiTimes.size());
            metrics.put("avgTook", allApiTimes.stream().mapToLong(Long::longValue).average().orElse(0.0));
            metrics.put("minTook", Collections.min(allApiTimes));
            metrics.put("maxTook", Collections.max(allApiTimes));
            metrics.put("p95Took", calculatePercentile(allApiTimes, 0.95));
            metrics.put("p99Took", calculatePercentile(allApiTimes, 0.99));
        } else {
            metrics.put("count", 0);
        }

        return metrics;
    }

    private Map<String, Object> getDatabaseMetricsByTimeRange(LocalDateTime startTime, LocalDateTime endTime) {
        Map<String, Object> metrics = new HashMap<>();

        List<Long> allDbTimes = dbMetricsCache.values().stream()
                .flatMap(List::stream)
                .collect(Collectors.toList());

        if (!allDbTimes.isEmpty()) {
            metrics.put("count", allDbTimes.size());
            metrics.put("avgTook", allDbTimes.stream().mapToLong(Long::longValue).average().orElse(0.0));
            metrics.put("minTook", Collections.min(allDbTimes));
            metrics.put("maxTook", Collections.max(allDbTimes));
            metrics.put("p95Took", calculatePercentile(allDbTimes, 0.95));
            metrics.put("p99Took", calculatePercentile(allDbTimes, 0.99));
        } else {
            metrics.put("count", 0);
        }

        return metrics;
    }

    private Map<String, Object> getCacheMetricsByTimeRange(LocalDateTime startTime, LocalDateTime endTime) {
        Map<String, Object> metrics = new HashMap<>();

        int totalRequests = 0;
        int totalHits = 0;

        for (List<Boolean> hitList : cacheMetricsCache.values()) {
            totalRequests += hitList.size();
            totalHits += hitList.stream().mapToInt(b -> b ? 1 : 0).sum();
        }

        if (totalRequests > 0) {
            metrics.put("totalRequests", totalRequests);
            metrics.put("totalHits", totalHits);
            metrics.put("hitRate", (double) totalHits / totalRequests * 100);
        } else {
            metrics.put("totalRequests", 0);
            metrics.put("hitRate", 0.0);
        }

        return metrics;
    }

    private List<Map<String, Object>> getAlertsByTimeRange(LocalDateTime startTime, LocalDateTime endTime) {
        // 从Redis获取时间范围内的警报（基础实现）
        return Collections.emptyList();
    }

    private Map<String, Object> getRecentMetrics() {
        Map<String, Object> recent = new HashMap<>();
        recent.put("search", getSearchMetricsByTimeRange(
            LocalDateTime.now().minusMinutes(5), LocalDateTime.now()));
        recent.put("api", getApiMetricsByTimeRange(
            LocalDateTime.now().minusMinutes(5), LocalDateTime.now()));
        recent.put("database", getDatabaseMetricsByTimeRange(
            LocalDateTime.now().minusMinutes(5), LocalDateTime.now()));
        recent.put("cache", getCacheMetricsByTimeRange(
            LocalDateTime.now().minusMinutes(5), LocalDateTime.now()));
        return recent;
    }

    private List<PerformanceAlert> getRecentAlerts() {
        return getPerformanceAlerts(null).stream()
                .filter(alert -> alert.getTimestamp().isAfter(LocalDateTime.now().minusMinutes(30)))
                .limit(10)
                .collect(Collectors.toList());
    }

    private Map<String, Object> performHealthChecks() {
        Map<String, Object> checks = new HashMap<>();
        checks.put("jvm_memory", checkJvmMemory());
        checks.put("search_performance", checkSearchPerformance());
        checks.put("api_performance", checkApiPerformance());
        checks.put("database_performance", checkDatabasePerformance());
        checks.put("cache_performance", checkCachePerformance());
        return checks;
    }

    private String checkJvmMemory() {
        Runtime runtime = Runtime.getRuntime();
        long usedMemory = runtime.totalMemory() - runtime.freeMemory();
        long maxMemory = runtime.maxMemory();
        double usagePercent = (double) usedMemory / maxMemory * 100;

        if (usagePercent > 90) {
            return "critical";
        } else if (usagePercent > 80) {
            return "warning";
        } else {
            return "healthy";
        }
    }

    private String checkSearchPerformance() {
        List<Long> searchTimes = searchMetricsCache.get("search");
        if (searchTimes != null && !searchTimes.isEmpty()) {
            double avgTook = searchTimes.stream().mapToLong(Long::longValue).average().orElse(0.0);
            if (avgTook > SEARCH_SLOW_THRESHOLD) {
                return "warning";
            }
        }
        return "healthy";
    }

    private String checkApiPerformance() {
        List<Long> apiTimes = apiMetricsCache.values().stream()
                .flatMap(List::stream)
                .collect(Collectors.toList());

        if (!apiTimes.isEmpty()) {
            double avgTook = apiTimes.stream().mapToLong(Long::longValue).average().orElse(0.0);
            if (avgTook > API_SLOW_THRESHOLD) {
                return "warning";
            }
        }
        return "healthy";
    }

    private String checkDatabasePerformance() {
        List<Long> dbTimes = dbMetricsCache.values().stream()
                .flatMap(List::stream)
                .collect(Collectors.toList());

        if (!dbTimes.isEmpty()) {
            double avgTook = dbTimes.stream().mapToLong(Long::longValue).average().orElse(0.0);
            if (avgTook > DB_SLOW_THRESHOLD) {
                return "warning";
            }
        }
        return "healthy";
    }

    private String checkCachePerformance() {
        int totalRequests = 0;
        int totalHits = 0;

        for (List<Boolean> hitList : cacheMetricsCache.values()) {
            totalRequests += hitList.size();
            totalHits += hitList.stream().mapToInt(b -> b ? 1 : 0).sum();
        }

        if (totalRequests > 0) {
            double hitRate = (double) totalHits / totalRequests * 100;
            if (hitRate < 70) {
                return "warning";
            }
        }
        return "healthy";
    }

    private void createAlert(String level, String type, String message) {
        PerformanceAlert alert = new PerformanceAlert();
        alert.setId(UUID.randomUUID().toString());
        alert.setLevel(level);
        alert.setType(type);
        alert.setMessage(message);
        alert.setTimestamp(LocalDateTime.now());

        // 存储到Redis
        if (redisTemplate != null) {
            String key = ALERTS_PREFIX + type;
            redisTemplate.opsForList().rightPush(key, alert);
            // 只保留最近100个警报
            redisTemplate.opsForList().trim(key, -100, -1);
            redisTemplate.expire(key, 7, TimeUnit.DAYS);
        }

        log.warn("Performance Alert [{}][{}]: {}", level, type, message);
    }

    private void checkFailureRate(String cacheKey) {
        List<Long> times = searchMetricsCache.get(cacheKey);
        if (times != null && times.size() > 100) {
            // 简单的失败率检查（假设最后10个中有3个以上失败，则发出警报）
            // 这里需要更复杂的逻辑来准确计算失败率
        }
    }

    private PerformanceAlert convertToAlert(Object alertObj) {
        // 对象转换（基础实现，返回空警报对象）
        return new PerformanceAlert();
    }

    private double calculatePercentile(List<Long> values, double percentile) {
        if (values.isEmpty()) {
            return 0.0;
        }

        List<Long> sorted = values.stream().sorted().collect(Collectors.toList());
        int index = (int) Math.ceil(percentile * sorted.size()) - 1;
        return sorted.get(Math.max(0, index));
    }
}