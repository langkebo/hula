package com.luohuo.flex.im.domain.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
public enum RecoveryType {

    /**
     * 密码恢复
     */
    PASSWORD("PASSWORD", "密码恢复"),

    /**
     * 安全问题恢复
     */
    SECURITY_QUESTION("SECURITY_QUESTION", "安全问题恢复"),

    /**
     * 邮箱恢复
     */
    EMAIL("EMAIL", "邮箱恢复"),

    /**
     * 手机号恢复
     */
    PHONE("PHONE", "手机号恢复"),

    /**
     * 管理员恢复
     */
    ADMIN("ADMIN", "管理员恢复");

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

    RecoveryType(String code, String description) {
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
    public static RecoveryType of(String code) {
        for (RecoveryType type : values()) {
            if (type.code.equals(code)) {
                return type;
            }
        }
        throw new IllegalArgumentException("未知的恢复类型: " + code);
    }

    /**
     * 根据code创建枚举（兼容性方法）
     */
    public static RecoveryType fromCode(String code) {
        return of(code);
    }
}
