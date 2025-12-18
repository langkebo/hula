package com.luohuo.flex.im.domain.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 修改用户名
 *
 * @author nyh
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SummeryInfoDTO {
    @Schema(description = "用户拥有的徽章id列表")
    List<Long> itemIds;
    @Schema(description = "用户id")
    private Long uid;
    @Schema(description = "是否需要刷新")
    @Builder.Default
    private Boolean needRefresh = Boolean.TRUE;
    @Schema(description = "用户昵称")
    private String name;
	@Schema(description = "性别")
	private Integer sex;
	@Schema(description = "Hula号")
	private String account;
    @Schema(description = "用户头像")
    private String avatar;
    @Schema(description = "归属地")
    private String locPlace;
	@JsonIgnore
	@Schema(description = "微信openId")
	private String openId;
	@JsonIgnore
	@Schema(description = "邮箱")
	private String email;
	@Schema(description = "个人简介")
	private String resume;
	@Schema(description = "用户状态")
	private Long userStateId;
    @Schema(description = "佩戴的徽章id")
    private Long wearingItemId;
	@Schema(description = "用户类型")
	private Integer userType;
	@Schema(description = "最后一次上下线时间")
	private LocalDateTime lastOptTime;

	public static SummeryInfoDTO skip(Long uid) {
        SummeryInfoDTO dto = new SummeryInfoDTO();
        dto.setUid(uid);
        dto.setNeedRefresh(Boolean.FALSE);
        return dto;
    }

    public Long getUid() {
        return uid;
    }
    public void setUid(Long uid) {
        this.uid = uid;
    }
    public Boolean getNeedRefresh() {
        return needRefresh;
    }
    public void setNeedRefresh(Boolean needRefresh) {
        this.needRefresh = needRefresh;
    }
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
    public Integer getSex() {
        return sex;
    }
    public void setSex(Integer sex) {
        this.sex = sex;
    }
    public String getAccount() {
        return account;
    }
    public void setAccount(String account) {
        this.account = account;
    }
    public String getAvatar() {
        return avatar;
    }
    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }
    public String getLocPlace() {
        return locPlace;
    }
    public void setLocPlace(String locPlace) {
        this.locPlace = locPlace;
    }
    public String getOpenId() {
        return openId;
    }
    public void setOpenId(String openId) {
        this.openId = openId;
    }
    public String getEmail() {
        return email;
    }
    public void setEmail(String email) {
        this.email = email;
    }
    public String getResume() {
        return resume;
    }
    public void setResume(String resume) {
        this.resume = resume;
    }
    public Long getUserStateId() {
        return userStateId;
    }
    public void setUserStateId(Long userStateId) {
        this.userStateId = userStateId;
    }
    public Long getWearingItemId() {
        return wearingItemId;
    }
    public void setWearingItemId(Long wearingItemId) {
        this.wearingItemId = wearingItemId;
    }
    public Integer getUserType() {
        return userType;
    }
    public void setUserType(Integer userType) {
        this.userType = userType;
    }
    public LocalDateTime getLastOptTime() {
        return lastOptTime;
    }
    public void setLastOptTime(LocalDateTime lastOptTime) {
        this.lastOptTime = lastOptTime;
    }
}
