package com.luohuo.flex.im.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

import java.time.LocalDateTime;

/**
 * 推送设备实体
 *
 * @author HuLa
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("im_push_device")
public class PushDevice {

    /**
     * 主键
     */
    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 设备类型：ios/android
     */
    private String deviceType;

    /**
     * 设备Token
     */
    private String deviceToken;

    /**
     * App版本
     */
    private String appVersion;

    /**
     * 系统版本
     */
    private String osVersion;

    /**
     * 设备型号
     */
    private String deviceModel;

    /**
     * 是否活跃
     */
    private Boolean active;

    /**
     * 最后活跃时间
     */
    private LocalDateTime lastActiveTime;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;

    /**
     * 租户ID
     */
    private Long tenantId;
}