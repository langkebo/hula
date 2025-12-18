package com.luohuo.flex.im.core.e2ee.event;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.context.ApplicationEvent;

import java.time.LocalDateTime;

/**
 * 消息已读事件
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
public class MessageReadEvent extends ApplicationEvent {

    /**
     * 消息ID
     */
    private Long messageId;

    /**
     * 用户ID
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

    /**
     * 消息类型
     */
    private Integer msgType;

    private Long senderId;

    public MessageReadEvent(Long messageId, Long readerId, String conversationId,
                           LocalDateTime readAt, Integer msgType, Long senderId) {
        super(messageId);
        this.messageId = messageId;
        this.readerId = readerId;
        this.conversationId = conversationId;
        this.readAt = readAt;
        this.msgType = msgType;
        this.senderId = senderId;
    }

    public long getReadAtTimestamp() {
        return readAt != null ? readAt.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli() : 0L;
    }
}
