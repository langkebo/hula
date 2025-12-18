package com.luohuo.flex.base.vo.result.user;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

/**
 * 树配置属性相关
 * <p>
 * 代码参考hutool
 *
 * @author tangyh
 */
@Getter
@Setter
public class RouterMetaConfig implements Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * 默认属性配置对象
     */
    public static RouterMetaConfig DEFAULT_CONFIG = new RouterMetaConfig();

    /* 公共属性 start */
    private String titleKey = "title";
    private String iconKey = "icon";
    private String componentKey = "component";
    /* 公共属性 end */

    /* vben 专用属性 start */
    private String ignoreKeepAliveKey = "ignoreKeepAlive";
    private String affixKey = "affix";
    private String frameSrcKey = "frameSrc";
    private String transitionNameKey = "transitionName";
    private String hideBreadcrumbKey = "hideBreadcrumb";
    private String carryParamKey = "carryParam";
    private String currentActiveMenuKey = "currentActiveMenu";


    private String hideTabKey = "hideTab";
    private String hideMenuKey = "hideMenu";
    private String hideChildrenInMenuKey = "hideChildrenInMenu";
    private String typeKey = "type";
    private String contentKey = "content";
    private String dotKey = "dot";
    /* vben 专用属性 end */

    /* soybean 专用属性 start */
    private String hideInMenuKey = "hideInMenu";
    private String activeMenuKey = "activeMenu";
    private String i18nKeyKey = "i18nKey";
    private String keepAliveKey = "keepAlive";
    private String constantKey = "constant";
    private String localIconKey = "localIcon";
    private String orderKey = "order";
    private String hrefKey = "href";
    private String multiTabKey = "multiTab";
    private String fixedIndexInTabKey = "fixedIndexInTab";
    /* soybean 专用属性 end */


    /* vben5 专用属性 start */
    private String iframeSrcKey = "iframeSrc";
    private String linkKey = "link";
    private String activePathKey = "activePath";
//    private String hideInMenuKey = "hideInMenu";
    /* vben5 专用属性 end */

    // 手动添加getter方法以确保Lombok不生成时能够正常工作
    public String getTitleKey() {
        return titleKey;
    }

    public String getIconKey() {
        return iconKey;
    }

    public String getComponentKey() {
        return componentKey;
    }

    public String getIgnoreKeepAliveKey() {
        return ignoreKeepAliveKey;
    }

    public String getAffixKey() {
        return affixKey;
    }

    public String getFrameSrcKey() {
        return frameSrcKey;
    }

    public String getTransitionNameKey() {
        return transitionNameKey;
    }

    public String getHideBreadcrumbKey() {
        return hideBreadcrumbKey;
    }

    public String getCarryParamKey() {
        return carryParamKey;
    }

    public String getCurrentActiveMenuKey() {
        return currentActiveMenuKey;
    }

    public String getHideTabKey() {
        return hideTabKey;
    }

    public String getHideMenuKey() {
        return hideMenuKey;
    }

    public String getHideChildrenInMenuKey() {
        return hideChildrenInMenuKey;
    }

    public String getTypeKey() {
        return typeKey;
    }

    public String getContentKey() {
        return contentKey;
    }

    public String getDotKey() {
        return dotKey;
    }

    public String getHideInMenuKey() {
        return hideInMenuKey;
    }

    public String getActiveMenuKey() {
        return activeMenuKey;
    }

    public String getI18nKeyKey() {
        return i18nKeyKey;
    }

    public String getKeepAliveKey() {
        return keepAliveKey;
    }

    public String getConstantKey() {
        return constantKey;
    }

    public String getLocalIconKey() {
        return localIconKey;
    }

    public String getOrderKey() {
        return orderKey;
    }

    public String getHrefKey() {
        return hrefKey;
    }

    public String getMultiTabKey() {
        return multiTabKey;
    }

    public String getFixedIndexInTabKey() {
        return fixedIndexInTabKey;
    }

    public String getIframeSrcKey() {
        return iframeSrcKey;
    }

    public String getLinkKey() {
        return linkKey;
    }

    public String getActivePathKey() {
        return activePathKey;
    }
}
