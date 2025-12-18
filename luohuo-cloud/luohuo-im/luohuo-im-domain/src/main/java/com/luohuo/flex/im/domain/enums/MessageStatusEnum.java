package com.luohuo.flex.im.domain.enums;

import lombok.Getter;

/**
 * 消息状态枚举
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Getter
public enum MessageStatusEnum {

    SENDING(1, "发送中"),
    SEND_SUCCESS(2, "发送成功"),
    SEND_FAILED(3, "发送失败"),
    READ(4, "已读"),
    RECALL(5, "已撤回"),
    DELETED(6, "已删除"),
    BURN_AFTER_READ(7, "阅后即焚");

    private final Integer code;
    private final String desc;

    MessageStatusEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static MessageStatusEnum getByCode(Integer code) {
        if (code == null) {
            return null;
        }
        for (MessageStatusEnum status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        return null;
    }

    public Integer getCode() {
        return this.code;
    }
}