package com.luohuo.flex.im.controller.e2ee;

import com.luohuo.basic.base.R;
import com.luohuo.flex.im.core.e2ee.service.E2EEFeatureToggle;
import com.luohuo.flex.im.core.e2ee.service.E2EEKeyService;
import com.luohuo.flex.im.core.e2ee.service.E2EEMessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * E2EE管理控制器
 *
 * 功能：
 * 1. 灰度发布管理
 * 2. 功能开关控制
 * 3. 系统维护操作
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@RestController
@RequestMapping("/e2ee/admin")
@RequiredArgsConstructor
@Tag(name = "E2EE管理接口", description = "E2EE功能管理和维护接口（需要管理员权限）")
public class E2EEAdminController {

    private final E2EEFeatureToggle featureToggle;
    private final E2EEKeyService keyService;
    private final E2EEMessageService messageService;

    /**
     * 获取功能开关状态
     */
    @GetMapping("/feature-toggle/status")
    
    @Operation(summary = "获取功能开关状态", description = "查看E2EE功能的开关和灰度配置状态")
    public R<E2EEFeatureToggle.FeatureToggleStatus> getFeatureToggleStatus() {
        log.info("查询E2EE功能开关状态");
        E2EEFeatureToggle.FeatureToggleStatus status = featureToggle.getStatus();
        return R.success(status);
    }

    /**
     * 设置全局开关
     */
    @PostMapping("/feature-toggle/global")
    
    @Operation(summary = "设置全局开关", description = "开启或关闭E2EE功能")
    public R<Void> setGlobalEnabled(@Parameter(description = "是否启用") @RequestParam boolean enabled) {
        log.info("设置E2EE全局开关: {}", enabled);
        featureToggle.setGlobalEnabled(enabled);
        return R.success();
    }

    /**
     * 设置灰度百分比
     */
    @PostMapping("/feature-toggle/rollout")
    
    @Operation(summary = "设置灰度百分比", description = "设置E2EE功能的灰度发布百分比（0-100）")
    public R<Void> setRolloutPercentage(@Parameter(description = "灰度百分比") @RequestParam int percentage) {
        log.info("设置E2EE灰度百分比: {}%", percentage);
        if (percentage < 0 || percentage > 100) {
            return R.fail("灰度百分比必须在0-100之间");
        }
        featureToggle.setRolloutPercentage(percentage);
        return R.success();
    }

    /**
     * 添加用户到白名单
     */
    @PostMapping("/feature-toggle/whitelist/{userId}")
    
    @Operation(summary = "添加白名单用户", description = "将用户添加到E2EE白名单（强制启用）")
    public R<Void> addToWhitelist(@Parameter(description = "用户ID") @PathVariable Long userId) {
        log.info("添加用户到E2EE白名单: {}", userId);
        featureToggle.addToWhitelist(userId);
        return R.success();
    }

    /**
     * 从白名单移除用户
     */
    @DeleteMapping("/feature-toggle/whitelist/{userId}")
    
    @Operation(summary = "移除白名单用户", description = "将用户从E2EE白名单移除")
    public R<Void> removeFromWhitelist(@Parameter(description = "用户ID") @PathVariable Long userId) {
        log.info("从E2EE白名单移除用户: {}", userId);
        featureToggle.removeFromWhitelist(userId);
        return R.success();
    }

    /**
     * 添加用户到黑名单
     */
    @PostMapping("/feature-toggle/blacklist/{userId}")
    
    @Operation(summary = "添加黑名单用户", description = "将用户添加到E2EE黑名单（强制禁用）")
    public R<Void> addToBlacklist(@Parameter(description = "用户ID") @PathVariable Long userId) {
        log.info("添加用户到E2EE黑名单: {}", userId);
        featureToggle.addToBlacklist(userId);
        return R.success();
    }

    /**
     * 从黑名单移除用户
     */
    @DeleteMapping("/feature-toggle/blacklist/{userId}")
    
    @Operation(summary = "移除黑名单用户", description = "将用户从E2EE黑名单移除")
    public R<Void> removeFromBlacklist(@Parameter(description = "用户ID") @PathVariable Long userId) {
        log.info("从E2EE黑名单移除用户: {}", userId);
        featureToggle.removeFromBlacklist(userId);
        return R.success();
    }

    /**
     * 批量清理过期数据
     */
    @PostMapping("/maintenance/cleanup")
    
    @Operation(summary = "批量清理过期数据", description = "清理过期的密钥和消息")
    public R<Map<String, Integer>> batchCleanup() {
        log.info("执行E2EE批量清理任务");
        Map<String, Integer> result = new HashMap<>();

        try {
            // 清理过期密钥
            int expiredKeys = keyService.cleanupExpiredKeys();
            result.put("expiredKeys", expiredKeys);

            // 清理过期消息
            int expiredMessages = messageService.cleanupExpiredMessages();
            result.put("expiredMessages", expiredMessages);

            log.info("E2EE批量清理完成: {}", result);
            return R.success(result);
        } catch (Exception e) {
            log.error("E2EE批量清理失败", e);
            return R.fail("清理失败: " + e.getMessage());
        }
    }

    /**
     * 获取系统统计信息
     */
    @GetMapping("/stats")
    @Operation(summary = "获取系统统计", description = "获取E2EE系统的统计信息")
    public R<Map<String, Object>> getStats() {
        log.info("查询E2EE系统统计信息");
        Map<String, Object> stats = new HashMap<>();

        // 返回默认统计值
        stats.put("totalPublicKeys", 0L);
        stats.put("totalEncryptedMessages", 0L);
        stats.put("activeUsers", 0L);
        stats.put("todayNewKeys", 0L);
        stats.put("todayEncryptedMessages", 0L);
        stats.put("keyAlgorithmDistribution", new HashMap<>());
        stats.put("messageContentTypeDistribution", new HashMap<>());
        stats.put("featureToggleStatus", featureToggle.getStatus());

        return R.success(stats);
    }

    /**
     * 检查用户是否启用E2EE
     */
    @GetMapping("/feature-toggle/check/{userId}")
    
    @Operation(summary = "检查用户E2EE状态", description = "检查指定用户是否启用了E2EE功能")
    public R<Map<String, Object>> checkUserE2EEStatus(@Parameter(description = "用户ID") @PathVariable Long userId) {
        log.info("检查用户E2EE状态: {}", userId);

        Map<String, Object> result = new HashMap<>();
        result.put("userId", userId);
        result.put("e2eeEnabled", featureToggle.isE2EEEnabledForUser(userId));
        result.put("globalEnabled", featureToggle.isGlobalEnabled());
        result.put("inWhitelist", featureToggle.isInWhitelist(userId));
        result.put("inBlacklist", featureToggle.isInBlacklist(userId));
        result.put("rolloutPercentage", featureToggle.getRolloutPercentage());

        return R.success(result);
    }
}
