package com.luohuo.flex.crypto;

import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * MyBatis加密字符串类型处理器
 * ===== P0修复: PII字段自动加密/解密 (2025-12-13) =====
 *
 * 功能:
 * - 写入数据库前自动加密
 * - 从数据库读取后自动解密
 * - 对应用层透明, 无需手动加密/解密
 *
 * 使用方法:
 * ```java
 * public class DefUser {
 *   @TableField(value = "email", typeHandler = EncryptedStringTypeHandler.class)
 *   private String email;
 *
 *   @TableField(value = "mobile", typeHandler = EncryptedStringTypeHandler.class)
 *   private String mobile;
 * }
 * ```
 *
 * @author HuLa Security Team
 * @since 2025-12-13
 */
@Slf4j
@Component
public class EncryptedStringTypeHandler extends BaseTypeHandler<String> {

    /**
     * 注入加密器
     * 注意: 由于MyBatis类型处理器可能在Spring容器初始化前创建,
     * 需要通过静态变量延迟注入
     */
    private static PiiEncryptor piiEncryptor;

    @Autowired
    public void setPiiEncryptor(PiiEncryptor piiEncryptor) {
        EncryptedStringTypeHandler.piiEncryptor = piiEncryptor;
    }

    /**
     * 设置非空参数 (写入数据库前加密)
     *
     * @param ps PreparedStatement
     * @param i 参数索引
     * @param parameter 明文参数
     * @param jdbcType JDBC类型
     * @throws SQLException SQL异常
     */
    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, String parameter, JdbcType jdbcType)
            throws SQLException {
        try {
            if (piiEncryptor == null) {
                log.error("PiiEncryptor未初始化, 无法加密字段!");
                ps.setString(i, parameter);  // 降级: 直接存储明文
                return;
            }

            // 加密后存储
            String encrypted = piiEncryptor.encrypt(parameter);
            ps.setString(i, encrypted);

        } catch (Exception e) {
            log.error("PII字段加密失败: {}", e.getMessage(), e);
            throw new SQLException("字段加密失败: " + e.getMessage(), e);
        }
    }

    /**
     * 获取可为空的结果 (从ResultSet读取并解密)
     *
     * @param rs ResultSet
     * @param columnName 列名
     * @return 解密后的明文
     * @throws SQLException SQL异常
     */
    @Override
    public String getNullableResult(ResultSet rs, String columnName) throws SQLException {
        String encrypted = rs.getString(columnName);
        return decrypt(encrypted);
    }

    /**
     * 获取可为空的结果 (按索引读取并解密)
     *
     * @param rs ResultSet
     * @param columnIndex 列索引
     * @return 解密后的明文
     * @throws SQLException SQL异常
     */
    @Override
    public String getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        String encrypted = rs.getString(columnIndex);
        return decrypt(encrypted);
    }

    /**
     * 获取可为空的结果 (从CallableStatement读取并解密)
     *
     * @param cs CallableStatement
     * @param columnIndex 列索引
     * @return 解密后的明文
     * @throws SQLException SQL异常
     */
    @Override
    public String getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        String encrypted = cs.getString(columnIndex);
        return decrypt(encrypted);
    }

    /**
     * 解密方法 (内部使用)
     *
     * @param encrypted 密文
     * @return 明文
     * @throws SQLException 解密失败
     */
    private String decrypt(String encrypted) throws SQLException {
        if (encrypted == null || encrypted.isEmpty()) {
            return encrypted;  // 空值直接返回
        }

        try {
            if (piiEncryptor == null) {
                log.error("PiiEncryptor未初始化, 无法解密字段!");
                return encrypted;  // 降级: 返回密文 (可能导致显示问题)
            }

            // 解密
            return piiEncryptor.decrypt(encrypted);

        } catch (Exception e) {
            log.error("PII字段解密失败: {}", e.getMessage(), e);
            throw new SQLException("字段解密失败: " + e.getMessage(), e);
        }
    }
}
