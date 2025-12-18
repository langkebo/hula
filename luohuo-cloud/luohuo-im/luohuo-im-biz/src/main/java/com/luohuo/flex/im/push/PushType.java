package com.luohuo.flex.im.push;

/**
 * 推送类型
 *
 * @author HuLa
 */
public enum PushType {
    /**
     * APNs (Apple Push Notification Service)
     */
    APNS,

    /**
     * FCM (Firebase Cloud Messaging)
     */
    FCM,

    /**
     * 华为推送
     */
    HUAWEI,

    /**
     * 小米推送
     */
    XIAOMI,

    /**
     * OPPO推送
     */
    OPPO,

    /**
     * vivo推送
     */
    VIVO
}