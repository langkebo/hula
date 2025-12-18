package com.luohuo.flex.model.entity.dto.tenant;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.io.Serializable;

/**
 * 租户id
 * @author 乾乾
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TenantDTO implements Serializable{
    /**
     * 租户id
     */
    private Long tenantId;
}
