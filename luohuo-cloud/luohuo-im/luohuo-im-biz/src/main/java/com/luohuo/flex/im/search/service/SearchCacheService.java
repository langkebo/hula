package com.luohuo.flex.im.search.service;

import com.luohuo.flex.im.search.dto.SearchRequest;
import com.luohuo.flex.im.search.dto.SearchResponse;

import java.time.Duration;
import java.util.List;
import java.util.Set;

/**
 * 搜索缓存服务接口
 *
 * @author HuLa
 */
public interface SearchCacheService {

    /**
     * 缓存搜索结果
     *
     * @param request    搜索请求
     * @param response   搜索响应
     * @param ttl        缓存时间
     */
    void cacheSearchResult(SearchRequest request, SearchResponse<?> response, Duration ttl);

    /**
     * 获取缓存的搜索结果
     *
     * @param request 搜索请求
     * @return 缓存的响应，如果不存在返回null
     */
    SearchResponse<?> getCachedSearchResult(SearchRequest request);

    /**
     * 删除搜索缓存
     *
     * @param pattern 删除模式
     */
    void evictSearchCache(String pattern);

    /**
     * 清除所有搜索缓存
     */
    void clearAllSearchCache();

    /**
     * 缓存搜索建议
     *
     * @param keyword  关键词
     * @param suggestions 建议列表
     * @param ttl     缓存时间
     */
    void cacheSuggestions(String keyword, List<String> suggestions, Duration ttl);

    /**
     * 获取缓存的搜索建议
     *
     * @param keyword 关键词
     * @return 建议列表
     */
    List<String> getCachedSuggestions(String keyword);

    /**
     * 缓存热门搜索
     *
     * @param hotSearches 热门搜索列表
     * @param ttl         缓存时间
     */
    void cacheHotSearches(List<String> hotSearches, Duration ttl);

    /**
     * 获取缓存的热门搜索
     *
     * @return 热门搜索列表
     */
    List<String> getCachedHotSearches();

    /**
     * 增加热门搜索权重
     *
     * @param keyword 关键词
     */
    void incrementHotSearchWeight(String keyword);

    /**
     * 缓存用户搜索历史
     *
     * @param userId    用户ID
     * @param keywords  关键词列表
     * @param ttl       缓存时间
     */
    void cacheUserSearchHistory(Long userId, List<String> keywords, Duration ttl);

    /**
     * 获取用户搜索历史
     *
     * @param userId 用户ID
     * @return 搜索历史列表
     */
    List<String> getUserSearchHistory(Long userId);

    /**
     * 添加用户搜索历史
     *
     * @param userId  用户ID
     * @param keyword 关键词
     */
    void addUserSearchHistory(Long userId, String keyword);

    /**
     * 删除用户搜索历史
     *
     * @param userId 用户ID
     */
    void deleteUserSearchHistory(Long userId);

    /**
     * 缓存搜索统计
     *
     * @param date      日期
     * @param keyword  关键词
     * @param count     搜索次数
     * @param ttl       缓存时间
     */
    void cacheSearchStats(String date, String keyword, Long count, Duration ttl);

    /**
     * 获取搜索统计
     *
     * @param date 日期
     * @return 关键词搜索次数映射
     */
    java.util.Map<String, Long> getSearchStats(String date);

    /**
     * 预热缓存
     */
    void warmupCache();

    /**
     * 获取缓存统计信息
     *
     * @return 缓存统计
     */
    java.util.Map<String, Object> getCacheStats();
}