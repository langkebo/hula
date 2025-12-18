package com.luohuo.flex.im.domain.enums;

import lombok.Getter;

/**
 * 群组角色枚举
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Getter
public enum GroupRoleEnum {

    MEMBER(1, "普通成员"),
    ADMIN(2, "管理员"),
    OWNER(3, "群主");

    private final Integer code;
    private final String desc;

    GroupRoleEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public static GroupRoleEnum getByCode(Integer code) {
        if (code == null) {
            return null;
        }
        for (GroupRoleEnum role : values()) {
            if (role.getCode().equals(code)) {
                return role;
            }
        }
        return null;
    }

    public Integer getCode() {
        return this.code;
    }
}