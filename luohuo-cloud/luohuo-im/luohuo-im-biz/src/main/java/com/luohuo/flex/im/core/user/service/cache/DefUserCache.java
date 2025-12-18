package com.luohuo.flex.im.core.user.service.cache;

import cn.hutool.core.collection.CollUtil;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.luohuo.flex.im.common.constant.RedisKey;
import com.luohuo.flex.im.core.user.dao.UserDao;
import com.luohuo.flex.im.domain.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 用户缓存服务 - 支持二级缓存
 * L1: 本地缓存 (Caffeine)
 * L2: Redis缓存
 *
 * @author 乾乾
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DefUserCache {

    private final UserDao userDao;

    // 本地缓存 - L1缓存
    private Cache<Long, User> localCache;

    // 本地缓存配置
    private static final int LOCAL_CACHE_SIZE = 1000;
    private static final int LOCAL_CACHE_EXPIRE_MINUTES = 5;

    /**
     * 初始化本地缓存
     */
    private Cache<Long, User> getLocalCache() {
        if (localCache == null) {
            synchronized (this) {
                if (localCache == null) {
                    localCache = Caffeine.newBuilder()
                            .maximumSize(LOCAL_CACHE_SIZE)
                            .expireAfterWrite(LOCAL_CACHE_EXPIRE_MINUTES, TimeUnit.MINUTES)
                            .build();
                    log.info("DefUserCache initialized with local cache size: {}, expire minutes: {}",
                            LOCAL_CACHE_SIZE, LOCAL_CACHE_EXPIRE_MINUTES);
                }
            }
        }
        return localCache;
    }

    /**
     * 获取用户信息，二级缓存模式
     * @param defUserId 用户ID
     * @return 用户信息
     */
    public User getUserInfo(Long defUserId) {
        // 1. 先查本地缓存（L1）
        Cache<Long, User> cache = getLocalCache();
        User user = cache.getIfPresent(defUserId);
        if (user != null) {
            log.debug("Hit L1 cache for user: {}", defUserId);
            return user;
        }

        // 2. 查Redis缓存（L2）
        String key = RedisKey.getKey(RedisKey.DEF_USER_INFO_FORMAT, defUserId);
        // 调用原有逻辑进行批量获取
        return getUserInfoBatch(Collections.singleton(defUserId)).get(defUserId);
    }

    /**
     * 批量获取用户信息，二级缓存模式
     * @param uids 用户ID集合
     * @return 用户信息映射
     */
    public Map<Long, User> getUserInfoBatch(Set<Long> uids) {
        Map<Long, User> result = new java.util.HashMap<>();

        // 1. 批量检查本地缓存（L1）
        Cache<Long, User> cache = getLocalCache();
        Set<Long> needCheckRedis = new java.util.HashSet<>();
        for (Long uid : uids) {
            User user = cache.getIfPresent(uid);
            if (user != null) {
                result.put(uid, user);
                log.debug("Batch hit L1 cache for user: {}", uid);
            } else {
                needCheckRedis.add(uid);
            }
        }

        if (needCheckRedis.isEmpty()) {
            return result;
        }

        // 2. 批量组装key
        List<String> keys = needCheckRedis.stream()
                .map(a -> RedisKey.getKey(RedisKey.DEF_USER_INFO_FORMAT, a))
                .collect(Collectors.toList());

        // 3. 批量查询数据库（原始逻辑）
        List<User> usersFromDb = userDao.getByDefUserId(new java.util.ArrayList<>(needCheckRedis));

        // 4. 将数据库数据放入结果和本地缓存
        for (User user : usersFromDb) {
            result.put(user.getUserId(), user);
            cache.put(user.getUserId(), user);
            log.debug("Loaded from database and cached user: {}", user.getUserId());
        }

        return result;
    }

    /**
     * 清除指定用户的缓存
     * @param userId 用户ID
     */
    public void evictUser(Long userId) {
        // 清除本地缓存
        Cache<Long, User> cache = getLocalCache();
        cache.invalidate(userId);
        log.debug("Evicted L1 cache for user: {}", userId);

        // Redis缓存由TTL自动过期，暂不手动清除
    }

    /**
     * 批量清除用户缓存
     * @param userIds 用户ID集合
     */
    public void evictUsers(Set<Long> userIds) {
        // 清除本地缓存
        Cache<Long, User> cache = getLocalCache();
        userIds.forEach(cache::invalidate);
        log.debug("Evicted L1 cache for {} users", userIds.size());
    }

    /**
     * 预热缓存
     * @param userIds 需要预热的用户ID集合
     */
    public void warmUpCache(Set<Long> userIds) {
        log.info("Warming up cache for {} users", userIds.size());
        getUserInfoBatch(userIds);
    }
}