package com.luohuo.flex.im.core.e2ee.monitor;

import com.luohuo.flex.im.metrics.E2EEMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * E2EE监控告警服务
 *
 * 功能：
 * 1. 性能监控
 * 2. 错误率监控
 * 3. 异常告警
 * 4. 阈值检测
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EEMonitorService {

    private final E2EEMetrics e2eeMetrics;
    private final RedisTemplate<String, String> redisTemplate;

    private static final String MONITOR_PREFIX = "e2ee:monitor:";
    private static final String ALERT_PREFIX = "e2ee:alert:";

    // 告警阈值配置
    private static final int ERROR_RATE_THRESHOLD = 5; // 错误率阈值 5%
    private static final long AVG_LATENCY_THRESHOLD = 200; // 平均延迟阈值 200ms
    private static final long MAX_MESSAGE_SIZE_THRESHOLD = 10 * 1024 * 1024; // 最大消息大小 10MB

    /**
     * 记录操作延迟
     */
    @Async("e2eeTaskExecutor")
    public void recordLatency(String operation, long latencyMs) {
        try {
            // 记录到Metrics
            switch (operation) {
                case "encryption":
                    e2eeMetrics.recordEncryptionTime(latencyMs);
                    break;
                case "decryption":
                    e2eeMetrics.recordDecryptionTime(latencyMs);
                    break;
                case "key_generation":
                    e2eeMetrics.recordKeyGenerationTime("RSA", latencyMs);
                    break;
                default:
                    log.debug("未知操作类型: {}", operation);
            }

            // 存储到Redis（用于计算平均值和趋势）
            String key = MONITOR_PREFIX + "latency:" + operation + ":" + getCurrentHour();
            redisTemplate.opsForList().rightPush(key, String.valueOf(latencyMs));
            redisTemplate.expire(key, 24, TimeUnit.HOURS);

            // 检查是否超过阈值
            if (latencyMs > AVG_LATENCY_THRESHOLD) {
                sendAlert("HIGH_LATENCY", operation + "操作延迟过高: " + latencyMs + "ms");
            }

        } catch (Exception e) {
            log.error("记录操作延迟失败", e);
        }
    }

    /**
     * 记录错误
     */
    @Async("e2eeTaskExecutor")
    public void recordError(String errorType, String errorMessage) {
        try {
            // 记录到Metrics
            e2eeMetrics.recordError(errorType);

            // 增加错误计数
            String errorKey = MONITOR_PREFIX + "errors:" + errorType + ":" + getCurrentHour();
            redisTemplate.opsForValue().increment(errorKey);
            redisTemplate.expire(errorKey, 24, TimeUnit.HOURS);

            // 检查错误率
            checkErrorRate(errorType);

            log.warn("E2EE错误 - 类型: {}, 消息: {}", errorType, errorMessage);

        } catch (Exception e) {
            log.error("记录错误失败", e);
        }
    }

    /**
     * 记录消息大小
     */
    @Async("e2eeTaskExecutor")
    public void recordMessageSize(long sizeBytes) {
        try {
            String key = MONITOR_PREFIX + "message_size:" + getCurrentHour();
            redisTemplate.opsForList().rightPush(key, String.valueOf(sizeBytes));
            redisTemplate.expire(key, 24, TimeUnit.HOURS);

            // 检查是否超过大小限制
            if (sizeBytes > MAX_MESSAGE_SIZE_THRESHOLD) {
                sendAlert("LARGE_MESSAGE", "检测到超大消息: " + (sizeBytes / 1024 / 1024) + "MB");
            }

        } catch (Exception e) {
            log.error("记录消息大小失败", e);
        }
    }

    /**
     * 检查错误率
     */
    private void checkErrorRate(String errorType) {
        try {
            String errorKey = MONITOR_PREFIX + "errors:" + errorType + ":" + getCurrentHour();
            String totalKey = MONITOR_PREFIX + "total:" + errorType + ":" + getCurrentHour();

            String errorCountStr = redisTemplate.opsForValue().get(errorKey);
            String totalCountStr = redisTemplate.opsForValue().get(totalKey);

            if (errorCountStr != null && totalCountStr != null) {
                int errorCount = Integer.parseInt(errorCountStr);
                int totalCount = Integer.parseInt(totalCountStr);

                if (totalCount > 0) {
                    int errorRate = (errorCount * 100) / totalCount;

                    if (errorRate > ERROR_RATE_THRESHOLD) {
                        sendAlert("HIGH_ERROR_RATE",
                                String.format("错误率过高: %s - %d%% (%d/%d)",
                                        errorType, errorRate, errorCount, totalCount));
                    }
                }
            }

        } catch (Exception e) {
            log.error("检查错误率失败", e);
        }
    }

    /**
     * 发送告警
     */
    @Async("e2eeTaskExecutor")
    public void sendAlert(String alertType, String alertMessage) {
        try {
            // 防止告警风暴：同一告警类型1小时内只发送一次
            String alertKey = ALERT_PREFIX + alertType + ":" + getCurrentHour();
            Boolean alreadyAlerted = redisTemplate.hasKey(alertKey);

            if (Boolean.TRUE.equals(alreadyAlerted)) {
                log.debug("告警已发送，跳过重复告警: {}", alertType);
                return;
            }

            // 记录告警
            redisTemplate.opsForValue().set(alertKey, alertMessage, 1, TimeUnit.HOURS);

            // 构建告警数据
            Map<String, Object> alertData = new HashMap<>();
            alertData.put("type", alertType);
            alertData.put("message", alertMessage);
            alertData.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            alertData.put("severity", getSeverity(alertType));

            // 记录到日志
            log.error("E2EE告警 - 类型: {}, 消息: {}", alertType, alertMessage);

            // 发送告警通知
            // 告警通知已通过Prometheus + AlertManager实现
            // 参见: docs/prometheus/e2ee_alerts.yml
            // 参见: docs/prometheus/alertmanager.yml
            // 如需自定义告警，可在此处集成邮件/钉钉/企业微信等通知方式

        } catch (Exception e) {
            log.error("发送告警失败", e);
        }
    }

    /**
     * 获取告警严重程度
     */
    private String getSeverity(String alertType) {
        switch (alertType) {
            case "HIGH_ERROR_RATE":
            case "SYSTEM_DOWN":
                return "CRITICAL";
            case "HIGH_LATENCY":
            case "LARGE_MESSAGE":
                return "WARNING";
            default:
                return "INFO";
        }
    }

    /**
     * 获取当前小时（格式：yyyyMMddHH）
     */
    private String getCurrentHour() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHH"));
    }

    /**
     * 获取性能统计
     */
    public Map<String, Object> getPerformanceStats() {
        Map<String, Object> stats = new HashMap<>();

        try {
            String currentHour = getCurrentHour();

            // 获取加密操作延迟统计
            stats.put("encryptionLatency", getLatencyStats("encryption", currentHour));

            // 获取解密操作延迟统计
            stats.put("decryptionLatency", getLatencyStats("decryption", currentHour));

            // 获取错误统计
            stats.put("errorStats", getErrorStats(currentHour));

            // 获取消息大小统计
            stats.put("messageSizeStats", getMessageSizeStats(currentHour));

        } catch (Exception e) {
            log.error("获取性能统计失败", e);
        }

        return stats;
    }

    /**
     * 获取延迟统计
     */
    private Map<String, Object> getLatencyStats(String operation, String hour) {
        Map<String, Object> stats = new HashMap<>();
        String key = MONITOR_PREFIX + "latency:" + operation + ":" + hour;

        try {
            Long size = redisTemplate.opsForList().size(key);
            if (size != null && size > 0) {
                // 计算平均延迟
                long sum = 0;
                for (int i = 0; i < size; i++) {
                    String value = redisTemplate.opsForList().index(key, i);
                    if (value != null) {
                        sum += Long.parseLong(value);
                    }
                }
                long avgLatency = sum / size;

                stats.put("count", size);
                stats.put("avgLatency", avgLatency);
            }
        } catch (Exception e) {
            log.error("获取延迟统计失败: {}", operation, e);
        }

        return stats;
    }

    /**
     * 获取错误统计
     */
    private Map<String, Object> getErrorStats(String hour) {
        Map<String, Object> stats = new HashMap<>();

        try {
            String errorKey = MONITOR_PREFIX + "errors:" + hour;

            // 从Redis获取错误统计数据
            Map<Object, Object> errorData = redisTemplate.opsForHash().entries(errorKey);

            long totalErrors = 0;
            for (Object value : errorData.values()) {
                try {
                    totalErrors += Long.parseLong(value.toString());
                } catch (NumberFormatException e) {
                    log.warn("解析错误计数失败: {}", value);
                }
            }

            // 获取总操作数（用于计算错误率）
            String opsKey = MONITOR_PREFIX + "operations:" + hour;
            String totalOpsStr = redisTemplate.opsForValue().get(opsKey);
            long totalOps = totalOpsStr != null ? Long.parseLong(totalOpsStr) : 0;

            // 计算错误率
            double errorRate = totalOps > 0 ? (totalErrors * 100.0 / totalOps) : 0.0;

            stats.put("totalErrors", totalErrors);
            stats.put("errorRate", errorRate);
            stats.put("errorBreakdown", errorData);

        } catch (Exception e) {
            log.error("获取错误统计失败", e);
            stats.put("totalErrors", 0);
            stats.put("errorRate", 0.0);
        }

        return stats;
    }

    /**
     * 获取消息大小统计
     */
    private Map<String, Object> getMessageSizeStats(String hour) {
        Map<String, Object> stats = new HashMap<>();
        String key = MONITOR_PREFIX + "message_size:" + hour;

        try {
            Long size = redisTemplate.opsForList().size(key);
            if (size != null && size > 0) {
                long sum = 0;
                long max = 0;
                long min = Long.MAX_VALUE;

                for (int i = 0; i < size; i++) {
                    String value = redisTemplate.opsForList().index(key, i);
                    if (value != null) {
                        long messageSize = Long.parseLong(value);
                        sum += messageSize;
                        max = Math.max(max, messageSize);
                        min = Math.min(min, messageSize);
                    }
                }

                stats.put("count", size);
                stats.put("avgSize", sum / size);
                stats.put("maxSize", max);
                stats.put("minSize", min);
            }
        } catch (Exception e) {
            log.error("获取消息大小统计失败", e);
        }

        return stats;
    }
}
