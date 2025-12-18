package com.luohuo.flex.im.domain.enums;

import java.util.stream.Stream;

/**
 * 朋友圈的枚举
 *
 * @author 乾乾
 */
public enum FeedEnum {

    WORD(0, "纯文字"),
	IMAGE(1, "图片"),
	VIDEO(2, "视频");

	/**
	 * 根据当前枚举的name匹配
	 */
	public static FeedEnum match(Integer val) {
		return Stream.of(values()).parallel().filter(item -> item.getType().equals(val)).findAny().orElse(WORD);
	}

	public static FeedEnum get(Integer val) {
		return match(val);
	}

    /**
     * 朋友圈类型
     */
    private final Integer type;
    private final String name;
    FeedEnum(Integer type, String name) {
        this.type = type;
        this.name = name;
    }
    public Integer getType() {
        return type;
    }
    public String getName() {
        return name;
    }}
