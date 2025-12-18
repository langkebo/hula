package com.luohuo.flex.im.core.limiter.config;

import com.luohuo.flex.im.core.limiter.RateLimiterService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.Scheduled;

import jakarta.annotation.PostConstruct;
import java.util.Map;

/**
 * 限流配置
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
@Configuration
@ConfigurationProperties(prefix = "e2ee.rate-limit")
@ConditionalOnProperty(prefix = "e2ee.rate-limit", name = "enabled", havingValue = "true")
public class RateLimitConfig {

    /**
     * 是否启用限流
     */
    private boolean enabled = true;

    /**
     * 全局默认配置
     */
    private GlobalConfig global = new GlobalConfig();

    /**
     * API 特定配置
     */
    private Map<String, ApiConfig> apis = new java.util.HashMap<>();

    /**
     * 动态调整配置
     */
    private DynamicConfig dynamic = new DynamicConfig();

    @Autowired
    private RateLimiterService rateLimiterService;

    @PostConstruct
    public void init() {
        log.info("初始化 E2EE 限流配置...");

        // 预热全局限流器
        if (global.isWarmup()) {
            rateLimiterService.warmupRateLimiter("global", global.getWarmupTokens());
        }

        // 预热 API 限流器
        apis.forEach((api, config) -> {
            if (config.isWarmup()) {
                String key = "api:" + api;
                rateLimiterService.warmupRateLimiter(key, config.getWarmupTokens());
                log.debug("预热 API 限流器: {}, tokens: {}", api, config.getWarmupTokens());
            }
        });

        log.info("E2EE 限流配置初始化完成");
    }

    /**
     * 定时更新限流参数
     */
    @Scheduled(fixedRate = 60000) // 每分钟执行一次
    public void updateRateLimits() {
        if (!dynamic.isEnabled()) {
            return;
        }

        log.debug("开始更新限流参数...");

        // 检查系统负载
        double cpuUsage = getCpuUsage();
        double memoryUsage = getMemoryUsage();

        // 根据负载动态调整
        double adjustmentFactor = calculateAdjustmentFactor(cpuUsage, memoryUsage);

        // 更新全局限流参数
        if (Math.abs(adjustmentFactor - 1.0) > 0.1) { // 调整幅度超过10%才更新
            rateLimiterService.adjustRateLimit(
                "global",
                global.getWindow(),
                global.getLimit(),
                adjustmentFactor
            );

            log.info("全局限流参数已调整，factor: {}", adjustmentFactor);
        }
    }

    /**
     * 清理过期限流器
     * 清理长时间未使用的限流器，释放 Redis 内存
     */
    @Scheduled(cron = "0 0 3 * * ?") // 每天凌晨3点执行
    public void cleanupExpiredLimiters() {
        log.info("开始清理过期限流器...");
        long startTime = System.currentTimeMillis();

        try {
            int cleanedCount = 0;

            // 1. 清理全局限流器的历史记录（保留最近7天）
            cleanedCount += rateLimiterService.cleanupExpiredHistory("global", 7);

            // 2. 清理 API 限流器
            for (String api : apis.keySet()) {
                String key = "api:" + api;
                cleanedCount += rateLimiterService.cleanupExpiredHistory(key, 7);
            }

            // 3. 清理用户级别的限流器（如果存在）
            cleanedCount += rateLimiterService.cleanupUserRateLimiters(30); // 30天未使用

            long duration = System.currentTimeMillis() - startTime;
            log.info("过期限流器清理完成，清理数量: {}, 耗时: {}ms", cleanedCount, duration);

        } catch (Exception e) {
            log.error("清理过期限流器失败", e);
        }
    }

    /**
     * 获取CPU使用率
     */
    private double getCpuUsage() {
        try {
            // 这里应该调用系统监控服务获取CPU使用率
            // 简化实现
            return 0.5; // 50%
        } catch (Exception e) {
            log.error("获取CPU使用率失败", e);
            return 0.5;
        }
    }

    /**
     * 获取内存使用率
     */
    private double getMemoryUsage() {
        try {
            // 这里应该调用系统监控服务获取内存使用率
            // 简化实现
            Runtime runtime = Runtime.getRuntime();
            long maxMemory = runtime.maxMemory();
            long usedMemory = runtime.totalMemory() - runtime.freeMemory();
            return (double) usedMemory / maxMemory;
        } catch (Exception e) {
            log.error("获取内存使用率失败", e);
            return 0.5;
        }
    }

    /**
     * 计算调整系数
     */
    private double calculateAdjustmentFactor(double cpuUsage, double memoryUsage) {
        double avgUsage = (cpuUsage + memoryUsage) / 2;

        // 根据平均使用率调整
        if (avgUsage > 0.8) {
            // 高负载，收紧限流（减少请求）
            return 0.8;
        } else if (avgUsage < 0.4) {
            // 低负载，放宽限流（允许更多请求）
            return 1.2;
        }

        // 正常负载，不调整
        return 1.0;
    }

    // Getters and Setters
    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public GlobalConfig getGlobal() {
        return global;
    }

    public void setGlobal(GlobalConfig global) {
        this.global = global;
    }

    public Map<String, ApiConfig> getApis() {
        return apis;
    }

    public void setApis(Map<String, ApiConfig> apis) {
        this.apis = apis;
    }

    public DynamicConfig getDynamic() {
        return dynamic;
    }

    public void setDynamic(DynamicConfig dynamic) {
        this.dynamic = dynamic;
    }

    /**
     * 全局配置
     */
    public static class GlobalConfig {
        private long window = 60000; // 1分钟
        private int limit = 1000;
        private boolean warmup = true;
        private int warmupTokens = 500;

        // Getters and Setters
        public long getWindow() { return window; }
        public void setWindow(long window) { this.window = window; }
        public int getLimit() { return limit; }
        public void setLimit(int limit) { this.limit = limit; }
        public boolean isWarmup() { return warmup; }
        public void setWarmup(boolean warmup) { this.warmup = warmup; }
        public int getWarmupTokens() { return warmupTokens; }
        public void setWarmupTokens(int warmupTokens) { this.warmupTokens = warmupTokens; }
    }

    /**
     * API 配置
     */
    public static class ApiConfig {
        private long window = 60000;
        private int limit = 100;
        private boolean warmup = false;
        private int warmupTokens = 100;
        private int capacity = -1;
        private int tokensPerSecond = 10;

        // Getters and Setters
        public long getWindow() { return window; }
        public void setWindow(long window) { this.window = window; }
        public int getLimit() { return limit; }
        public void setLimit(int limit) { this.limit = limit; }
        public boolean isWarmup() { return warmup; }
        public void setWarmup(boolean warmup) { this.warmup = warmup; }
        public int getWarmupTokens() { return warmupTokens; }
        public void setWarmupTokens(int warmupTokens) { this.warmupTokens = warmupTokens; }
        public int getCapacity() { return capacity; }
        public void setCapacity(int capacity) { this.capacity = capacity; }
        public int getTokensPerSecond() { return tokensPerSecond; }
        public void setTokensPerSecond(int tokensPerSecond) { this.tokensPerSecond = tokensPerSecond; }
    }

    /**
     * 动态调整配置
     */
    public static class DynamicConfig {
        private boolean enabled = true;
        private double adjustmentThreshold = 0.1;
        private int maxAdjustmentFactor = 2;
        private int minAdjustmentFactor = 1;
        private boolean logAdjustments = true;

        // Getters and Setters
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public double getAdjustmentThreshold() { return adjustmentThreshold; }
        public void setAdjustmentThreshold(double adjustmentThreshold) { this.adjustmentThreshold = adjustmentThreshold; }
        public int getMaxAdjustmentFactor() { return maxAdjustmentFactor; }
        public void setMaxAdjustmentFactor(int maxAdjustmentFactor) { this.maxAdjustmentFactor = maxAdjustmentFactor; }
        public int getMinAdjustmentFactor() { return minAdjustmentFactor; }
        public void setMinAdjustmentFactor(int minAdjustmentFactor) { this.minAdjustmentFactor = minAdjustmentFactor; }
        public boolean isLogAdjustments() { return logAdjustments; }
        public void setLogAdjustments(boolean logAdjustments) { this.logAdjustments = logAdjustments; }
    }
}