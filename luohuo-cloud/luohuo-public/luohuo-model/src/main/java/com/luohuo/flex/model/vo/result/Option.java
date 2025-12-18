package com.luohuo.flex.model.vo.result;

import io.swagger.v3.oas.annotations.media.Schema;
import com.luohuo.basic.interfaces.BaseEnum;

import java.util.Arrays;
import java.util.List;

/**
 * @author tangyh
 * @version v1.0
 * @date 2021/4/28 12:15 上午
 * @create [2021/4/28 12:15 上午 ] [tangyh] [初始创建]
 */
@Schema(description = "下拉、多选组件选项")
public class Option {
    private String label;
    private String text;
    private String value;
    private String color;


    public static List<Option> mapOptions(BaseEnum[] values) {
        return Arrays.stream(values)
                .map(item -> new Option(item.getDesc(), item.getDesc(), item.getCode(), item.getExtra()))
                .toList();
    }

    public Option() {}
    public Option(String label, String text, String value, String color) {
        this.label = label;
        this.text = text;
        this.value = value;
        this.color = color;
    }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
}
