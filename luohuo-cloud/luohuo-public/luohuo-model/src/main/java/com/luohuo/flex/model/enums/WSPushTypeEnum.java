package com.luohuo.flex.model.enums;


import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * @author nyh
 */
public enum WSPushTypeEnum {
    USER(1, "个人"),
    ALL(2, "全部连接用户"),
    ;

    private final Integer type;
    private final String desc;

    private WSPushTypeEnum(Integer type, String desc) {
        this.type = type;
        this.desc = desc;
    }

    private static final Map<Integer, WSPushTypeEnum> cache;

    static {
        cache = Arrays.stream(WSPushTypeEnum.values()).collect(Collectors.toMap(WSPushTypeEnum::getType, Function.identity()));
    }

    public static WSPushTypeEnum of(Integer type) {
        return cache.get(type);
    }

    public Integer getType() { return type; }
    public String getDesc() { return desc; }
}
