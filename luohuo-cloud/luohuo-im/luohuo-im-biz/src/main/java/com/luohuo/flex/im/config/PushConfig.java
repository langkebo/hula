package com.luohuo.flex.im.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import lombok.Data;

/**
 * 推送配置
 *
 * @author HuLa
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "im.push")
public class PushConfig {

    /**
     * APNs配置
     */
    private ApnsConfig apns = new ApnsConfig();

    /**
     * FCM配置
     */
    private FcmConfig fcm = new FcmConfig();

    /**
     * 华为推送配置
     */
    private HuaweiConfig huawei = new HuaweiConfig();

    /**
     * 小米推送配置
     */
    private XiaomiConfig xiaomi = new XiaomiConfig();

    /**
     * OPPO推送配置
     */
    private OppoConfig oppo = new OppoConfig();

    /**
     * vivo推送配置
     */
    private VivoConfig vivo = new VivoConfig();

    @Data
    public static class ApnsConfig {
        /**
         * 是否启用
         */
        private boolean enabled = false;

        /**
         * 生产环境
         */
        private boolean production = false;

        /**
         * 证书路径
         */
        private String certPath;

        /**
         * 证书密码
         */
        private String certPassword;

        /**
         * Team ID
         */
        private String teamId;

        /**
         * Key ID
         */
        private String keyId;

        /**
         * Bundle ID
         */
        private String bundleId;
    }

    @Data
    public static class FcmConfig {
        /**
         * 是否启用
         */
        private boolean enabled = false;

        /**
         * 服务账号密钥文件路径
         */
        private String keyPath;

        /**
         * 数据库URL
         */
        private String databaseUrl;

        /**
         * 项目ID
         */
        private String projectId;
    }

    @Data
    public static class HuaweiConfig {
        /**
         * 是否启用
         */
        private boolean enabled = false;

        /**
         * App ID
         */
        private String appId;

        /**
         * App Secret
         */
        private String appSecret;

        /**
         * 消息回执地址
         */
        private String callbackUrl;
    }

    @Data
    public static class XiaomiConfig {
        /**
         * 是否启用
         */
        private boolean enabled = false;

        /**
         * App Secret
         */
        private String appSecret;

        /**
         * 包名
         */
        private String packageName;
    }

    @Data
    public static class OppoConfig {
        /**
         * 是否启用
         */
        private boolean enabled = false;

        /**
         * App Key
         */
        private String appKey;

        /**
         * App Secret
         */
        private String appSecret;

        /**
         * Master Secret
         */
        private String masterSecret;
    }

    @Data
    public static class VivoConfig {
        /**
         * 是否启用
         */
        private boolean enabled = false;

        /**
         * App ID
         */
        private String appId;

        /**
         * App Key
         */
        private String appKey;

        /**
         * App Secret
         */
        private String appSecret;
    }
}