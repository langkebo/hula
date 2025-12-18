package com.luohuo.flex.im.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * E2EE缓存配置
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Configuration
@EnableCaching
public class ImE2EECacheConfig {

    @Bean
    @Primary
    public CacheManager e2eeCacheManager(RedisConnectionFactory factory) {
        Map<String, RedisCacheConfiguration> configMap = new HashMap<>();

        // 公钥缓存 - 30天
        configMap.put("publicKeys",
            RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofDays(30))
                .disableCachingNullValues()
                .prefixCacheNameWith("e2ee:pk:"));

        // 密钥包缓存 - 7天
        configMap.put("keyPackages",
            RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofDays(7))
                .disableCachingNullValues()
                .prefixCacheNameWith("e2ee:kp:"));

        // 消息缓存 - 1小时
        configMap.put("messages",
            RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(1))
                .disableCachingNullValues()
                .prefixCacheNameWith("e2ee:msg:"));

        // 内容哈希缓存 - 24小时
        configMap.put("contentHashes",
            RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(24))
                .disableCachingNullValues()
                .prefixCacheNameWith("e2ee:hash:"));

        // 指纹缓存 - 30天
        configMap.put("fingerprints",
            RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofDays(30))
                .disableCachingNullValues()
                .prefixCacheNameWith("e2ee:fp:"));

        return RedisCacheManager.builder(factory)
            .withInitialCacheConfigurations(configMap)
            .build();
    }
}
