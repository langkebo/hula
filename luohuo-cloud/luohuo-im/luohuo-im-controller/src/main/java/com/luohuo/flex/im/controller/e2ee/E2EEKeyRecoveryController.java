package com.luohuo.flex.im.controller.e2ee;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.luohuo.basic.base.R;
import com.luohuo.flex.im.core.e2ee.service.E2EEKeyRecoveryService;
import com.luohuo.flex.im.domain.dto.*;
import com.luohuo.flex.im.domain.vo.KeyRecoveryDataVO;
import com.luohuo.flex.im.domain.vo.KeyRecoveryRequestVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * E2EE密钥恢复控制器
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@RestController
@RequestMapping("/e2ee/recovery")
@RequiredArgsConstructor
@Tag(name = "E2EE密钥恢复", description = "端到端加密密钥恢复相关接口")
public class E2EEKeyRecoveryController {

    private final E2EEKeyRecoveryService keyRecoveryService;

    /**
     * 创建密钥恢复请求
     */
    @PostMapping("/request")
    @Operation(summary = "创建密钥恢复请求", description = "用户创建密钥恢复请求")
    public R<KeyRecoveryRequestVO> createRecoveryRequest(
            @Validated @RequestBody CreateKeyRecoveryDTO dto) {
        try {
            KeyRecoveryRequestVO result = keyRecoveryService.createRecoveryRequest(dto);
            return R.success(result);
        } catch (Exception e) {
            log.error("创建密钥恢复请求失败", e);
            return R.fail(e.getMessage());
        }
    }

    /**
     * 验证恢复请求
     */
    @PostMapping("/verify")
    @Operation(summary = "验证恢复请求", description = "通过令牌验证恢复请求")
    public R<KeyRecoveryRequestVO> verifyRecoveryRequest(
            @Validated @RequestBody VerifyRecoveryDTO dto) {
        try {
            KeyRecoveryRequestVO result = keyRecoveryService.verifyRecoveryRequest(dto);
            return R.success(result);
        } catch (Exception e) {
            log.error("验证恢复请求失败", e);
            return R.fail(e.getMessage());
        }
    }

    /**
     * 执行密钥恢复
     */
    @PostMapping("/recover")
    @Operation(summary = "执行密钥恢复", description = "验证通过后执行密钥恢复")
    public R<KeyRecoveryDataVO> recoverKey(
            @Validated @RequestBody RecoverKeyDTO dto) {
        try {
            KeyRecoveryDataVO result = keyRecoveryService.recoverKey(dto);
            return R.success(result);
        } catch (Exception e) {
            log.error("执行密钥恢复失败", e);
            return R.fail(e.getMessage());
        }
    }

    /**
     * 查询用户的恢复请求
     */
    @GetMapping("/requests")
    @Operation(summary = "查询用户的恢复请求", description = "分页查询当前用户的恢复请求历史")
    public R<IPage<KeyRecoveryRequestVO>> getUserRecoveryRequests(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "密钥ID") @RequestParam(required = false) String keyId) {
        try {
            IPage<KeyRecoveryRequestVO> result = keyRecoveryService.getUserRecoveryRequests(page, size, keyId);
            return R.success(result);
        } catch (Exception e) {
            log.error("查询恢复请求失败", e);
            return R.fail(e.getMessage());
        }
    }

    /**
     * 管理员查询待审核的恢复请求
     */
    @GetMapping("/admin/pending")
    
    @Operation(summary = "查询待审核请求", description = "管理员查询待审核的恢复请求")
    public R<IPage<KeyRecoveryRequestVO>> getPendingRecoveryRequests(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "恢复类型") @RequestParam(required = false) String recoveryType) {
        try {
            IPage<KeyRecoveryRequestVO> result = keyRecoveryService.getPendingRecoveryRequests(page, size, recoveryType);
            return R.success(result);
        } catch (Exception e) {
            log.error("查询待审核恢复请求失败", e);
            return R.fail(e.getMessage());
        }
    }

    /**
     * 管理员审核恢复请求
     */
    @PostMapping("/admin/review/{requestId}")
    
    @Operation(summary = "审核恢复请求", description = "管理员审核恢复请求")
    public R<Void> reviewRecoveryRequest(
            @Parameter(description = "请求ID") @PathVariable Long requestId,
            @Validated @RequestBody ReviewRecoveryDTO dto) {
        try {
            keyRecoveryService.reviewRecoveryRequest(requestId, dto);
            return R.success();
        } catch (Exception e) {
            log.error("审核恢复请求失败", e);
            return R.fail(e.getMessage());
        }
    }

    /**
     * 取消恢复请求
     */
    @PostMapping("/cancel/{requestId}")
    @Operation(summary = "取消恢复请求", description = "用户取消自己的恢复请求")
    public R<Void> cancelRecoveryRequest(
            @Parameter(description = "请求ID") @PathVariable Long requestId) {
        try {
            // 这里需要实现取消逻辑
            // keyRecoveryService.cancelRecoveryRequest(requestId);
            return R.success();
        } catch (Exception e) {
            log.error("取消恢复请求失败", e);
            return R.fail(e.getMessage());
        }
    }

    /**
     * 获取恢复请求详情
     */
    @GetMapping("/request/{requestId}")
    @Operation(summary = "获取恢复请求详情", description = "获取指定恢复请求的详细信息")
    public R<KeyRecoveryRequestVO> getRecoveryRequest(
            @Parameter(description = "请求ID") @PathVariable Long requestId) {
        try {
            // 这里需要实现获取详情逻辑
            // KeyRecoveryRequestVO result = keyRecoveryService.getRecoveryRequest(requestId);
            // return R.success(result);
            return R.fail("功能待实现");
        } catch (Exception e) {
            log.error("获取恢复请求详情失败", e);
            return R.fail(e.getMessage());
        }
    }
}