package com.luohuo.flex.im.domain.enums;

import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 物品类型枚举
 * @author nyh
 */
public enum ItemTypeEnum {
    MODIFY_NAME_CARD(1, "改名卡"),
    BADGE(2, "徽章"),
    ;

    private final Integer type;
    private final String desc;
    ItemTypeEnum(Integer type, String desc) {
        this.type = type;
        this.desc = desc;
    }
    public Integer getType() {
        return type;
    }
    public String getDesc() {
        return desc;
    }

    private static Map<Integer, ItemTypeEnum> cache;

    static {
        cache = Arrays.stream(ItemTypeEnum.values()).collect(Collectors.toMap(ItemTypeEnum::getType, Function.identity()));
    }

    public static ItemTypeEnum of(Integer type) {
        return cache.get(type);
    }}
