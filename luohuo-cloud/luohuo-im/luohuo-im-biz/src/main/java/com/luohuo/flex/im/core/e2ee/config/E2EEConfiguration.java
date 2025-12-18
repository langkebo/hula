package com.luohuo.flex.im.core.e2ee.config;

import com.luohuo.flex.im.metrics.E2EEMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.time.Duration;
import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * E2EE端到端加密配置类
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Configuration
@EnableAsync
@EnableCaching
@RequiredArgsConstructor
@ConditionalOnProperty(name = "e2ee.enabled", havingValue = "true")
public class E2EEConfiguration {

    private final E2EEMetrics e2eeMetrics;

    /**
     * E2EE签名验证线程池
     */
    @Bean("e2eeSignatureExecutor")
    public Executor e2eeSignatureExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(2000);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("e2ee-signature-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();

        log.info("E2EE签名验证线程池初始化完成");
        return executor;
    }

    /**
     * E2EE通用任务线程池
     */
    @Bean("e2eeTaskExecutor")
    public Executor e2eeTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(32);
        executor.setQueueCapacity(1000);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("e2ee-task-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();

        log.info("E2EE通用任务线程池初始化完成");
        return executor;
    }

    /**
     * E2EE清理任务线程池
     */
    @Bean("e2eeCleanupExecutor")
    public Executor e2eeCleanupExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(100);
        executor.setKeepAliveSeconds(30);
        executor.setThreadNamePrefix("e2ee-cleanup-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        executor.initialize();

        log.info("E2EE清理任务线程池初始化完成");
        return executor;
    }

    /**
     * 配置Redis缓存管理器
     */
    @Bean("e2eeCacheManager")
    public CacheManager e2eeCacheManager(RedisConnectionFactory redisConnectionFactory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofDays(30)) // 默认30天过期
            .serializeKeysWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()))
            .disableCachingNullValues();

        // 针对不同类型的缓存设置不同的过期时间
        RedisCacheConfiguration publicKeyCacheConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofDays(30)) // 公钥缓存30天
            .serializeKeysWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()))
            .disableCachingNullValues();

        RedisCacheConfiguration messageCacheConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofHours(24)) // 消息缓存24小时
            .serializeKeysWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()))
            .disableCachingNullValues();

        RedisCacheConfiguration keyPackageCacheConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofDays(7)) // 密钥包缓存7天
            .serializeKeysWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()))
            .disableCachingNullValues();

        return RedisCacheManager.builder(redisConnectionFactory)
            .cacheDefaults(config)
            .withCacheConfiguration("publicKeys", publicKeyCacheConfig)
            .withCacheConfiguration("messages", messageCacheConfig)
            .withCacheConfiguration("keyPackages", keyPackageCacheConfig)
            .transactionAware()
            .build();
    }

    /**
     * E2EE缓存配置
     */
    @Bean
    public E2EECacheProperties e2eeCacheProperties() {
        E2EECacheProperties properties = new E2EECacheProperties();
        properties.setPublicKeyCacheDuration(Duration.ofDays(30));
        properties.setMessageCacheDuration(Duration.ofHours(24));
        properties.setKeyPackageCacheDuration(Duration.ofDays(7));
        properties.setCacheNullValues(false);
        return properties;
    }

    /**
     * 缓存配置属性类
     */
    public static class E2EECacheProperties {
        private Duration publicKeyCacheDuration;
        private Duration messageCacheDuration;
        private Duration keyPackageCacheDuration;
        private boolean cacheNullValues = false;

        // Getters and Setters
        public Duration getPublicKeyCacheDuration() {
            return publicKeyCacheDuration;
        }

        public void setPublicKeyCacheDuration(Duration publicKeyCacheDuration) {
            this.publicKeyCacheDuration = publicKeyCacheDuration;
        }

        public Duration getMessageCacheDuration() {
            return messageCacheDuration;
        }

        public void setMessageCacheDuration(Duration messageCacheDuration) {
            this.messageCacheDuration = messageCacheDuration;
        }

        public Duration getKeyPackageCacheDuration() {
            return keyPackageCacheDuration;
        }

        public void setKeyPackageCacheDuration(Duration keyPackageCacheDuration) {
            this.keyPackageCacheDuration = keyPackageCacheDuration;
        }

        public boolean isCacheNullValues() {
            return cacheNullValues;
        }

        public void setCacheNullValues(boolean cacheNullValues) {
            this.cacheNullValues = cacheNullValues;
        }
    }

    @Bean
    public E2EEProperties e2eeProperties() {
        return new E2EEProperties();
    }
}
