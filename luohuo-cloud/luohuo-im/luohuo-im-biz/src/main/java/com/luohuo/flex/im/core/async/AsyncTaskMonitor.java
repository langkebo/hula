package com.luohuo.flex.im.core.async;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 异步任务监控
 * 监控异步任务的执行状态、进度、性能等
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
@Component
public class AsyncTaskMonitor {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    // 任务统计
    private final ConcurrentHashMap<String, TaskStats> taskStats = new ConcurrentHashMap<>();
    private final AtomicLong totalTasks = new AtomicLong(0);
    private final AtomicLong completedTasks = new AtomicLong(0);
    private final AtomicLong failedTasks = new AtomicLong(0);

    /**
     * 开始任务
     */
    public void startTask(String taskName, int totalItems) {
        TaskStats stats = taskStats.computeIfAbsent(taskName, k -> new TaskStats());
        stats.startTime = System.currentTimeMillis();
        stats.totalItems = totalItems;
        stats.processedItems = 0;
        stats.status = TaskStatus.RUNNING;

        totalTasks.incrementAndGet();

        // 记录到 Redis 用于历史分析
        String key = getTaskKey(taskName);
        redisTemplate.opsForHash().put(key, "status", "RUNNING");
        redisTemplate.opsForHash().put(key, "startTime", String.valueOf(stats.startTime));
        redisTemplate.opsForHash().put(key, "totalItems", String.valueOf(totalItems));
        redisTemplate.opsForHash().put(key, "processedItems", "0");
        redisTemplate.expire(key, 1, java.util.concurrent.TimeUnit.DAYS);

        log.debug("任务开始: {}, 总数: {}", taskName, totalItems);
    }

    /**
     * 增加进度
     */
    public void incrementProgress() {
        taskStats.values().forEach(stats -> {
            if (stats.status == TaskStatus.RUNNING) {
                stats.processedItems++;
                updateProgressInRedis(stats);
            }
        });
    }

    /**
     * 完成任务
     */
    public void completeTask(String taskName) {
        TaskStats stats = taskStats.get(taskName);
        if (stats != null) {
            stats.endTime = System.currentTimeMillis();
            stats.status = TaskStatus.COMPLETED;
            completedTasks.incrementAndGet();

            long duration = stats.endTime - stats.startTime;

            // 更新 Redis
            String key = getTaskKey(taskName);
            redisTemplate.opsForHash().put(key, "status", "COMPLETED");
            redisTemplate.opsForHash().put(key, "endTime", String.valueOf(stats.endTime));
            redisTemplate.opsForHash().put(key, "duration", String.valueOf(duration));

            log.info("任务完成: {}, 耗时: {}ms, 处理数: {}/{}",
                taskName, duration, stats.processedItems, stats.totalItems);
        }
    }

    /**
     * 任务失败
     */
    public void failTask(String taskName, Throwable error) {
        TaskStats stats = taskStats.get(taskName);
        if (stats != null) {
            stats.endTime = System.currentTimeMillis();
            stats.status = TaskStatus.FAILED;
            stats.error = error.getMessage();
            failedTasks.incrementAndGet();

            long duration = stats.endTime - stats.startTime;

            // 更新 Redis
            String key = getTaskKey(taskName);
            redisTemplate.opsForHash().put(key, "status", "FAILED");
            redisTemplate.opsForHash().put(key, "endTime", String.valueOf(stats.endTime));
            redisTemplate.opsForHash().put(key, "error", stats.error);
            redisTemplate.opsForHash().put(key, "duration", String.valueOf(duration));

            log.error("任务失败: {}, 耗时: {}ms, 处理数: {}/{}, 错误: {}",
                taskName, duration, stats.processedItems, stats.totalItems, error.getMessage(), error);
        }
    }

    /**
     * 获取任务统计
     */
    public TaskStats getTaskStats(String taskName) {
        return taskStats.get(taskName);
    }

    /**
     * 获取所有任务统计
     */
    public java.util.Map<String, TaskStats> getAllTaskStats() {
        return new java.util.HashMap<>(taskStats);
    }

    /**
     * 获取总体统计
     */
    public TaskMonitorStats getOverallStats() {
        return new TaskMonitorStats(
            totalTasks.get(),
            completedTasks.get(),
            failedTasks.get(),
            getAverageTaskDuration()
        );
    }

    /**
     * 定时更新统计
     */
    @Scheduled(fixedRate = 5000) // 每5秒更新一次
    public void updateStats() {
        try {
            // 清理过期的任务统计
            cleanupExpiredStats();

            // 计算平均处理速度
            calculateAverageThroughput();
        } catch (Exception e) {
            log.error("更新统计失败", e);
        }
    }

    /**
     * 定时清理历史数据
     */
    @Scheduled(cron = "0 0 2 * * ?") // 每天凌晨2点执行
    public void cleanupHistory() {
        try {
            log.info("开始清理异步任务监控历史数据...");

            String pattern = "async_task_stats:*";
            java.util.Set<String> keys = redisTemplate.keys(pattern);

            int deletedCount = 0;
            for (String key : keys) {
                String timestamp = key.split(":")[1];
                long ts = Long.parseLong(timestamp);
                long cutoffTime = System.currentTimeMillis() - (7 * 24 * 60 * 60 * 1000); // 7天前

                if (ts < cutoffTime) {
                    redisTemplate.delete(key);
                    deletedCount++;
                }
            }

            log.info("历史数据清理完成，删除记录数: {}", deletedCount);
        } catch (Exception e) {
            log.error("清理历史数据失败", e);
        }
    }

    /**
     * 清理过期的任务统计
     */
    private void cleanupExpiredStats() {
        long now = System.currentTimeMillis();
        long expireTime = 5 * 60 * 1000; // 5分钟

        taskStats.entrySet().removeIf(entry -> {
            TaskStats stats = entry.getValue();
            return stats.endTime > 0 && (now - stats.endTime) > expireTime;
        });
    }

    /**
     * 计算平均任务耗时
     */
    private long getAverageTaskDuration() {
        long totalDuration = 0;
        int count = 0;

        for (TaskStats stats : taskStats.values()) {
            if (stats.endTime > 0 && stats.startTime > 0) {
                totalDuration += (stats.endTime - stats.startTime);
                count++;
            }
        }

        return count > 0 ? totalDuration / count : 0;
    }

    /**
     * 计算平均处理速度
     */
    private void calculateAverageThroughput() {
        // 这里可以计算每分钟处理的平均任务数
        // 具体实现可以根据需要调整
    }

    /**
     * 更新进度到 Redis
     */
    private void updateProgressInRedis(TaskStats stats) {
        String key = getTaskKey(stats.taskName);
        redisTemplate.opsForHash().put(key, "processedItems", String.valueOf(stats.processedItems));

        // 计算进度百分比
        if (stats.totalItems > 0) {
            double progress = (double) stats.processedItems / stats.totalItems * 100;
            redisTemplate.opsForHash().put(key, "progress", String.format("%.2f%%", progress));
        }
    }

    /**
     * 生成任务键
     */
    private String getTaskKey(String taskName) {
        return String.format("async_task_stats:%d:%s", System.currentTimeMillis(), taskName);
    }

    /**
     * 任务统计
     */
    public static class TaskStats {
        public String taskName;
        public long startTime;
        public long endTime;
        public int totalItems;
        public int processedItems;
        public TaskStatus status;
        public String error;

        @Override
        public String toString() {
            return String.format(
                "TaskStats{name='%s', status=%s, progress=%d/%d, duration=%dms}",
                taskName, status, processedItems, totalItems,
                endTime > 0 ? (endTime - startTime) : 0
            );
        }
    }

    /**
     * 任务监控统计
     */
    public static class TaskMonitorStats {
        private final long totalTasks;
        private final long completedTasks;
        private final long failedTasks;
        private final long averageDuration;

        public TaskMonitorStats(long totalTasks, long completedTasks, long failedTasks, long averageDuration) {
            this.totalTasks = totalTasks;
            this.completedTasks = completedTasks;
            this.failedTasks = failedTasks;
            this.averageDuration = averageDuration;
        }

        public double getSuccessRate() {
            return totalTasks > 0 ? (double) completedTasks / totalTasks : 0;
        }

        public double getFailureRate() {
            return totalTasks > 0 ? (double) failedTasks / totalTasks : 0;
        }

        @Override
        public String toString() {
            return String.format(
                "TaskMonitorStats{total=%d, completed=%d, failed=%d, successRate=%.2f%%, averageDuration=%dms}",
                totalTasks, completedTasks, failedTasks, getSuccessRate() * 100, averageDuration
            );
        }
    }

    /**
     * 任务状态枚举
     */
    public enum TaskStatus {
        RUNNING,
        COMPLETED,
        FAILED,
        CANCELLED
    }
}