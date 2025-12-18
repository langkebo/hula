package com.luohuo.flex.model.vo.result;


/**
 * 用户查询对象
 *
 * @author 乾乾
 * @date 2019-07-10 11:37
 */
public class UserQuery {
    private Long userId;
    private Long employeeId;

    /**
     * 是否查询SysUser对象所有信息，true则通过rpc接口查询
     */
    private Boolean full = false;

    /**
     * 是否 查询角色信息，true则通过rpc接口查询
     */
    private Boolean roles = false;

    /**
     * 是否 查询所属的所有组织信息，true则通过rpc接口查询
     */
    private Boolean org = false;
    /**
     * 是否 查询当前所属的组织信息，true则通过rpc接口查询
     */
    private Boolean currentOrg = false;

    /**
     * 是否 查询员工信息，true则通过rpc接口查询
     */
    private Boolean employee = false;

    /**
     * 是否 查询用户信息，true则通过rpc接口查询
     */
    private Boolean user = true;

    /**
     * 是否 查询岗位信息，true则通过rpc接口查询
     */
    private Boolean position = false;

    /**
     * 是否 查询资源信息，true则通过rpc接口查询
     */
    private Boolean resource = false;

    public static UserQuery buildFull(Long userId, Long employeeId) {
        return new UserQuery().setUserId(userId).setEmployeeId(employeeId).setFull(true);
    }

    public static UserQuery buildRoles(Long userId, Long employeeId) {
        return new UserQuery().setUserId(userId).setEmployeeId(employeeId).setRoles(true);
    }

    public static UserQuery buildOrg(Long userId, Long employeeId) {
        return new UserQuery().setUserId(userId).setEmployeeId(employeeId).setOrg(true);
    }

    public static UserQuery buildPosition(Long userId, Long employeeId) {
        return new UserQuery().setUserId(userId).setEmployeeId(employeeId).setPosition(true);
    }

    public static UserQuery buildResource(Long userId, Long employeeId) {
        return new UserQuery().setUserId(userId).setEmployeeId(employeeId).setResource(true);
    }

    public static UserQuery buildEmployee(Long userId, Long employeeId) {
        return new UserQuery().setUserId(userId).setEmployeeId(employeeId).setEmployee(true);
    }

    public static UserQuery buildUser(Long userId, Long employeeId) {
        return new UserQuery().setUserId(userId).setEmployeeId(employeeId).setUser(true);
    }

    public UserQuery() {}
    public Long getUserId() { return userId; }
    public Long getEmployeeId() { return employeeId; }
    public Boolean getFull() { return full; }
    public Boolean getRoles() { return roles; }
    public Boolean getOrg() { return org; }
    public Boolean getCurrentOrg() { return currentOrg; }
    public Boolean getEmployee() { return employee; }
    public Boolean getUser() { return user; }
    public Boolean getPosition() { return position; }
    public Boolean getResource() { return resource; }
    public UserQuery setUserId(Long userId) { this.userId = userId; return this; }
    public UserQuery setEmployeeId(Long employeeId) { this.employeeId = employeeId; return this; }
    public UserQuery setFull(Boolean full) { this.full = full; return this; }
    public UserQuery setRoles(Boolean roles) { this.roles = roles; return this; }
    public UserQuery setOrg(Boolean org) { this.org = org; return this; }
    public UserQuery setCurrentOrg(Boolean currentOrg) { this.currentOrg = currentOrg; return this; }
    public UserQuery setEmployee(Boolean employee) { this.employee = employee; return this; }
    public UserQuery setUser(Boolean user) { this.user = user; return this; }
    public UserQuery setPosition(Boolean position) { this.position = position; return this; }
    public UserQuery setResource(Boolean resource) { this.resource = resource; return this; }
}
