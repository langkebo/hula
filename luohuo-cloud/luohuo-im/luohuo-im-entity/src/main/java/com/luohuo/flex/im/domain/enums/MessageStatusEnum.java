package com.luohuo.flex.im.domain.enums;

import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 消息状态
 * @author nyh
 */
public enum MessageStatusEnum {
    NORMAL(0, "正常"),
    DELETE(1, "删除"),
    ;

    private final Integer status;
    private final String desc;
    MessageStatusEnum(Integer status, String desc) {
        this.status = status;
        this.desc = desc;
    }
    public Integer getStatus() {
        return status;
    }
    public String getDesc() {
        return desc;
    }

    private static Map<Integer, MessageStatusEnum> cache;

    static {
        cache = Arrays.stream(MessageStatusEnum.values()).collect(Collectors.toMap(MessageStatusEnum::getStatus, Function.identity()));
    }

    public static MessageStatusEnum of(Integer type) {
        return cache.get(type);
    }}
