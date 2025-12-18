package com.luohuo.flex.im.domain.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import com.luohuo.basic.interfaces.BaseEnum;

/**
 * 密钥包状态枚举
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
public enum KeyPackageStatus implements BaseEnum {

    /**
     * 待消费
     */
    PENDING(1, "待消费"),

    /**
     * 已消费
     */
    CONSUMED(2, "已消费"),

    /**
     * 激活状态
     */
    ACTIVE(5, "激活"),

    /**
     * 已过期
     */
    EXPIRED(3, "已过期"),

    /**
     * 已废弃
     */
    REVOKED(4, "已废弃");

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

    KeyPackageStatus(Integer code, String description) {
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
    public static KeyPackageStatus of(Integer code) {
        for (KeyPackageStatus status : values()) {
            if (status.code.equals(code)) {
                return status;
            }
        }
        throw new IllegalArgumentException("未知的密钥包状态: " + code);
    }
}
