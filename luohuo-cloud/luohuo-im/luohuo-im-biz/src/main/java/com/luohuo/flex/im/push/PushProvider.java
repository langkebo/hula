package com.luohuo.flex.im.push;

import java.util.List;
import java.util.Map;

/**
 * 推送提供者接口
 *
 * @author HuLa
 */
public interface PushProvider {

    /**
     * 获取推送类型
     */
    PushType getType();

    /**
     * 单个推送
     *
     * @param deviceToken 设备Token
     * @param title 标题
     * @param content 内容
     * @param extra 扩展信息
     * @return 是否成功
     */
    boolean push(String deviceToken, String title, String content, Map<String, Object> extra);

    /**
     * 批量推送
     *
     * @param deviceTokens 设备Token列表
     * @param title 标题
     * @param content 内容
     * @param extra 扩展信息
     * @return 是否成功
     */
    boolean batchPush(List<String> deviceTokens, String title, String content, Map<String, Object> extra);
}