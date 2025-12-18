package com.luohuo.flex.im.domain.vo.request;

import com.luohuo.flex.im.domain.dto.SaveEncryptedMessageDTO;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * 加密聊天消息请求
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Schema(description = "加密聊天消息请求")
public class EncryptedChatMessageReq extends ChatMessageReq {

    /**
     * 是否是加密消息
     */
    @Schema(description = "是否是加密消息", example = "true")
    private Boolean encrypted = false;

    /**
     * 加密消息详情
     */
    @Valid
    @Schema(description = "加密消息详情")
    private SaveEncryptedMessageDTO encryptedMessage;

    /**
     * 静态构建器方法
     */
    public static Builder encryptedBuilder() {
        return new Builder();
    }

    /**
     * 自定义构建器
     */
    public static class Builder {
        private Long roomId;
        private Integer msgType;
        private String body;
        private Boolean skip = false;
        private Boolean temp = false;
        private Boolean pushMessage = true;
        private Boolean encrypted = false;
        private SaveEncryptedMessageDTO encryptedMessage;

        public Builder roomId(Long roomId) {
            this.roomId = roomId;
            return this;
        }

        public Builder msgType(Integer msgType) {
            this.msgType = msgType;
            return this;
        }

        public Builder body(String body) {
            this.body = body;
            return this;
        }

        public Builder skip(Boolean skip) {
            this.skip = skip;
            return this;
        }

        public Builder temp(Boolean temp) {
            this.temp = temp;
            return this;
        }

        public Builder pushMessage(Boolean pushMessage) {
            this.pushMessage = pushMessage;
            return this;
        }

        public Builder encrypted(Boolean encrypted) {
            this.encrypted = encrypted;
            return this;
        }

        public Builder encryptedMessage(SaveEncryptedMessageDTO encryptedMessage) {
            this.encryptedMessage = encryptedMessage;
            return this;
        }

        public EncryptedChatMessageReq build() {
            EncryptedChatMessageReq req = new EncryptedChatMessageReq();
            req.setRoomId(roomId);
            req.setMsgType(msgType);
            req.setBody(body);
            req.setSkip(skip);
            req.setTemp(temp);
            req.setPushMessage(pushMessage);
            req.setEncrypted(encrypted);
            req.setEncryptedMessage(encryptedMessage);
            return req;
        }
    }

    /**
     * 转换为普通ChatMessageReq（用于兼容性）
     */
    public ChatMessageReq toChatMessageReq() {
        if (!Boolean.TRUE.equals(encrypted)) {
            return this;
        }

        ChatMessageReq req = new ChatMessageReq();
        req.setRoomId(this.getRoomId());
        req.setMsgType(this.getMsgType());
        req.setBody("[加密消息]");
        req.setSkip(this.isSkip());
        req.setTemp(this.isTemp());
        req.setPushMessage(this.isPushMessage());

        return req;
    }

    /**
     * 验证加密消息请求
     */
    public void validateEncryptedMessage() {
        if (Boolean.TRUE.equals(encrypted) && encryptedMessage == null) {
            throw new IllegalArgumentException("加密消息标记为true时，必须提供encryptedMessage");
        }
    }
}