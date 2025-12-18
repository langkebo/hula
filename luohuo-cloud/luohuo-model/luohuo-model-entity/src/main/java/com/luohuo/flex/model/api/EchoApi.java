package com.luohuo.flex.model.api;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Echo API 响应")
public class EchoApi {
    @Schema(description = "消息")
    private String message;

    @Schema(description = "时间戳")
    private Long timestamp;

    @Schema(description = "状态码")
    private Integer code;
}
