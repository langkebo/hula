package com.luohuo.flex.im.controller.e2ee;

import com.luohuo.basic.base.R;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.flex.im.core.e2ee.service.E2EEKeyService;
import com.luohuo.flex.im.core.e2ee.service.E2EEBatchService;
import com.luohuo.flex.im.core.e2ee.service.E2EEMessageService;
import com.luohuo.flex.im.domain.dto.SessionKeyPackageDTO;
import com.luohuo.flex.im.domain.dto.BatchGetPublicKeysDTO;
import com.luohuo.flex.im.domain.dto.UploadPublicKeyDTO;
import com.luohuo.flex.im.domain.dto.SaveEncryptedMessageDTO;
import com.luohuo.flex.im.domain.dto.VerifySignatureRequestDTO;
import com.luohuo.flex.im.domain.vo.CursorPageBaseResp;
import com.luohuo.flex.im.domain.vo.EncryptedMessageResp;
import com.luohuo.flex.im.domain.vo.UserPublicKeyVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Base64;

/**
 * 端到端加密控制器
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@RestController
@RequestMapping("/e2ee")
@RequiredArgsConstructor
@Validated
@Tag(name = "端到端加密接口", description = "端到端加密相关接口")
public class E2EEController {

    private final E2EEKeyService e2eeKeyService;
    private final E2EEBatchService e2eeBatchService;
    private final E2EEMessageService e2eeMessageService;

    @PostMapping("/keys/upload")
    @Operation(summary = "上传用户公钥", description = "用户上传自己的RSA公钥用于端到端加密")
    public R<Void> uploadPublicKey(@Valid @RequestBody UploadPublicKeyDTO dto) {
        log.info("用户 {} 上传公钥，密钥ID: {}", ContextUtil.getUid(), dto.getKeyId());
        e2eeKeyService.uploadUserPublicKey(dto);
        return R.success();
    }

    @GetMapping("/keys/{userId}")
    @Operation(summary = "获取用户公钥", description = "获取指定用户的公钥用于加密消息")
    public R<UserPublicKeyVO> getUserPublicKey(
            @Parameter(description = "用户ID") @PathVariable Long userId,
            @Parameter(description = "密钥ID") @RequestParam(required = false) String keyId) {
        log.info("获取用户 {} 的公钥，密钥ID: {}", userId, keyId);
        UserPublicKeyVO publicKey = e2eeKeyService.getUserPublicKey(userId, keyId);
        return R.success(publicKey);
    }

    @GetMapping("/keys/{userId}/all")
    @Operation(summary = "获取用户所有公钥", description = "获取指定用户的所有有效公钥")
    public R<List<UserPublicKeyVO>> getAllUserPublicKeys(
            @Parameter(description = "用户ID") @PathVariable Long userId) {
        log.info("获取用户 {} 的所有公钥", userId);
        List<UserPublicKeyVO> publicKeys = e2eeKeyService.getUserPublicKeys(userId);
        return R.success(publicKeys);
    }

    @PostMapping("/keys/batch")
    @Operation(summary = "批量获取用户公钥", description = "批量获取多个用户的公钥信息")
    public R<java.util.Map<Long, java.util.List<UserPublicKeyVO>>> batchGetPublicKeys(
            @Valid @RequestBody BatchGetPublicKeysDTO dto) {
        log.info("批量获取用户公钥，请求用户数量: {}", dto.getUserIds().size());
        java.util.Map<Long, java.util.List<UserPublicKeyVO>> result = e2eeBatchService.batchGetPublicKeys(dto);
        return R.success(result);
    }

    @GetMapping("/keys/fingerprint/{fingerprint}")
    @Operation(summary = "根据指纹获取公钥", description = "根据公钥指纹获取公钥信息")
    public R<UserPublicKeyVO> getPublicKeyByFingerprint(
            @Parameter(description = "公钥指纹") @PathVariable String fingerprint) {
        log.info("根据指纹 {} 获取公钥", fingerprint);
        UserPublicKeyVO publicKey = e2eeKeyService.getPublicKeyByFingerprint(fingerprint);
        return R.success(publicKey);
    }

    @PostMapping("/sessions/{sessionId}/key-package")
    @Operation(summary = "分发会话密钥包", description = "向指定用户分发加密的会话密钥")
    public R<Void> distributeKeyPackage(
            @Parameter(description = "会话ID") @PathVariable String sessionId,
            @Valid @RequestBody SessionKeyPackageDTO dto) {
        log.info("分发密钥包，会话ID: {}, 接收者: {}", sessionId, dto.getRecipientId());
        e2eeMessageService.distributeSessionKey(dto);
        return R.success();
    }

    @GetMapping("/sessions/key-packages/pending")
    @Operation(summary = "获取待接收的密钥包", description = "获取当前用户待接收的密钥包列表")
    public R<List<SessionKeyPackageDTO>> getPendingKeyPackages() {
        log.info("获取用户 {} 的待接收密钥包", ContextUtil.getUid());
        List<SessionKeyPackageDTO> packages = e2eeMessageService.getPendingKeyPackages(ContextUtil.getUid());
        return R.success(packages);
    }

    @PostMapping("/messages")
    @Operation(summary = "发送加密消息", description = "发送端到端加密的消息")
    public R<Long> sendEncryptedMessage(@Valid @RequestBody SaveEncryptedMessageDTO dto) {
        log.info("发送加密消息，会话ID: {}, 接收者: {}", dto.getConversationId(), dto.getRecipientId());
        Long messageId = e2eeMessageService.saveEncryptedMessage(dto);
        return R.success(messageId);
    }

    @GetMapping("/messages/{messageId}/extra")
    @Operation(summary = "获取加密消息扩展信息", description = "返回加密消息的扩展字段(encryptedExtra)")
    public R<String> getEncryptedMessageExtra(
            @Parameter(description = "消息ID") @PathVariable Long messageId) {
        String extra = e2eeMessageService.getEncryptedMessageExtra(messageId);
        return R.success(extra);
    }

    @GetMapping("/messages/{conversationId}")
    @Operation(summary = "获取加密消息列表", description = "分页获取指定会话的加密消息")
    public R<CursorPageBaseResp<EncryptedMessageResp>> getEncryptedMessages(
            @Parameter(description = "会话ID") @PathVariable String conversationId,
            @Parameter(description = "游标") @RequestParam(required = false) Long cursor,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") Integer limit) {
        log.info("获取会话 {} 的加密消息，游标: {}, 限制: {}", conversationId, cursor, limit);
        CursorPageBaseResp<EncryptedMessageResp> messages =
            e2eeMessageService.getEncryptedMessages(conversationId, cursor, limit);
        return R.success(messages);
    }

    @PostMapping("/messages/{messageId}/verify")
    @Operation(summary = "验证消息签名", description = "验证指定消息的签名有效性")
    public R<Boolean> verifyMessageSignature(
            @Parameter(description = "消息ID") @PathVariable Long messageId,
            @Valid @RequestBody VerifySignatureRequestDTO dto) {
        log.info("验证消息 {} 的签名", messageId);
        boolean valid = e2eeMessageService.verifyMessageSignature(messageId, dto.getSignatureBytes());
        return R.success(valid);
    }

    @PostMapping("/cleanup/keys")
    @Operation(summary = "清理过期密钥", description = "清理所有过期的公钥")
    public R<Integer> cleanupExpiredKeys() {
        log.info("开始清理过期密钥");
        int count = e2eeKeyService.cleanupExpiredKeys();
        log.info("清理过期密钥完成，共清理 {} 个", count);
        return R.success(count);
    }

    @PostMapping("/cleanup/messages")
    @Operation(summary = "清理过期消息", description = "清理指定天数前的加密消息")
    public R<Integer> cleanupExpiredMessages(
            @Parameter(description = "保留天数") @RequestParam(defaultValue = "30") Integer days) {
        log.info("开始清理 {} 天前的加密消息", days);
        int count = e2eeMessageService.cleanupExpiredMessages();
        log.info("清理过期消息完成，共清理 {} 个", count);
        return R.success(count);
    }

    @GetMapping("/status")
    @Operation(summary = "获取E2EE状态", description = "获取当前用户的端到端加密状态")
    public R<E2EEStatusVO> getE2EEStatus() {
        Long userId = ContextUtil.getUid();
        log.info("获取用户 {} 的E2EE状态", userId);
        E2EEStatusVO status = new E2EEStatusVO();

        // 获取用户的公钥数量
        List<UserPublicKeyVO> publicKeys = e2eeKeyService.getUserPublicKeys(userId);
        status.setPublicKeyCount(publicKeys.size());
        status.setHasValidKey(publicKeys.stream().anyMatch(UserPublicKeyVO::getValid));

        // 设置默认统计信息
        status.setEncryptedMessageCount(0L);
        status.setActiveConversationCount(0L);

        return R.success(status);
    }

    /**
     * 验证签名请求DTO
     */
    public static class VerifySignatureRequestDTO {
        private String signature;

        public String getSignature() {
            return signature;
        }

        public void setSignature(String signature) {
            this.signature = signature;
        }

        public byte[] getSignatureBytes() {
            return signature != null ? Base64.getDecoder().decode(signature) : null;
        }
    }

    /**
     * E2EE状态响应VO
     */
    public static class E2EEStatusVO {
        private Integer publicKeyCount;
        private Boolean hasValidKey;
        private Long encryptedMessageCount;
        private Long activeConversationCount;

        public Integer getPublicKeyCount() {
            return publicKeyCount;
        }

        public void setPublicKeyCount(Integer publicKeyCount) {
            this.publicKeyCount = publicKeyCount;
        }

        public Boolean getHasValidKey() {
            return hasValidKey;
        }

        public void setHasValidKey(Boolean hasValidKey) {
            this.hasValidKey = hasValidKey;
        }

        public Long getEncryptedMessageCount() {
            return encryptedMessageCount;
        }

        public void setEncryptedMessageCount(Long encryptedMessageCount) {
            this.encryptedMessageCount = encryptedMessageCount;
        }

        public Long getActiveConversationCount() {
            return activeConversationCount;
        }

        public void setActiveConversationCount(Long activeConversationCount) {
            this.activeConversationCount = activeConversationCount;
        }
    }
}
