package com.luohuo.flex.im.core.e2ee;

import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * E2EE指标统计类
 * 用于收集和存储端到端加密相关的性能指标
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class E2EEMetrics implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 总加密消息数
     */
    @Builder.Default
    private AtomicLong totalEncryptedMessages = new AtomicLong(0);

    /**
     * 总解密消息数
     */
    @Builder.Default
    private AtomicLong totalDecryptedMessages = new AtomicLong(0);

    /**
     * 加密失败数
     */
    @Builder.Default
    private AtomicLong encryptionFailures = new AtomicLong(0);

    /**
     * 解密失败数
     */
    @Builder.Default
    private AtomicLong decryptionFailures = new AtomicLong(0);

    /**
     * 平均加密时间（毫秒）
     */
    private double avgEncryptionTimeMs;

    /**
     * 平均解密时间（毫秒）
     */
    private double avgDecryptionTimeMs;

    /**
     * 算法使用统计
     */
    private Map<String, AtomicLong> algorithmUsage;

    /**
     * 最后更新时间
     */
    private LocalDateTime lastUpdateTime;

    /**
     * 成功率
     */
    public double getSuccessRate() {
        long total = totalEncryptedMessages.get() + totalDecryptedMessages.get();
        long failures = encryptionFailures.get() + decryptionFailures.get();
        return total == 0 ? 0.0 : (double) (total - failures) / total * 100;
    }

    /**
     * 增加加密计数
     */
    public void incrementEncryptedMessages() {
        totalEncryptedMessages.incrementAndGet();
        lastUpdateTime = LocalDateTime.now();
    }

    /**
     * 增加解密计数
     */
    public void incrementDecryptedMessages() {
        totalDecryptedMessages.incrementAndGet();
        lastUpdateTime = LocalDateTime.now();
    }

    /**
     * 增加加密失败计数
     */
    public void incrementEncryptionFailures() {
        encryptionFailures.incrementAndGet();
        lastUpdateTime = LocalDateTime.now();
    }

    /**
     * 增加解密失败计数
     */
    public void incrementDecryptionFailures() {
        decryptionFailures.incrementAndGet();
        lastUpdateTime = LocalDateTime.now();
    }

    /**
     * 更新加密时间
     */
    public void updateEncryptionTime(long timeMs) {
        // 简单的移动平均
        avgEncryptionTimeMs = (avgEncryptionTimeMs + timeMs) / 2;
        lastUpdateTime = LocalDateTime.now();
    }

    /**
     * 更新解密时间
     */
    public void updateDecryptionTime(long timeMs) {
        // 简单的移动平均
        avgDecryptionTimeMs = (avgDecryptionTimeMs + timeMs) / 2;
        lastUpdateTime = LocalDateTime.now();
    }
}