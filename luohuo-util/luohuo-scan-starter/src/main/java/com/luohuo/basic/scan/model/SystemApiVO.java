package com.luohuo.basic.scan.model;

import lombok.Builder;
import lombok.Data;
import lombok.ToString;

/**
 * @author 乾乾
 * @date 2021/4/7 11:49 上午
 */
public class SystemApiVO {

    /**
     * 接口名称
     */
    private String name;
    /**
     * 请求方式
     */
    private String requestMethod;

    /**
     * 请求路径
     */
    private String uri;

    /**
     * 服务ID
     */
    private String springApplicationName;

    /**
     * 类名
     */
    private String controller;

    public SystemApiVO() {}
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getRequestMethod() { return requestMethod; }
    public void setRequestMethod(String requestMethod) { this.requestMethod = requestMethod; }
    public String getUri() { return uri; }
    public void setUri(String uri) { this.uri = uri; }
    public String getSpringApplicationName() { return springApplicationName; }
    public void setSpringApplicationName(String springApplicationName) { this.springApplicationName = springApplicationName; }
    public String getController() { return controller; }
    public void setController(String controller) { this.controller = controller; }
}
