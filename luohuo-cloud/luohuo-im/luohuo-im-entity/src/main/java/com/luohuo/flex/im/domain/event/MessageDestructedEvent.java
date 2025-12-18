package com.luohuo.flex.im.domain.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.time.LocalDateTime;

/**
 * 消息销毁事件
 * 当消息被销毁（阅后即焚或定时销毁）时触发
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Getter
public class MessageDestructedEvent extends ApplicationEvent {

    /**
     * 消息ID
     */
    private final Long messageId;

    /**
     * 发送者ID
     */
    private final Long senderId;

    /**
     * 接收者ID（单聊时使用）
     */
    private final Long recipientId;

    /**
     * 群组ID（群聊时使用）
     */
    private final Long groupId;

    /**
     * 会话ID
     */
    private final String conversationId;

    /**
     * 销毁时间
     */
    private final LocalDateTime destructAt;

    /**
     * 销毁类型（1:阅后即焚 2:定时销毁）
     */
    private final Integer destructType;

    /**
     * 消息类型
     */
    private final String messageType;

    /**
     * 销毁原因
     */
    private final String reason;

    public MessageDestructedEvent(Object source, Long messageId, Long senderId, Long recipientId,
                                 Long groupId, String conversationId, LocalDateTime destructAt,
                                 Integer destructType, String messageType, String reason) {
        super(source);
        this.messageId = messageId;
        this.senderId = senderId;
        this.recipientId = recipientId;
        this.groupId = groupId;
        this.conversationId = conversationId;
        this.destructAt = destructAt;
        this.destructType = destructType;
        this.messageType = messageType;
        this.reason = reason;
    }

    /**
     * 判断是否是群聊消息
     */
    public boolean isGroupMessage() {
        return groupId != null;
    }

    /**
     * 判断是否是私聊消息
     */
    public boolean isPrivateMessage() {
        return recipientId != null;
    }
}