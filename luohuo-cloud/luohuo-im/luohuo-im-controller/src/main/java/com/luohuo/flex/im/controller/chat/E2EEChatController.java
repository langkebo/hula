package com.luohuo.flex.im.controller.chat;

import com.luohuo.basic.base.R;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.flex.im.core.chat.service.E2EEChatService;
import com.luohuo.flex.im.domain.vo.CursorPageBaseResp;
import com.luohuo.flex.im.domain.vo.request.EncryptedChatMessageReq;
import com.luohuo.flex.model.entity.ws.ChatMessageResp;
import com.luohuo.flex.im.domain.vo.response.EncryptedChatMessageResp;
import com.luohuo.flex.im.domain.vo.response.EncryptedMessageResp;
import com.luohuo.flex.im.domain.vo.response.EncryptedMessageListItemVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

/**
 * 端到端加密聊天控制器
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@RestController
@RequestMapping("/chat/e2ee")
@RequiredArgsConstructor
@Validated
@Tag(name = "端到端加密聊天接口", description = "端到端加密聊天相关接口")
public class E2EEChatController {

    private final E2EEChatService e2eeChatService;

    @PostMapping("/msg")
    @Operation(summary = "发送加密消息", description = "发送端到端加密的聊天消息")
    public R<ChatMessageResp> sendEncryptedMsg(@Valid @RequestBody EncryptedChatMessageReq request) {
        log.info("发送加密消息，用户: {}, 房间: {}", ContextUtil.getUid(), request.getRoomId());

        // 发送加密消息
        Long msgId = e2eeChatService.sendEncryptedMessage(request, ContextUtil.getUid());

        // 获取消息响应
        ChatMessageResp resp = e2eeChatService.getEncryptedMessageResp(msgId, ContextUtil.getUid());

        return R.success(resp);
    }

    @GetMapping("/msg/{msgId}")
    @Operation(summary = "获取加密消息", description = "获取指定的加密消息详情")
    public R<EncryptedChatMessageResp> getEncryptedMessage(
            @Parameter(description = "消息ID") @PathVariable Long msgId) {
        log.info("获取加密消息，用户: {}, 消息ID: {}", ContextUtil.getUid(), msgId);

        // 获取消息响应
        ChatMessageResp resp = e2eeChatService.getEncryptedMessageResp(msgId, ContextUtil.getUid());

        // 转换为加密消息响应
        EncryptedChatMessageResp encryptedResp = EncryptedChatMessageResp.from(resp);

        return R.success(encryptedResp);
    }

    @PostMapping("/msg/{msgId}/read")
    @Operation(summary = "标记消息为已读", description = "接收方阅读消息时调用，触发自毁倒计时重新计算")
    public R<Void> markMessageAsRead(
            @Parameter(description = "消息ID") @PathVariable Long msgId,
            @Parameter(description = "阅读时间戳（毫秒）") @RequestParam Long readAt) {
        log.info("标记消息为已读，用户: {}, 消息ID: {}, 阅读时间: {}", ContextUtil.getUid(), msgId, readAt);

        // 调用服务层标记消息为已读
        e2eeChatService.markMessageAsRead(msgId, readAt, ContextUtil.getUid());

        return R.success();
    }

    @GetMapping("/conversations/{conversationId}/messages")
    @Operation(summary = "分页获取会话加密消息", description = "使用游标分页获取指定会话的加密消息列表")
    public R<CursorPageBaseResp<EncryptedMessageListItemVO>> getMessagesByConversation(
            @Parameter(description = "会话ID") @PathVariable String conversationId,
            @Parameter(description = "游标（消息ID）") @RequestParam(required = false) Long cursor,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") Integer limit) {
        log.info("获取会话 {} 的加密消息，游标: {}, 限制: {}", conversationId, cursor, limit);

        // 限制每页最大数量
        if (limit > 100) {
            limit = 100;
        }

        CursorPageBaseResp<EncryptedMessageListItemVO> messages =
            e2eeChatService.getMessagesByConversation(conversationId, cursor, limit, ContextUtil.getUid());

        return R.success(messages);
    }
}