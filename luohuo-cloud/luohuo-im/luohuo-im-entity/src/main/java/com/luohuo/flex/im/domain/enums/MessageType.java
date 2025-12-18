package com.luohuo.flex.im.domain.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 消息类型枚举 (E2EE)
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
public enum MessageType {

    /**
     * 文本消息
     */
    TEXT("TEXT", "文本消息"),

    /**
     * 图片消息
     */
    IMAGE("IMAGE", "图片消息"),

    /**
     * 文件消息
     */
    FILE("FILE", "文件消息"),

    /**
     * 语音消息
     */
    VOICE("VOICE", "语音消息"),

    /**
     * 视频消息
     */
    VIDEO("VIDEO", "视频消息"),

    /**
     * 位置消息
     */
    LOCATION("LOCATION", "位置消息"),

    /**
     * 表情消息
     */
    EMOJI("EMOJI", "表情消息"),

    /**
     * 系统消息
     */
    SYSTEM("SYSTEM", "系统消息");

    /**
     * 类型标识
     */
    @EnumValue
    @JsonValue
    private final String code;

    /**
     * 类型描述
     */
    private final String description;

    MessageType(String code, String description) {
        this.code = code;
        this.description = description;
    }

    public String getCode() {
        return code;
    }

    public String getDescription() {
        return description;
    }

    /**
     * 根据code获取枚举
     */
    public static MessageType of(String code) {
        for (MessageType type : values()) {
            if (type.code.equals(code)) {
                return type;
            }
        }
        throw new IllegalArgumentException("未知的消息类型: " + code);
    }}
