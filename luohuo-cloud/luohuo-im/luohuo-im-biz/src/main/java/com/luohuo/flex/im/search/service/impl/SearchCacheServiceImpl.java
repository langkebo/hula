package com.luohuo.flex.im.search.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luohuo.flex.im.search.dto.SearchRequest;
import com.luohuo.flex.im.search.dto.SearchResponse;
import com.luohuo.flex.im.search.service.SearchCacheService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;
import org.springframework.util.DigestUtils;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * 搜索缓存服务实现
 *
 * @author HuLa
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchCacheServiceImpl implements SearchCacheService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    // 缓存键前缀
    private static final String SEARCH_RESULT_PREFIX = "search:result:";
    private static final String SUGGESTION_PREFIX = "search:suggest:";
    private static final String HOT_SEARCH_KEY = "search:hot";
    private static final String USER_HISTORY_PREFIX = "search:history:user:";
    private static final String SEARCH_STATS_PREFIX = "search:stats:";

    // 缓存时间
    private static final Duration DEFAULT_TTL = Duration.ofMinutes(5);
    private static final Duration SUGGESTION_TTL = Duration.ofMinutes(30);
    private static final Duration HOT_SEARCH_TTL = Duration.ofHours(1);
    private static final Duration USER_HISTORY_TTL = Duration.ofDays(30);
    private static final Duration SEARCH_STATS_TTL = Duration.ofDays(1);

    @Override
    public void cacheSearchResult(SearchRequest request, SearchResponse<?> response, Duration ttl) {
        try {
            String key = buildSearchResultKey(request);
            String value = objectMapper.writeValueAsString(response);
            redisTemplate.opsForValue().set(key, value, ttl);
            log.debug("Cached search result for key: {}", key);
        } catch (JsonProcessingException e) {
            log.error("Failed to cache search result", e);
        }
    }

    @Override
    public SearchResponse<?> getCachedSearchResult(SearchRequest request) {
        try {
            String key = buildSearchResultKey(request);
            String value = (String) redisTemplate.opsForValue().get(key);
            if (value != null) {
                log.debug("Cache hit for search result key: {}", key);
                return objectMapper.readValue(value, new TypeReference<SearchResponse<?>>() {});
            }
            log.debug("Cache miss for search result key: {}", key);
        } catch (Exception e) {
            log.error("Failed to get cached search result", e);
        }
        return null;
    }

    @Override
    public void evictSearchCache(String pattern) {
        try {
            Set<String> keys = redisTemplate.keys(pattern);
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
                log.info("Evicted {} cache entries matching pattern: {}", keys.size(), pattern);
            }
        } catch (Exception e) {
            log.error("Failed to evict search cache", e);
        }
    }

    @Override
    public void clearAllSearchCache() {
        try {
            Set<String> keys = redisTemplate.keys("search:*");
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
                log.info("Cleared {} search cache entries", keys.size());
            }
        } catch (Exception e) {
            log.error("Failed to clear all search cache", e);
        }
    }

    @Override
    public void cacheSuggestions(String keyword, List<String> suggestions, Duration ttl) {
        try {
            String key = SUGGESTION_PREFIX + keyword.toLowerCase();
            redisTemplate.opsForValue().set(key, suggestions, ttl);
            log.debug("Cached {} suggestions for keyword: {}", suggestions.size(), keyword);
        } catch (Exception e) {
            log.error("Failed to cache suggestions for keyword: {}", keyword, e);
        }
    }

    @Override
    public List<String> getCachedSuggestions(String keyword) {
        try {
            String key = SUGGESTION_PREFIX + keyword.toLowerCase();
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                return objectMapper.convertValue(cached, new TypeReference<List<String>>() {});
            }
        } catch (Exception e) {
            log.error("Failed to get cached suggestions for keyword: {}", keyword, e);
        }
        return Collections.emptyList();
    }

    @Override
    public void cacheHotSearches(List<String> hotSearches, Duration ttl) {
        try {
            ZSetOperations<String, Object> zSetOps = redisTemplate.opsForZSet();
            // 删除旧的
            redisTemplate.delete(HOT_SEARCH_KEY);
            // 添加新的
            for (int i = 0; i < hotSearches.size(); i++) {
                zSetOps.add(HOT_SEARCH_KEY, hotSearches.get(i), hotSearches.size() - i);
            }
            redisTemplate.expire(HOT_SEARCH_KEY, ttl);
            log.debug("Cached {} hot searches", hotSearches.size());
        } catch (Exception e) {
            log.error("Failed to cache hot searches", e);
        }
    }

    @Override
    public List<String> getCachedHotSearches() {
        try {
            ZSetOperations<String, Object> zSetOps = redisTemplate.opsForZSet();
            Set<Object> hotSearches = zSetOps.reverseRange(HOT_SEARCH_KEY, 0, 9);
            if (hotSearches != null) {
                return hotSearches.stream()
                        .map(Object::toString)
                        .collect(java.util.stream.Collectors.toList());
            }
        } catch (Exception e) {
            log.error("Failed to get cached hot searches", e);
        }
        return Collections.emptyList();
    }

    @Override
    public void incrementHotSearchWeight(String keyword) {
        try {
            redisTemplate.opsForZSet().incrementScore(HOT_SEARCH_KEY, keyword, 1);
            // 设置过期时间
            redisTemplate.expire(HOT_SEARCH_KEY, HOT_SEARCH_TTL);
        } catch (Exception e) {
            log.error("Failed to increment hot search weight for keyword: {}", keyword, e);
        }
    }

    @Override
    public void cacheUserSearchHistory(Long userId, List<String> keywords, Duration ttl) {
        try {
            String key = USER_HISTORY_PREFIX + userId;
            ZSetOperations<String, Object> zSetOps = redisTemplate.opsForZSet();
            long timestamp = System.currentTimeMillis();

            for (String keyword : keywords) {
                zSetOps.add(key, keyword, timestamp);
            }

            // 只保留最近100条
            zSetOps.removeRange(key, 0, -101);
            redisTemplate.expire(key, ttl);
            log.debug("Cached {} keywords for user: {}", keywords.size(), userId);
        } catch (Exception e) {
            log.error("Failed to cache user search history for user: {}", userId, e);
        }
    }

    @Override
    public List<String> getUserSearchHistory(Long userId) {
        try {
            String key = USER_HISTORY_PREFIX + userId;
            ZSetOperations<String, Object> zSetOps = redisTemplate.opsForZSet();
            Set<Object> history = zSetOps.reverseRange(key, 0, 19);
            if (history != null) {
                return history.stream()
                        .map(Object::toString)
                        .collect(java.util.stream.Collectors.toList());
            }
        } catch (Exception e) {
            log.error("Failed to get user search history for user: {}", userId, e);
        }
        return Collections.emptyList();
    }

    @Override
    public void addUserSearchHistory(Long userId, String keyword) {
        try {
            if (!StringUtils.hasText(keyword)) {
                return;
            }

            String key = USER_HISTORY_PREFIX + userId;
            ZSetOperations<String, Object> zSetOps = redisTemplate.opsForZSet();

            // 添加新记录
            zSetOps.add(key, keyword, System.currentTimeMillis());

            // 如果已存在，删除旧的
            zSetOps.removeRangeByScore(key, 0, System.currentTimeMillis() - 1);

            // 只保留最近100条
            zSetOps.removeRange(key, 0, -101);

            redisTemplate.expire(key, USER_HISTORY_TTL);
        } catch (Exception e) {
            log.error("Failed to add user search history", e);
        }
    }

    @Override
    public void deleteUserSearchHistory(Long userId) {
        try {
            String key = USER_HISTORY_PREFIX + userId;
            redisTemplate.delete(key);
            log.info("Deleted search history for user: {}", userId);
        } catch (Exception e) {
            log.error("Failed to delete user search history for user: {}", userId, e);
        }
    }

    @Override
    public void cacheSearchStats(String date, String keyword, Long count, Duration ttl) {
        try {
            String key = SEARCH_STATS_PREFIX + date;
            redisTemplate.opsForHash().put(key, keyword, count.toString());
            redisTemplate.expire(key, ttl);
        } catch (Exception e) {
            log.error("Failed to cache search stats", e);
        }
    }

    @Override
    public Map<String, Long> getSearchStats(String date) {
        try {
            String key = SEARCH_STATS_PREFIX + date;
            Map<Object, Object> stats = redisTemplate.opsForHash().entries(key);
            Map<String, Long> result = new HashMap<>();

            for (Map.Entry<Object, Object> entry : stats.entrySet()) {
                try {
                    result.put(entry.getKey().toString(), Long.valueOf(entry.getValue().toString()));
                } catch (NumberFormatException e) {
                    log.warn("Invalid search stat value: {}", entry.getValue());
                }
            }

            return result;
        } catch (Exception e) {
            log.error("Failed to get search stats for date: {}", date, e);
            return Collections.emptyMap();
        }
    }

    @Override
    public void warmupCache() {
        log.info("Starting search cache warmup...");

        try {
            // 预加载热门搜索
            List<String> hotSearches = getCachedHotSearches();
            if (hotSearches.isEmpty()) {
                // 从数据库加载热门搜索
                hotSearches = loadHotSearchesFromDatabase();
                cacheHotSearches(hotSearches, HOT_SEARCH_TTL);
            }

            // 预加载搜索建议
            for (String keyword : hotSearches.subList(0, Math.min(10, hotSearches.size()))) {
                // 这里可以预加载搜索建议
                log.debug("Warmup suggestions for keyword: {}", keyword);
            }

            log.info("Search cache warmup completed");
        } catch (Exception e) {
            log.error("Failed to warmup search cache", e);
        }
    }

    @Override
    public Map<String, Object> getCacheStats() {
        Map<String, Object> stats = new HashMap<>();

        try {
            // 获取Redis连接信息
            Properties info = redisTemplate.getConnectionFactory().getConnection().info();
            stats.put("redis_version", info.getProperty("redis_version"));
            stats.put("used_memory", info.getProperty("used_memory_human"));
            stats.put("connected_clients", info.getProperty("connected_clients"));

            // 获取缓存键数量
            Set<String> searchResultKeys = redisTemplate.keys(SEARCH_RESULT_PREFIX + "*");
            Set<String> suggestionKeys = redisTemplate.keys(SUGGESTION_PREFIX + "*");
            Set<String> userHistoryKeys = redisTemplate.keys(USER_HISTORY_PREFIX + "*");

            stats.put("search_result_cache_size", searchResultKeys != null ? searchResultKeys.size() : 0);
            stats.put("suggestion_cache_size", suggestionKeys != null ? suggestionKeys.size() : 0);
            stats.put("user_history_cache_size", userHistoryKeys != null ? userHistoryKeys.size() : 0);

        } catch (Exception e) {
            log.error("Failed to get cache stats", e);
        }

        return stats;
    }

    /**
     * 构建搜索结果缓存键
     */
    private String buildSearchResultKey(SearchRequest request) {
        StringBuilder sb = new StringBuilder(SEARCH_RESULT_PREFIX);

        // 添加用户ID
        if (request.getUserId() != null) {
            sb.append("user:").append(request.getUserId()).append(":");
        }

        // 构建查询参数的哈希
        String params = String.format("%s_%s_%s_%s_%s_%s_%s",
                request.getKeyword(),
                request.getType(),
                request.getConversationId(),
                request.getSenderId(),
                request.getStartTime(),
                request.getEndTime(),
                request.getPage());

        String hash = DigestUtils.md5DigestAsHex(params.getBytes());
        sb.append(hash);

        return sb.toString();
    }

    /**
     * 从数据库加载热门搜索
     */
    private List<String> loadHotSearchesFromDatabase() {
        // TODO: 从数据库加载热门搜索关键词
        // 这里先返回一些默认值
        return Arrays.asList(
                "你好",
                "谢谢",
                "文件",
                "图片",
                "视频",
                "会议",
                "项目",
                "方案",
                "问题",
                "帮助"
        );
    }
}