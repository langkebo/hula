package com.luohuo.flex.im.domain.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * 消息销毁事件
 * 当消息因自毁定时器到期而被删除时触发，用于通知客户端
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Getter
public class MessageDestructedEvent extends ApplicationEvent {

    private final Long messageId;
    private final String conversationId;
    private final Long senderId;
    private final Long recipientId;
    private final Long roomId;

    public MessageDestructedEvent(Long messageId, String conversationId,
                                 Long senderId, Long recipientId, Long roomId) {
        super(messageId);
        this.messageId = messageId;
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.recipientId = recipientId;
        this.roomId = roomId;
    }

    /**
     * 是否是群消息
     */
    public boolean isGroupMessage() {
        return roomId != null && roomId > 0;
    }

    /**
     * 是否是私聊消息
     */
    public boolean isPrivateMessage() {
        return recipientId != null && recipientId > 0;
    }
}
