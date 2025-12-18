package com.luohuo.flex.im.domain.dto;

import lombok.Data;
import lombok.Builder;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 消息已读通知DTO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
@Builder
public class MessageReadNotificationDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 消息ID
     */
    private Long messageId;

    /**
     * 发送者ID
     */
    private Long senderId;

    /**
     * 读者ID
     */
    private Long readerId;

    /**
     * 会话ID
     */
    private String conversationId;

    /**
     * 阅读时间
     */
    private LocalDateTime readAt;
    private Long readAtTimestamp;
    private Long tenantId;

    /**
     * 消息类型（单聊/群聊）
     */
    private Integer messageType;
}
