package com.luohuo.flex.im.domain.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * 消息已读通知DTO
 * 用于WebSocket推送已读回执给发送方
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "消息已读通知")
public class MessageReadNotificationDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 消息ID
     */
    @Schema(description = "消息ID", example = "123456")
    private Long messageId;

    /**
     * 会话ID
     */
    @Schema(description = "会话ID", example = "conv_123456")
    private String conversationId;

    /**
     * 发送方ID（接收通知的用户）
     */
    @Schema(description = "发送方ID", example = "10001")
    private Long senderId;

    /**
     * 阅读者ID（标记消息为已读的用户）
     */
    @Schema(description = "阅读者ID", example = "10002")
    private Long readerId;

    /**
     * 阅读时间戳（毫秒）
     */
    @Schema(description = "阅读时间戳（毫秒）", example = "1702368000000")
    private Long readAtTimestamp;

    /**
     * 租户ID
     */
    @Schema(description = "租户ID", example = "1")
    private Long tenantId;

    /**
     * 通知类型（用于前端区分）
     */
    @Schema(description = "通知类型", example = "MESSAGE_READ")
    @Builder.Default
    private String notificationType = "MESSAGE_READ";
}
