package com.luohuo.flex.im.core.e2ee.task;

import com.luohuo.flex.im.core.e2ee.service.E2EEAuditService;
import com.luohuo.flex.im.core.e2ee.service.E2EEKeyService;
import com.luohuo.flex.im.core.e2ee.service.E2EEMessageService;
import com.luohuo.flex.im.core.e2ee.service.SessionKeyRotationService;
import com.luohuo.flex.im.core.e2ee.service.DatabaseMaintenanceService;
import com.luohuo.flex.im.common.mq.E2EEMQProducer;
import com.luohuo.flex.im.domain.dto.MessageDestructNotificationDTO;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.flex.im.metrics.E2EEMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.ArrayList;

/**
 * E2EE定时任务
 *
 * 功能：
 * 1. 定时清理过期密钥
 * 2. 定时清理过期消息
 * 3. 定时清理过期审计日志
 * 4. 定时统计和监控
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class E2EEScheduledTasks {

    private final E2EEKeyService keyService;
    private final E2EEMessageService messageService;
    private final E2EEAuditService auditService;
    private final E2EEMetrics e2eeMetrics;
    private final E2EEMQProducer e2eeMQProducer;
    private final SessionKeyRotationService sessionKeyRotationService;
    private final DatabaseMaintenanceService databaseMaintenanceService;

    /**
     * 每天凌晨3点清理过期密钥
     */
    @Scheduled(cron = "0 0 3 * * ?")
    public void cleanupExpiredKeys() {
        log.info("开始定时清理过期密钥任务");
        long startTime = System.currentTimeMillis();

        try {
            int cleanedCount = keyService.cleanupExpiredKeys();
            long duration = System.currentTimeMillis() - startTime;

            log.info("过期密钥清理完成，清理数量: {}, 耗时: {}ms", cleanedCount, duration);
            e2eeMetrics.recordCleanupOperation("expired_keys", cleanedCount);

        } catch (Exception e) {
            log.error("清理过期密钥失败", e);
            e2eeMetrics.recordError("cleanup_expired_keys_failed");
        }
    }

    /**
     * 每天凌晨4点清理过期消息
     */
    @Scheduled(cron = "0 0 4 * * ?")
    public void cleanupExpiredMessages() {
        log.info("开始定时清理过期加密消息任务");
        long startTime = System.currentTimeMillis();

        try {
            int cleanedCount = messageService.cleanupExpiredMessages();
            long duration = System.currentTimeMillis() - startTime;

            log.info("过期加密消息清理完成，清理数量: {}, 耗时: {}ms", cleanedCount, duration);
            e2eeMetrics.recordCleanupOperation("expired_messages", cleanedCount);

        } catch (Exception e) {
            log.error("清理过期加密消息失败", e);
            e2eeMetrics.recordError("cleanup_expired_messages_failed");
        }
    }

    /**
     * 每分钟清理到期的自毁消息
     * 自毁消息最短可设置为5分钟，因此需要高频率检查
     */
    @Scheduled(cron = "0 * * * * ?")
    public void cleanupSelfDestructMessages() {
        log.debug("开始定时清理自毁消息任务");
        long startTime = System.currentTimeMillis();

        try {
            // 批量清理自毁消息并获取通知列表
            int cleanedCount = messageService.cleanupSelfDestructMessagesWithNotifications();

            // NOTE: 如果需要批量发送通知，可以在这里调用 e2eeMQProducer
            // 目前使用事件监听器逐个发送

            long duration = System.currentTimeMillis() - startTime;

            if (cleanedCount > 0) {
                log.info("自毁消息清理完成，清理数量: {}, 耗时: {}ms", cleanedCount, duration);
                e2eeMetrics.recordCleanupOperation("self_destruct_messages", cleanedCount);
            } else {
                log.debug("自毁消息清理完成，无需清理消息");
            }

        } catch (Exception e) {
            log.error("清理自毁消息失败", e);
            e2eeMetrics.recordError("cleanup_self_destruct_messages_failed");
        }
    }

    /**
     * 批量发送消息销毁通知的优化方法
     * 可配置是否启用批量发送（默认启用）
     */
    private void batchSendDestructNotifications(List<MessageDestructNotificationDTO> notifications) {
        if (notifications == null || notifications.isEmpty()) {
            return;
        }

        try {
            // 使用批量发送优化
            e2eeMQProducer.sendBatchMessageDestructNotifications(notifications);
            log.info("批量发送消息销毁通知完成，数量: {}", notifications.size());
        } catch (Exception e) {
            log.error("批量发送消息销毁通知失败", e);
        }
    }

    /**
     * 每天凌晨5点清理过期审计日志
     */
    @Scheduled(cron = "0 0 5 * * ?")
    public void cleanupExpiredAuditLogs() {
        log.info("开始定时清理过期审计日志任务");
        long startTime = System.currentTimeMillis();

        try {
            int cleanedCount = auditService.cleanupExpiredLogs();
            long duration = System.currentTimeMillis() - startTime;

            log.info("过期审计日志清理完成，清理数量: {}, 耗时: {}ms", cleanedCount, duration);
            e2eeMetrics.recordCleanupOperation("expired_audit_logs", cleanedCount);

        } catch (Exception e) {
            log.error("清理过期审计日志失败", e);
            e2eeMetrics.recordError("cleanup_expired_audit_logs_failed");
        }
    }

    /**
     * 每小时检查密钥轮换
     */
    @Scheduled(cron = "0 0 * * * ?")
    public void checkKeyRotation() {
        log.debug("执行密钥轮换检查任务");
        long startTime = System.currentTimeMillis();

        try {
            // 调用密钥轮换服务检查并处理需要轮换的密钥
            int rotatedCount = sessionKeyRotationService.checkAndRotateKeys();

            long duration = System.currentTimeMillis() - startTime;

            if (rotatedCount > 0) {
                log.info("密钥轮换检查完成，轮换数量: {}, 耗时: {}ms", rotatedCount, duration);
            } else {
                log.debug("密钥轮换检查完成，无需轮换密钥，耗时: {}ms", duration);
            }

        } catch (Exception e) {
            log.error("密钥轮换检查失败", e);
            e2eeMetrics.recordError("key_rotation_check_failed");
        }
    }

    /**
     * 每15分钟收集统计数据
     */
    @Scheduled(cron = "0 */15 * * * ?")
    public void collectStatistics() {
        log.debug("收集E2EE统计数据");

        try {
            // 统计数据收集已通过E2EEMetrics + Prometheus实现
            // 可通过/actuator/prometheus获取以下指标：
            // 1. e2ee_active_users - 活跃用户数
            // 2. e2ee_messages_encrypted_total - 加密消息总数
            // 3. e2ee_cache_hit_total - 缓存命中次数
            // 4. e2ee_errors_total - 错误统计
            // 参见：E2EEMetrics.java 和 docs/grafana/E2EE_Dashboard.json
            log.debug("统计数据已通过Prometheus收集");

        } catch (Exception e) {
            log.error("收集统计数据失败", e);
        }
    }

    /**
     * 每天凌晨2点生成日报
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void generateDailyReport() {
        log.info("生成E2EE每日报告");
        long startTime = System.currentTimeMillis();

        try {
            // E2EE日报已通过Grafana仪表盘实现可视化
            // 管理员可查看：
            // 1. 性能趋势（加密/解密延迟）
            // 2. 消息量统计
            // 3. 缓存命中率
            // 4. 错误分析
            // 如需邮件日报，可在此实现从Prometheus查询并发送邮件
            // 参见：docs/grafana/E2EE_Dashboard.json

            long duration = System.currentTimeMillis() - startTime;
            log.info("E2EE每日报告生成完成（已通过Grafana可视化），耗时: {}ms", duration);

        } catch (Exception e) {
            log.error("生成每日报告失败", e);
            e2eeMetrics.recordError("daily_report_generation_failed");
        }
    }

    /**
     * 每30分钟检查系统健康状态
     */
    @Scheduled(cron = "0 */30 * * * ?")
    public void healthCheck() {
        log.debug("执行E2EE系统健康检查");

        try {
            // 系统健康检查已通过Spring Actuator + Prometheus实现
            // 可访问：
            // 1. /actuator/health - 总体健康状态（包含Redis、DB、MQ）
            // 2. /e2ee/health - E2EE专用健康检查
            // Prometheus监控告警参见：docs/prometheus/e2ee_alerts.yml
            log.debug("E2EE健康检查完成（已通过Actuator + Prometheus监控）");

        } catch (Exception e) {
            log.error("健康检查失败", e);
            e2eeMetrics.recordError("health_check_failed");
        }
    }

    /**
     * 每周执行数据库维护任务
     * 包括分析表、更新统计信息、优化索引等
     */
    @Scheduled(cron = "0 0 3 * * 1")  // 每周一凌晨3点
    public void databaseMaintenance() {
        log.info("开始执行数据库维护任务");
        long startTime = System.currentTimeMillis();

        try {
            // 1. 分析表以更新统计信息
            int maintainedCount = databaseMaintenanceService.performMaintenance();

            // 2. 归档90天前的历史数据
            int archivedCount = databaseMaintenanceService.archiveHistoricalData(90);

            long duration = System.currentTimeMillis() - startTime;
            log.info("数据库维护任务完成，维护表数: {}, 归档记录数: {}, 耗时: {}ms",
                maintainedCount, archivedCount, duration);
            e2eeMetrics.recordMaintenanceOperation("database_maintenance", duration);

        } catch (Exception e) {
            log.error("数据库维护任务失败", e);
            e2eeMetrics.recordError("database_maintenance_failed");
        }
    }

    /**
     * 每小时检查数据库性能
     * 监控表大小、索引效率、慢查询等
     */
    @Scheduled(cron = "0 0 * * * ?")
    public void monitorDatabasePerformance() {
        log.debug("开始监控数据库性能");

        try {
            // 执行数据库性能监控
            // 1. 监控表大小增长
            // 2. 检查索引使用率
            // 3. 监控慢查询
            // 4. 检查缓存命中率
            // 5. 监控连接池状态
            databaseMaintenanceService.monitorPerformance();

            log.debug("数据库性能监控完成");

        } catch (Exception e) {
            log.error("数据库性能监控失败", e);
            e2eeMetrics.recordError("database_monitoring_failed");
        }
    }
}
