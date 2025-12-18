package com.luohuo.flex.im.domain.enums;

import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 角色枚举
 * @author nyh
 */
public enum RoleTypeEnum {

    ADMIN(1L, "超级管理员"),
    CHAT_MANAGER(2L, "HuLa群聊管理"),
    ;

    private final Long id;

    private final String desc;
    RoleTypeEnum(Long id, String desc) {
        this.id = id;
        this.desc = desc;
    }
    public Long getId() {
        return id;
    }
    public String getDesc() {
        return desc;
    }

    private final static Map<Long, RoleTypeEnum> CACHE;

    static {
        CACHE = Arrays.stream(RoleTypeEnum.values()).collect(Collectors.toMap(RoleTypeEnum::getId, Function.identity()));
    }

    public static RoleTypeEnum of(Long type) {
        return CACHE.get(type);
    }}
