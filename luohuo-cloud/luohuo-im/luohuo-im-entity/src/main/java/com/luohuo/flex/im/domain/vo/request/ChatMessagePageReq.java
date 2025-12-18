package com.luohuo.flex.im.domain.vo.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;import lombok.NoArgsConstructor;
import com.luohuo.flex.im.domain.vo.req.CursorPageBaseReq;


/**
 * 消息列表请求
 * @author nyh
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ChatMessagePageReq extends CursorPageBaseReq {
    @NotNull
    @Schema(description ="会话id")
    private Long roomId;

	@Builder.Default
	private Boolean skip = false;
}
