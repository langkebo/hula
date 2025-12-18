package com.luohuo.flex.im.domain.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.time.LocalDateTime;

/**
 * 消息已读事件
 * 当接收方阅读消息时触发，用于通知发送方和更新自毁倒计时
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Getter
public class MessageReadEvent extends ApplicationEvent {

    private final Long messageId;
    private final String conversationId;
    private final Long senderId;
    private final Long readerId;
    private final LocalDateTime readAt;

    public MessageReadEvent(Long messageId, String conversationId,
                           Long senderId, Long readerId, LocalDateTime readAt) {
        super(messageId);
        this.messageId = messageId;
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.readerId = readerId;
        this.readAt = readAt;
    }

    /**
     * 获取阅读时间戳（毫秒）
     */
    public Long getReadAtTimestamp() {
        return readAt.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
    }
}
