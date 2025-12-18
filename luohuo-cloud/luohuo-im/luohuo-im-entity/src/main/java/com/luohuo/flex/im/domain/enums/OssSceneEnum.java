package com.luohuo.flex.im.domain.enums;

import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 场景枚举
 * @author nyh
 */
public enum OssSceneEnum {
    CHAT("chat", "聊天", "/chat"),
    EMOJI("emoji", "表情包", "/emoji"),
    AVATAR("avatar", "头像", "/avatar"),
    ;

    private final String type;
    private final String desc;
    private final String path;
    OssSceneEnum(String type, String desc, String path) {
        this.type = type;
        this.desc = desc;
        this.path = path;
    }
    public String getType() {
        return type;
    }
    public String getDesc() {
        return desc;
    }
    public String getPath() {
        return path;
    }

    private static final Map<String, OssSceneEnum> cache;

    static {
        cache = Arrays.stream(OssSceneEnum.values()).collect(Collectors.toMap(OssSceneEnum::getType, Function.identity()));
    }

    public static OssSceneEnum of(String type) {
        return cache.get(type);
    }}
