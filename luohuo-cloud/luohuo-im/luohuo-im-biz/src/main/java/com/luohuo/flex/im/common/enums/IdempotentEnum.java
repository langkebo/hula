package com.luohuo.flex.im.common.enums;


import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;


/**
 * 幂等类型
 * @author nyh
 */
public enum IdempotentEnum {
    UID(1, "uid"),
    MSG_ID(2, "消息id"),
    ;

    private final Integer type;
    private final String desc;
    IdempotentEnum(Integer type, String desc) {
        this.type = type;
        this.desc = desc;
    }
    public Integer getType() {
        return type;
    }
    public String getDesc() {
        return desc;
    }

    private static Map<Integer, IdempotentEnum> cache;

    static {
        cache = Arrays.stream(IdempotentEnum.values()).collect(Collectors.toMap(IdempotentEnum::getType, Function.identity()));
    }

    public static IdempotentEnum of(Integer type) {
        return cache.get(type);
    }
}
