package com.luohuo.flex.im.domain.dto;

import lombok.Data;
import lombok.Builder;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 消息销毁通知DTO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
@Builder
public class MessageDestructNotificationDTO implements Serializable {

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
     * 接收者ID（单聊时使用）
     */
    private Long recipientId;

    /**
     * 群组ID（群聊时使用）
     */
    private Long roomId;

    /**
     * 销毁时间
     */
    private LocalDateTime destructAt;
    private Long destructedAt;
    private String conversationId;
    private Long tenantId;

    /**
     * 销毁类型（1:阅后即焚 2:定时销毁）
     */
    private Integer destructType;

    /**
     * 消息类型
     */
    private String messageType;
}
