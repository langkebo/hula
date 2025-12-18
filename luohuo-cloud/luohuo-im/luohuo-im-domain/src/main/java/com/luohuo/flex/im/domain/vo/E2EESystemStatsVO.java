package com.luohuo.flex.im.domain.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * E2EE系统统计VO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class E2EESystemStatsVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 总公钥数量
     */
    private Long totalPublicKeys;

    /**
     * 活跃公钥数量
     */
    private Long activePublicKeys;

    /**
     * 过期公钥数量
     */
    private Long expiredPublicKeys;

    /**
     * 总加密消息数量
     */
    private Long totalEncryptedMessages;

    /**
     * 今日加密消息数量
     */
    private Long todayEncryptedMessages;

    /**
     * 总会话密钥包数量
     */
    private Long totalSessionKeyPackages;

    /**
     * 活跃会话密钥包数量
     */
    private Long activeSessionKeyPackages;

    /**
     * 启用E2EE的用户数
     */
    private Long enabledUserCount;

    /**
     * 平均加密延迟(ms)
     */
    private Double avgEncryptionLatency;

    /**
     * 平均解密延迟(ms)
     */
    private Double avgDecryptionLatency;

    /**
     * 错误率(%)
     */
    private Double errorRate;

    /**
     * 缓存命中率(%)
     */
    private Double cacheHitRate;

    /**
     * 统计时间
     */
    private LocalDateTime statisticsTime;

    /**
     * 系统健康状态
     */
    private String healthStatus; // HEALTHY, WARNING, ERROR

    /**
     * 额外信息
     */
    private String additionalInfo;
}
