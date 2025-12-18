package com.luohuo.flex.ws.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 线程池配置属性
 * ===== P0修复: 线程池参数优化 (2025-12-13) =====
 * 提升默认值以支持更高并发场景
 */
@ConfigurationProperties(prefix = "luohuo.thread")
@Component
@Data
public class ThreadPoolProperties {
    // ===== P0修复: 线程池参数优化 (2025-12-13) =====
    // 核心线程数: 10 → 16, 支持更多并发任务
    private int coreSize = 16;
    // 最大线程数: 16 → 50, 支持突发流量
    private int maxSize = 50;
    // 队列容量: 1000 → 2000, 提升消息推送吞吐量
    private int queueCapacity = 2000;
    // 线程空闲超时时间（秒）
    private int keepAlive = 60;
}