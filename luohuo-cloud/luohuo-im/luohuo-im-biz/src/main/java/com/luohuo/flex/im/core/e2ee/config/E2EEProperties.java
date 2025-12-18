package com.luohuo.flex.im.core.e2ee.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * E2EE配置属性
 *
 * 配置项：
 * - 加密算法设置
 * - 密钥管理策略
 * - 性能优化参数
 * - 安全策略
 *
 * 配置前缀: e2ee
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "e2ee")
public class E2EEProperties {

    /**
     * 是否启用E2EE功能
     */
    private boolean enabled = true;

    /**
     * 加密相关配置
     */
    private Encryption encryption = new Encryption();

    /**
     * 密钥管理配置
     */
    private KeyManagement keyManagement = new KeyManagement();

    /**
     * 缓存配置
     */
    private Cache cache = new Cache();

    /**
     * 性能配置
     */
    private Performance performance = new Performance();

    /**
     * 安全策略配置
     */
    private Security security = new Security();

    /**
     * 审计配置
     */
    private Audit audit = new Audit();

    @Data
    public static class Encryption {
        /**
         * 默认加密算法
         */
        private String defaultAlgorithm = "AES-GCM";

        /**
         * AES密钥长度（位）
         */
        private int aesKeySize = 256;

        /**
         * RSA密钥长度（位）
         */
        private int rsaKeySize = 2048;

        /**
         * 是否要求消息签名
         */
        private boolean requireSignature = false;

        /**
         * 签名算法
         */
        private String signatureAlgorithm = "RSA-PSS";

        /**
         * IV长度（字节）
         */
        private int ivLength = 12;

        /**
         * 认证标签长度（字节）
         */
        private int tagLength = 16;
    }

    @Data
    public static class KeyManagement {
        /**
         * 密钥有效期（天）
         */
        private int keyValidityDays = 365;

        /**
         * 密钥自动��换周期（天）
         */
        private int keyRotationDays = 90;

        /**
         * 是否启用自动密钥轮换
         */
        private boolean autoRotation = false;

        /**
         * 会话密钥包有效期（小时）
         */
        private int sessionKeyValidityHours = 24;

        /**
         * 每个用户最多保存的公钥数量
         */
        private int maxPublicKeysPerUser = 5;

        /**
         * 密钥备份保留天数
         */
        private int backupRetentionDays = 730;
    }

    @Data
    public static class Cache {
        /**
         * 是否启用缓存
         */
        private boolean enabled = true;

        /**
         * 公钥缓存过期时间
         */
        private Duration publicKeyTtl = Duration.ofDays(30);

        /**
         * 会话密钥缓存过期时间
         */
        private Duration sessionKeyTtl = Duration.ofHours(24);

        /**
         * 本地缓存最大条目数
         */
        private int localCacheMaxSize = 1000;

        /**
         * 是否启用预热
         */
        private boolean warmupEnabled = true;

        /**
         * 预热热点用户数量
         */
        private int warmupHotUserCount = 100;
    }

    @Data
    public static class Performance {
        /**
         * 批量查询最大数量
         */
        private int batchQueryMaxSize = 100;

        /**
         * 异步处理阈值（消息数）
         */
        private int asyncProcessThreshold = 10;

        /**
         * 数据库查询超时（毫秒）
         */
        private int dbQueryTimeout = 5000;

        /**
         * Redis操作超时（毫秒）
         */
        private int redisTimeout = 3000;

        /**
         * 是否启用性能监控
         */
        private boolean metricsEnabled = true;
    }

    @Data
    public static class Security {
        /**
         * 是否要求强制签名验证
         */
        private boolean requireSignature = false;

        /**
         * 是否验证消息哈希
         */
        private boolean verifyContentHash = true;

        /**
         * 是否检测重放攻击
         */
        private boolean replayDetectionEnabled = true;

        /**
         * 重放检测窗口期（分钟）
         */
        private int replayWindowMinutes = 5;

        /**
         * 密钥恢复最大尝试次数
         */
        private int maxRecoveryAttempts = 3;

        /**
         * 密钥恢复令牌有效期（小时）
         */
        private int recoveryTokenValidityHours = 24;

        /**
         * 是否要求多因素认证进行密钥恢复
         */
        private boolean requireMfaForRecovery = true;
    }

    @Data
    public static class Audit {
        /**
         * 是否启用审计日志
         */
        private boolean enabled = true;

        /**
         * 审计日志保留天数
         */
        private int retentionDays = 90;

        /**
         * 是否记录详细审计信息
         */
        private boolean detailedLogging = true;

        /**
         * 是否异步写入审计日志
         */
        private boolean asyncWrite = true;

        /**
         * 需要审计的操作类型
         */
        private String[] auditActions = {
            "KEY_UPLOAD", "KEY_ROTATION", "KEY_REVOKE",
            "MESSAGE_ENCRYPT", "MESSAGE_DECRYPT",
            "RECOVERY_REQUEST", "RECOVERY_APPROVE", "RECOVERY_COMPLETE"
        };
    }

    /**
     * 验证配置
     */
    public void validate() {
        if (encryption.aesKeySize != 128 && encryption.aesKeySize != 192 && encryption.aesKeySize != 256) {
            throw new IllegalArgumentException("AES密钥长度必须是128、192或256位");
        }

        if (encryption.rsaKeySize < 2048) {
            throw new IllegalArgumentException("RSA密钥长度不能小于2048位");
        }

        if (keyManagement.keyValidityDays <= 0) {
            throw new IllegalArgumentException("密钥有效期必须大于0天");
        }

        if (cache.localCacheMaxSize <= 0) {
            throw new IllegalArgumentException("本地缓存大小必须大于0");
        }
    }
}
