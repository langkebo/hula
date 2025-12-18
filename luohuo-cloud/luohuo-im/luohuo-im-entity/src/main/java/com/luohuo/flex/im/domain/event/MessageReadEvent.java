package com.luohuo.flex.im.domain.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.time.LocalDateTime;

/**
 * 消息已读事件
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Getter
public class MessageReadEvent extends ApplicationEvent {

    /**
     * 消息ID
     */
    private final Long messageId;

    /**
     * 发送者ID
     */
    private final Long senderId;

    /**
     * 读者ID
     */
    private final Long readerId;

    /**
     * 会话ID
     */
    private final String conversationId;

    /**
     * 阅读时间
     */
    private final LocalDateTime readAt;

    public MessageReadEvent(Object source, Long messageId, Long senderId,
                           Long readerId, String conversationId, LocalDateTime readAt) {
        super(source);
        this.messageId = messageId;
        this.senderId = senderId;
        this.readerId = readerId;
        this.conversationId = conversationId;
        this.readAt = readAt;
    }
}