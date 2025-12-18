package com.luohuo.flex.im.domain.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.luohuo.basic.base.entity.TenantEntity;
import com.luohuo.flex.im.domain.enums.EncryptionAlgorithm;
import com.luohuo.flex.im.domain.enums.MessageType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 加密消息实体类
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("im_message_encrypted")
@Schema(description = "加密消息")
public class MessageEncrypted extends TenantEntity<Long> implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 关联原始消息ID(兼容性)
     */
    @TableField("msg_id")
    @Schema(description = "关联原始消息ID", example = "123456")
    private Long msgId;

    /**
     * 会话ID
     */
    @NotBlank(message = "会话ID不能为空")
    @Size(max = 64, message = "会话ID长度不能超过64")
    @TableField("conversation_id")
    @Schema(description = "会话ID", example = "conv_123456")
    private String conversationId;

    /**
     * 发送者ID
     */
    @NotNull(message = "发送者ID不能为空")
    @TableField("sender_id")
    @Schema(description = "发送者ID", example = "123456")
    private Long senderId;

    /**
     * 接收者ID(私聊)
     */
    @TableField("recipient_id")
    @Schema(description = "接收者ID", example = "654321")
    private Long recipientId;

    /**
     * 群聊ID
     */
    @TableField("room_id")
    @Schema(description = "群聊ID", example = "1001")
    private Long roomId;

    /**
     * 会话密钥ID
     */
    @NotBlank(message = "会话密钥ID不能为空")
    @Size(max = 64, message = "密钥ID长度不能超过64")
    @TableField("key_id")
    @Schema(description = "会话密钥ID", example = "session_key_001")
    private String keyId;

    /**
     * 加密算法
     */
    @TableField("algorithm")
    @Schema(description = "加密算法", example = "AES-GCM")
    private EncryptionAlgorithm algorithm = EncryptionAlgorithm.AES_GCM;

    /**
     * 密文
     */
    @NotNull(message = "密文不能为空")
    @TableField("ciphertext")
    @Schema(description = "密文")
    private byte[] ciphertext;

    /**
     * 初始化向量(IV)
     */
    @NotNull(message = "初始化向量不能为空")
    @TableField("iv")
    @Schema(description = "初始化向量")
    private byte[] iv;

    /**
     * 认证标签(GCM)
     */
    @TableField("tag")
    @Schema(description = "认证标签")
    private byte[] tag;

    /**
     * 内容哈希(SHA-256)
     */
    @TableField("content_hash")
    @Schema(description = "内容哈希")
    private byte[] contentHash;

    /**
     * 消息签名(RSA-PSS)
     */
    @TableField("signature")
    @Schema(description = "消息签名")
    private byte[] signature;

    /**
     * 内容类型
     */
    @NotBlank(message = "内容类型不能为空")
    @Size(max = 32, message = "内容类型长度不能超过32")
    @TableField("content_type")
    @Schema(description = "内容类型", example = "text")
    private String contentType;

    /**
     * 加密的扩展信息(JSON格式)
     */
    @TableField("encrypted_extra")
    @Schema(description = "加密的扩展信息")
    private String encryptedExtra;

    /**
     * 消息大小(字节)
     */
    @TableField("message_size")
    @Schema(description = "消息大小(字节)", example = "1024")
    private Integer messageSize;

    /**
     * 是否已签名
     */
    @TableField("is_signed")
    @Schema(description = "是否已签名", example = "true")
    private Boolean isSigned = false;

    /**
     * 验证状态
     */
    @TableField("verification_status")
    @Schema(description = "验证状态", example = "VERIFIED")
    private String verificationStatus;

    /**
     * 签名验证时间
     */
    @TableField("signature_verified_at")
    @Schema(description = "签名验证时间")
    private LocalDateTime signatureVerifiedAt;

    /**
     * 加密耗时(毫秒)
     */
    @TableField("encryption_time_ms")
    @Schema(description = "加密耗时(毫秒)", example = "15")
    private Long encryptionTimeMs;

    /**
     * 解密耗时(毫秒)
     */
    @TableField("decryption_time_ms")
    @Schema(description = "解密耗时(毫秒)", example = "12")
    private Long decryptionTimeMs;

    /**
     * 自毁定时器(毫秒)
     * 客户端设置的消息存活时间
     */
    @TableField("self_destruct_timer")
    @Schema(description = "自毁定时器(毫秒)", example = "300000")
    private Long selfDestructTimer;

    /**
     * 消息被读取时间
     * 接收方阅读消息时由客户端上报
     */
    @TableField("read_at")
    @Schema(description = "消息被读取时间")
    private LocalDateTime readAt;

    /**
     * 消息销毁时间（自动计算）
     * 计算规则: min(readAt + 5min, sendTime + selfDestructTimer, sendTime + 3days)
     */
    @TableField("destruct_at")
    @Schema(description = "消息销毁时间")
    private LocalDateTime destructAt;

    /**
     * 是否是群消息
     *
     * @return true if message is for a room
     */
    public boolean isGroupMessage() {
        return roomId != null && roomId > 0;
    }

    /**
     * 是否是私聊消息
     *
     * @return true if message is for a private chat
     */
    public boolean isPrivateMessage() {
        return recipientId != null && recipientId > 0;
    }

    /**
     * 获取消息类型
     *
     * @return message type
     */
    public MessageType getMessageType() {
        try {
            return MessageType.valueOf(contentType.toUpperCase());
        } catch (IllegalArgumentException e) {
            return MessageType.TEXT;
        }
    }

    /**
     * 设置解密耗时
     */
    public void setDecryptionTime(long timeMs) {
        this.decryptionTimeMs = timeMs;
    }

    /**
     * 设置加密耗时
     */
    public void setEncryptionTime(long timeMs) {
        this.encryptionTimeMs = timeMs;
    }

    /**
     * 计算消息销毁时间
     * 规则：
     * 1. 如果已读，取 readAt + 5 分钟
     * 2. 如果未读，取 createTime + selfDestructTimer
     * 3. 最长保留 3 天
     *
     * @return 消息销毁时间
     */
    public LocalDateTime calculateDestructTime() {
        if (selfDestructTimer == null || selfDestructTimer <= 0) {
            return null;
        }

        final long MIN_DESTRUCT_AFTER_READ_MS = 5 * 60 * 1000L; // 5 分钟
        final long MAX_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000L; // 3 天

        LocalDateTime maxDestructTime = getCreateTime().plusNanos(MAX_LIFETIME_MS * 1_000_000);

        if (readAt != null) {
            // 已读：readAt + 5 分钟，但不超过 3 天
            LocalDateTime destructAfterRead = readAt.plusNanos(MIN_DESTRUCT_AFTER_READ_MS * 1_000_000);
            return destructAfterRead.isBefore(maxDestructTime) ? destructAfterRead : maxDestructTime;
        } else {
            // 未读：createTime + selfDestructTimer，但不超过 3 天
            long timerMs = Math.min(selfDestructTimer, MAX_LIFETIME_MS);
            LocalDateTime destructByTimer = getCreateTime().plusNanos(timerMs * 1_000_000);
            return destructByTimer.isBefore(maxDestructTime) ? destructByTimer : maxDestructTime;
        }
    }

    /**
     * 检查消息是否应该被销毁
     *
     * @return true if message should be destroyed
     */
    public boolean shouldDestruct() {
        if (destructAt == null) {
            return false;
        }
        return LocalDateTime.now().isAfter(destructAt);
    }

    /**
     * 是否启用了自毁功能
     *
     * @return true if self-destruct is enabled
     */
    public boolean isSelfDestructEnabled() {
        return selfDestructTimer != null && selfDestructTimer > 0;
    }
}