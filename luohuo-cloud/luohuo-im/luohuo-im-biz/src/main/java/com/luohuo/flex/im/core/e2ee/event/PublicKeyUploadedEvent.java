package com.luohuo.flex.im.core.e2ee.event;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.context.ApplicationEvent;

/**
 * 公钥上传事件
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
public class PublicKeyUploadedEvent extends ApplicationEvent {

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 密钥ID
     */
    private String keyId;

    /**
     * 算法
     */
    private String algorithm;

    /**
     * 公钥数据
     */
    private String publicKey;

    /**
     * 上传时间
     */
    private Long uploadTime;

    /**
     * 是否成功
     */
    private Boolean success;

    public PublicKeyUploadedEvent(Long userId, String keyId, String algorithm,
                                 String publicKey, Long uploadTime, Boolean success) {
        super(userId);
        this.userId = userId;
        this.keyId = keyId;
        this.algorithm = algorithm;
        this.publicKey = publicKey;
        this.uploadTime = uploadTime;
        this.success = success;
    }
}