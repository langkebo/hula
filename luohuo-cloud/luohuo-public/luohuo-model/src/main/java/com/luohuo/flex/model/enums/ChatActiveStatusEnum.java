package com.luohuo.flex.model.enums;


import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 *  ws前端请求类型枚举
 * @author nyh
 */
public enum ChatActiveStatusEnum {
    ONLINE(1, "在线"),
    OFFLINE(2, "离线"),
    ;

    private final Integer status;
    private final String desc;

    private ChatActiveStatusEnum(Integer status, String desc) {
        this.status = status;
        this.desc = desc;
    }

    private static Map<Integer, ChatActiveStatusEnum> cache;

    static {
        cache = Arrays.stream(ChatActiveStatusEnum.values()).collect(Collectors.toMap(ChatActiveStatusEnum::getStatus, Function.identity()));
    }

    public static ChatActiveStatusEnum of(Integer type) {
        return cache.get(type);
    }

    public Integer getStatus() { return status; }
    public String getDesc() { return desc; }
}
