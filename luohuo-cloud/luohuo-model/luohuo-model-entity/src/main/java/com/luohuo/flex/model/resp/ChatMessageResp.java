package com.luohuo.flex.model.resp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "聊天消息响应")
public class ChatMessageResp {
    @Schema(description = "消息ID")
    private Long id;

    @Schema(description = "消息内容")
    private String content;

    @Schema(description = "发送者名称")
    private String senderName;

    @Schema(description = "发送时间")
    private LocalDateTime sendTime;

    @Schema(description = "消息类型")
    private Integer messageType;

    @Schema(description = "发送者ID")
    private Long senderId;

    @Schema(description = "房间ID")
    private Long roomId;
}
