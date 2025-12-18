package com.luohuo.flex.im.core.e2ee.service;

import com.luohuo.flex.im.core.chat.mapper.MessageMapper;
import com.luohuo.flex.im.core.e2ee.mapper.SessionKeyPackageMapper;
import com.luohuo.flex.im.core.e2ee.mapper.UserPublicKeyMapper;
import com.luohuo.flex.im.domain.entity.SessionKeyPackage;
import com.luohuo.flex.im.domain.entity.UserPublicKey;
import com.luohuo.flex.im.domain.vo.UserPublicKeyVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * E2EE 缓存预热服务
 * 系统启动时预热热点数据，定期刷新缓存
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EECacheWarmupService implements CommandLineRunner {

    private final UserPublicKeyMapper publicKeyMapper;
    private final SessionKeyPackageMapper sessionKeyPackageMapper;
    private final CacheManager cacheManager;
    private final RedisTemplate<String, Object> redisTemplate;
    private final E2EEKeyService e2eeKeyService;
    private final MessageMapper messageMapper;

    /**
     * 系统启动后执行缓存预热
     */
    @Override
    public void run(String... args) {
        log.info("开始执行 E2EE 缓存预热...");
        long startTime = System.currentTimeMillis();

        try {
            // 预热热点用户公钥
            warmupHotUserPublicKeys();

            // 预热活跃会话密钥
            warmupActiveSessionKeys();

            // 预热统计数据
            warmupStatistics();

            long duration = System.currentTimeMillis() - startTime;
            log.info("E2EE 缓存预热完成，耗时: {}ms", duration);

        } catch (Exception e) {
            log.error("E2EE 缓存预热失败", e);
        }
    }

    /**
     * 预热热点用户公钥
     * 预热最近活跃的100个用户
     */
    private void warmupHotUserPublicKeys() {
        log.info("开始预热热点用户公钥...");

        // 获取最近活跃的用户（这里简化实现，实际可以从用户活跃度表获取）
        List<Long> hotUserIds = getHotUserIds(100);

        int warmupCount = 0;
        for (Long userId : hotUserIds) {
            try {
                // 获取用户所有公钥并缓存
                List<UserPublicKeyVO> publicKeys = e2eeKeyService.getUserPublicKeys(userId);

                // 缓存每个公钥
                for (UserPublicKeyVO key : publicKeys) {
                    String cacheKey = buildKeyCacheKey(userId, key.getKeyId());
                    redisTemplate.opsForValue().set(cacheKey, key, 7, TimeUnit.DAYS);

                    // 缓存指纹映射
                    if (key.getFingerprint() != null) {
                        String fingerprintCacheKey = buildFingerprintCacheKey(key.getFingerprint());
                        redisTemplate.opsForValue().set(fingerprintCacheKey, key, 7, TimeUnit.DAYS);
                    }
                }

                warmupCount++;
            } catch (Exception e) {
                log.error("预热用户 {} 公钥失败", userId, e);
            }
        }

        log.info("热点用户公钥预热完成，预热用户数: {}, 总公钥数: {}",
            warmupCount, hotUserIds.size());
    }

    /**
     * 预热活跃会话密钥
     * 获取最近24小时活跃的会话并预热其密钥包
     */
    private void warmupActiveSessionKeys() {
        log.info("开始预热活跃会话密钥...");

        try {
            // 1. 获取热点用户ID列表（最近活跃的用户）
            List<Long> hotUserIds = getHotUserIds(200);
            
            if (hotUserIds.isEmpty()) {
                log.info("没有热点用户，跳过会话密钥预热");
                return;
            }

            int warmupCount = 0;
            int sessionCount = 0;

            // 2. 为每个热点用户预热其会话密钥
            for (Long userId : hotUserIds) {
                try {
                    // 获取用户的活跃会话密钥包
                    List<SessionKeyPackage> activeKeyPackages = sessionKeyPackageMapper.selectActiveByRecipientId(userId);
                    
                    if (activeKeyPackages == null || activeKeyPackages.isEmpty()) {
                        continue;
                    }

                    // 3. 按会话分组并缓存
                    Map<String, List<SessionKeyPackage>> keysBySession = activeKeyPackages.stream()
                        .collect(java.util.stream.Collectors.groupingBy(SessionKeyPackage::getSessionId));

                    for (Map.Entry<String, List<SessionKeyPackage>> entry : keysBySession.entrySet()) {
                        String sessionId = entry.getKey();
                        List<SessionKeyPackage> sessionKeys = entry.getValue();

                        // 缓存会话密钥包（TTL 24小时）
                        String sessionCacheKey = buildSessionKeyCacheKey(sessionId, userId);
                        redisTemplate.opsForValue().set(sessionCacheKey, sessionKeys, 24, TimeUnit.HOURS);
                        
                        sessionCount++;
                    }

                    warmupCount++;
                } catch (Exception e) {
                    log.error("预热用户 {} 的会话密钥失败", userId, e);
                }
            }

            log.info("活跃会话密钥预热完成，预热用户数: {}, 会话数: {}", warmupCount, sessionCount);

        } catch (Exception e) {
            log.error("活跃会话密钥预热失败", e);
        }
    }

    /**
     * 预热统计数据
     */
    private void warmupStatistics() {
        log.info("开始预热统计数据...");

        try {
            // 预热用户公钥统计
            Map<String, Object> publicKeyStats = new HashMap<>();
            // 使用明确的类型转换来选择BaseMapper的selectCount方法
            com.baomidou.mybatisplus.core.mapper.BaseMapper<com.luohuo.flex.im.domain.entity.UserPublicKey> baseMapper = publicKeyMapper;
            publicKeyStats.put("totalCount", baseMapper.selectCount(null));
            publicKeyStats.put("activeCount", publicKeyMapper.selectCount(Boolean.TRUE));
            publicKeyStats.put("expiresToday", publicKeyMapper.selectCountByExpiryDate(LocalDateTime.now().plusDays(1)));

            redisTemplate.opsForValue().set("e2ee:stats:public_keys", publicKeyStats, 1, TimeUnit.HOURS);

            // 预热加密消息统计
            Map<String, Object> messageStats = new HashMap<>();
            try {
                // 统计今日总消息数
                long totalToday = messageMapper.countTodayMessages();
                messageStats.put("totalToday", totalToday);

                // 统计今日加密消息数
                long encryptedCount = messageMapper.countTodayEncryptedMessages();
                messageStats.put("encryptedCount", encryptedCount);

                // 统计今日自毁消息数
                long selfDestructCount = messageMapper.countTodaySelfDestructMessages();
                messageStats.put("selfDestructCount", selfDestructCount);

                // 计算加密消息比例
                if (totalToday > 0) {
                    double encryptedRatio = (double) encryptedCount / totalToday * 100;
                    messageStats.put("encryptedRatio", String.format("%.2f%%", encryptedRatio));
                } else {
                    messageStats.put("encryptedRatio", "0.00%");
                }

                // 统计昨日数据用于对比
                LocalDateTime yesterdayStart = LocalDateTime.now().minusDays(1).withHour(0).withMinute(0).withSecond(0);
                LocalDateTime yesterdayEnd = LocalDateTime.now().minusDays(1).withHour(23).withMinute(59).withSecond(59);
                long totalYesterday = messageMapper.countMessagesByTimeRange(yesterdayStart, yesterdayEnd);
                long encryptedYesterday = messageMapper.countEncryptedMessagesByTimeRange(yesterdayStart, yesterdayEnd);

                messageStats.put("totalYesterday", totalYesterday);
                messageStats.put("encryptedYesterday", encryptedYesterday);

                // 计算环比增长
                if (totalYesterday > 0) {
                    double dayOverDayGrowth = (double) (totalToday - totalYesterday) / totalYesterday * 100;
                    messageStats.put("dayOverDayGrowth", String.format("%.2f%%", dayOverDayGrowth));
                } else {
                    messageStats.put("dayOverDayGrowth", totalToday > 0 ? "+∞" : "0.00%");
                }

                log.info("消息统计更新 - 今日总数: {}, 加密数: {}, 自毁数: {}, 加密比例: {}",
                        totalToday, encryptedCount, selfDestructCount, messageStats.get("encryptedRatio"));

            } catch (Exception e) {
                log.error("获取消息统计失败，使用默认值", e);
                messageStats.put("totalToday", 0);
                messageStats.put("encryptedCount", 0);
                messageStats.put("selfDestructCount", 0);
                messageStats.put("encryptedRatio", "0.00%");
                messageStats.put("totalYesterday", 0);
                messageStats.put("encryptedYesterday", 0);
                messageStats.put("dayOverDayGrowth", "0.00%");
            }

            redisTemplate.opsForValue().set("e2ee:stats:messages", messageStats, 1, TimeUnit.HOURS);

            log.info("统计数据预热完成");

        } catch (Exception e) {
            log.error("统计数据预热失败", e);
        }
    }

    /**
     * 定时刷新缓存
     * 每小时执行一次
     */
    @Scheduled(cron = "0 0 * * * ?")
    public void refreshCache() {
        log.debug("开始定时刷新缓存...");

        try {
            // 刷新统计数据
            warmupStatistics();

            // 可以添加其他需要定期刷新的缓存

            log.debug("缓存刷新完成");

        } catch (Exception e) {
            log.error("定时刷新缓存失败", e);
        }
    }

    /**
     * 每日深度预热
     * 每天凌晨2点执行
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void deepWarmup() {
        log.info("开始执行深度缓存预热...");

        try {
            // 预热所有用户的公钥
            warmupAllUserPublicKeys();

            log.info("深度缓存预热完成");

        } catch (Exception e) {
            log.error("深度缓存预热失败", e);
        }
    }

    /**
     * 预热所有用户公钥
     */
    private void warmupAllUserPublicKeys() {
        log.info("开始预热所有用户公钥...");

        // 分批获取所有用户，避免内存溢出
        int batchSize = 100;
        int offset = 0;
        int totalWarmed = 0;

        List<Long> userIds;
        do {
            userIds = publicKeyMapper.selectUserIds(offset, batchSize);

            for (Long userId : userIds) {
                try {
                    List<UserPublicKeyVO> publicKeys = e2eeKeyService.getUserPublicKeys(userId);

                    // 缓存每个公钥
                    for (UserPublicKeyVO key : publicKeys) {
                        String cacheKey = buildKeyCacheKey(userId, key.getKeyId());
                        redisTemplate.opsForValue().set(cacheKey, key, 7, TimeUnit.DAYS);

                        if (key.getFingerprint() != null) {
                            String fingerprintCacheKey = buildFingerprintCacheKey(key.getFingerprint());
                            redisTemplate.opsForValue().set(fingerprintCacheKey, key, 7, TimeUnit.DAYS);
                        }
                    }

                    totalWarmed++;
                } catch (Exception e) {
                    log.error("预热用户 {} 公钥失败", userId, e);
                }
            }

            offset += batchSize;

            // 避免过度占用资源
            if (offset % 1000 == 0) {
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }

        } while (!userIds.isEmpty());

        log.info("所有用户公钥预热完成，预热用户数: {}", totalWarmed);
    }

    /**
     * 获取热点用户ID列表
     * 基于多维度数据获取最活跃的用户
     */
    private List<Long> getHotUserIds(int limit) {
        try {
            // 1. 首先尝试从 Redis 获取热点用户缓存
            String hotUsersCacheKey = "e2ee:hot_users";
            @SuppressWarnings("unchecked")
            List<Long> cachedHotUsers = (List<Long>) redisTemplate.opsForValue().get(hotUsersCacheKey);
            if (cachedHotUsers != null && !cachedHotUsers.isEmpty()) {
                return cachedHotUsers.stream().limit(limit).collect(java.util.stream.Collectors.toList());
            }

            // 2. 从会话密钥包表获取最近活跃的用户（有密钥交换活动的用户）
            // 查询最近24小时内有密钥包活动的用户
            LocalDateTime since = LocalDateTime.now().minusHours(24);
            List<Long> activeRecipients = sessionKeyPackageMapper.selectActiveByRecipientId(null) != null ?
                sessionKeyPackageMapper.selectActiveByRecipientId(null).stream()
                    .filter(pkg -> pkg.getCreateTime() != null && pkg.getCreateTime().isAfter(since))
                    .map(SessionKeyPackage::getRecipientId)
                    .distinct()
                    .limit(limit)
                    .collect(java.util.stream.Collectors.toList()) :
                new ArrayList<>();

            // 3. 如果活跃用户不足，补充公钥表中的用户
            if (activeRecipients.size() < limit) {
                List<Long> publicKeyUsers = publicKeyMapper.selectUserIds(0, limit - activeRecipients.size());
                Set<Long> uniqueUsers = new java.util.LinkedHashSet<>(activeRecipients);
                uniqueUsers.addAll(publicKeyUsers);
                activeRecipients = new ArrayList<>(uniqueUsers);
            }

            // 4. 缓存热点用户列表（TTL 1小时）
            if (!activeRecipients.isEmpty()) {
                redisTemplate.opsForValue().set(hotUsersCacheKey, activeRecipients, 1, TimeUnit.HOURS);
            }

            return activeRecipients.stream().limit(limit).collect(java.util.stream.Collectors.toList());

        } catch (Exception e) {
            log.error("获取热点用户失败，使用降级方案", e);
            // 降级方案：直接从公钥表获取用户
            return publicKeyMapper.selectUserIds(0, limit);
        }
    }

    /**
     * 构建公钥缓存键
     */
    private String buildKeyCacheKey(Long userId, String keyId) {
        return String.format("e2ee:public_key:%s:%s", userId, keyId);
    }

    /**
     * 构建指纹缓存键
     */
    private String buildFingerprintCacheKey(String fingerprint) {
        return String.format("e2ee:fingerprint:%s", fingerprint);
    }

    /**
     * 构建会话密钥缓存键
     */
    private String buildSessionKeyCacheKey(String sessionId, Long userId) {
        return String.format("e2ee:session_key:%s:%s", sessionId, userId);
    }

    /**
     * 清理过期缓存
     */
    @Scheduled(cron = "0 30 3 * * ?")  // 每天凌晨3:30执行
    public void cleanupExpiredCache() {
        log.info("开始清理过期缓存...");

        try {
            int cleanedCount = 0;

            // 1. 清理已过期的会话密钥缓存
            Set<String> sessionKeyPatterns = redisTemplate.keys("e2ee:session_key:*");
            if (sessionKeyPatterns != null) {
                for (String key : sessionKeyPatterns) {
                    Long ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);
                    if (ttl != null && ttl <= 0) {
                        redisTemplate.delete(key);
                        cleanedCount++;
                    }
                }
            }

            // 2. 清理已废弃用户的公钥缓存
            // 获取已废弃的公钥列表
            List<UserPublicKey> revokedKeys = publicKeyMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<UserPublicKey>()
                    .eq("status", 0)  // 已废弃状态
                    .lt("update_time", LocalDateTime.now().minusDays(7))  // 7天前废弃的
            );

            for (UserPublicKey key : revokedKeys) {
                String cacheKey = buildKeyCacheKey(key.getUserId(), key.getKeyId());
                redisTemplate.delete(cacheKey);
                
                if (key.getFingerprint() != null) {
                    String fingerprintKey = buildFingerprintCacheKey(key.getFingerprint());
                    redisTemplate.delete(fingerprintKey);
                }
                cleanedCount++;
            }

            // 3. 清理热点用户缓存（如果过期）
            String hotUsersCacheKey = "e2ee:hot_users";
            Long hotUsersTtl = redisTemplate.getExpire(hotUsersCacheKey, TimeUnit.SECONDS);
            if (hotUsersTtl != null && hotUsersTtl <= 0) {
                redisTemplate.delete(hotUsersCacheKey);
                cleanedCount++;
            }

            log.info("过期缓存清理完成，清理数量: {}", cleanedCount);

        } catch (Exception e) {
            log.error("清理过期缓存失败", e);
        }
    }
}
