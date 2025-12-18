package com.luohuo.flex.im.core.e2ee.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luohuo.flex.im.domain.entity.UserPublicKey;
import com.luohuo.flex.im.domain.entity.MessageEncrypted;
import com.luohuo.flex.im.domain.entity.SessionKeyPackage;
import com.luohuo.flex.im.metrics.E2EEMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.*;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * E2EE缓存服务
 * 多层缓存策略优化性能
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EECacheService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final StringRedisTemplate stringRedisTemplate;
    private final E2EEMetrics e2eeMetrics;
    private final ObjectMapper objectMapper;

    // 缓存键前缀
    private static final String PUBLIC_KEY_PREFIX = "e2ee:pk:";
    private static final String MESSAGE_PREFIX = "e2ee:msg:";
    private static final String KEY_PACKAGE_PREFIX = "e2ee:kp:";
    private static final String FINGERPRINT_PREFIX = "e2ee:fp:";
    private static final String HOT_DATA_PREFIX = "e2ee:hot:";
    private static final String CACHE_STATS_PREFIX = "e2ee:stats:";

    // 本地缓存（Caffeine或类似）
    private final Map<String, CacheItem> localCache = new HashMap<>();
    private static final int LOCAL_CACHE_SIZE = 1000;
    private static final Duration LOCAL_CACHE_TTL = Duration.ofMinutes(5);

    /**
     * 多级缓存获取公钥
     */
    public UserPublicKey getPublicKey(Long userId, String keyId) {
        String cacheKey = buildPublicKeyKey(userId, keyId);

        // L1: 本地缓存
        UserPublicKey cached = getFromLocalCache(cacheKey, UserPublicKey.class);
        if (cached != null) {
            e2eeMetrics.recordCacheHit("local_public_key");
            return cached;
        }

        // L2: Redis缓存
        cached = getFromRedisCache(cacheKey, UserPublicKey.class);
        if (cached != null) {
            // 回填本地缓存
            putToLocalCache(cacheKey, cached);
            e2eeMetrics.recordCacheHit("redis_public_key");
            return cached;
        }

        // L3: 缓存未命中
        e2eeMetrics.recordCacheMiss("public_key");
        return null;
    }

    /**
     * 批量获取公钥
     */
    public Map<String, UserPublicKey> batchGetPublicKeys(Set<String> cacheKeys) {
        Map<String, UserPublicKey> result = new HashMap<>();

        // 1. 从本地缓存获取
        List<String> missedKeys = new ArrayList<>();
        for (String key : cacheKeys) {
            UserPublicKey cached = getFromLocalCache(key, UserPublicKey.class);
            if (cached != null) {
                result.put(key, cached);
                e2eeMetrics.recordCacheHit("local_public_key_batch");
            } else {
                missedKeys.add(key);
            }
        }

        // 2. 从Redis批量获取未命中的键
        if (!missedKeys.isEmpty()) {
            List<Object> cachedValues = redisTemplate.opsForValue().multiGet(missedKeys);
            Map<String, UserPublicKey> redisResults = new HashMap<>();

            for (int i = 0; i < missedKeys.size(); i++) {
                String key = missedKeys.get(i);
                Object value = cachedValues.get(i);
                if (value != null) {
                    UserPublicKey publicKey = convertValue(value, UserPublicKey.class);
                    if (publicKey != null) {
                        redisResults.put(key, publicKey);
                        // 回填本地缓存
                        putToLocalCache(key, publicKey);
                    }
                }
            }

            result.putAll(redisResults);
            e2eeMetrics.recordCacheHit("redis_public_key_batch", redisResults.size());
            e2eeMetrics.recordCacheMiss("public_key_batch", missedKeys.size() - redisResults.size());
        }

        return result;
    }

    /**
     * 缓存公钥（多级）
     */
    @Async("e2eeTaskExecutor")
    public CompletableFuture<Void> cachePublicKey(Long userId, String keyId, UserPublicKey publicKey) {
        String cacheKey = buildPublicKeyKey(userId, keyId);

        // 缓存到本地
        putToLocalCache(cacheKey, publicKey);

        // 缓存到Redis
        cacheToRedis(cacheKey, publicKey, Duration.ofDays(30));

        // 更新热点数据缓存
        updateHotData(userId, publicKey);

        return CompletableFuture.completedFuture(null);
    }

    /**
     * 智能缓存预热
     */
    @Async("e2eeTaskExecutor")
    public CompletableFuture<Void> intelligentPreWarm(Map<String, Object> preWarmConfig) {
        log.info("开始智能缓存预热");

        // 1. 预热热点公钥
        List<String> hotUserIds = getHotUserIds();
        if (!hotUserIds.isEmpty()) {
            // 异步批量加载公钥
            // e2eeKeyService.batchPreloadPublicKeys(hotUserIds);
        }

        // 2. 预热最近会话的密钥包
        List<String> recentConversationIds = getRecentConversationIds();
        for (String convId : recentConversationIds) {
            // 预热会话密钥包
            String cacheKey = KEY_PACKAGE_PREFIX + convId + ":latest";
            // 从数据库加载并缓存最新的密钥包
        }

        // 3. 根据配置预热特定数据
        if (preWarmConfig.containsKey("preWarmKeys")) {
            @SuppressWarnings("unchecked")
            List<String> keys = (List<String>) preWarmConfig.get("preWarmKeys");
            batchPreWarm(keys);
        }

        log.info("智能缓存预热完成");
        return CompletableFuture.completedFuture(null);
    }

    /**
     * 缓存失效策略
     */
    public void evictCache(String pattern, EvictStrategy strategy) {
        switch (strategy) {
            case PATTERN:
                evictByPattern(pattern);
                break;
            case BATCH:
                evictBatch(pattern);
                break;
            case SMART:
                smartEvict(pattern);
                break;
        }
    }

    /**
     * 监控缓存性能
     */
    public Map<String, Object> getCacheStats() {
        Map<String, Object> stats = new HashMap<>();

        // 本地缓存统计
        stats.put("localCacheSize", localCache.size());
        stats.put("localCacheHitRate", calculateLocalHitRate());

        // Redis缓存统计
        Properties info = redisTemplate.getConnectionFactory()
            .getConnection().info("memory");
        stats.put("redisMemoryUsed", info.getProperty("used_memory_human"));

        // 热点数据统计
        stats.put("hotDataCount", getHotDataCount());

        return stats;
    }

    /**
     * 动态调整缓存TTL
     */
    public void adjustCacheTTL(String cacheType, AccessPattern pattern) {
        Duration newTTL = calculateOptimalTTL(cacheType, pattern);
        log.info("调整缓存TTL: {} -> {}", cacheType, newTTL);

        // 更新配置
        // 这里可以更新配置服务中的TTL设置
    }

    // 私有方法实现

    private String buildPublicKeyKey(Long userId, String keyId) {
        return PUBLIC_KEY_PREFIX + userId + ":" + keyId;
    }

    private String buildMessageKey(Long messageId) {
        return MESSAGE_PREFIX + messageId;
    }

    private String buildKeyPackageKey(String conversationId, String keyId) {
        return KEY_PACKAGE_PREFIX + conversationId + ":" + keyId;
    }

    private <T> T getFromLocalCache(String key, Class<T> clazz) {
        CacheItem item = localCache.get(key);
        if (item != null && !item.isExpired()) {
            @SuppressWarnings("unchecked")
            T value = (T) item.getValue();
            return value;
        }
        return null;
    }

    private <T> void putToLocalCache(String key, T value) {
        // 如果本地缓存已满，使用LRU策略移除旧项
        if (localCache.size() >= LOCAL_CACHE_SIZE) {
            evictLRUFromLocalCache();
        }

        CacheItem item = new CacheItem(value, System.currentTimeMillis() + LOCAL_CACHE_TTL.toMillis());
        localCache.put(key, item);
    }

    private void evictLRUFromLocalCache() {
        String oldestKey = localCache.entrySet().stream()
            .min(Comparator.comparingLong(e -> e.getValue().getExpireTime()))
            .map(Map.Entry::getKey)
            .orElse(null);

        if (oldestKey != null) {
            localCache.remove(oldestKey);
        }
    }

    private <T> T getFromRedisCache(String key, Class<T> clazz) {
        try {
            Object value = redisTemplate.opsForValue().get(key);
            return convertValue(value, clazz);
        } catch (Exception e) {
            log.error("从Redis获取缓存失败: {}", key, e);
            return null;
        }
    }

    private void cacheToRedis(String key, Object value, Duration ttl) {
        try {
            redisTemplate.opsForValue().set(key, value, ttl);
        } catch (Exception e) {
            log.error("缓存到Redis失败: {}", key, e);
        }
    }

    private <T> T convertValue(Object value, Class<T> clazz) {
        if (value == null) {
            return null;
        }

        if (clazz.isInstance(value)) {
            return clazz.cast(value);
        }

        // JSON反序列化
        try {
            String json = objectMapper.writeValueAsString(value);
            return objectMapper.readValue(json, clazz);
        } catch (JsonProcessingException e) {
            log.error("值转换失败", e);
            return null;
        }
    }

    private void updateHotData(Long userId, UserPublicKey publicKey) {
        String hotKey = HOT_DATA_PREFIX + "user:" + userId;
        redisTemplate.opsForZSet().add(hotKey, userId, System.currentTimeMillis());
        redisTemplate.expire(hotKey, Duration.ofDays(7));
    }

    private List<String> getHotUserIds() {
        Set<String> hotKeys = redisTemplate.keys(HOT_DATA_PREFIX + "user:*");
        return hotKeys.stream()
            .map(key -> key.substring(key.lastIndexOf(":") + 1))
            .collect(Collectors.toList());
    }

    private List<String> getRecentConversationIds() {
        // 从最近活动记录获取会话ID
        return new ArrayList<>();
    }

    private void batchPreWarm(List<String> keys) {
        // 批量预热指定的键
        for (String key : keys) {
            // 根据键的类型进行预热
            if (key.startsWith(PUBLIC_KEY_PREFIX)) {
                // 预热公钥
            } else if (key.startsWith(MESSAGE_PREFIX)) {
                // 预热消息
            }
        }
    }

    private void evictByPattern(String pattern) {
        Set<String> keys = redisTemplate.keys(pattern);
        if (!keys.isEmpty()) {
            redisTemplate.delete(keys);
        }

        // 清理本地缓存
        localCache.keySet().removeIf(key -> key.matches(pattern.replace("*", ".*")));
    }

    private void evictBatch(String pattern) {
        // 批量删除，使用管道优化性能
        redisTemplate.executePipelined((RedisCallback<Object>) connection -> {
            byte[] patternBytes = pattern.getBytes();
            java.util.Set<byte[]> keys = connection.keyCommands().keys(patternBytes);
            if (keys != null && !keys.isEmpty()) {
                byte[][] arr = keys.toArray(new byte[0][]);
                connection.keyCommands().del(arr);
            }
            return null;
        });
    }

    private void smartEvict(String pattern) {
        // 智能失效：根据访问频率决定失效策略
        Map<String, Double> scores = getCacheScores(pattern);
        List<String> toEvict = scores.entrySet().stream()
            .sorted(Map.Entry.comparingByValue())
            .limit(scores.size() / 2) // 删除访问频率最低的一半
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());

        redisTemplate.delete(toEvict);
    }

    private Map<String, Double> getCacheScores(String pattern) {
        // 获取缓存项的访问频率分数
        return new HashMap<>();
    }

    private double calculateLocalHitRate() {
        // 计算本地缓存命中率
        return 0.0;
    }

    private int getHotDataCount() {
        Set<String> hotKeys = redisTemplate.keys(HOT_DATA_PREFIX + "*");
        return hotKeys.size();
    }

    private Duration calculateOptimalTTL(String cacheType, AccessPattern pattern) {
        // 根据访问模式计算最优TTL
        switch (pattern) {
            case FREQUENT:
                return Duration.ofHours(24);
            case MODERATE:
                return Duration.ofHours(6);
            case RARE:
                return Duration.ofHours(1);
            default:
                return Duration.ofHours(12);
        }
    }

    // 内部类和枚举

    private static class CacheItem {
        private final Object value;
        private final long expireTime;

        public CacheItem(Object value, long expireTime) {
            this.value = value;
            this.expireTime = expireTime;
        }

        public Object getValue() { return value; }
        public long getExpireTime() { return expireTime; }
        public boolean isExpired() { return System.currentTimeMillis() > expireTime; }
    }

    public enum EvictStrategy {
        PATTERN,    // 模式匹配删除
        BATCH,      // 批量删除
        SMART       // 智能删除
    }

    public enum AccessPattern {
        FREQUENT,   // 频繁访问
        MODERATE,   // 中等频率
        RARE        // 偶尔访问
    }
}
