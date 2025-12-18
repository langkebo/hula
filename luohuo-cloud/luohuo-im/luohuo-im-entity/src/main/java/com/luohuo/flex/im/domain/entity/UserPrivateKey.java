package com.luohuo.flex.im.domain.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 用户私钥实体
 * 用于存储E2EE用户的私钥信息
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("user_private_key")
public class UserPrivateKey implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 主键ID
     */
    @TableId
    private Long id;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 私钥内容（Base64编码）
     */
    private String privateKey;

    /**
     * 密钥算法（如：RSA）
     */
    private String algorithm;

    /**
     * 密钥长度
     */
    private Integer keySize;

    /**
     * 密钥状态
     */
    private String status;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    private LocalDateTime updatedAt;
}