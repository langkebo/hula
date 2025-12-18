package com.luohuo.flex.im.domain.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 会话DTO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
public class ConversationDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 会话ID
     */
    private String conversationId;

    /**
     * 会话类型（1-单聊，2-群聊）
     */
    private Integer conversationType;

    /**
     * 会话名称
     */
    private String conversationName;

    /**
     * 会话头像
     */
    private String conversationAvatar;

    /**
     * 参与者ID（单聊时为对方ID，群聊时为群组ID）
     */
    private Long participantId;

    /**
     * 最后一条消息内容
     */
    private String lastMessageContent;

    /**
     * 最后一条消息时间
     */
    private Long lastMessageTime;

    /**
     * 未读消息数
     */
    private Integer unreadCount;

    /**
     * 会话状态（1-正常，2-置顶，3-免打扰，4-删除）
     */
    private Integer conversationStatus;

    /**
     * 创建时间
     */
    private Long createTime;

    /**
     * 更新时间
     */
    private Long updateTime;
}