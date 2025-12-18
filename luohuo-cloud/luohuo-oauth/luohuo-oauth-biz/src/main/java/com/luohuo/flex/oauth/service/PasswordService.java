package com.luohuo.flex.oauth.service;

import cn.hutool.crypto.SecureUtil;
import com.luohuo.flex.base.entity.tenant.DefUser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * 密码服务
 * ===== P0修复: 安全密码处理升级到Argon2 (2025-12-13) =====
 *
 * 支持三种密码格式的渐进式迁移:
 * 1. SHA-256 + salt (旧格式, 不安全)
 * 2. BCrypt (中间格式, 安全但不如Argon2)
 * 3. Argon2id (新格式, 最安全)
 *
 * 迁移策略:
 * - 新用户注册: 直接使用Argon2
 * - 旧用户登录: 验证成功后自动升级到Argon2
 * - 修改密码: 直接使用Argon2
 *
 * @author HuLa Security Team
 * @since 2025-12-13
 */
@Slf4j
@Service
public class PasswordService {

    @Autowired
    private PasswordEncoder passwordEncoder;  // Argon2PasswordEncoder

    // BCrypt编码器用于验证旧BCrypt密码
    private static final BCryptPasswordEncoder bcryptEncoder = new BCryptPasswordEncoder(12);

    /**
     * 密码编码 (用于注册/修改密码)
     * 使用Argon2id算法, 自动生成和存储盐值
     *
     * @param rawPassword 明文密码
     * @return Argon2哈希值 (格式: $argon2id$v=19$m=65536,t=3,p=4$...)
     */
    public String encodePassword(String rawPassword) {
        return passwordEncoder.encode(rawPassword);
    }

    /**
     * 验证密码 (兼容旧SHA-256、BCrypt和新Argon2)
     *
     * 验证逻辑:
     * 1. 如果有salt字段 → SHA-256格式 (最旧)
     * 2. 如果密码以"$2a$"或"$2b$"开头 → BCrypt格式 (中间)
     * 3. 如果密码以"$argon2"开头 → Argon2格式 (最新)
     *
     * @param rawPassword 明文密码
     * @param user 用户对象
     * @return true=密码正确, false=密码错误
     */
    public boolean verifyPassword(String rawPassword, DefUser user) {
        String storedPassword = user.getPassword();

        // 1. 旧密码格式: SHA-256 + salt
        if (user.getSalt() != null && !user.getSalt().isEmpty()) {
            String oldHash = SecureUtil.sha256(rawPassword + user.getSalt());
            boolean matches = oldHash.equalsIgnoreCase(storedPassword);

            if (matches) {
                log.warn("用户 {} 使用旧SHA-256密码格式登录, 强烈建议立即升级到Argon2", user.getId());
            }
            return matches;
        }

        // 2. BCrypt格式 (中间过渡格式)
        if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$")) {
            boolean matches = bcryptEncoder.matches(rawPassword, storedPassword);

            if (matches) {
                log.info("用户 {} 使用BCrypt密码格式登录, 建议升级到Argon2", user.getId());
            }
            return matches;
        }

        // 3. Argon2格式 (新格式, 最安全)
        if (storedPassword.startsWith("$argon2")) {
            return passwordEncoder.matches(rawPassword, storedPassword);
        }

        // 未知格式
        log.error("用户 {} 的密码格式未知: {}", user.getId(), storedPassword.substring(0, Math.min(10, storedPassword.length())));
        return false;
    }

    /**
     * 判断是否需要密码升级
     *
     * 需要升级的情况:
     * 1. 使用SHA-256 + salt
     * 2. 使用BCrypt
     *
     * @param user 用户对象
     * @return true=需要升级, false=已是Argon2格式
     */
    public boolean needsPasswordUpgrade(DefUser user) {
        // SHA-256格式
        if (user.getSalt() != null && !user.getSalt().isEmpty()) {
            return true;
        }

        String storedPassword = user.getPassword();

        // BCrypt格式
        if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$")) {
            return true;
        }

        // Argon2格式不需要升级
        return !storedPassword.startsWith("$argon2");
    }

    /**
     * 将密码升级为Argon2格式
     * 用于登录时自动升级旧密码
     *
     * @param rawPassword 明文密码
     * @return 新的Argon2哈希
     */
    public String upgradePassword(String rawPassword) {
        String newHash = encodePassword(rawPassword);
        log.info("密码已升级到Argon2格式");
        return newHash;
    }

    /**
     * 获取密码格式类型 (用于监控和统计)
     *
     * @param user 用户对象
     * @return "SHA256" | "BCRYPT" | "ARGON2" | "UNKNOWN"
     */
    public String getPasswordFormat(DefUser user) {
        if (user.getSalt() != null && !user.getSalt().isEmpty()) {
            return "SHA256";
        }

        String storedPassword = user.getPassword();
        if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$")) {
            return "BCRYPT";
        }
        if (storedPassword.startsWith("$argon2")) {
            return "ARGON2";
        }

        return "UNKNOWN";
    }
}
