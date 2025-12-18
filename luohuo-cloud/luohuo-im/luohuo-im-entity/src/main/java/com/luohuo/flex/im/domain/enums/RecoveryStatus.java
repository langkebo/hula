package com.luohuo.flex.im.domain.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import com.luohuo.basic.interfaces.BaseEnum;

/**
 * 恢复状态枚举
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
public enum RecoveryStatus implements BaseEnum {

    /**
     * 待审核
     */
    PENDING(1, "待审核"),

    /**
     * 待验证
     */
    PENDING_VERIFICATION(6, "待验证"),

    /**
     * 审核通过
     */
    APPROVED(2, "审核通过"),

    /**
     * 已过期
     */
    EXPIRED(7, "已过期"),

    /**
     * 已完成
     */
    COMPLETED(8, "已完成"),

    /**
     * 审核拒绝
     */
    REJECTED(3, "审核拒绝"),

    /**
     * 恢复成功
     */
    RECOVERED(4, "恢复成功"),

    /**
     * 恢复失败
     */
    FAILED(5, "恢复失败");

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

    RecoveryStatus(Integer code, String description) {
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
     * 检查是否为最终状态
     */
    public boolean isFinal() {
        return this == RECOVERED || this == FAILED || this == COMPLETED;
    }

    /**
     * 根据code获取枚举
     */
    public static RecoveryStatus of(Integer code) {
        for (RecoveryStatus status : values()) {
            if (status.code.equals(code)) {
                return status;
            }
        }
        throw new IllegalArgumentException("未知的恢复状态: " + code);
    }
}
