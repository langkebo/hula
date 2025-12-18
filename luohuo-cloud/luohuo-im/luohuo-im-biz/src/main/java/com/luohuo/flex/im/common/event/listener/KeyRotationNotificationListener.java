package com.luohuo.flex.im.common.event.listener;

import com.luohuo.flex.im.core.e2ee.service.SessionKeyRotationService.KeyRotationNotificationEvent;
import com.luohuo.flex.im.core.user.service.impl.PushService;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import static com.luohuo.flex.im.common.config.ThreadPoolConfig.LUOHUO_EXECUTOR;

/**
 * 密钥轮换通知事件监听器
 * 负责将密钥轮换通知通过WebSocket推送给目标用户
 *
 * @author HuLa Team
 * @since 2025-12-13
 */
@Slf4j
@Component
public class KeyRotationNotificationListener {

    @Resource
    private PushService pushService;

    /**
     * 处理密钥轮换通知事件
     * 异步推送WebSocket消息给目标用户
     */
    @Async(LUOHUO_EXECUTOR)
    @EventListener
    public void onKeyRotationNotification(KeyRotationNotificationEvent event) {
        log.info("收到密钥轮换通知事件，目标用户: {}", event.getTargetUsers());

        try {
            if (event.getTargetUsers() == null || event.getTargetUsers().isEmpty()) {
                log.warn("密钥轮换通知事件没有目标用户");
                return;
            }

            // 通过PushService推送WebSocket消息
            pushService.sendPushMsg(event.getWsMessage(), event.getTargetUsers(), null);

            log.info("密钥轮换通知已推送，目标用户数: {}", event.getTargetUsers().size());

        } catch (Exception e) {
            log.error("推送密钥轮换通知失败", e);
        }
    }
}
