package com.luohuo.flex.im.domain.enums;

import lombok.Getter;

/**
 * 群组成员状态枚举
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Getter
public enum GroupMemberStatusEnum {

    NORMAL(1, "正常"),
    MUTED(2, "禁言"),
    KICKED(3, "踢出"),
    LEFT(4, "已退出");

    private final Integer code;
    private final String desc;

    GroupMemberStatusEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static GroupMemberStatusEnum getByCode(Integer code) {
        if (code == null) {
            return null;
        }
        for (GroupMemberStatusEnum status : values()) {
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