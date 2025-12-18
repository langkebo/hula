package com.luohuo.flex.im.domain.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 修改用户名
 * @author 乾乾
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ItemInfoDTO {

    @Schema(description = "徽章id")
    private Long itemId;

    @Schema(description = "是否需要刷新")
    @Builder.Default
    private Boolean needRefresh = Boolean.TRUE;

	@Schema(description = "徽章图像")
    private String img;

	@Schema(description = "徽章说明")
    private String describe;

    public static ItemInfoDTO skip(Long itemId) {
        ItemInfoDTO dto = new ItemInfoDTO();
        dto.setItemId(itemId);
        dto.setNeedRefresh(Boolean.FALSE);
        return dto;
    }

    public Long getItemId() {
        return itemId;
    }
    public void setItemId(Long itemId) {
        this.itemId = itemId;
    }
    public Boolean getNeedRefresh() {
        return needRefresh;
    }
    public void setNeedRefresh(Boolean needRefresh) {
        this.needRefresh = needRefresh;
    }
    public String getImg() {
        return img;
    }
    public void setImg(String img) {
        this.img = img;
    }
    public String getDescribe() {
        return describe;
    }
    public void setDescribe(String describe) {
        this.describe = describe;
    }
}
