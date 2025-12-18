package com.luohuo.flex.im.domain.enums;

/**
 * 密钥恢复状态枚举
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
public enum RecoveryStatus {

    /**
     * 待处理
     */
    PENDING("PENDING", "待处理"),

    /**
     * 待验证
     */
    PENDING_VERIFICATION("PENDING_VERIFICATION", "待验证"),

    /**
     * 验证中
     */
    VERIFYING("VERIFYING", "验证中"),

    /**
     * 已批准
     */
    APPROVED("APPROVED", "已批准"),

    /**
     * 已拒绝
     */
    REJECTED("REJECTED", "已拒绝"),

    /**
     * 处理中
     */
    PROCESSING("PROCESSING", "处理中"),

    /**
     * 已完成
     */
    COMPLETED("COMPLETED", "已完成"),

    /**
     * 已取消
     */
    CANCELLED("CANCELLED", "已取消"),

    /**
     * 已过期
     */
    EXPIRED("EXPIRED", "已过期"),

    /**
     * 失败
     */
    FAILED("FAILED", "失败");

    private final String code;
    private final String description;

    RecoveryStatus(String code, String description) {
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
    public static RecoveryStatus fromCode(String code) {
        for (RecoveryStatus status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        throw new IllegalArgumentException("未知的恢复状态: " + code);
    }

    /**
     * 是否是终态
     */
    public boolean isFinal() {
        return this == COMPLETED || this == CANCELLED || this == EXPIRED || this == FAILED;
    }

    /**
     * 是否可以取消
     */
    public boolean isCancellable() {
        return this == PENDING || this == PENDING_VERIFICATION;
    }
}