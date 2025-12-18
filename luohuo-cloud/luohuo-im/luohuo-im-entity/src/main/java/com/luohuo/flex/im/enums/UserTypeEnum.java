package com.luohuo.flex.im.enums;

import cn.hutool.core.util.ArrayUtil;

import java.util.Arrays;

public enum UserTypeEnum  {
	SYSTEM(1, "系统用户"),
	BOT(2, "机器人"),
	NORMAL(3, "普通用户");

    public static final Integer[] ARRAYS = Arrays.stream(values()).map(UserTypeEnum::getValue).toArray(Integer[]::new);

    /**
     * 类型
     */
    private final Integer value;
    /**
     * 类型名
     */
    private final String name;
    UserTypeEnum(Integer value, String name) {
        this.value = value;
        this.name = name;
    }
    public Integer getValue() {
        return value;
    }
    public String getName() {
        return name;
    }

    public static UserTypeEnum valueOf(Integer value) {
        return ArrayUtil.firstMatch(userType -> userType.getValue().equals(value), UserTypeEnum.values());
    }

    public Integer[] array() {
        return ARRAYS;
    }}
