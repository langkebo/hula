package com.luohuo.flex.im.domain.enums;

import lombok.Getter;

/**
 * 消息类型枚举
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Getter
public enum MessageTypeEnum {

    TEXT(1, "文本消息"),
    IMAGE(2, "图片消息"),
    VOICE(3, "语音消息"),
    VIDEO(4, "视频消息"),
    FILE(5, "文件消息"),
    SYSTEM(6, "系统消息"),
    LOCATION(7, "位置消息"),
    CARD(8, "名片消息"),
    RECALL(9, "撤回消息"),
    TYPING(10, "正在输入"),
    QUOTE(11, "引用消息"),
    FORWARD(12, "转发消息"),
    NOTICE(13, "公告消息"),
    RED_PACKET(14, "红包消息"),
    TRANSFER(15, "转账消息");

    private final Integer code;
    private final String desc;

    MessageTypeEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static MessageTypeEnum getByCode(Integer code) {
        if (code == null) {
            return null;
        }
        for (MessageTypeEnum type : values()) {
            if (type.getCode().equals(code)) {
                return type;
            }
        }
        return null;
    }

    public Integer getCode() {
        return this.code;
    }
}