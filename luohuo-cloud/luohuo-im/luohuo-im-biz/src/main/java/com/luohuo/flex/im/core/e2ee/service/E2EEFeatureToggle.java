package com.luohuo.flex.im.core.e2ee.service;

import com.luohuo.flex.im.core.e2ee.config.E2EEProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * E2EE功能灰度发布服务
 *
 * 功能：
 * 1. 全局开关控制
 * 2. 基于用户ID的灰度发布
 * 3. 基于哈希的分布策略
 * 4. Redis缓存优化
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EEFeatureToggle {

    private final E2EEProperties e2eeProperties;
    private final RedisTemplate<String, String> redisTemplate;

    private static final String E2EE_GLOBAL_SWITCH_KEY = "e2ee:feature:global_enabled";
    private static final String E2EE_ROLLOUT_PERCENTAGE_KEY = "e2ee:feature:rollout_percentage";
    private static final String E2EE_USER_ENABLED_PREFIX = "e2ee:feature:user:";
    private static final String E2EE_WHITELIST_PREFIX = "e2ee:feature:whitelist:";
    private static final String E2EE_BLACKLIST_PREFIX = "e2ee:feature:blacklist:";

    /**
     * 检查用户是否启用E2EE功能
     *
     * 决策流程：
     * 1. 检查全局开关
     * 2. 检查黑名单
     * 3. 检查白名单
     * 4. 检查灰度百分比
     */
    public boolean isE2EEEnabledForUser(Long userId) {
        // 1. 检查全局开关
        if (!isGlobalEnabled()) {
            log.debug("E2EE全局开关已关闭，用户ID: {}", userId);
            return false;
        }

        // 2. 检查黑名单（优先级最高）
        if (isInBlacklist(userId)) {
            log.debug("用户在E2EE黑名单中，用户ID: {}", userId);
            return false;
        }

        // 3. 检查白名单（优先级第二）
        if (isInWhitelist(userId)) {
            log.debug("用户在E2EE白名单中，用户ID: {}", userId);
            return true;
        }

        // 4. 检查灰度百分比
        return isInRolloutPercentage(userId);
    }

    /**
     * 检查全局开关
     */
    public boolean isGlobalEnabled() {
        try {
            String enabled = redisTemplate.opsForValue().get(E2EE_GLOBAL_SWITCH_KEY);
            if (enabled != null) {
                return Boolean.parseBoolean(enabled);
            }
            // 默认值从配置读取
            return e2eeProperties.isEnabled();
        } catch (Exception e) {
            log.error("检查E2EE全局开关失败", e);
            // 出错时默认开启（根据配置）
            return e2eeProperties.isEnabled();
        }
    }

    /**
     * 设置全局开关
     */
    public void setGlobalEnabled(boolean enabled) {
        redisTemplate.opsForValue().set(E2EE_GLOBAL_SWITCH_KEY, String.valueOf(enabled));
        log.info("E2EE全局开关已设置为: {}", enabled);
    }

    /**
     * 获取当前灰度百分比
     */
    public int getRolloutPercentage() {
        try {
            String percentage = redisTemplate.opsForValue().get(E2EE_ROLLOUT_PERCENTAGE_KEY);
            if (percentage != null) {
                return Integer.parseInt(percentage);
            }
            // 默认100% (全量发布)
            return 100;
        } catch (Exception e) {
            log.error("获取E2EE灰度百分比失败", e);
            return 100;
        }
    }

    /**
     * 设置灰度百分比
     * @param percentage 0-100之间的整数
     */
    public void setRolloutPercentage(int percentage) {
        if (percentage < 0 || percentage > 100) {
            throw new IllegalArgumentException("灰度百分比必须在0-100之间");
        }
        redisTemplate.opsForValue().set(E2EE_ROLLOUT_PERCENTAGE_KEY, String.valueOf(percentage));
        log.info("E2EE灰度百分比已设置为: {}%", percentage);
    }

    /**
     * 检查用户是否在白名单中
     */
    public boolean isInWhitelist(Long userId) {
        try {
            String key = E2EE_WHITELIST_PREFIX + userId;
            String value = redisTemplate.opsForValue().get(key);
            return "1".equals(value);
        } catch (Exception e) {
            log.error("检查E2EE白名单失败，用户ID: {}", userId, e);
            return false;
        }
    }

    /**
     * 添加用户到白名单
     */
    public void addToWhitelist(Long userId) {
        String key = E2EE_WHITELIST_PREFIX + userId;
        redisTemplate.opsForValue().set(key, "1", Duration.ofDays(365));
        log.info("用户已添加到E2EE白名单，用户ID: {}", userId);
    }

    /**
     * 从白名单移除用户
     */
    public void removeFromWhitelist(Long userId) {
        String key = E2EE_WHITELIST_PREFIX + userId;
        redisTemplate.delete(key);
        log.info("用户已从E2EE白名单移除，用户ID: {}", userId);
    }

    /**
     * 检查用户是否在黑名单中
     */
    public boolean isInBlacklist(Long userId) {
        try {
            String key = E2EE_BLACKLIST_PREFIX + userId;
            String value = redisTemplate.opsForValue().get(key);
            return "1".equals(value);
        } catch (Exception e) {
            log.error("检查E2EE黑名单失败，用户ID: {}", userId, e);
            return false;
        }
    }

    /**
     * 添加用户到黑名单
     */
    public void addToBlacklist(Long userId) {
        String key = E2EE_BLACKLIST_PREFIX + userId;
        redisTemplate.opsForValue().set(key, "1", Duration.ofDays(365));
        log.info("用户已添加到E2EE黑名单，用户ID: {}", userId);
    }

    /**
     * 从黑名单移除用户
     */
    public void removeFromBlacklist(Long userId) {
        String key = E2EE_BLACKLIST_PREFIX + userId;
        redisTemplate.delete(key);
        log.info("用户已从E2EE黑名单移除，用户ID: {}", userId);
    }

    /**
     * 基于用户ID哈希的灰度分流
     * 使用一致性哈希算法确保同一用户的判断结果稳定
     */
    private boolean isInRolloutPercentage(Long userId) {
        int percentage = getRolloutPercentage();

        if (percentage >= 100) {
            // 全量发布
            return true;
        }

        if (percentage <= 0) {
            // 完全关闭
            return false;
        }

        // 使用用户ID的哈希值进行分流
        // 保证同一用户多次调用结果一致
        int hash = Math.abs(userId.hashCode() % 100);
        boolean enabled = hash < percentage;

        log.debug("用户ID: {}, 哈希值: {}, 灰度百分比: {}%, 是否启用: {}",
                userId, hash, percentage, enabled);

        return enabled;
    }

    /**
     * 获取功能状态统计信息
     */
    public FeatureToggleStatus getStatus() {
        FeatureToggleStatus status = new FeatureToggleStatus();
        status.setGlobalEnabled(isGlobalEnabled());
        status.setRolloutPercentage(getRolloutPercentage());
        // 统计白名单、黑名单数量
        // 注意：白名单和黑名单统计可通过以下方式实现：
        // Long whitelistCount = redisTemplate.opsForSet().size(WHITELIST_KEY);
        // Long blacklistCount = redisTemplate.opsForSet().size(BLACKLIST_KEY);
        return status;
    }

    /**
     * 功能开关状态
     */
    public static class FeatureToggleStatus {
        private boolean globalEnabled;
        private int rolloutPercentage;
        private long whitelistCount;
        private long blacklistCount;

        public boolean isGlobalEnabled() { return globalEnabled; }
        public void setGlobalEnabled(boolean globalEnabled) { this.globalEnabled = globalEnabled; }

        public int getRolloutPercentage() { return rolloutPercentage; }
        public void setRolloutPercentage(int rolloutPercentage) { this.rolloutPercentage = rolloutPercentage; }

        public long getWhitelistCount() { return whitelistCount; }
        public void setWhitelistCount(long whitelistCount) { this.whitelistCount = whitelistCount; }

        public long getBlacklistCount() { return blacklistCount; }
        public void setBlacklistCount(long blacklistCount) { this.blacklistCount = blacklistCount; }
    }
}
