package com.luohuo.flex.oauth.controller;

import cn.dev33.satoken.stp.StpUtil;
import com.luohuo.basic.base.R;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Token心跳控制器
 *
 * ===== P1修复: Token活跃超时 - 心跳接口 (2025-12-13) =====
 *
 * 功能:
 * 1. 提供轻量级心跳接口，保持Token活跃
 * 2. 前端定期调用此接口(建议5分钟)，防止活跃超时
 * 3. SA-Token会自动续期Token，无需手动处理
 *
 * 使用场景:
 * - 用户正在浏览页面但长时间无操作
 * - 用户正在查看文档、视频等静态内容
 * - 需要保持登录状态但无API调用
 *
 * @author HuLa Team
 * @since 2025-12-13
 */
@Slf4j
@RestController
@RequestMapping("/api/token")
@RequiredArgsConstructor
@Tag(name = "Token管理", description = "Token心跳和刷新相关接口")
public class TokenHeartbeatController {

    /**
     * Token心跳接口
     *
     * 前端定期调用此接口，保持Token活跃状态，防止活跃超时(15分钟)失效
     *
     * **调用频率建议**:
     * - 开发环境: 每5分钟
     * - 生产环境: 每5-10分钟
     * - 高安全系统: 每3分钟
     *
     * **前端实现示例**:
     * ```typescript
     * // 定期心跳
     * setInterval(async () => {
     *   try {
     *     await fetch('/api/token/heartbeat', {
     *       headers: { 'Authorization': `Bearer ${token}` }
     *     });
     *     console.log('Token心跳成功');
     *   } catch (error) {
     *     console.error('Token心跳失败，可能已过期');
     *     // 跳转到登录页
     *   }
     * }, 5 * 60 * 1000);  // 5分钟
     * ```
     *
     * **工作原理**:
     * 1. 验证Token有效性
     * 2. SA-Token自动续期Token (如果配置了is-auto-renew=true)
     * 3. 更新Token的最后活跃时间
     * 4. 返回成功响应
     *
     * @return 成功响应
     */
    @GetMapping("/heartbeat")
    @Operation(
            summary = "Token心跳",
            description = "保持Token活跃，防止超时失效。前端应定期调用此接口(建议5分钟)。"
    )
    public R<TokenHeartbeatVO> heartbeat() {
        // SA-Token自动验证登录状态和续期
        StpUtil.checkLogin();

        // 获取Token信息
        long timeout = StpUtil.getTokenTimeout();  // 剩余有效时间(秒)
        String loginId = StpUtil.getLoginIdAsString();
        String device = StpUtil.getLoginDevice();

        log.debug("Token心跳成功: loginId={}, device={}, 剩余={}秒", loginId, device, timeout);

        return R.success(TokenHeartbeatVO.builder()
                .success(true)
                .message("Token已续期")
                .remainingTime(timeout)
                .loginId(loginId)
                .device(device)
                .build());
    }

    /**
     * 获取Token状态
     *
     * 查询当前Token的详细状态信息，包括:
     * - 是否已登录
     * - Token剩余有效时间
     * - 活跃超时剩余时间
     * - 登录设备信息
     *
     * @return Token状态信息
     */
    @GetMapping("/status")
    @Operation(
            summary = "获取Token状态",
            description = "查询当前Token的详细状态信息，包括剩余时间、设备信息等"
    )
    public R<TokenStatusVO> getTokenStatus() {
        // 检查是否登录
        boolean isLogin = StpUtil.isLogin();

        if (!isLogin) {
            return R.success(TokenStatusVO.builder()
                    .isLogin(false)
                    .message("未登录")
                    .build());
        }

        // 获取Token详细信息
        String loginId = StpUtil.getLoginIdAsString();
        String tokenValue = StpUtil.getTokenValue();
        String device = StpUtil.getLoginDevice();
        long timeout = StpUtil.getTokenTimeout();  // Token总超时
        long sessionTimeout = StpUtil.getTokenSessionTimeout();  // Session超时

        // 计算活跃超时剩余时间 (需要从Session中获取最后活跃时间)
        // SA-Token没有直接提供API，这里简化处理
        long activeTimeoutRemaining = Math.min(timeout, 900);  // 假设活跃超时为900秒(15分钟)

        return R.success(TokenStatusVO.builder()
                .isLogin(true)
                .loginId(loginId)
                .tokenValue(maskToken(tokenValue))  // 脱敏处理
                .device(device)
                .remainingTime(timeout)
                .activeTimeoutRemaining(activeTimeoutRemaining)
                .sessionTimeout(sessionTimeout)
                .message("Token有效")
                .build());
    }

    /**
     * 简单Token健康检查
     *
     * 最轻量级的接口，仅验证Token是否有效
     * 不返回详细信息，适合高频调用
     *
     * @return 是否有效
     */
    @GetMapping("/ping")
    @Operation(
            summary = "Token健康检查",
            description = "最轻量级的Token验证接口，仅返回是否有效"
    )
    public R<Boolean> ping() {
        boolean isLogin = StpUtil.isLogin();
        return R.success(isLogin);
    }

    // ========== 辅助方法 ==========

    /**
     * Token脱敏处理
     * 只显示前8位和后4位
     */
    private String maskToken(String token) {
        if (token == null || token.length() < 12) {
            return "****";
        }
        return token.substring(0, 8) + "****" + token.substring(token.length() - 4);
    }

    // ========== 内部VO类 ==========

    /**
     * Token心跳响应VO
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class TokenHeartbeatVO {
        /** 是否成功 */
        private Boolean success;

        /** 响应消息 */
        private String message;

        /** Token剩余有效时间(秒) */
        private Long remainingTime;

        /** 登录ID */
        private String loginId;

        /** 登录设备 */
        private String device;
    }

    /**
     * Token状态响应VO
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class TokenStatusVO {
        /** 是否已登录 */
        private Boolean isLogin;

        /** 登录ID */
        private String loginId;

        /** Token值(脱敏) */
        private String tokenValue;

        /** 登录设备 */
        private String device;

        /** Token总剩余时间(秒) */
        private Long remainingTime;

        /** 活跃超时剩余时间(秒) */
        private Long activeTimeoutRemaining;

        /** Session超时时间(秒) */
        private Long sessionTimeout;

        /** 状态消息 */
        private String message;
    }
}
