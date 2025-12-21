package com.luohuo.flex.im.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.luohuo.flex.im.domain.entity.SearchHistory;
import com.luohuo.flex.im.mapper.SearchHistoryMapper;
import com.luohuo.flex.im.service.SearchHistoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * 搜索历史服务实现
 *
 * @author HuLa
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchHistoryServiceImpl extends ServiceImpl<SearchHistoryMapper, SearchHistory>
        implements SearchHistoryService {

    private final RedisTemplate<String, Object> redisTemplate;

    // Redis key前缀
    private static final String USER_HISTORY_PREFIX = "search:history:user:";
    private static final String HOT_KEYWORDS_PREFIX = "search:hot:";

    @Override
    public void recordSearchHistory(Long userId, String keyword, String searchType,
                                   String searchParams, Integer resultCount, Integer searchTime) {
        try {
            // 保存到数据库
            SearchHistory history = new SearchHistory();
            history.setUserId(userId);
            history.setKeyword(keyword);
            history.setSearchType(searchType);
            history.setSearchParams(searchParams);
            history.setResultCount(resultCount);
            history.setSearchTime(searchTime);
            history.setSearchedAt(LocalDateTime.now());
            history.setCreateTime(LocalDateTime.now());

            save(history);

            // 更新Redis缓存
            String cacheKey = USER_HISTORY_PREFIX + userId + ":" + searchType;
            redisTemplate.opsForZSet().add(cacheKey, keyword, System.currentTimeMillis());
            redisTemplate.expire(cacheKey, 30, TimeUnit.DAYS);

            // 更新热门关键词缓存
            updateHotKeywordsCache(searchType, keyword);

            log.debug("Recorded search history: userId={}, keyword={}, type={}",
                    userId, keyword, searchType);

        } catch (Exception e) {
            log.error("Failed to record search history", e);
        }
    }

    @Override
    public List<SearchHistory> getUserSearchHistory(Long userId, String searchType, Integer limit) {
        try {
            // 先从Redis获取
            String cacheKey = USER_HISTORY_PREFIX + userId + ":" + searchType;
            var cachedKeywords = redisTemplate.opsForZSet()
                    .reverseRange(cacheKey, 0, limit - 1);

            if (cachedKeywords != null && !cachedKeywords.isEmpty()) {
                // 从缓存直接返回关键词列表
                return cachedKeywords.stream()
                        .map(obj -> String.valueOf(obj))
                        .toList();
            }

            // 从数据库查询
            return baseMapper.selectUserSearchHistory(userId, searchType, limit);

        } catch (Exception e) {
            log.error("Failed to get user search history", e);
            return List.of();
        }
    }

    @Override
    public List<String> getHotKeywords(String searchType, Integer limit) {
        try {
            // 先从Redis获取
            String cacheKey = HOT_KEYWORDS_PREFIX + searchType;
            var cachedKeywords = redisTemplate.opsForZSet()
                    .reverseRange(cacheKey, 0, limit - 1);

            if (cachedKeywords != null && !cachedKeywords.isEmpty()) {
                return cachedKeywords.stream()
                        .map(obj -> String.valueOf(obj))
                        .toList();
            }

            // 从数据库查询
            List<String> keywords = baseMapper.selectHotKeywords(searchType, limit);

            // 更新缓存
            for (int i = 0; i < keywords.size(); i++) {
                redisTemplate.opsForZSet().add(cacheKey, keywords.get(i), keywords.size() - i);
            }
            redisTemplate.expire(cacheKey, 1, TimeUnit.HOURS);

            return keywords;

        } catch (Exception e) {
            log.error("Failed to get hot keywords", e);
            return List.of();
        }
    }

    @Override
    public void clearUserSearchHistory(Long userId, String searchType) {
        try {
            // 删除数据库记录
            baseMapper.deleteUserSearchHistory(userId, searchType);

            // 清除Redis缓存
            String cacheKey = USER_HISTORY_PREFIX + userId + ":" + searchType;
            redisTemplate.delete(cacheKey);

            log.info("Cleared search history: userId={}, type={}", userId, searchType);

        } catch (Exception e) {
            log.error("Failed to clear search history", e);
        }
    }

    @Override
    public void deleteSearchHistory(Long id, Long userId) {
        try {
            // 获取搜索历史记录
            SearchHistory history = getById(id);
            if (history == null || !history.getUserId().equals(userId)) {
                log.warn("Invalid search history record: id={}, userId={}", id, userId);
                return;
            }

            // 删除数据库记录
            removeById(id);

            // 更新Redis缓存（移除对应关键词）
            String cacheKey = USER_HISTORY_PREFIX + userId + ":" + history.getSearchType();
            redisTemplate.opsForZSet().remove(cacheKey, history.getKeyword());

            log.info("Deleted search history: id={}, keyword={}", id, history.getKeyword());

        } catch (Exception e) {
            log.error("Failed to delete search history", e);
        }
    }

    @Override
    public List<String> getSearchSuggestions(Long userId, String prefix, Integer limit) {
        try {
            // 先从Redis获取用户的搜索历史
            String cacheKey = USER_HISTORY_PREFIX + userId + ":*";
            List<String> suggestions = baseMapper.selectSearchSuggestions(userId, prefix, limit);

            // 可以结合AI模型提供更智能的建议
            // TODO: 集成AI服务，基于用户行为提供个性化建议

            return suggestions;

        } catch (Exception e) {
            log.error("Failed to get search suggestions", e);
            return List.of();
        }
    }

    /**
     * 更新热门关键词缓存
     */
    private void updateHotKeywordsCache(String searchType, String keyword) {
        try {
            String cacheKey = HOT_KEYWORDS_PREFIX + searchType;
            redisTemplate.opsForZSet().incrementScore(cacheKey, keyword, 1);
            redisTemplate.expire(cacheKey, 1, TimeUnit.HOURS);

            // 清理过期或低频的关键词
            Long size = redisTemplate.opsForZSet().zCard(cacheKey);
            if (size != null && size > 100) {
                // 保留前100个热门关键词
                redisTemplate.opsForZSet().removeRange(cacheKey, 0, -101);
            }

        } catch (Exception e) {
            log.error("Failed to update hot keywords cache", e);
        }
    }
}