package com.luohuo.flex.im.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

import java.time.LocalDateTime;

/**
 * 推送记录实体
 *
 * @author HuLa
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("im_push_record")
public class PushRecord {

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
     * 设备Token
     */
    private String deviceToken;

    /**
     * 推送类型：apns/fcm/huawei/xiaomi/oppo/vivo
     */
    private String pushType;

    /**
     * 标题
     */
    private String title;

    /**
     * 内容
     */
    private String content;

    /**
     * 扩展信息（JSON格式）
     */
    private String extra;

    /**
     * 状态：pending/success/failed
     */
    private String status;

    /**
     * 错误信息
     */
    private String errorMessage;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 租户ID
     */
    private Long tenantId;
}
