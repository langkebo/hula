package com.luohuo.flex.im.common.enums;


import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;


/**
 * ws前端请求类型枚举
 * @author nyh
 */
public enum YesOrNoEnum {
    NO(false,0, "否"),
    YES(true,1, "是"),
    ;

	private final Boolean bool;
    private final Integer status;
    private final String desc;
    YesOrNoEnum(Boolean bool, Integer status, String desc) {
        this.bool = bool;
        this.status = status;
        this.desc = desc;
    }
    public Boolean getBool() {
        return bool;
    }
    public Integer getStatus() {
        return status;
    }
    public String getDesc() {
        return desc;
    }

    private static Map<Integer, YesOrNoEnum> cache;

    static {
        cache = Arrays.stream(YesOrNoEnum.values()).collect(Collectors.toMap(YesOrNoEnum::getStatus, Function.identity()));
    }

    public static YesOrNoEnum of(Integer type) {
        return cache.get(type);
    }

    public static Integer toStatus(Boolean bool) {
        return bool ? YES.getStatus() : NO.getStatus();
    }
}
