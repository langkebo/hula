package com.luohuo.flex.im.core.limiter;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * 分布式限流服务
 * 基于 Redis + Lua 脚本实现
 * 支持：
 * 1. 滑动窗口限流
 * 2. 令牌桶限流
 * 3. 固定窗口限流
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private final RedisTemplate<String, String> redisTemplate;

    // 滑动窗口限流 Lua 脚本
    private static final String SLIDING_WINDOW_SCRIPT = """
        local key = KEYS[1]
        local window = tonumber(ARGV[1])
        local limit = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])

        -- 清除过期的记录
        redis.call('zremrangebyscore', key, 0, now - window)

        -- 获取当前窗口内的请求数
        local current = redis.call('zcard', key)

        if current < limit then
            -- 添加当前请求
            redis.call('zadd', key, now, now)
            -- 设置过期时间
            redis.call('expire', key, window)
            return 1
        else
            return 0
        end
        """;

    // 令牌桶限流 Lua 脚本
    private static final String TOKEN_BUCKET_SCRIPT = """
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local tokens = tonumber(ARGV[2])
        local interval = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])

        local bucket_key = key .. ':bucket'
        local last_refill_key = key .. ':refill'

        -- 获取当前桶状态
        local current_tokens = tonumber(redis.call('get', bucket_key) or capacity)
        local last_refill = tonumber(redis.call('get', last_refill_key) or 0)

        -- 计算需要添加的令牌数
        local elapsed = now - last_refill
        local tokens_to_add = math.floor(elapsed / interval * tokens)

        if tokens_to_add > 0 then
            current_tokens = math.min(current_tokens + tokens_to_add, capacity)
            redis.call('set', bucket_key, current_tokens)
            redis.call('set', last_refill_key, now)
        end

        -- 尝试消费令牌
        if current_tokens >= 1 then
            current_tokens = current_tokens - 1
            redis.call('set', bucket_key, current_tokens)
            return 1
        else
            return 0
        end
        """;

    /**
     * 滑动窗口限流
     *
     * @param key     限流键
     * @param window  时间窗口（毫秒）
     * @param limit   限制数量
     * @return 是否允许通过
     */
    public boolean isAllowedSlidingWindow(String key, long window, int limit) {
        try {
            DefaultRedisScript<Long> script = new DefaultRedisScript<>(SLIDING_WINDOW_SCRIPT, Long.class);

            Long result = redisTemplate.execute(
                script,
                Collections.singletonList(getKey(key)),
                String.valueOf(window),
                String.valueOf(limit),
                String.valueOf(System.currentTimeMillis())
            );

            return result != null && result == 1L;
        } catch (Exception e) {
            log.error("滑动窗口限流检查失败", e);
            // 限流检查失败时，允许通过（避免影响业务）
            return true;
        }
    }

    /**
     * 令牌桶限流
     *
     * @param key       限流键
     * @param capacity  桶容量
     * @param tokens    每秒生成的令牌数
     * @return 是否允许通过
     */
    public boolean isAllowedTokenBucket(String key, int capacity, int tokens) {
        try {
            DefaultRedisScript<Long> script = new DefaultRedisScript<>(TOKEN_BUCKET_SCRIPT, Long.class);

            Long result = redisTemplate.execute(
                script,
                Collections.singletonList(getKey(key)),
                String.valueOf(capacity),
                String.valueOf(tokens),
                String.valueOf(1000), // 1秒
                String.valueOf(System.currentTimeMillis())
            );

            return result != null && result == 1L;
        } catch (Exception e) {
            log.error("令牌桶限流检查失败", e);
            return true;
        }
    }

    /**
     * 固定窗口限流
     *
     * @param key     限流键
     * @param window  时间窗口（秒）
     * @param limit   限制数量
     * @return 是否允许通过
     */
    public boolean isAllowedFixedWindow(String key, int window, int limit) {
        try {
            String redisKey = getKey(key);
            String countKey = redisKey + ":count";
            String timestampKey = redisKey + ":timestamp";

            String currentTimestamp = redisTemplate.opsForValue().get(timestampKey);
            long now = System.currentTimeMillis() / 1000;
            long windowStart = (now / window) * window;

            if (currentTimestamp == null || !currentTimestamp.equals(String.valueOf(windowStart))) {
                // 新窗口，重置计数器
                redisTemplate.opsForValue().set(countKey, "1", window, TimeUnit.SECONDS);
                redisTemplate.opsForValue().set(timestampKey, String.valueOf(windowStart), window, TimeUnit.SECONDS);
                return true;
            } else {
                // 同一窗口，增加计数
                Long count = redisTemplate.opsForValue().increment(countKey);
                redisTemplate.expire(countKey, window, TimeUnit.SECONDS);

                return count <= limit;
            }
        } catch (Exception e) {
            log.error("固定窗口限流检查失败", e);
            return true;
        }
    }

    /**
     * 获取剩余可用次数
     *
     * @param key   限流键
     * @param limit 限制数量
     * @return 剩余次数
     */
    public int getRemainingCount(String key, int limit) {
        try {
            String redisKey = getKey(key);
            String countKey = redisKey + ":count";

            String countStr = redisTemplate.opsForValue().get(countKey);
            if (countStr != null) {
                long count = Long.parseLong(countStr);
                return Math.max(0, (int) (limit - count));
            }
            return limit;
        } catch (Exception e) {
            log.error("获取剩余次数失败", e);
            return limit;
        }
    }

    /**
     * 预热限流器
     * 预先设置一些初始值，避免冷启动问题
     */
    public void warmupRateLimiter(String key, int initialTokens) {
        try {
            String bucketKey = getKey(key) + ":bucket";
            String lastRefillKey = getKey(key) + ":refill";

            redisTemplate.opsForValue().set(bucketKey, String.valueOf(initialTokens), 1, TimeUnit.DAYS);
            redisTemplate.opsForValue().set(lastRefillKey, String.valueOf(System.currentTimeMillis()), 1, TimeUnit.DAYS);

            log.debug("限流器预热完成，key: {}, tokens: {}", key, initialTokens);
        } catch (Exception e) {
            log.error("预热限流器失败", e);
        }
    }

    /**
     * 清理限流器
     */
    public void clearRateLimiter(String key) {
        try {
            String redisKey = getKey(key);
            redisTemplate.delete(redisKey);
            redisTemplate.delete(redisKey + ":count");
            redisTemplate.delete(redisKey + ":timestamp");
            redisTemplate.delete(redisKey + ":bucket");
            redisTemplate.delete(redisKey + ":refill");

            log.debug("限流器清理完成，key: {}", key);
        } catch (Exception e) {
            log.error("清理限流器失败", e);
        }
    }

    /**
     * 批量检查限流
     *
     * @param requests 请求列表（包含key和limit）
     * @return 允许通过的请求数
     */
    public int batchCheckSlidingWindow(java.util.List<RateLimitRequest> requests) {
        int allowed = 0;

        for (RateLimitRequest request : requests) {
            if (isAllowedSlidingWindow(request.key, request.window, request.limit)) {
                allowed++;
            }
        }

        return allowed;
    }

    /**
     * 动态调整限流参数
     *
     * @param key       限流键
     * @param window    时间窗口
     * @param limit     限制数量
     * @param factor    调整系数（>1 放宽，<1 收紧）
     */
    public void adjustRateLimit(String key, long window, int limit, double factor) {
        // 计算新的参数
        long newWindow = (long) (window * factor);
        int newLimit = (int) (limit * factor);

        // 清理旧的限流器
        clearRateLimiter(key);

        // 可以记录调整历史
        String historyKey = getKey(key) + ":history";
        redisTemplate.opsForList().rightPush(historyKey,
            String.format("%d,%d,%d,%f", System.currentTimeMillis(), window, limit, factor));
        redisTemplate.expire(historyKey, 7, TimeUnit.DAYS);

        log.info("限流参数已调整，key: {}, window: {}->{}, limit: {}->{}, factor: {}",
            key, window, newWindow, limit, newLimit, factor);
    }

    /**
     * 获取限流统计信息
     */
    public RateLimitStats getRateLimitStats(String key) {
        RateLimitStats stats = new RateLimitStats();

        try {
            String historyKey = getKey(key) + ":history";
            java.util.List<String> history = redisTemplate.opsForList().range(historyKey, 0, -1);

            stats.key = key;
            stats.adjustmentCount = history.size();

            if (!history.isEmpty()) {
                String lastAdjustment = history.get(history.size() - 1);
                String[] parts = lastAdjustment.split(",");
                stats.lastAdjustmentTime = Long.parseLong(parts[0]);
                stats.currentWindow = Long.parseLong(parts[1]);
                stats.currentLimit = Integer.parseInt(parts[2]);
                stats.adjustmentFactor = Double.parseDouble(parts[3]);
            }

            stats.remainingCount = getRemainingCount(key, stats.currentLimit);

        } catch (Exception e) {
            log.error("获取限流统计失败", e);
        }

        return stats;
    }

    /**
     * 生成限流键
     */
    private String getKey(String key) {
        return "rate_limit:" + key;
    }

    /**
     * 限流请求
     */
    public static class RateLimitRequest {
        public final String key;
        public final long window;
        public final int limit;

        public RateLimitRequest(String key, long window, int limit) {
            this.key = key;
            this.window = window;
            this.limit = limit;
        }
    }

    /**
     * 限流统计信息
     */
    public static class RateLimitStats {
        public String key;
        public int currentLimit;
        public long currentWindow;
        public int remainingCount;
        public int adjustmentCount;
        public long lastAdjustmentTime;
        public double adjustmentFactor;
    }

    /**
     * 清理过期的历史记录
     *
     * @param key  限流键
     * @param days 保留天数
     * @return 清理的记录数
     */
    public int cleanupExpiredHistory(String key, int days) {
        try {
            String historyKey = getKey(key) + ":history";
            Long size = redisTemplate.opsForList().size(historyKey);

            if (size == null || size == 0) {
                return 0;
            }

            // 计算过期时间点
            long expireTime = System.currentTimeMillis() - (days * 24L * 60 * 60 * 1000);
            int cleanedCount = 0;

            // 获取所有历史记录
            java.util.List<String> history = redisTemplate.opsForList().range(historyKey, 0, -1);
            if (history == null) {
                return 0;
            }

            // 过滤出需要保留的记录
            java.util.List<String> validHistory = new java.util.ArrayList<>();
            for (String record : history) {
                String[] parts = record.split(",");
                if (parts.length > 0) {
                    long timestamp = Long.parseLong(parts[0]);
                    if (timestamp >= expireTime) {
                        validHistory.add(record);
                    } else {
                        cleanedCount++;
                    }
                }
            }

            // 如果有记录被清理，重新设置历史记录
            if (cleanedCount > 0) {
                redisTemplate.delete(historyKey);
                if (!validHistory.isEmpty()) {
                    for (String record : validHistory) {
                        redisTemplate.opsForList().rightPush(historyKey, record);
                    }
                    redisTemplate.expire(historyKey, 7, TimeUnit.DAYS);
                }
                log.debug("清理限流器历史记录，key: {}, 清理数量: {}", key, cleanedCount);
            }

            return cleanedCount;
        } catch (Exception e) {
            log.error("清理限流器历史记录失败，key: {}", key, e);
            return 0;
        }
    }

    /**
     * 清理用户级别的限流器
     * 清理长时间未使用的用户限流器
     *
     * @param inactiveDays 未活跃天数阈值
     * @return 清理的限流器数量
     */
    public int cleanupUserRateLimiters(int inactiveDays) {
        try {
            // 扫描所有用户限流器键
            java.util.Set<String> keys = redisTemplate.keys("rate_limit:user:*");
            if (keys == null || keys.isEmpty()) {
                return 0;
            }

            int cleanedCount = 0;
            long expireTime = System.currentTimeMillis() - (inactiveDays * 24L * 60 * 60 * 1000);

            for (String key : keys) {
                try {
                    // 检查最后访问时间
                    String lastRefillKey = key + ":refill";
                    String lastRefillStr = redisTemplate.opsForValue().get(lastRefillKey);

                    if (lastRefillStr != null) {
                        long lastRefill = Long.parseLong(lastRefillStr);
                        if (lastRefill < expireTime) {
                            // 清理过期的限流器
                            String baseKey = key.replace("rate_limit:", "");
                            clearRateLimiter(baseKey);
                            cleanedCount++;
                        }
                    }
                } catch (Exception e) {
                    log.warn("检查限流器 {} 失败: {}", key, e.getMessage());
                }
            }

            if (cleanedCount > 0) {
                log.info("清理用户限流器完成，清理数量: {}", cleanedCount);
            }

            return cleanedCount;
        } catch (Exception e) {
            log.error("清理用户限流器失败", e);
            return 0;
        }
    }
}