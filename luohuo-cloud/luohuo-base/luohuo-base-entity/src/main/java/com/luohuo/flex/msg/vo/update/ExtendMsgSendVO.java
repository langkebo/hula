package com.luohuo.flex.msg.vo.update;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import com.luohuo.basic.model.Kv;
import com.luohuo.flex.msg.vo.save.ExtendMsgRecipientSaveVO;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * <p>
 * 表单修改方法VO
 * 消息
 * </p>
 *
 * @author 乾乾
 * @date 2022-07-10 11:41:17
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString(callSuper = true)
@EqualsAndHashCode
@Builder
@Schema(description = "消息发送")
public class ExtendMsgSendVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 模板标识
     */
    @Schema(description = "模板标识")
    @Size(max = 255, message = "模板标识长度不能超过{max}")
    @NotEmpty(message = "请填写模板标识")
    private String code;
    /**
     * 参数;
     * <p>
     * 需要封装为[{{‘key’:'', ’value’:''}, {'key2':'', 'value2':''}]格式
     */
    @Schema(description = "参数")
    private List<Kv> paramList;


    /**
     * 发送时间
     */
    @Schema(description = "发送时间")
    private LocalDateTime sendTime;
    /**
     * 业务ID
     */
    @Schema(description = "业务ID")
    private Long bizId;
    /**
     * 业务类型
     */
    @Schema(description = "业务类型")
    @Size(max = 255, message = "业务类型长度不能超过{max}")
    private String bizType;
    /**
     * 发布人姓名
     */
    @Schema(description = "发布人姓名")
    @Size(max = 255, message = "发布人姓名长度不能超过{max}")
    private String author;

    @Schema(description = "接收人")
    @NotEmpty(message = "请选择接收人")
    private List<ExtendMsgRecipientSaveVO> recipientList;


    public ExtendMsgSendVO addParam(String key, String value) {
        if (paramList == null) {
            paramList = new ArrayList<>();
        }
        // 创建基本的 Kv 对象
        Kv kv = new Kv();
        paramList.add(kv);
        return this;
    }

    public ExtendMsgSendVO addRecipient(String recipient, String ext) {
        if (recipientList == null) {
            recipientList = new ArrayList<>();
        }
        ExtendMsgRecipientSaveVO saveVO = createRecipient(recipient, ext);
        recipientList.add(saveVO);
        return this;
    }

    public ExtendMsgSendVO addRecipient(String recipient) {
        if (recipientList == null) {
            recipientList = new ArrayList<>();
        }
        ExtendMsgRecipientSaveVO saveVO = createRecipient(recipient, null);
        recipientList.add(saveVO);
        return this;
    }

    public ExtendMsgSendVO addParam(Kv kv) {
        if (paramList == null) {
            paramList = new ArrayList<>();
        }
        paramList.add(kv);
        return this;
    }

    public ExtendMsgSendVO addRecipient(ExtendMsgRecipientSaveVO recipient) {
        if (recipientList == null) {
            recipientList = new ArrayList<>();
        }
        recipientList.add(recipient);
        return this;
    }

    public ExtendMsgSendVO clearParam() {
        if (paramList == null) {
            paramList = new ArrayList<>();
        }
        paramList.clear();
        return this;
    }

    public ExtendMsgSendVO clearRecipient() {
        if (recipientList == null) {
            recipientList = new ArrayList<>();
        }
        recipientList.clear();
        return this;
    }

    /**
     * 创建收件人对象，使用反射设置私有字段
     */
    private ExtendMsgRecipientSaveVO createRecipient(String recipient, String ext) {
        ExtendMsgRecipientSaveVO saveVO = new ExtendMsgRecipientSaveVO();
        try {
            if (recipient != null) {
                saveVO.getClass().getDeclaredField("recipient").setAccessible(true);
                saveVO.getClass().getDeclaredField("recipient").set(saveVO, recipient);
            }
            if (ext != null) {
                saveVO.getClass().getDeclaredField("ext").setAccessible(true);
                saveVO.getClass().getDeclaredField("ext").set(saveVO, ext);
            }
        } catch (Exception e) {
            // 如果反射失败，使用替代方案
            throw new RuntimeException("Failed to create recipient", e);
        }
        return saveVO;
    }
}
