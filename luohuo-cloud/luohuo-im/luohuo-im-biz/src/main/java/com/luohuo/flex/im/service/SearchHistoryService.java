package com.luohuo.flex.im.service;

import com.luohuo.flex.im.domain.entity.SearchHistory;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

/**
 * 搜索历史服务接口
 *
 * @author HuLa
 */
public interface SearchHistoryService extends IService<SearchHistory> {

    /**
     * 记录搜索历史
     *
     * @param userId 用户ID
     * @param keyword 关键词
     * @param searchType 搜索类型
     * @param searchParams 搜索参数
     * @param resultCount 结果数量
     * @param searchTime 搜索耗时
     */
    void recordSearchHistory(Long userId, String keyword, String searchType,
                            String searchParams, Integer resultCount, Integer searchTime);

    /**
     * 获取用户搜索历史
     *
     * @param userId 用户ID
     * @param searchType 搜索类型
     * @param limit 限制数量
     * @return 搜索历史列表
     */
    List<SearchHistory> getUserSearchHistory(Long userId, String searchType, Integer limit);

    /**
     * 获取热门搜索关键词
     *
     * @param searchType 搜索类型
     * @param limit 限制数量
     * @return 热门关键词列表
     */
    List<String> getHotKeywords(String searchType, Integer limit);

    /**
     * 清除用户搜索历史
     *
     * @param userId 用户ID
     * @param searchType 搜索类型
     */
    void clearUserSearchHistory(Long userId, String searchType);

    /**
     * 删除搜索历史记录
     *
     * @param id 记录ID
     * @param userId 用户ID
     */
    void deleteSearchHistory(Long id, Long userId);

    /**
     * 获取搜索建议
     *
     * @param userId 用户ID
     * @param prefix 关键词前缀
     * @param limit 限制数量
     * @return 建议列表
     */
    List<String> getSearchSuggestions(Long userId, String prefix, Integer limit);
}