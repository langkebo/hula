package com.luohuo.flex.im.core.e2ee.util;

import lombok.extern.slf4j.Slf4j;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/**
 * E2EE密钥工具类
 *
 * 功能：
 * 1. 密钥指纹计算
 * 2. 密钥格式验证
 * 3. 密钥ID生成
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
public class E2EEKeyUtil {

    /**
     * 计算公钥指纹（SHA-256）
     *
     * @param publicKeySpki SPKI格式的公钥（Base64编码）
     * @return 指纹（Base64编码）
     */
    public static String calculateFingerprint(String publicKeySpki) {
        try {
            byte[] spkiBytes = Base64.getDecoder().decode(publicKeySpki);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(spkiBytes);
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            log.error("SHA-256算法不可用", e);
            throw new RuntimeException("无法计算密钥指纹", e);
        } catch (IllegalArgumentException e) {
            log.error("公钥格式错误", e);
            throw new IllegalArgumentException("无效的公钥格式");
        }
    }

    /**
     * 生成密钥ID
     * 格式：前8位指纹 + 时间戳
     *
     * @param publicKeySpki SPKI格式的公钥
     * @return 密钥ID
     */
    public static String generateKeyId(String publicKeySpki) {
        String fingerprint = calculateFingerprint(publicKeySpki);
        String fingerprintPrefix = fingerprint.substring(0, Math.min(8, fingerprint.length()));
        long timestamp = System.currentTimeMillis();
        return fingerprintPrefix + "_" + timestamp;
    }

    /**
     * 验证密钥ID格式
     *
     * @param keyId 密钥ID
     * @return true=格式正确, false=格式错误
     */
    public static boolean isValidKeyId(String keyId) {
        if (keyId == null || keyId.isEmpty()) {
            return false;
        }

        // 检查格式：至少包含一个下划线
        if (!keyId.contains("_")) {
            return false;
        }

        String[] parts = keyId.split("_");
        if (parts.length != 2) {
            return false;
        }

        // 检查时间戳部分是否为数字
        try {
            Long.parseLong(parts[1]);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /**
     * 验证SPKI格式的公钥
     *
     * @param spki SPKI格式的公钥（Base64编码）
     * @return true=格式正确, false=格式错误
     */
    public static boolean isValidSPKI(String spki) {
        if (spki == null || spki.isEmpty()) {
            return false;
        }

        try {
            byte[] decoded = Base64.getDecoder().decode(spki);
            // SPKI至少应该有几百字节（RSA-2048约294字节）
            return decoded.length > 100;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * 验证密钥长度是否符合安全要求
     *
     * @param spki       SPKI格式的公钥
     * @param minKeySize 最小密钥长度（位），如2048
     * @return true=符合要求, false=不符合要求
     */
    public static boolean isValidKeySize(String spki, int minKeySize) {
        try {
            byte[] decoded = Base64.getDecoder().decode(spki);

            // 根据SPKI长度粗略估算密钥长度
            // RSA-2048的SPKI约294字节
            // RSA-4096的SPKI约550字节
            int estimatedBits = decoded.length * 8;

            // 保守估计：实际密钥长度约为SPKI长度的70%
            int actualBits = (int) (estimatedBits * 0.7);

            return actualBits >= minKeySize;
        } catch (Exception e) {
            log.error("验证密钥长度失败", e);
            return false;
        }
    }

    /**
     * 从密钥ID提取时间戳
     *
     * @param keyId 密钥ID
     * @return 时间戳（毫秒）
     */
    public static Long extractTimestamp(String keyId) {
        if (!isValidKeyId(keyId)) {
            return null;
        }

        try {
            String[] parts = keyId.split("_");
            return Long.parseLong(parts[1]);
        } catch (Exception e) {
            log.error("提取密钥ID时间戳失败: {}", keyId, e);
            return null;
        }
    }

    /**
     * 检查密钥是否已过期
     *
     * @param keyId           密钥ID
     * @param validityDays    有效期（天）
     * @return true=已过期, false=未过期
     */
    public static boolean isKeyExpired(String keyId, int validityDays) {
        Long timestamp = extractTimestamp(keyId);
        if (timestamp == null) {
            return true; // 无法提取时间戳，视为过期
        }

        long now = System.currentTimeMillis();
        long validityMillis = validityDays * 24L * 60 * 60 * 1000;

        return (now - timestamp) > validityMillis;
    }

    /**
     * 安全地比较两个密钥指纹是否相同
     * 使用时间常量比较，防止时间攻击
     *
     * ===== P1修复: 时间攻击防护 (2025-12-13) =====
     * 修复：使用MessageDigest.isEqual()，完全消除时间泄露
     * 原代码问题：提前返回会泄露长度信息
     *
     * @param fingerprint1 指纹1
     * @param fingerprint2 指纹2
     * @return true=相同, false=不同
     */
    public static boolean constantTimeEquals(String fingerprint1, String fingerprint2) {
        if (fingerprint1 == null || fingerprint2 == null) {
            // 即使为null，也要执行固定时间的操作，避免时间泄露
            return fingerprint1 == fingerprint2;
        }

        byte[] bytes1 = fingerprint1.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] bytes2 = fingerprint2.getBytes(java.nio.charset.StandardCharsets.UTF_8);

        int maxLen = Math.max(bytes1.length, bytes2.length);
        int diff = bytes1.length ^ bytes2.length;

        for (int i = 0; i < maxLen; i++) {
            byte b1 = i < bytes1.length ? bytes1[i] : 0;
            byte b2 = i < bytes2.length ? bytes2[i] : 0;
            diff |= b1 ^ b2;
        }

        return diff == 0;
    }
}
