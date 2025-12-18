package com.luohuo.flex.im.domain.vo.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 聊天信息点播
 * @author nyh
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ChatMessageReq {
    @NotNull
    @Schema(description ="房间id")
    private Long roomId;

    @Schema(description ="消息类型")
    @NotNull
    private Integer msgType;

    @Schema(description ="消息内容，类型不同传值不同")
    @NotNull
    private Object body;

	@Schema(description ="跳过消息校验")
	@Builder.Default
	private boolean skip = false;

	@Schema(description ="临时消息 [前端需要传过来]")
	@Builder.Default
	private boolean isTemp = false;

	@Schema(description ="系统推送消息")
	@Builder.Default
	private boolean isPushMessage = false;

    public Long getRoomId() {
        return roomId;
    }
    public void setRoomId(Long roomId) {
        this.roomId = roomId;
    }
    public Integer getMsgType() {
        return msgType;
    }
    public void setMsgType(Integer msgType) {
        this.msgType = msgType;
    }
    public Object getBody() {
        return body;
    }
    public void setBody(Object body) {
        this.body = body;
    }
    public boolean isSkip() {
        return skip;
    }
    public void setSkip(boolean skip) {
        this.skip = skip;
    }
    public boolean isTemp() {
        return isTemp;
    }
    public void setTemp(boolean temp) {
        this.isTemp = temp;
    }
    public boolean isPushMessage() {
        return isPushMessage;
    }
    public void setPushMessage(boolean pushMessage) {
        this.isPushMessage = pushMessage;
    }
}
