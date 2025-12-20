package com.luohuo.flex.monitor.service;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.cluster.HealthRequest;
import co.elastic.clients.elasticsearch.cluster.HealthResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.actuate.health.Health;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.ThreadMXBean;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * 系统健康检查服务
 *
 * @author HuLa
 * @since 2025-12-20
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SystemHealthService {

    private final DataSource dataSource;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ElasticsearchClient elasticsearchClient;

    /**
     * 检查数据库健康状态
     */
    public Health checkDatabaseHealth() {
        try {
            long startTime = System.currentTimeMillis();
            JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);

            // 执行简单查询
            Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            long responseTime = System.currentTimeMillis() - startTime;

            if (result != null && result == 1) {
                Map<String, Object> details = new HashMap<>();
                details.put("responseTime", responseTime + "ms");
                details.put("status", "Connected");

                return Health.up()
                        .withDetails(details)
                        .build();
            }
        } catch (Exception e) {
            log.error("Database health check failed", e);
            return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
        }
        return Health.down().build();
    }

    /**
     * 检查Redis健康状态
     */
    public Health checkRedisHealth() {
        try {
            long startTime = System.currentTimeMillis();

            // 执行ping操作
            String pong = redisTemplate.getConnectionFactory()
                    .getConnection()
                    .ping();
            long responseTime = System.currentTimeMillis() - startTime;

            if ("PONG".equals(pong)) {
                Map<String, Object> details = new HashMap<>();
                details.put("responseTime", responseTime + "ms");

                // 获取Redis信息
                Properties info = redisTemplate.getConnectionFactory()
                        .getConnection()
                        .info();
                details.put("used_memory", info.getProperty("used_memory_human"));
                details.put("connected_clients", info.getProperty("connected_clients"));

                return Health.up()
                        .withDetails(details)
                        .build();
            }
        } catch (Exception e) {
            log.error("Redis health check failed", e);
            return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
        }
        return Health.down().build();
    }

    /**
     * 检查Elasticsearch健康状态
     */
    public Health checkElasticsearchHealth() {
        try {
            HealthRequest request = HealthRequest.of(h -> h.waitForStatus("yellow"));
            HealthResponse response = elasticsearchClient.cluster().health(request);

            String status = response.status().jsonValue();
            Map<String, Object> details = new HashMap<>();
            details.put("cluster_name", response.clusterName());
            details.put("number_of_nodes", response.numberOfNodes());
            details.put("active_primary_shards", response.activePrimaryShards());
            details.put("active_shards", response.activeShards());

            if ("green".equals(status) || "yellow".equals(status)) {
                return Health.up()
                        .withDetails(details)
                        .build();
            } else {
                return Health.down()
                        .withDetails(details)
                        .build();
            }
        } catch (Exception e) {
            log.error("Elasticsearch health check failed", e);
            return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
        }
    }

    /**
     * 检查WebSocket健康状态
     */
    public Health checkWebSocketHealth() {
        try {
            // 检查WebSocket服务是否正常
            // 这里可以添加具体的检查逻辑，比如检查连接数等
            Map<String, Object> details = new HashMap<>();
            details.put("status", "Running");

            return Health.up()
                    .withDetails(details)
                    .build();
        } catch (Exception e) {
            log.error("WebSocket health check failed", e);
            return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
        }
    }

    /**
     * 检查磁盘空间
     */
    public Health checkDiskSpace() {
        try {
            File[] roots = File.listRoots();
            Map<String, Object> diskInfo = new HashMap<>();

            for (File root : roots) {
                long totalSpace = root.getTotalSpace();
                long freeSpace = root.getFreeSpace();
                long usedSpace = totalSpace - freeSpace;
                double usagePercent = (double) usedSpace / totalSpace * 100;

                Map<String, Object> info = new HashMap<>();
                info.put("total", formatBytes(totalSpace));
                info.put("free", formatBytes(freeSpace));
                info.put("used", formatBytes(usedSpace));
                info.put("usage", String.format("%.2f%%", usagePercent));

                diskInfo.put(root.getAbsolutePath(), info);

                // 如果磁盘使用率超过90%，返回警告
                if (usagePercent > 90) {
                    return Health.down()
                            .withDetails(diskInfo)
                            .withDetail("warning", "Disk usage above 90%")
                            .build();
                }
            }

            return Health.up()
                    .withDetails(diskInfo)
                    .build();
        } catch (Exception e) {
            log.error("Disk space check failed", e);
            return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
        }
    }

    /**
     * 检查内存使用情况
     */
    public Health checkMemoryUsage() {
        try {
            MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
            long heapUsed = memoryBean.getHeapMemoryUsage().getUsed();
            long heapMax = memoryBean.getHeapMemoryUsage().getMax();
            double heapUsagePercent = (double) heapUsed / heapMax * 100;

            Map<String, Object> details = new HashMap<>();
            details.put("heap.used", formatBytes(heapUsed));
            details.put("heap.max", formatBytes(heapMax));
            details.put("heap.usage", String.format("%.2f%%", heapUsagePercent));

            // 获取非堆内存信息
            long nonHeapUsed = memoryBean.getNonHeapMemoryUsage().getUsed();
            long nonHeapMax = memoryBean.getNonHeapMemoryUsage().getMax();
            details.put("nonHeap.used", formatBytes(nonHeapUsed));
            details.put("nonHeap.max", formatBytes(nonHeapMax));

            // 如果堆内存使用率超过90%，返回警告
            if (heapUsagePercent > 90) {
                return Health.down()
                        .withDetails(details)
                        .withDetail("warning", "Heap memory usage above 90%")
                        .build();
            }

            return Health.up()
                    .withDetails(details)
                    .build();
        } catch (Exception e) {
            log.error("Memory usage check failed", e);
            return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
        }
    }

    /**
     * 检查特定组件的健康状态
     */
    public Health checkComponentHealth(String component) {
        switch (component.toLowerCase()) {
            case "database":
                return checkDatabaseHealth();
            case "redis":
                return checkRedisHealth();
            case "elasticsearch":
                return checkElasticsearchHealth();
            case "websocket":
                return checkWebSocketHealth();
            case "diskspace":
                return checkDiskSpace();
            case "memory":
                return checkMemoryUsage();
            default:
                return Health.down()
                        .withDetail("error", "Unknown component: " + component)
                        .build();
        }
    }

    /**
     * 获取系统性能指标
     */
    public Map<String, Object> getPerformanceMetrics() {
        Map<String, Object> metrics = new HashMap<>();

        // 线程信息
        ThreadMXBean threadBean = ManagementFactory.getThreadMXBean();
        metrics.put("thread.count", threadBean.getThreadCount());
        metrics.put("thread.daemon", threadBean.getDaemonThreadCount());
        metrics.put("thread.peak", threadBean.getPeakThreadCount());

        // 垃圾回收信息
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        metrics.put("gc.heap.used", memoryBean.getHeapMemoryUsage().getUsed());
        metrics.put("gc.heap.max", memoryBean.getHeapMemoryUsage().getMax());
        metrics.put("gc.nonHeap.used", memoryBean.getNonHeapMemoryUsage().getUsed());

        // 系统负载
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        metrics.put("system.load.average", osBean.getSystemLoadAverage());
        metrics.put("system.cpu.usage", osBean.getProcessCpuLoad());

        return metrics;
    }

    /**
     * 格式化字节数
     */
    private String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.2f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.2f MB", bytes / 1024.0 / 1024.0);
        return String.format("%.2f GB", bytes / 1024.0 / 1024.0 / 1024.0);
    }
}