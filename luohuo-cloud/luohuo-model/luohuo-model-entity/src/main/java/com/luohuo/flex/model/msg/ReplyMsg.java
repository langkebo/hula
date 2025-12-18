package com.luohuo.flex.model.msg;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "回复消息")
public class ReplyMsg {
    @Schema(description = "回复消息ID")
    private Long messageId;

    @Schema(description = "被回复的消息ID")
    private Long replyToId;

    @Schema(description = "回复内容")
    private String content;

    @Schema(description = "扩展信息")
    private Map<String, Object> extra;
}
