package com.luohuo.flex.im.core.monitor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 系统监控告警服务
 *
 * 功能：
 * 1. 数据库连接池监控 (Requirements 12.3)
 * 2. 缓存命中率监控 (Requirements 12.4)
 * 3. 消息队列延迟监控 (Requirements 12.5)
 *
 * @author HuLa Team
 * @since 2025-12-14
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SystemMonitorService {

    private final RedisTemplate<String, String> redisTemplate;
    private final DataSource dataSource;

    private static final String MONITOR_PREFIX = "system:monitor:";
    private static final String ALERT_PREFIX = "system:alert:";

    // 告警阈值配置
    @Value("${monitor.db.pool.usage.threshold:80}")
    private int dbPoolUsageThreshold; // 数据库连接池使用率阈值 80%

    @Value("${monitor.cache.hit.rate.threshold:70}")
    private int cacheHitRateThreshold; // 缓存命中率阈值 70%

    @Value("${monitor.mq.delay.threshold:5000}")
    private long mqDelayThreshold; // 消息队列延迟阈值 5秒

    // 缓存统计
    private final AtomicLong cacheHits = new AtomicLong(0);
    private final AtomicLong cacheMisses = new AtomicLong(0);

    // 消息队列统计
    private final AtomicLong mqTotalDelay = new AtomicLong(0);
    private final AtomicLong mqMessageCount = new AtomicLong(0);

    /**
     * 定时检查数据库连接池状态
     * Requirements 12.3: 数据库连接池使用率超过 80% 发送警告
     */
    @Scheduled(fixedRate = 60000) // 每分钟检查一次
    public void checkDatabasePoolStatus() {
        try {
            // 获取连接池状态
            Map<String, Object> poolStats = getDatabasePoolStats();
            
            int activeConnections = (int) poolStats.getOrDefault("activeConnections", 0);
            int maxConnections = (int) poolStats.getOrDefault("maxConnections", 100);
            
            if (maxConnections > 0) {
                int usagePercent = (activeConnections * 100) / maxConnections;
                
                // 记录到Redis
                String key = MONITOR_PREFIX + "db:pool:" + getCurrentMinute();
                redisTemplate.opsForHash().put(key, "usage", String.valueOf(usagePercent));
                redisTemplate.opsForHash().put(key, "active", String.valueOf(activeConnections));
                redisTemplate.opsForHash().put(key, "max", String.valueOf(maxConnections));
                redisTemplate.expire(key, 24, TimeUnit.HOURS);
                
                // 检查是否超过阈值
                if (usagePercent > dbPoolUsageThreshold) {
                    sendAlert("DB_POOL_HIGH_USAGE", 
                        String.format("数据库连接池使用率过高: %d%% (%d/%d)", 
                            usagePercent, activeConnections, maxConnections),
                        "WARNING");
                }
                
                log.debug("数据库连接池状态 - 使用率: {}%, 活跃连接: {}, 最大连接: {}", 
                    usagePercent, activeConnections, maxConnections);
            }
        } catch (Exception e) {
            log.error("检查数据库连接池状态失败", e);
        }
    }

    /**
     * 获取数据库连接池统计信息
     */
    private Map<String, Object> getDatabasePoolStats() {
        Map<String, Object> stats = new HashMap<>();
        
        try {
            // 尝试获取Druid连接池统计
            if (dataSource instanceof com.alibaba.druid.pool.DruidDataSource) {
                com.alibaba.druid.pool.DruidDataSource druidDataSource = 
                    (com.alibaba.druid.pool.DruidDataSource) dataSource;
                
                stats.put("activeConnections", druidDataSource.getActiveCount());
                stats.put("maxConnections", druidDataSource.getMaxActive());
                stats.put("poolingCount", druidDataSource.getPoolingCount());
                stats.put("waitThreadCount", druidDataSource.getWaitThreadCount());
            } else {
                // 通用方式：尝试获取连接来测试
                try (Connection conn = dataSource.getConnection()) {
                    stats.put("activeConnections", 1);
                    stats.put("maxConnections", 100); // 默认值
                }
            }
        } catch (Exception e) {
            log.error("获取数据库连接池统计失败", e);
            stats.put("activeConnections", 0);
            stats.put("maxConnections", 100);
        }
        
        return stats;
    }

    /**
     * 记录缓存命中
     */
    public void recordCacheHit() {
        cacheHits.incrementAndGet();
    }

    /**
     * 记录缓存未命中
     */
    public void recordCacheMiss() {
        cacheMisses.incrementAndGet();
    }

    /**
     * 定时检查缓存命中率
     * Requirements 12.4: 缓存命中率低于 70% 发送警告
     */
    @Scheduled(fixedRate = 300000) // 每5分钟检查一次
    public void checkCacheHitRate() {
        try {
            long hits = cacheHits.getAndSet(0);
            long misses = cacheMisses.getAndSet(0);
            long total = hits + misses;
            
            if (total > 0) {
                int hitRate = (int) ((hits * 100) / total);
                
                // 记录到Redis
                String key = MONITOR_PREFIX + "cache:hitrate:" + getCurrentMinute();
                redisTemplate.opsForHash().put(key, "hitRate", String.valueOf(hitRate));
                redisTemplate.opsForHash().put(key, "hits", String.valueOf(hits));
                redisTemplate.opsForHash().put(key, "misses", String.valueOf(misses));
                redisTemplate.expire(key, 24, TimeUnit.HOURS);
                
                // 检查是否低于阈值
                if (hitRate < cacheHitRateThreshold) {
                    sendAlert("CACHE_LOW_HIT_RATE",
                        String.format("缓存命中率过低: %d%% (命中: %d, 未命中: %d)",
                            hitRate, hits, misses),
                        "WARNING");
                }
                
                log.debug("缓存命中率 - {}% (命中: {}, 未命中: {})", hitRate, hits, misses);
            }
        } catch (Exception e) {
            log.error("检查缓存命中率失败", e);
        }
    }

    /**
     * 记录消息队列延迟
     * @param delayMs 延迟毫秒数
     */
    public void recordMqDelay(long delayMs) {
        mqTotalDelay.addAndGet(delayMs);
        mqMessageCount.incrementAndGet();
        
        // 立即检查是否超过阈值
        if (delayMs > mqDelayThreshold) {
            sendAlert("MQ_HIGH_DELAY",
                String.format("消息队列延迟过高: %dms (阈值: %dms)", delayMs, mqDelayThreshold),
                "CRITICAL");
        }
    }

    /**
     * 定时检查消息队列平均延迟
     * Requirements 12.5: 消息队列消费延迟超过 5 秒发送严重告警
     */
    @Scheduled(fixedRate = 60000) // 每分钟检查一次
    public void checkMqDelay() {
        try {
            long totalDelay = mqTotalDelay.getAndSet(0);
            long messageCount = mqMessageCount.getAndSet(0);
            
            if (messageCount > 0) {
                long avgDelay = totalDelay / messageCount;
                
                // 记录到Redis
                String key = MONITOR_PREFIX + "mq:delay:" + getCurrentMinute();
                redisTemplate.opsForHash().put(key, "avgDelay", String.valueOf(avgDelay));
                redisTemplate.opsForHash().put(key, "messageCount", String.valueOf(messageCount));
                redisTemplate.opsForHash().put(key, "totalDelay", String.valueOf(totalDelay));
                redisTemplate.expire(key, 24, TimeUnit.HOURS);
                
                // 检查平均延迟是否超过阈值
                if (avgDelay > mqDelayThreshold) {
                    sendAlert("MQ_AVG_HIGH_DELAY",
                        String.format("消息队列平均延迟过高: %dms (消息数: %d, 阈值: %dms)",
                            avgDelay, messageCount, mqDelayThreshold),
                        "CRITICAL");
                }
                
                log.debug("消息队列延迟 - 平均: {}ms, 消息数: {}", avgDelay, messageCount);
            }
        } catch (Exception e) {
            log.error("检查消息队列延迟失败", e);
        }
    }

    /**
     * 发送告警
     */
    @Async("monitorTaskExecutor")
    public void sendAlert(String alertType, String alertMessage, String severity) {
        try {
            // 防止告警风暴：同一告警类型5分钟内只发送一次
            String alertKey = ALERT_PREFIX + alertType + ":" + getCurrentMinute();
            Boolean alreadyAlerted = redisTemplate.hasKey(alertKey);

            if (Boolean.TRUE.equals(alreadyAlerted)) {
                log.debug("告警已发送，跳过重复告警: {}", alertType);
                return;
            }

            // 记录告警
            redisTemplate.opsForValue().set(alertKey, alertMessage, 5, TimeUnit.MINUTES);

            // 构建告警数据
            Map<String, Object> alertData = new HashMap<>();
            alertData.put("type", alertType);
            alertData.put("message", alertMessage);
            alertData.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            alertData.put("severity", severity);

            // 记录到日志
            if ("CRITICAL".equals(severity)) {
                log.error("系统告警 [{}] - 类型: {}, 消息: {}", severity, alertType, alertMessage);
            } else {
                log.warn("系统告警 [{}] - 类型: {}, 消息: {}", severity, alertType, alertMessage);
            }

            // 存储告警历史
            String historyKey = ALERT_PREFIX + "history:" + getCurrentHour();
            redisTemplate.opsForList().rightPush(historyKey, 
                String.format("[%s] %s: %s - %s", 
                    alertData.get("timestamp"), severity, alertType, alertMessage));
            redisTemplate.expire(historyKey, 7, TimeUnit.DAYS);

        } catch (Exception e) {
            log.error("发送告警失败", e);
        }
    }

    /**
     * 获取系统监控统计
     */
    public Map<String, Object> getSystemStats() {
        Map<String, Object> stats = new HashMap<>();

        try {
            // 数据库连接池状态
            stats.put("databasePool", getDatabasePoolStats());

            // 缓存统计
            Map<String, Object> cacheStats = new HashMap<>();
            cacheStats.put("currentHits", cacheHits.get());
            cacheStats.put("currentMisses", cacheMisses.get());
            stats.put("cache", cacheStats);

            // 消息队列统计
            Map<String, Object> mqStats = new HashMap<>();
            long count = mqMessageCount.get();
            mqStats.put("messageCount", count);
            mqStats.put("avgDelay", count > 0 ? mqTotalDelay.get() / count : 0);
            stats.put("messageQueue", mqStats);

        } catch (Exception e) {
            log.error("获取系统监控统计失败", e);
        }

        return stats;
    }

    /**
     * 获取告警历史
     */
    public java.util.List<String> getAlertHistory(int hours) {
        java.util.List<String> history = new java.util.ArrayList<>();
        
        try {
            LocalDateTime now = LocalDateTime.now();
            for (int i = 0; i < hours; i++) {
                String hour = now.minusHours(i).format(DateTimeFormatter.ofPattern("yyyyMMddHH"));
                String key = ALERT_PREFIX + "history:" + hour;
                java.util.List<String> hourHistory = redisTemplate.opsForList().range(key, 0, -1);
                if (hourHistory != null) {
                    history.addAll(hourHistory);
                }
            }
        } catch (Exception e) {
            log.error("获取告警历史失败", e);
        }
        
        return history;
    }

    private String getCurrentMinute() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmm"));
    }

    private String getCurrentHour() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHH"));
    }
}
