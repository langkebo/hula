package com.luohuo.flex.im.monitor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 性能监控服务接口
 *
 * @author HuLa
 */
public interface PerformanceMonitorService {

    /**
     * 记录搜索性能指标
     *
     * @param userId     用户ID
     * @param keyword    搜索关键词
     * @param took       耗时（毫秒）
     * @param resultCount 结果数量
     * @param success    是否成功
     */
    void recordSearchMetrics(Long userId, String keyword, Long took, Integer resultCount, Boolean success);

    /**
     * 记录API性能指标
     *
     * @param apiPath    API路径
     * @param method     HTTP方法
     * @param took       耗时（毫秒）
     * @param statusCode 状态码
     * @param userId     用户ID
     */
    void recordApiMetrics(String apiPath, String method, Long took, Integer statusCode, Long userId);

    /**
     * 记录数据库性能指标
     *
     * @param operation  操作类型
     * @param table      表名
     * @param took       耗时（毫秒）
     * @param rows       影响行数
     */
    void recordDatabaseMetrics(String operation, String table, Long took, Long rows);

    /**
     * 记录缓存性能指标
     *
     * @param cacheType  缓存类型
     * @param operation  操作类型
     * @param took       耗时（毫秒）
     * @param hit        是否命中
     */
    void recordCacheMetrics(String cacheType, String operation, Long took, Boolean hit);

    /**
     * 获取性能统计报告
     *
     * @param startTime 开始时间
     * @param endTime   结束时间
     * @return 性能统计
     */
    Map<String, Object> getPerformanceReport(LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 获取搜索性能统计
     *
     * @param timeRange 时间范围（hour/day/week/month）
     * @return 搜索性能统计
     */
    Map<String, Object> getSearchPerformanceStats(String timeRange);

    /**
     * 获取API性能统计
     *
     * @param timeRange 时间范围
     * @return API性能统计
     */
    Map<String, Object> getApiPerformanceStats(String timeRange);

    /**
     * 获取数据库性能统计
     *
     * @param timeRange 时间范围
     * @return 数据库性能统计
     */
    Map<String, Object> getDatabasePerformanceStats(String timeRange);

    /**
     * 获取缓存性能统计
     *
     * @param timeRange 时间范围
     * @return 缓存性能统计
     */
    Map<String, Object> getCachePerformanceStats(String timeRange);

    /**
     * 获取系统健康状态
     *
     * @return 健康状态信息
     */
    Map<String, Object> getSystemHealth();

    /**
     * 获取性能警报
     *
     * @param level 警报级别（warning/critical）
     * @return 警报列表
     */
    List<PerformanceAlert> getPerformanceAlerts(String level);

    /**
     * 性能警报数据结构
     */
    class PerformanceAlert {
        private String id;
        private String level;
        private String type;
        private String message;
        private LocalDateTime timestamp;
        private Map<String, Object> details;

        // getters and setters
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getLevel() { return level; }
        public void setLevel(String level) { this.level = level; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public LocalDateTime getTimestamp() { return timestamp; }
        public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
        public Map<String, Object> getDetails() { return details; }
        public void setDetails(Map<String, Object> details) { this.details = details; }
    }

    /**
     * 性能指标数据结构
     */
    class PerformanceMetrics {
        private String metricType;
        private String name;
        private Long count;
        private Double avgTook;
        private Long minTook;
        private Long maxTook;
        private Double p50Took;
        private Double p95Took;
        private Double p99Took;
        private Double successRate;
        private LocalDateTime lastUpdated;

        // getters and setters
        public String getMetricType() { return metricType; }
        public void setMetricType(String metricType) { this.metricType = metricType; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public Long getCount() { return count; }
        public void setCount(Long count) { this.count = count; }
        public Double getAvgTook() { return avgTook; }
        public void setAvgTook(Double avgTook) { this.avgTook = avgTook; }
        public Long getMinTook() { return minTook; }
        public void setMinTook(Long minTook) { this.minTook = minTook; }
        public Long getMaxTook() { return maxTook; }
        public void setMaxTook(Long maxTook) { this.maxTook = maxTook; }
        public Double getP50Took() { return p50Took; }
        public void setP50Took(Double p50Took) { this.p50Took = p50Took; }
        public Double getP95Took() { return p95Took; }
        public void setP95Took(Double p95Took) { this.p95Took = p95Took; }
        public Double getP99Took() { return p99Took; }
        public void setP99Took(Double p99Took) { this.p99Took = p99Took; }
        public Double getSuccessRate() { return successRate; }
        public void setSuccessRate(Double successRate) { this.successRate = successRate; }
        public LocalDateTime getLastUpdated() { return lastUpdated; }
        public void setLastUpdated(LocalDateTime lastUpdated) { this.lastUpdated = lastUpdated; }
    }
}