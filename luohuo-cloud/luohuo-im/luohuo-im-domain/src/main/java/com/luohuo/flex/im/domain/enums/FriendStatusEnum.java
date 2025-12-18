package com.luohuo.flex.im.domain.enums;

import lombok.Getter;

/**
 * 好友状态枚举
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Getter
public enum FriendStatusEnum {

    NORMAL(1, "正常"),
    BLACKLISTED(2, "拉黑"),
    DELETED(3, "删除"),
    PENDING(4, "待验证");

    private final Integer code;
    private final String desc;

    FriendStatusEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static FriendStatusEnum getByCode(Integer code) {
        if (code == null) {
            return null;
        }
        for (FriendStatusEnum status : values()) {
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