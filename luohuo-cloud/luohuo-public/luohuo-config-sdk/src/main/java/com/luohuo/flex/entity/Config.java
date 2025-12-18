package com.luohuo.flex.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.luohuo.basic.tenant.core.aop.TenantIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import com.luohuo.basic.base.entity.Entity;

/**
 * 系统配置表 base_config
 * @author 乾乾
 * @date 2024-04-18
 */
@TableName("base_config")
@TenantIgnore
public class Config extends Entity {
	private static final long serialVersionUID = 1L;

	@TableId(value = "id", type = IdType.ASSIGN_ID)
	private Long id;

	@Schema(description = "参数名称")
	private String configName;

	@Schema(description = "类型")
	private String type;

	@Schema(description = "参数键名")
	private String configKey;

	@Schema(description = "参数键值")
    private String configValue;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getConfigName() { return configName; }
    public void setConfigName(String configName) { this.configName = configName; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getConfigKey() { return configKey; }
    public void setConfigKey(String configKey) { this.configKey = configKey; }
    public String getConfigValue() { return configValue; }
    public void setConfigValue(String configValue) { this.configValue = configValue; }
}
