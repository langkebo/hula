package com.luohuo.flex.im.core.e2ee.constants;

/**
 * E2EE错误代码常量
 *
 * 统一管理所有E2EE相关的错误代码，便于维护和国际化
 *
 * @author HuLa Team
 * @since 2025-12-13
 */
public final class E2EEErrorCodes {

    private E2EEErrorCodes() {
        // 工具类，禁止实例化
    }

    // ==================== 密钥相关错误 (1xxx) ====================

    /**
     * 未找到有效的会话密钥包
     */
    public static final String KEY_NOT_FOUND = "E2EE_1001";

    /**
     * 解包会话密钥失败
     */
    public static final String KEY_UNWRAP_FAILED = "E2EE_1002";

    /**
     * 公钥不存在或已失效
     */
    public static final String PUBLIC_KEY_INVALID = "E2EE_1003";

    /**
     * 私钥不存在或已失效
     */
    public static final String PRIVATE_KEY_INVALID = "E2EE_1004";

    /**
     * 密钥已过期
     */
    public static final String KEY_EXPIRED = "E2EE_1005";

    /**
     * 密钥格式错误
     */
    public static final String KEY_FORMAT_ERROR = "E2EE_1006";

    /**
     * 不支持的密钥算法
     */
    public static final String UNSUPPORTED_KEY_ALGORITHM = "E2EE_1007";

    // ==================== 加密/解密相关错误 (2xxx) ====================

    /**
     * 解密失败
     */
    public static final String DECRYPTION_FAILED = "E2EE_2001";

    /**
     * 加密失败
     */
    public static final String ENCRYPTION_FAILED = "E2EE_2002";

    /**
     * 不支持的加密算法
     */
    public static final String UNSUPPORTED_ALGORITHM = "E2EE_2003";

    /**
     * 解密内容失败
     */
    public static final String CONTENT_DECRYPTION_FAILED = "E2EE_2004";

    /**
     * IV长度错误
     */
    public static final String INVALID_IV_LENGTH = "E2EE_2005";

    /**
     * 认证标签验证失败
     */
    public static final String AUTH_TAG_FAILED = "E2EE_2006";

    // ==================== 完整性验证相关错误 (3xxx) ====================

    /**
     * 消息完整性验证失败
     */
    public static final String INTEGRITY_CHECK_FAILED = "E2EE_3001";

    /**
     * 签名验证失败
     */
    public static final String SIGNATURE_VERIFICATION_FAILED = "E2EE_3002";

    /**
     * 哈希值不匹配
     */
    public static final String HASH_MISMATCH = "E2EE_3003";

    /**
     * 消息未签名
     */
    public static final String MESSAGE_NOT_SIGNED = "E2EE_3004";

    /**
     * 签名格式错误
     */
    public static final String INVALID_SIGNATURE_FORMAT = "E2EE_3005";

    // ==================== 安全相关错误 (4xxx) ====================

    /**
     * 检测到重放攻击
     */
    public static final String REPLAY_ATTACK_DETECTED = "E2EE_4001";

    /**
     * 消息已过期
     */
    public static final String MESSAGE_EXPIRED = "E2EE_4002";

    /**
     * 消息时间戳无效
     */
    public static final String INVALID_TIMESTAMP = "E2EE_4003";

    /**
     * 未授权的操作
     */
    public static final String UNAUTHORIZED_OPERATION = "E2EE_4004";

    /**
     * 访问被拒绝
     */
    public static final String ACCESS_DENIED = "E2EE_4005";

    /**
     * 密钥已被撤销
     */
    public static final String KEY_REVOKED = "E2EE_4006";

    // ==================== 系统相关错误 (5xxx) ====================

    /**
     * 系统错误
     */
    public static final String SYSTEM_ERROR = "E2EE_5001";

    /**
     * 数据库错误
     */
    public static final String DATABASE_ERROR = "E2EE_5002";

    /**
     * 缓存错误
     */
    public static final String CACHE_ERROR = "E2EE_5003";

    /**
     * 网络错误
     */
    public static final String NETWORK_ERROR = "E2EE_5004";

    /**
     * 超时错误
     */
    public static final String TIMEOUT_ERROR = "E2EE_5005";

    /**
     * 资源不足
     */
    public static final String RESOURCE_EXHAUSTED = "E2EE_5006";

    // ==================== 参数相关错误 (6xxx) ====================

    /**
     * 参数无效
     */
    public static final String INVALID_PARAMETER = "E2EE_6001";

    /**
     * 参数缺失
     */
    public static final String MISSING_PARAMETER = "E2EE_6002";

    /**
     * 消息格式错误
     */
    public static final String INVALID_MESSAGE_FORMAT = "E2EE_6003";

    /**
     * 数据损坏
     */
    public static final String DATA_CORRUPTED = "E2EE_6004";

    // ==================== 业务逻辑错误 (7xxx) ====================

    /**
     * 消息已被销毁
     */
    public static final String MESSAGE_DESTROYED = "E2EE_7001";

    /**
     * 会话不存在
     */
    public static final String SESSION_NOT_FOUND = "E2EE_7002";

    /**
     * 用户不存在
     */
    public static final String USER_NOT_FOUND = "E2EE_7003";

    /**
     * 密钥轮换失败
     */
    public static final String KEY_ROTATION_FAILED = "E2EE_7004";

    /**
     * 批量操作部分失败
     */
    public static final String BATCH_OPERATION_PARTIAL_FAILURE = "E2EE_7005";

    // ==================== 错误消息映射 ====================

    /**
     * 获取错误代码对应的错误消息
     *
     * @param errorCode 错误代码
     * @return 错误消息
     */
    public static String getErrorMessage(String errorCode) {
        return switch (errorCode) {
            // 密钥相关
            case KEY_NOT_FOUND -> "未找到有效的会话密钥包";
            case KEY_UNWRAP_FAILED -> "解包会话密钥失败";
            case PUBLIC_KEY_INVALID -> "公钥不存在或已失效";
            case PRIVATE_KEY_INVALID -> "私钥不存在或已失效";
            case KEY_EXPIRED -> "密钥已过期";
            case KEY_FORMAT_ERROR -> "密钥格式错误";
            case UNSUPPORTED_KEY_ALGORITHM -> "不支持的密钥算法";

            // 加密/解密相关
            case DECRYPTION_FAILED -> "解密失败";
            case ENCRYPTION_FAILED -> "加密失败";
            case UNSUPPORTED_ALGORITHM -> "不支持的加密算法";
            case CONTENT_DECRYPTION_FAILED -> "解密内容失败";
            case INVALID_IV_LENGTH -> "初始化向量长度错误";
            case AUTH_TAG_FAILED -> "认证标签验证失败";

            // 完整性验证相关
            case INTEGRITY_CHECK_FAILED -> "消息完整性验证失败";
            case SIGNATURE_VERIFICATION_FAILED -> "签名验证失败";
            case HASH_MISMATCH -> "哈希值不匹配";
            case MESSAGE_NOT_SIGNED -> "消息未签名";
            case INVALID_SIGNATURE_FORMAT -> "签名格式错误";

            // 安全相关
            case REPLAY_ATTACK_DETECTED -> "检测到重放攻击：消息已被处理";
            case MESSAGE_EXPIRED -> "消息已过期";
            case INVALID_TIMESTAMP -> "消息时间戳无效";
            case UNAUTHORIZED_OPERATION -> "未授权的操作";
            case ACCESS_DENIED -> "访问被拒绝";
            case KEY_REVOKED -> "密钥已被撤销";

            // 系统相关
            case SYSTEM_ERROR -> "系统错误";
            case DATABASE_ERROR -> "数据库错误";
            case CACHE_ERROR -> "缓存错误";
            case NETWORK_ERROR -> "网络错误";
            case TIMEOUT_ERROR -> "操作超时";
            case RESOURCE_EXHAUSTED -> "系统资源不足";

            // 参数相关
            case INVALID_PARAMETER -> "参数无效";
            case MISSING_PARAMETER -> "参数缺失";
            case INVALID_MESSAGE_FORMAT -> "消息格式错误";
            case DATA_CORRUPTED -> "数据已损坏";

            // 业务逻辑
            case MESSAGE_DESTROYED -> "消息已被销毁";
            case SESSION_NOT_FOUND -> "会话不存在";
            case USER_NOT_FOUND -> "用户不存在";
            case KEY_ROTATION_FAILED -> "密钥轮换失败";
            case BATCH_OPERATION_PARTIAL_FAILURE -> "批量操作部分失败";

            default -> "未知错误";
        };
    }

    /**
     * 判断错误是否可重试
     *
     * @param errorCode 错误代码
     * @return true 如果错误可重试，false 否则
     */
    public static boolean isRetryable(String errorCode) {
        return errorCode.equals(NETWORK_ERROR)
            || errorCode.equals(TIMEOUT_ERROR)
            || errorCode.equals(DATABASE_ERROR)
            || errorCode.equals(CACHE_ERROR)
            || errorCode.equals(RESOURCE_EXHAUSTED);
    }

    /**
     * 判断错误是否为安全相关错误
     *
     * @param errorCode 错误代码
     * @return true 如果是安全错误，false 否则
     */
    public static boolean isSecurityError(String errorCode) {
        return errorCode.startsWith("E2EE_4");
    }
}
