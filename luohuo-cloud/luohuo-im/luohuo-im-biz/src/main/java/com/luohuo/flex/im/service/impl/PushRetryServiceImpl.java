package com.luohuo.flex.im.service.impl;

import com.luohuo.flex.im.push.PushProvider;
import com.luohuo.flex.im.push.PushType;
import com.luohuo.flex.im.service.PushRetryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * 推送重试服务实现
 *
 * @author HuLa
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PushRetryServiceImpl implements PushRetryService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final Map<PushType, PushProvider> pushProviders;

    // 重试任务Redis key前缀
    private static final String RETRY_TASK_PREFIX = "push:retry:task:";
    // 最大重试次数
    private static final int MAX_RETRY_COUNT = 3;
    // 重试间隔（分钟）
    private static final int[] RETRY_INTERVALS = {1, 5, 15}; // 第1次1分钟，第2次5分钟，第3次15分钟

    @Override
    public void addRetryTask(String pushType, String deviceToken, String title,
                            String content, Map<String, Object> extra, int retryCount) {
        if (retryCount >= MAX_RETRY_COUNT) {
            log.warn("Push retry reached max count: {}, device: {}", retryCount, deviceToken);
            return;
        }

        try {
            // 构建重试任务
            Map<String, Object> task = new HashMap<>();
            task.put("pushType", pushType);
            task.put("deviceToken", deviceToken);
            task.put("title", title);
            task.put("content", content);
            task.put("extra", extra);
            task.put("retryCount", retryCount);
            task.put("createTime", LocalDateTime.now().toString());

            // 计算下次重试时间
            int delayMinutes = RETRY_INTERVALS[Math.min(retryCount, RETRY_INTERVALS.length - 1)];
            String taskKey = RETRY_TASK_PREFIX + System.currentTimeMillis() + ":" + deviceToken;

            // 存储重试任务
            redisTemplate.opsForValue().set(taskKey, task, delayMinutes, TimeUnit.MINUTES);

            log.info("Added push retry task: {}, retryCount: {}, nextRetryIn: {} minutes",
                    deviceToken, retryCount, delayMinutes);

        } catch (Exception e) {
            log.error("Failed to add push retry task: {}", deviceToken, e);
        }
    }

    @Override
    @Scheduled(fixedRate = 60000) // 每分钟执行一次
    public void processRetryTasks() {
        try {
            Set<String> keys = redisTemplate.keys(RETRY_TASK_PREFIX + "*");
            if (keys == null || keys.isEmpty()) {
                return;
            }

            log.debug("Processing {} push retry tasks", keys.size());

            for (String key : keys) {
                try {
                    Object taskObj = redisTemplate.opsForValue().get(key);
                    if (taskObj instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> task = (Map<String, Object>) taskObj;

                        String pushTypeStr = (String) task.get("pushType");
                        String deviceToken = (String) task.get("deviceToken");
                        String title = (String) task.get("title");
                        String content = (String) task.get("content");
                        @SuppressWarnings("unchecked")
                        Map<String, Object> extra = (Map<String, Object>) task.get("extra");
                        Integer retryCount = (Integer) task.get("retryCount");

                        // 获取推送提供者
                        PushType pushType = PushType.valueOf(pushTypeStr);
                        PushProvider provider = pushProviders.get(pushType);

                        if (provider != null) {
                            boolean success = provider.push(deviceToken, title, content, extra);

                            if (success) {
                                // 推送成功，删除重试任务
                                redisTemplate.delete(key);
                                log.info("Push retry success: {}, device: {}, retryCount: {}",
                                        pushType, deviceToken, retryCount);
                            } else {
                                // 推送失败，增加重试次数
                                int newRetryCount = retryCount + 1;
                                if (newRetryCount < MAX_RETRY_COUNT) {
                                    addRetryTask(pushTypeStr, deviceToken, title, content, extra, newRetryCount);
                                }
                                // 删除当前任务
                                redisTemplate.delete(key);
                            }
                        }
                    }
                } catch (Exception e) {
                    log.error("Failed to process retry task: {}", key, e);
                    // 删除异常的任务
                    redisTemplate.delete(key);
                }
            }

        } catch (Exception e) {
            log.error("Failed to process push retry tasks", e);
        }
    }

    @Override
    @Scheduled(cron = "0 0 3 * * ?") // 每天凌晨3点执行
    public void cleanupExpiredTasks() {
        try {
            Set<String> keys = redisTemplate.keys(RETRY_TASK_PREFIX + "*");
            if (keys != null && !keys.isEmpty()) {
                long deletedCount = redisTemplate.delete(keys);
                log.info("Cleaned up {} expired push retry tasks", deletedCount);
            }
        } catch (Exception e) {
            log.error("Failed to cleanup expired push retry tasks", e);
        }
    }

    @Override
    public Map<String, Object> getRetryStatistics() {
        Map<String, Object> statistics = new HashMap<>();

        try {
            Set<String> keys = redisTemplate.keys(RETRY_TASK_PREFIX + "*");
            int totalRetryTasks = keys != null ? keys.size() : 0;

            // 统计各推送类型的重试任务数
            Map<String, Integer> typeCount = new HashMap<>();
            if (keys != null) {
                for (String key : keys) {
                    Object taskObj = redisTemplate.opsForValue().get(key);
                    if (taskObj instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> task = (Map<String, Object>) taskObj;
                        String pushType = (String) task.get("pushType");
                        typeCount.put(pushType, typeCount.getOrDefault(pushType, 0) + 1);
                    }
                }
            }

            statistics.put("totalRetryTasks", totalRetryTasks);
            statistics.put("maxRetryCount", MAX_RETRY_COUNT);
            statistics.put("retryTasksByType", typeCount);

        } catch (Exception e) {
            log.error("Failed to get retry statistics", e);
            statistics.put("error", e.getMessage());
        }

        return statistics;
    }
}