package com.luohuo.flex.im.domain.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

/**
 * 批量获取公钥请求DTO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchGetPublicKeysDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 用户ID列表
     */
    @NotEmpty(message = "用户ID列表不能为空")
    @Size(max = 100, message = "单次最多查询100个用户的公钥")
    private List<Long> userIds;

    /**
     * 是否只返回最新的公钥
     * true=每个用户只返回最新的一个公钥
     * false=返回每个用户的所有有效公钥
     */
    @Builder.Default
    private Boolean onlyLatest = true;

    /**
     * 是否包含已过期的公钥
     */
    @Builder.Default
    private Boolean includeExpired = false;
}
