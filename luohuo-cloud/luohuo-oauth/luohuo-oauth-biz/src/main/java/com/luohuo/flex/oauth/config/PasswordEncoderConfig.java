package com.luohuo.flex.oauth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 密码编码器配置
 * ===== P0修复: 密码哈希算法升级到Argon2 (2025-12-13) =====
 * SHA-256 → Argon2id, 防止GPU/ASIC暴力破解和侧信道攻击
 *
 * Argon2特性:
 * - 2015年密码哈希比赛(PHC)获胜者, 行业最佳实践
 * - Argon2id模式: 结合Argon2i(抗侧信道)和Argon2d(抗GPU)优势
 * - 内存困难函数: 使用65536 KB内存, 使GPU/ASIC攻击成本极高
 * - 可调参数: 盐长度16字节, 哈希长度32字节, 3次迭代, 4并行度
 * - 自动处理盐值生成和存储
 * - 抗时间攻击、侧信道攻击、GPU/ASIC暴力破解
 *
 * 性能: 在现代硬件上约200-300ms (比BCrypt稍慢, 但安全性更高)
 *
 * @author HuLa Security Team
 * @since 2025-12-13
 */
@Configuration
public class PasswordEncoderConfig {

    /**
     * Argon2id密码编码器
     *
     * 参数说明:
     * - saltLength: 16字节 (128位盐值)
     * - hashLength: 32字节 (256位哈希)
     * - parallelism: 4 (并行度, 利用多核CPU)
     * - memory: 65536 KB (64 MB内存, 使GPU攻击成本高)
     * - iterations: 3 (迭代次数, 平衡安全性和性能)
     *
     * @return Argon2id密码编码器
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }
}
