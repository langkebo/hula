package com.luohuo.flex.im.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * E2EE加密消息发送DTO
 *
 * 用于RocketMQ消息传输
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class E2EEMsgSendDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 消息ID
     */
    private Long messageId;

    /**
     * 会话ID
     */
    private String conversationId;

    /**
     * 发送者ID
     */
    private Long senderId;

    /**
     * 接收者ID（单聊）
     */
    private Long recipientId;

    /**
     * 房间ID（群聊）
     */
    private Long roomId;

    /**
     * 租户ID
     */
    private Long tenantId;

    /**
     * 是否为群聊消息
     */
    public boolean isGroupMessage() {
        return roomId != null && roomId > 0;
    }

    /**
     * 是否为私聊消息
     */
    public boolean isPrivateMessage() {
        return recipientId != null && recipientId > 0;
    }
}
