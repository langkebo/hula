package com.luohuo.flex.im.search.service;

import com.luohuo.flex.im.search.dto.SearchRequest;
import com.luohuo.flex.im.search.dto.SearchResponse;

/**
 * 消息搜索服务接口
 *
 * @author HuLa
 */
public interface MessageSearchService {

    /**
     * 搜索消息
     *
     * @param request 搜索请求
     * @return 搜索响应
     */
    SearchResponse<?> searchMessages(SearchRequest request);

    /**
     * 搜索消息（同步）
     *
     * @param request 搜索请求
     * @return 搜索响应
     */
    SearchResponse<?> searchMessagesSync(SearchRequest request);

    /**
     * 搜索用户
     *
     * @param request 搜索请求
     * @return 搜索响应
     */
    SearchResponse<?> searchUsers(SearchRequest request);

    /**
     * 搜索会话
     *
     * @param request 搜索请求
     * @return 搜索响应
     */
    SearchResponse<?> searchConversations(SearchRequest request);

    /**
     * 搜索文件
     *
     * @param request 搜索请求
     * @return 搜索响应
     */
    SearchResponse<?> searchFiles(SearchRequest request);

    /**
     * 搜索图片
     *
     * @param request 搜索请求
     * @return 搜索响应
     */
    SearchResponse<?> searchImages(SearchRequest request);

    /**
     * 获取搜索建议（基于历史和热门搜索）
     *
     * @param keyword 关键词
     * @param userId  用户ID
     * @return 建议列表
     */
    java.util.List<String> getSuggestions(String keyword, Long userId);

    /**
     * 获取热门搜索
     *
     * @param userId 用户ID
     * @param limit 限制数量
     * @return 热门搜索列表
     */
    java.util.List<String> getHotSearches(Long userId, Integer limit);

    /**
     * 记录搜索历史
     *
     * @param userId  用户ID
     * @param keyword 关键词
     */
    void recordSearchHistory(Long userId, String keyword);

    /**
     * 清除搜索历史
     *
     * @param userId 用户ID
     */
    void clearSearchHistory(Long userId);

    /**
     * 获取搜索历史
     *
     * @param userId  用户ID
     * @param limit 限制数量
     * @return 搜索历史
     */
    java.util.List<String> getSearchHistory(Long userId, Integer limit);

    /**
     * 重建索引
     *
     * @param type 重建类型（user/conversation）
     * @param id    ID
     */
    void reindex(String type, Long id);

    /**
     * 全量重建索引
     */
    void reindexAll();
}