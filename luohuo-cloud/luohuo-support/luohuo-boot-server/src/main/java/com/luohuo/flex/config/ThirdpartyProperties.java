package com.luohuo.flex.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "thirdparty")
public class ThirdpartyProperties {
    private Tencent tencent = new Tencent();
    private Youdao youdao = new Youdao();
    private Wechat wechat = new Wechat();

    public Tencent getTencent() { return tencent; }
    public void setTencent(Tencent tencent) { this.tencent = tencent; }
    public Youdao getYoudao() { return youdao; }
    public void setYoudao(Youdao youdao) { this.youdao = youdao; }
    public Wechat getWechat() { return wechat; }
    public void setWechat(Wechat wechat) { this.wechat = wechat; }

    public static class Tencent {
        private String secretId;
        private String secretKey;
        private String mapKey;

        public String getSecretId() { return secretId; }
        public void setSecretId(String secretId) { this.secretId = secretId; }
        public String getSecretKey() { return secretKey; }
        public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
        public String getMapKey() { return mapKey; }
        public void setMapKey(String mapKey) { this.mapKey = mapKey; }
    }

    public static class Youdao {
        private String appKey;
        private String appSecret;

        public String getAppKey() { return appKey; }
        public void setAppKey(String appKey) { this.appKey = appKey; }
        public String getAppSecret() { return appSecret; }
        public void setAppSecret(String appSecret) { this.appSecret = appSecret; }
    }

    public static class Wechat {
        private String appId;
        private String appSecret;
        private String token;
        private String aesKey;
        private String callback;

        public String getAppId() { return appId; }
        public void setAppId(String appId) { this.appId = appId; }
        public String getAppSecret() { return appSecret; }
        public void setAppSecret(String appSecret) { this.appSecret = appSecret; }
        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
        public String getAesKey() { return aesKey; }
        public void setAesKey(String aesKey) { this.aesKey = aesKey; }
        public String getCallback() { return callback; }
        public void setCallback(String callback) { this.callback = callback; }
    }
}

