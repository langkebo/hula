package com.luohuo.flex.im.domain.enums;

/**
 * 密钥恢复类型枚举
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
public enum RecoveryType {

    /**
     * 密钥丢失
     */
    LOST_KEY("LOST_KEY", "密钥丢失"),

    /**
     * 密钥损坏
     */
    CORRUPTED_KEY("CORRUPTED_KEY", "密钥损坏"),

    /**
     * 设备更换
     */
    DEVICE_CHANGE("DEVICE_CHANGE", "设备更换"),

    /**
     * 账号恢复
     */
    ACCOUNT_RECOVERY("ACCOUNT_RECOVERY", "账号恢复"),

    /**
     * 紧急恢复
     */
    EMERGENCY_RECOVERY("EMERGENCY_RECOVERY", "紧急恢复");

    private final String code;
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
     * 根据代码获取枚举
     */
    public static RecoveryType fromCode(String code) {
        for (RecoveryType type : values()) {
            if (type.getCode().equals(code)) {
                return type;
            }
        }
        throw new IllegalArgumentException("未知的恢复类型: " + code);
    }
}