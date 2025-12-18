package com.luohuo.flex.im.domain.enums;

/**
 * 申请阅读状态枚举
 * @author nyh
 */
public enum ApplyReadStatusEnum {

    UNREAD(1, "未读"),

    READ(2, "已读");

    private final Integer code;

    private final String desc;
    ApplyReadStatusEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }
    public Integer getCode() {
        return code;
    }
    public String getDesc() {
        return desc;
    }}
