package com.luohuo.flex.monitor.endpoint;

import com.luohuo.flex.monitor.service.SystemHealthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.actuate.endpoint.annotation.Endpoint;
import org.springframework.boot.actuate.endpoint.annotation.ReadOperation;
import org.springframework.boot.actuate.endpoint.annotation.Selector;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 自定义健康检查端点
 *
 * @author HuLa
 * @since 2025-12-20
 */
@Slf4j
@Component
@Endpoint(id = "hula-health")
@RequiredArgsConstructor
public class HealthCheckEndpoint {

    private final SystemHealthService systemHealthService;

    /**
     * 读取系统健康状态
     */
    @ReadOperation
    public Map<String, Object> health() {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "UP");
        result.put("timestamp", System.currentTimeMillis());
        result.put("components", getComponentsHealth());
        result.put("systemInfo", getSystemInfo());
        return result;
    }

    /**
     * 获取特定组件的健康状态
     */
    @ReadOperation
    public Map<String, Object> componentHealth(@Selector String component) {
        Map<String, Object> result = new HashMap<>();
        Health health = systemHealthService.checkComponentHealth(component);
        result.put("component", component);
        result.put("status", health.getStatus().getCode());
        result.put("details", health.getDetails());
        return result;
    }

    /**
     * 获取所有组件的健康状态
     */
    private Map<String, Health> getComponentsHealth() {
        Map<String, Health> components = new HashMap<>();

        // 数据库健康检查
        components.put("database", systemHealthService.checkDatabaseHealth());

        // Redis健康检查
        components.put("redis", systemHealthService.checkRedisHealth());

        // Elasticsearch健康检查
        components.put("elasticsearch", systemHealthService.checkElasticsearchHealth());

        // WebSocket健康检查
        components.put("websocket", systemHealthService.checkWebSocketHealth());

        // 磁盘空间检查
        components.put("diskSpace", systemHealthService.checkDiskSpace());

        // 内存使用检查
        components.put("memory", systemHealthService.checkMemoryUsage());

        return components;
    }

    /**
     * 获取系统信息
     */
    private Map<String, Object> getSystemInfo() {
        Map<String, Object> info = new HashMap<>();
        Runtime runtime = Runtime.getRuntime();

        // JVM信息
        info.put("java.version", System.getProperty("java.version"));
        info.put("jvm.name", System.getProperty("java.vm.name"));
        info.put("jvm.version", System.getProperty("java.vm.version"));

        // 内存信息
        long maxMemory = runtime.maxMemory();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        long usedMemory = totalMemory - freeMemory;

        info.put("memory.max", formatBytes(maxMemory));
        info.put("memory.total", formatBytes(totalMemory));
        info.put("memory.used", formatBytes(usedMemory));
        info.put("memory.free", formatBytes(freeMemory));
        info.put("memory.usage", String.format("%.2f%%", (double) usedMemory / maxMemory * 100));

        // 系统信息
        info.put("os.name", System.getProperty("os.name"));
        info.put("os.version", System.getProperty("os.version"));
        info.put("processors", runtime.availableProcessors());

        // 应用信息
        info.put("application.name", System.getProperty("spring.application.name", "unknown"));
        info.put("application.version", System.getProperty("application.version", "unknown"));

        return info;
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

/**
 * 自定义健康指示器
 */
@Slf4j
@Component
@RequiredArgsConstructor
class CustomHealthIndicator implements HealthIndicator {

    private final SystemHealthService systemHealthService;

    @Override
    public Health health() {
        // 检查关键组件状态
        boolean dbHealthy = systemHealthService.checkDatabaseHealth().getStatus() == Health.Status.UP;
        boolean redisHealthy = systemHealthService.checkRedisHealth().getStatus() == Health.Status.UP;

        if (dbHealthy && redisHealthy) {
            return Health.up()
                    .withDetail("database", "UP")
                    .withDetail("redis", "UP")
                    .build();
        } else {
            return Health.down()
                    .withDetail("database", dbHealthy ? "UP" : "DOWN")
                    .withDetail("redis", redisHealthy ? "UP" : "DOWN")
                    .build();
        }
    }
}