package com.luohuo.flex.im.domain.enums;

import java.util.stream.Stream;

/**
 * 转发类型的枚举
 *
 * @author 乾乾
 */
public enum MergeTypeEnum {

	SINGLE(1, "单一转发"),
	MERGE(2, "合并转发");

	private final Integer type;
	private final String desc;
    MergeTypeEnum(Integer type, String desc) {
        this.type = type;
        this.desc = desc;
    }
    public Integer getType() {
        return type;
    }
    public String getDesc() {
        return desc;
    }

	/**
	 * 根据当前枚举的name匹配
	 */
	public static MergeTypeEnum match(Integer val) {
		return Stream.of(values()).parallel().filter(item -> item.getType().equals(val)).findAny().orElse(SINGLE);
	}

	public static MergeTypeEnum get(Integer val) {
		return match(val);
	}}
