package com.luohuo.flex.im.domain.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import com.luohuo.basic.interfaces.BaseEnum;

/**
 * 密钥状态枚举
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
public enum KeyStatus implements BaseEnum {

    /**
     * 激活
     */
    ACTIVE(1, "激活"),

    /**
     * 禁用
     */
    DISABLED(0, "禁用"),

    /**
     * 已过期
     */
    EXPIRED(2, "已过期"),

    /**
     * 已废弃
     */
    REVOKED(3, "已废弃");

    /**
     * 状态码
     */
    @EnumValue
    @JsonValue
    private final Integer code;

    /**
     * 状态描述
     */
    private final String description;

    KeyStatus(Integer code, String description) {
        this.code = code;
        this.description = description;
    }

    @Override
    public String getCode() {
        return String.valueOf(code);
    }

    @Override
    public String getDesc() {
        return description;
    }

    public Integer getCodeInt() {
        return code;
    }

    public String getDescription() {
        return description;
    }

    /**
     * 根据code获取枚举
     */
    public static KeyStatus of(Integer code) {
        for (KeyStatus status : values()) {
            if (status.code.equals(code)) {
                return status;
            }
        }
        throw new IllegalArgumentException("未知的密钥状态: " + code);
    }
}
