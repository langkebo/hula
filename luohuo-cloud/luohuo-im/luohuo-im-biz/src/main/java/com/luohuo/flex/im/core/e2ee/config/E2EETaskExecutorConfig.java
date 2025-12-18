package com.luohuo.flex.im.core.e2ee.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * E2EE异步任务执行器配置
 *
 * 为E2EE相关的异步操作提供专用线程池：
 * - 缓存预热
 * - 密钥清理
 * - 审计日志写入
 * - 性能指标收集
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Configuration
@EnableAsync
public class E2EETaskExecutorConfig {

    /**
     * E2EE专用异步任务执行器
     *
     * 线程池配置：
     * - 核心线程数: 5
     * - 最大线程数: 20
     * - 队列容量: 200
     * - 线程空闲时间: 60秒
     * - 拒绝策略: CallerRunsPolicy (调用者运行)
     */
    @Bean(name = "e2eeTaskExecutor")
    public Executor e2eeTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        
        // 核心线程池大小
        executor.setCorePoolSize(5);
        
        // 最大线程池大小
        executor.setMaxPoolSize(20);
        
        // 队列容量
        executor.setQueueCapacity(200);
        
        // 线程名称前缀
        executor.setThreadNamePrefix("e2ee-async-");
        
        // 线程空闲时间（秒）
        executor.setKeepAliveSeconds(60);
        
        // 拒绝策略：调用者运行
        // 当队列满时，在调用者线程中直接运行任务
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        
        // 等待所有任务完成后再关闭线程池
        executor.setWaitForTasksToCompleteOnShutdown(true);
        
        // 最长等待时间（秒）
        executor.setAwaitTerminationSeconds(60);
        
        // 初始化
        executor.initialize();
        
        log.info("E2EE异步任务执行器已初始化: corePoolSize={}, maxPoolSize={}, queueCapacity={}",
                executor.getCorePoolSize(),
                executor.getMaxPoolSize(),
                executor.getQueueCapacity());
        
        return executor;
    }

    /**
     * E2EE缓存预热专用执行器
     *
     * 用于缓存预热任务，避免影响主业务线程
     */
    @Bean(name = "e2eeCacheWarmupExecutor")
    public Executor e2eeCacheWarmupExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("e2ee-cache-warmup-");
        executor.setKeepAliveSeconds(300);
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardOldestPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(false);
        
        executor.initialize();
        
        log.info("E2EE缓存预热执行器已初始化");
        
        return executor;
    }

    /**
     * E2EE审计日志执行器
     *
     * 用于异步写入审计日志
     */
    @Bean(name = "e2eeAuditLogExecutor")
    public Executor e2eeAuditLogExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        
        executor.setCorePoolSize(3);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("e2ee-audit-");
        executor.setKeepAliveSeconds(120);
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        
        executor.initialize();
        
        log.info("E2EE审计日志执行器已初始化");
        
        return executor;
    }
}
