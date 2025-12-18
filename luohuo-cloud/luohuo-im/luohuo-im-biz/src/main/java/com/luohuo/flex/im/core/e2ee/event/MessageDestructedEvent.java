package com.luohuo.flex.im.core.e2ee.event;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.context.ApplicationEvent;

import java.time.LocalDateTime;

/**
 * 消息销毁事件
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
public class MessageDestructedEvent extends ApplicationEvent {

    /**
     * 消息ID
     */
    private Long messageId;

    /**
     * 用户ID
     */
    private Long senderId;
    private Long recipientId;

    /**
     * 会话ID
     */
    private String conversationId;

    /**
     * 销毁时间
     */
    private LocalDateTime destructedAt;

    /**
     * 房间ID
     */
    private Long roomId;

    /**
     * 消息类型
     */
    private Integer msgType;

    public MessageDestructedEvent(Long messageId, Long senderId, String conversationId,
                                  LocalDateTime destructedAt, Long roomId, Integer msgType, Long recipientId) {
        super(messageId);
        this.messageId = messageId;
        this.senderId = senderId;
        this.recipientId = recipientId;
        this.conversationId = conversationId;
        this.destructedAt = destructedAt;
        this.roomId = roomId;
        this.msgType = msgType;
    }

    /**
     * 是否是群消息
     */
    public boolean isGroupMessage() {
        return roomId != null && roomId > 0;
    }

    /**
     * 新的构造函数，兼容E2EEMessageService的调用
     */
    public MessageDestructedEvent(Object source, Long messageId, String conversationId,
                                 Long senderId, Long recipientId, Long roomId) {
        super(messageId);
        this.messageId = messageId;
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.recipientId = recipientId;
        this.roomId = roomId;
        this.destructedAt = LocalDateTime.now();
        this.msgType = null;
    }

    /**
     * 带销毁原因的构造函数
     */
    public MessageDestructedEvent(Object source, Long messageId, String conversationId,
                                 Long senderId, Long recipientId, Long roomId, String reason) {
        super(messageId);
        this.messageId = messageId;
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.recipientId = recipientId;
        this.roomId = roomId;
        this.destructedAt = LocalDateTime.now();
        this.msgType = null;
    }

    public boolean isPrivateMessage() {
        return recipientId != null && recipientId > 0;
    }
}
