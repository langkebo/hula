package com.luohuo.flex.im.api;

import com.luohuo.flex.model.entity.ws.ChatMessageResp;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 消息搜索服务接口
 *
 * @author HuLa
 */
public interface MessageSearchService {

    /**
     * 索引消息到Elasticsearch
     *
     * @param message 消息内容
     */
    void indexMessage(Object message);

    /**
     * 批量索引消息
     *
     * @param messages 消息列表
     */
    void batchIndexMessages(List<Object> messages);

    /**
     * 全文搜索消息
     *
     * @param userId 用户ID
     * @param keyword 关键词
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @param page 页码
     * @param size 每页大小
     * @return 搜索结果
     */
    List<ChatMessageResp> searchMessages(Long userId, String keyword,
                                         LocalDateTime startTime, LocalDateTime endTime,
                                         Integer page, Integer size);

    /**
     * 搜索群组消息
     *
     * @param userId 用户ID
     * @param groupId 群组ID
     * @param keyword 关键词
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @param page 页码
     * @param size 每页大小
     * @return 搜索结果
     */
    List<ChatMessageResp> searchGroupMessages(Long userId, Long groupId, String keyword,
                                              LocalDateTime startTime, LocalDateTime endTime,
                                              Integer page, Integer size);

    /**
     * 搜索私聊消息
     *
     * @param userId 用户ID
     * @param friendId 好友ID
     * @param keyword 关键词
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @param page 页码
     * @param size 每页大小
     * @return 搜索结果
     */
    List<ChatMessageResp> searchPrivateMessages(Long userId, Long friendId, String keyword,
                                                LocalDateTime startTime, LocalDateTime endTime,
                                                Integer page, Integer size);

    /**
     * 删除消息索引
     *
     * @param messageId 消息ID
     */
    void deleteMessageIndex(Long messageId);

    /**
     * 批量删除消息索引
     *
     * @param messageIds 消息ID列表
     */
    void batchDeleteMessageIndex(List<Long> messageIds);

    /**
     * 同步历史消息到Elasticsearch
     *
     * @param userId 用户ID
     * @param startTime 开始时间
     * @param endTime 结束时间
     */
    void syncHistoryMessages(Long userId, LocalDateTime startTime, LocalDateTime endTime);
}