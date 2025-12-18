package com.luohuo.basic.model.log;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.Accessors;

import java.time.LocalDateTime;

/**
 * <p>
 * 实体类
 * 系统日志
 * </p>
 *
 * @author 乾乾
 * @since 2019-07-02
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString(callSuper = true)
@EqualsAndHashCode
@Accessors(chain = true)
public class OptLogDTO {

    private static final long serialVersionUID = 1L;

    /**
     * 操作IP
     */
    private String requestIp;

    private Long basePoolNameHeader;
    private Long extendPoolNameHeader;

    /**
     * 日志链路追踪id日志标志
     */
    private String trace;

    /**
     * 日志类型
     * #LogType{OPT:操作类型;EX:异常类型}
     */
    private String type;

    /**
     * 操作人
     */
    private String userName;

    /**
     * 操作描述
     */
    private String description;

    /**
     * 类路径
     */
    private String classPath;

    /**
     * 请求类型
     */
    private String actionMethod;

    /**
     * 请求地址
     */
    private String requestUri;

    /**
     * 请求类型
     * #HttpMethod{GET:GET请求;POST:POST请求;PUT:PUT请求;DELETE:DELETE请求;PATCH:PATCH请求;TRACE:TRACE请求;HEAD:HEAD请求;OPTIONS:OPTIONS请求;}
     */
    private String httpMethod;

    /**
     * 请求参数
     */
    private String params;

    /**
     * 返回值
     */
    private String result;

    /**
     * 异常描述
     */
    private String exDetail;

    /**
     * 开始时间
     */
    private LocalDateTime startTime;

    /**
     * 完成时间
     */
    private LocalDateTime finishTime;

    /**
     * 消耗时间
     */
    private Long consumingTime;

    /**
     * 浏览器
     */
    private String ua;

	private Long createBy;
    private Long createdOrgId;
    private String token;



    public void setType(String type) { this.type = type; }
    public void setResult(String result) { this.result = result; }
    public void setExDetail(String exDetail) { this.exDetail = exDetail; }
    public void setParams(String params) { this.params = params; }
    public void setCreateBy(Long createBy) { this.createBy = createBy; }
    public void setClassPath(String classPath) { this.classPath = classPath; }
    public void setActionMethod(String actionMethod) { this.actionMethod = actionMethod; }
    public void setRequestIp(String requestIp) { this.requestIp = requestIp; }
    public void setRequestUri(String requestUri) { this.requestUri = requestUri; }
    public void setHttpMethod(String httpMethod) { this.httpMethod = httpMethod; }
    public void setUa(String ua) { this.ua = ua; }
    public void setCreatedOrgId(Long createdOrgId) { this.createdOrgId = createdOrgId; }
    public void setToken(String token) { this.token = token; }
    public void setTrace(String trace) { this.trace = trace; }
    public String getTrace() { return trace; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public void setFinishTime(LocalDateTime finishTime) { this.finishTime = finishTime; }
    public LocalDateTime getStartTime() { return startTime; }
    public LocalDateTime getFinishTime() { return finishTime; }
    public String getToken() { return token; }
    public String getParams() { return params; }
    public void setDescription(String description) { this.description = description; }
    public void setConsumingTime(Long consumingTime) { this.consumingTime = consumingTime; }
}
